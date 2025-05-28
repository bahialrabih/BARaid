'use strict';

/**
 * Enum for raid types.
 * @readonly
 * @enum {string}
 */
const RAID_TYPES = Object.freeze({
    GrandAssault: 'Grand Assault',
    TotalAssault: 'Total Assault',
});

/**
 * Enum for server indices.
 * @readonly
 * @enum {number}
 */
const SERVERS = Object.freeze({ JP: 0, GLB: 1 });

/**
 * Resource link definitions for raids.
 * @type {Array<{hostname: string, displayname: string, constructRaidUrl: function}>}
 */
const RESOURCES = [
    {
        hostname: 'www.souriki-border.com',
        displayname: 'souriki-border',
        constructRaidUrl: season => {
            const raidTypeInURI = (season.Type === RAID_TYPES.GrandAssault) ? 'decisive_battle' : 'total_assault';
            return `https://${RESOURCES[0].hostname}/${raidTypeInURI}/season/${season.SeasonDisplay}`;
        },
    },
    {
        hostname: 'hina.loves.midokuni.com',
        displayname: 'midokuni',
        constructRaidUrl: season => {
            let raidTypeInURI = 'Raid';
            let seasonPath = season.SeasonDisplay;
            if (season.Type === RAID_TYPES.GrandAssault) {
                raidTypeInURI = 'GrandRaid';
                seasonPath = season.SeasonId;
            }
            return `https://${RESOURCES[1].hostname}/${raidTypeInURI}/JP/${seasonPath}`;
        },
    },
];

const DATA_URL = Object.freeze({
    raids: 'https://schaledb.com/data/en/raids.min.json',
    TACoinIcon: 'https://schaledb.com/images/item/full/item_icon_raidcoin.webp',
    GACoinIcon: 'https://schaledb.com/images/item/full/item_icon_eliminateraidcoin.webp',
});

const longDateFormatArgs = [
    'en-US',
    {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
    },
];

/**
 * Main entry point: fetches data and initializes the controller.
 */
document.addEventListener('DOMContentLoaded', async () => {
    const loadingScreen = document.getElementById('loading-screen');

    try {
        const raidsData = await fetchData(DATA_URL.raids, true);
        if (!raidsData) {
            hideLoadingScreen(loadingScreen);
            return;
        }

        const ctrl = new Controller(raidsData, SERVERS.JP);
        ctrl.constructRaidsTable();
        highlightNextGLBRaid();

        // Hide loading screen after everything is ready
        hideLoadingScreen(loadingScreen);

    } catch (error) {
        console.error('Error loading raids data:', error);
        hideLoadingScreen(loadingScreen);
    }

    document.body.addEventListener('scroll', handleTableHeaderSticky);
});

/**
 * Hides the loading screen with a smooth fade out.
 */
const hideLoadingScreen = (loadingScreen) => {
    if (loadingScreen) {
        loadingScreen.classList.add('hidden');
        // Remove from DOM after transition completes
        setTimeout(() => {
            loadingScreen.remove();
        }, 500);
    }
};

/**
 * Highlights the next upcoming GLB raid row and scrolls to it.
 */
const highlightNextGLBRaid = () => {
    const nextFocusGLBRaid = [...document.querySelectorAll('#raids-table .glb-raid-info')].reduce((acc, el) => {
        const comingIn = parseInt(el.getAttribute('coming-in'), 10);
        if (comingIn > -7 && (acc === null || comingIn < parseInt(acc.getAttribute('coming-in'), 10))) {
            return el;
        }
        return acc;
    }, null);
    if (nextFocusGLBRaid) {
        const tr = nextFocusGLBRaid.closest('tr');
        tr.classList.add('next-glb-raid');
        tr.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    }
};

/**
 * Handles sticky table header on scroll.
 */
const handleTableHeaderSticky = () => {
    const thead = document.querySelector('#raids-table thead');
    if (thead) {
        const rect = thead.getBoundingClientRect();
        if (rect.top <= 0) {
            thead.classList.add('sticky-header');
        } else {
            thead.classList.remove('sticky-header');
        }
    }
};

/**
 * Controller class for managing raid data and table rendering.
 */
class Controller {
    /**
     * @param {Object} rawData - The raw raid data.
     * @param {number} server - The server index (JP or GLB).
     */
    constructor(rawData, server) {
        this.rawData = rawData;
        this.server = server;
        document.querySelector('#raids-table').setAttribute('selected-server', this.server);
        this.raidsData = this.process();
    }

    /**
     * Processes raw data into a structured format for rendering.
     * @returns {Object}
     */
    process() {
        const { rawData, server } = this;
        const data = {};
        data.RaidDefinitions = Object.fromEntries(
            rawData.Raid.map(r => [
                r.Id,
                {
                    Id: r.Id,
                    Name: r.Name,
                    PathName: r.PathName,
                    Terrain: r.Terrain,
                    IconURL: (r.Boss_Portrait_EN0006_Lobby ?? `https://schaledb.com/images/raid/Boss_Portrait_${r.DevName}_Lobby`) + '.png',
                    RaidLink: `https://schaledb.com/raid/${r.PathName}`
                },
            ])
        );

        /**
         * Constructs season data with calculated fields.
         * @param {Object} season
         * @param {string} type
         * @returns {Object}
         */
        const utilConstructSeasonDt = (season, type) => {
            const findMax = (arr, prop) => arr.reduce((prev, current) => (current[prop] > prev[prop] ? current : prev));
            const today = new Date();
            today.setUTCHours(0, 0, 0, 0);
            const msInOneDay = 24 * 60 * 60 * 1000;
            const startDt = new Date(season.Start * 1000);
            startDt.setUTCHours(0, 0, 0, 0);
            const endDt = new Date(season.End * 1000);
            endDt.setUTCHours(0, 0, 0, 0);
            const calcDaysComesIn = s => {
                const sStartDt = new Date(s.Start * 1000);
                sStartDt.setUTCHours(0, 0, 0, 0);
                return (sStartDt - today) / msInOneDay;
            };
            const result = {
                SeasonId: season.SeasonId,
                SeasonDisplay: season.SeasonDisplay,
                Terrain: season.Terrain,
                Start: season.Start,
                End: season.End,
                StartFormatted: startDt.toLocaleDateString(...longDateFormatArgs),
                EndFormatted: endDt.toLocaleDateString(...longDateFormatArgs),
                RaidId: season.RaidId,
                RaidName: data.RaidDefinitions[season.RaidId].Name,
                RaidIconURL: data.RaidDefinitions[season.RaidId].IconURL,
                DaysComesIn: calcDaysComesIn(season),
                GlbDaysComesIn: undefined,
                GLBStatus: undefined,
                Type: type,
            };
            const raidLink = data.RaidDefinitions[season.RaidId].RaidLink;
            result.RaidNameWithIcon = createIconTextContainer(result.RaidName, result.RaidIconURL, raidLink).outerHTML;
            result.TypeWithIcon = createIconTextContainer(type, type === RAID_TYPES.GrandAssault ? DATA_URL.GACoinIcon : DATA_URL.TACoinIcon, null).outerHTML;
            result.Resources = genResourceInnerHtml(result);
            (() => {
                if (server === SERVERS.GLB) return 'Yes';
                const idAdjust = type === RAID_TYPES.GrandAssault ? 0 : -5;
                const propName = type === RAID_TYPES.GrandAssault ? 'EliminateSeasons' : 'Seasons';
                const glbSeason = rawData.RaidSeasons[SERVERS.GLB][propName].find(glbSeason => glbSeason.SeasonId === season.SeasonId + idAdjust);
                let daysUntilRaidInGLB;
                let isDatePredicted;
                if (glbSeason) {
                    isDatePredicted = false;
                    daysUntilRaidInGLB = calcDaysComesIn(glbSeason);
                } else {
                    isDatePredicted = true;
                    const latestAnnouncedGlobalSeason = findMax(rawData.RaidSeasons[SERVERS.GLB][propName], 'Start');
                    const jpEquivOfLatestGLBAnnounced = rawData.RaidSeasons[SERVERS.JP][propName].find(jpSeason => jpSeason.SeasonId + idAdjust === latestAnnouncedGlobalSeason.SeasonId);
                    daysUntilRaidInGLB = calcDaysComesIn(latestAnnouncedGlobalSeason) + result.DaysComesIn - calcDaysComesIn(jpEquivOfLatestGLBAnnounced);
                }
                const glbRaidStartDateF = new Date(today.getTime() + daysUntilRaidInGLB * msInOneDay).toLocaleDateString(...longDateFormatArgs);
                result.GlbDaysComesIn = `<div class="glb-raid-info" coming-in="${daysUntilRaidInGLB}"><div>In ${daysUntilRaidInGLB} days</div><div>${glbRaidStartDateF}</div></div>`;
                result.GLBStatus = isDatePredicted ? 'Predicted' : 'Confirmed';
            })();
            return result;
        };

        data.JPRaidData = [
            ...rawData.RaidSeasons[server].Seasons.map(season => utilConstructSeasonDt(season, RAID_TYPES.TotalAssault)),
            ...rawData.RaidSeasons[server].EliminateSeasons.map(season => utilConstructSeasonDt(season, RAID_TYPES.GrandAssault)),
        ];
        data.JPRaidData.sort((a, b) => b.Start - a.Start);
        return data;
    }

    /**
     * Constructs the raids table in the DOM.
     */
    constructRaidsTable() {
        const table = document.getElementById('raids-table');
        const thead = table.querySelector('thead');
        const tbody = table.querySelector('tbody');
        tbody.innerHTML = '';
        const colProperties = [...thead.querySelectorAll('th')].map(th => th.dataset.propertyName);
        this.raidsData.JPRaidData.forEach((raidDt, rowIndex) => {
            const tr = tbody.insertRow(rowIndex);
            colProperties.forEach((propName, colIdx) => {
                const td = tr.insertCell(colIdx);
                td.innerHTML = typeof raidDt[propName] === 'function' ? raidDt[propName]() : raidDt[propName];
                td.setAttribute('data-property-name', propName);
            });
        });
        table.setAttribute('finished-loading', true);
    }
}

/**
 * Fetches JSON data from a given URL with optional error alerting and timeout.
 * @async
 * @param {string} url - The URL to fetch data from.
 * @param {boolean} [alertOnError=false] - Whether to show an alert on error.
 * @param {number} [timeout=15000] - Timeout in milliseconds before aborting the request.
 * @returns {Promise<Object|null>} The parsed JSON response, or null if an error occurred.
 */
const fetchData = async (url, alertOnError = false, timeout = 15000) => {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (!response.ok) throw new Error(response.statusText);
        return await response.json();
    } catch (error) {
        const msg = `Error fetching data from ${url}: ${error}`;
        console.error(msg);
        if (alertOnError) alert(msg);
        return null;
    }
};

/**
 * Generates an HTML string representing a list of resource links for a given season.
 * @param {Object} season - The season object used to construct resource URLs.
 * @returns {string} The outer HTML of a <ul> element containing <li> elements with resource links.
 */
const genResourceInnerHtml = season => {
    const container = document.createElement('ul');
    RESOURCES.forEach(resource => {
        const li = document.createElement('li');
        const hyperlink = document.createElement('a');
        hyperlink.href = resource.constructRaidUrl(season);
        hyperlink.target = '_blank';
        hyperlink.textContent = resource.displayname;
        hyperlink.style.display = 'block';
        li.append(hyperlink);
        container.append(li);
    });
    return container.outerHTML;
};

/**
 * Creates a container element with an icon and accompanying text.
 * @param {string} text - The text to display next to the icon.
 * @param {string} iconUrl - The URL of the icon image.
 * @returns {HTMLDivElement} A div element containing the icon and text.
 */
const createIconTextContainer = (text, iconUrl, linkUrl) => {
    const container = document.createElement('div');
    container.className = 'icon-text-container';
    const icon = document.createElement('img');
    icon.src = iconUrl;
    icon.alt = '...';
    icon.classList.add('icon');
    const iconText = document.createElement('span');
    iconText.textContent = text;
    container.append(icon, iconText);
    if (linkUrl) {
        const link = document.createElement('a');
        link.href = linkUrl;
        link.target = '_blank';
        link.append(container);
        return link;
    }
    return container;
};
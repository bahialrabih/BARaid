const RAID_TYPES = {
    GrandAssault: 'Grand Assault',
    TotalAssault: 'Total Assault'
};

const SERVERS = { JP: 0, GLB: 1 };

const RESOURCES = [
    {
        hostname: 'www.souriki-border.com',
        displayname: 'souriki-border',
        constructRaidUrl: function(season) {
            const raidTypeInURI = (season.Type === RAID_TYPES.GrandAssault) ? 'decisive_battle' : 'total_assault';
            return `https://${this.hostname}/${raidTypeInURI}/season/${season.SeasonDisplay}`;
        }
    },
    {
        hostname: 'hina.loves.midokuni.com',
        displayname: 'midokuni',
        constructRaidUrl: function(season) {
            let [raidTypeInURI, seasonPath] = ['Raid', season.SeasonDisplay];
            if (season.Type === RAID_TYPES.GrandAssault) {
                [raidTypeInURI, seasonPath] = ['GrandRaid', season.SeasonId];
            }
            return `https://${this.hostname}/${raidTypeInURI}/JP/${seasonPath}`;
        }
    },
]

const DATA_URL = {
    raids: 'https://schaledb.com/data/en/raids.min.json',
    TACoinIcon: 'https://schaledb.com/images/item/full/item_icon_raidcoin.webp',
    GACoinIcon: 'https://schaledb.com/images/item/full/item_icon_eliminateraidcoin.webp',
};

const longDateFormatArgs = [
    'en-US',
    {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
    }
];

document.addEventListener('DOMContentLoaded', async () => {
    const raidsData = await fetchData(DATA_URL.raids, true);
    if (!raidsData) {
        return;
    }
    const ctrl = new Controller(raidsData, SERVERS.JP);
    ctrl.constructRaidsTable();
    const nextFocusGLBRaid = [...document.querySelectorAll('#raids-table .glb-raid-info')].reduce((acc, el) => {
        const comingIn = parseInt(el.getAttribute('coming-in'), 10);
        if (comingIn > -7 &&  (acc === null || comingIn < parseInt(acc.getAttribute('coming-in'), 10))) {
            acc = el;
        }
        return acc;
    }, null);
    if (nextFocusGLBRaid) {
        // add css
        const tr = nextFocusGLBRaid.closest('tr');
        tr.classList.add('next-glb-raid');
        // scroll to the element
        tr.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'nearest'
        });

    }
    document.body.addEventListener('scroll', () => {
        const thead = document.querySelector('#raids-table thead');
        if (thead) {
            const rect = thead.getBoundingClientRect();
            if (rect.top <= 0) {
              thead.classList.add('sticky-header');
            }
            else {
              thead.classList.remove('sticky-header');
            }
        }
    });
});


class Controller {

    constructor(rawData, server) {
        this.rawData = rawData;
        this.server = server;
        document.querySelector('#raids-table').setAttribute('selected-server', this.server);
        this.raidsData = this.process(this.rawData);
    }

    process() {
        const rawData = this.rawData;
        const data = {};
        data.RaidDefinitions = Object.fromEntries(rawData.Raid.map(r => {
            const raid = {
                Id: r.Id, Name: r.Name, PathName: r.PathName, Terrain: r.Terrain,
                IconURL: (r.Boss_Portrait_EN0006_Lobby ?? `https://schaledb.com/images/raid/Boss_Portrait_${r.DevName}_Lobby`) + '.png'
            };
            return [r.Id, raid];
        }));
        const utilConstructSeasonDt = (season, type) => {
            const findMax = (arr, prop) => arr.reduce((prev, current) => (current[prop] > prev[prop]) ? current : prev);
            const today = new Date();
            today.setUTCHours(0, 0, 0, 0);
            const msInOneDay = 24 * 60 * 60 * 1000;
            const startDt = new Date(season.Start * 1000);
            startDt.setUTCHours(0, 0, 0, 0);
            const endDt = new Date(season.End * 1000);
            endDt.setUTCHours(0, 0, 0, 0);
            const calcDaysComesIn = (season) => {
                const startDt = new Date(season.Start * 1000);
                startDt.setUTCHours(0, 0, 0, 0);
                return (startDt - today) / msInOneDay;
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
                DaysComesIn: calcDaysComesIn(season), // (startDt - today) / msInOneDay,
                GlbDaysComesIn: undefined,
                GLBStatus : undefined,
                Type: type
            };
            result.RaidNameWithIcon = createIconTextContainer(result.RaidName, result.RaidIconURL).outerHTML;
            result.TypeWithIcon = createIconTextContainer(type, type === RAID_TYPES.GrandAssault ? DATA_URL.GACoinIcon : DATA_URL.TACoinIcon).outerHTML;
            result.Resources = genResourceInnerHtml(result);
            (() => {
                if (this.server === SERVERS.GLB) {
                    return 'Yes';
                }
                const idAdjust = type === RAID_TYPES.GrandAssault ? 0 : -5;
                const propName = type === RAID_TYPES.GrandAssault ? 'EliminateSeasons' : 'Seasons';
                const glbSeason = rawData.RaidSeasons[SERVERS.GLB][propName].find(glbSeason => glbSeason.SeasonId === season.SeasonId+idAdjust);
                let daysUntilRaidInGLB;
                let isDatePredicted;
                if (glbSeason) {
                    isDatePredicted = false;
                    daysUntilRaidInGLB = calcDaysComesIn(glbSeason);
                }
                else {
                    isDatePredicted = true;
                    let latestAnnouncedGlobalSeason = findMax(rawData.RaidSeasons[SERVERS.GLB][propName], 'Start');
                    const jpEquivOfLatestGLBAnnounced = rawData.RaidSeasons[SERVERS.JP][propName].find(jpSeason => jpSeason.SeasonId+idAdjust === latestAnnouncedGlobalSeason.SeasonId);
                    daysUntilRaidInGLB = calcDaysComesIn(latestAnnouncedGlobalSeason) + result.DaysComesIn - calcDaysComesIn(jpEquivOfLatestGLBAnnounced);
                }
                const glbRaidStartDateF = new Date(today.getTime() + daysUntilRaidInGLB * msInOneDay).toLocaleDateString(...longDateFormatArgs);
                result.GlbDaysComesIn = `<div class="glb-raid-info" coming-in="${daysUntilRaidInGLB}">
                    <div>In ${daysUntilRaidInGLB} days</div>
                    <div>${glbRaidStartDateF}</div>
                </div>`;
                result.GLBStatus = isDatePredicted ? 'Predicted' : 'Confirmed';
                return;
            })();
            return result;
        };
        data.JPRaidData = rawData.RaidSeasons[this.server].Seasons.reduce((acc, season) => {
            const dt = utilConstructSeasonDt(season, RAID_TYPES.TotalAssault);
            acc.push(dt);
            return acc;
        }, []);
        data.JPRaidData = rawData.RaidSeasons[this.server].EliminateSeasons.reduce((acc, season) => {
            const dt = utilConstructSeasonDt(season, RAID_TYPES.GrandAssault);
            acc.push(dt);
            return acc;
        }, data.JPRaidData);
        data.JPRaidData.sort((a,b) => b.Start-a.Start);
        return data;
    }

    constructRaidsTable() {
        // console.log('Data:', this.raidsData);
        const table = document.getElementById('raids-table');
        const thead = table.querySelector('thead');
        const tbody = table.querySelector('tbody');
        tbody.innerHTML = ''; // Clear existing rows
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

async function fetchData(url, alertOnError = false) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(response.statusText);
        }
        return await response.json();
    }
    catch (error) {
        const msg = `Error fetching data from ${url}: ${error}`;
        console.error(msg);
        if (alertOnError) {
            alert(msg);
        }
        return null;
    }
}

function genResourceInnerHtml(season) {
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
}

function createIconTextContainer(text, iconUrl) {
    const container = document.createElement('div');
    container.className = 'icon-text-container';

    const icon = document.createElement('img');
    icon.src = iconUrl;
    icon.alt = '...';
    icon.classList.add('icon');
    const iconText = document.createElement('span');
    iconText.textContent = text;
    container.append(icon);
    container.append(iconText);
    return container;
}
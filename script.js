// Execute when DOM is fully loaded
document.addEventListener('DOMContentLoaded', function() {
    // Update the current year in the footer
    document.getElementById('currentYear').textContent = new Date().getFullYear();
    
    // Show previous click count if exists
    const savedCount = localStorage.getItem('clickCount') || 0;
    if (savedCount > 0) {
        const result = document.getElementById('result');
        result.textContent = `You've previously clicked the button ${savedCount} time(s)!`;
        result.style.opacity = '0.7';
    }
});

// Handle button click
document.getElementById('demoButton').addEventListener('click', function() {
    let result = document.getElementById('result');
    let count = localStorage.getItem('clickCount') || 0;
    count = parseInt(count) + 1;
    localStorage.setItem('clickCount', count);
    
    // Add animation and message
    result.style.opacity = '1';
    result.style.color = getRandomColor();
    result.textContent = `You've clicked the button ${count} time(s)!`;
    
    // Add subtle button animation
    this.classList.add('button-clicked');
    setTimeout(() => this.classList.remove('button-clicked'), 300);
});

// Generate a random color
function getRandomColor() {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}

// offscreen.js
// This script runs in a hidden page and has access to DOM APIs like window.matchMedia

const mql = window.matchMedia('(prefers-color-scheme: dark)');

// Function to notify the background script
function notifyBackground(isDark) {
    chrome.runtime.sendMessage({ 
        type: 'THEME_CHANGED', 
        isDark: isDark 
    });
}

// Initial check
notifyBackground(mql.matches);

// Listen for OS theme changes
mql.addEventListener('change', (e) => {
    notifyBackground(e.matches);
});

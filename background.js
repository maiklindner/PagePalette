// PagePalette Background Script

// We inject CSS when a tab is updated (e.g., finishes loading)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Wait for the page to finish loading before injecting, or inject early.
  // Generally, injecting at "loading" or "complete" both work, but we'll try to apply ASAP.
  if (changeInfo.status === 'loading' || changeInfo.status === 'complete') {
    if (tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('edge://')) {
      checkAndInjectCSS(tabId, tab.url);
    }
  }
});

function checkAndInjectCSS(tabId, url) {
  chrome.storage.sync.get({ rules: [] }, (data) => {
    const rules = data.rules;
    
    // We can inject multiple rules if multiple regexes match
    rules.forEach(rule => {
      // Only inject if the rule is enabled and has valid content
      if (rule.enabled && rule.urlRegex && rule.css) {
        try {
          const regex = new RegExp(rule.urlRegex, 'i');
          if (regex.test(url)) {
            // Inject!
            chrome.scripting.insertCSS({
              target: { tabId: tabId },
              css: rule.css
            }).catch(err => {
              console.error(`Failed to inject CSS for rule ${rule.id}:`, err);
            });
          }
        } catch (e) {
             console.error(`Invalid regex in rule ${rule.id}: ${rule.urlRegex}`, e);
        }
      }
    });
  });
}

// Open options page on extension icon click
chrome.action.onClicked.addListener(() => {
  chrome.runtime.openOptionsPage();
});

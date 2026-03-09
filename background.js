// PagePalette Background Script

// State to track which tab has matched rules and their toggle status
// Format: { tabId: { applicableRules: [...], hasEnabledRules: boolean } }
const tabState = {};

// Migration and initialization
chrome.runtime.onInstalled.addListener(() => {
  migrateSyncToLocal();
});

// Also check on startup to ensure migration happened if onInstalled was missed or for service worker restarts
migrateSyncToLocal();

function migrateSyncToLocal() {
  // Check if rules exist in sync storage
  chrome.storage.sync.get(['rules'], (syncData) => {
    if (syncData.rules && syncData.rules.length > 0) {
      // Check if local storage already has rules to avoid overwriting existing local data
      chrome.storage.local.get(['rules'], (localData) => {
        if (!localData.rules || localData.rules.length === 0) {
          console.log('Migrating rules from sync to local storage...');
          chrome.storage.local.set({ rules: syncData.rules }, () => {
            // Optional: We could clear sync storage here, but keeping it as a backup is safer for now
            // chrome.storage.sync.remove('rules');
            console.log('Migration successful.');
          });
        }
      });
    }
  });
}

// We evaluate rules when a tab is updated (e.g., finishes loading)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading' || changeInfo.status === 'complete') {
    if (tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('edge://')) {
      evaluateRulesForTab(tabId, tab.url);
    }
  }
});

// We also evaluate when switching tabs, so the badge updates correctly
chrome.tabs.onActivated.addListener(({ tabId }) => {
  chrome.tabs.get(tabId, (tab) => {
    if (tab && tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('edge://')) {
      // Small delay to ensure tab url is fresh
      evaluateRulesForTab(tabId, tab.url);
    }
  });
});

function evaluateRulesForTab(tabId, url) {
  chrome.storage.local.get({ rules: [] }, (data) => {
    const rules = data.rules;
    const applicableRules = [];
    
    // Find ALL rules that match the regex, regardless of 'enabled' state
    rules.forEach(rule => {
      if (rule.urlRegex && rule.css) {
        try {
          const regex = new RegExp(rule.urlRegex, 'i');
          if (regex.test(url)) {
            applicableRules.push(rule);
          }
        } catch (e) {
          console.error(`Invalid regex in rule ${rule.id}: ${rule.urlRegex}`, e);
        }
      }
    });

    if (applicableRules.length > 0) {
      const hasEnabledRules = applicableRules.some(r => r.enabled);
      
      // Store state for this tab
      tabState[tabId] = {
        applicableRules: applicableRules,
        hasEnabledRules: hasEnabledRules
      };
      
      if (hasEnabledRules) {
        let count = 0;
        applicableRules.forEach(rule => {
          if (rule.enabled) {
            count++;
            chrome.scripting.executeScript({
              target: { tabId: tabId, allFrames: true },
              func: (ruleId, cssText) => {
                let style = document.getElementById('pagepalette-' + ruleId);
                if (!style) {
                  style = document.createElement('style');
                  style.id = 'pagepalette-' + ruleId;
                  (document.head || document.documentElement).appendChild(style);
                }
                style.textContent = cssText;
              },
              args: [rule.id, rule.css]
            }).catch(() => {});
          }
        });
        updateBadge(tabId, count);
      } else {
        updateBadge(tabId, 0);
      }
    } else {
      // No rules matched
      delete tabState[tabId];
      updateBadge(tabId, 0);
    }
  });
}

// Function to update the extension icon badge
function updateBadge(tabId, count) {
  if (count > 0) {
    chrome.action.setBadgeText({ text: count.toString(), tabId: tabId });
    chrome.action.setBadgeBackgroundColor({ color: '#333333', tabId: tabId });
    if (chrome.action.setBadgeTextColor) {
      chrome.action.setBadgeTextColor({ color: '#eeeeee', tabId: tabId });
    }
  } else {
    // Remove badge completely
    chrome.action.setBadgeText({ text: '', tabId: tabId });
  }
}

// Open options page or toggle styles on extension icon click
chrome.action.onClicked.addListener((tab) => {
  const state = tabState[tab.id];
  
  // If there are applicable rules for this page, toggle them globally
  if (state && state.applicableRules && state.applicableRules.length > 0) {
    chrome.storage.local.get({ rules: [] }, (data) => {
      let rules = data.rules;
      const newEnabledState = !state.hasEnabledRules;
      
      // Update rules in memory and in the fetched storage copy
      state.applicableRules.forEach(appRule => {
        const idx = rules.findIndex(r => r.id === appRule.id);
        if (idx !== -1) {
          rules[idx].enabled = newEnabledState;
          appRule.enabled = newEnabledState; // Update local state copy
        }
      });
      
      // Save globally so it acts like clicking the toggle in settings
      chrome.storage.local.set({ rules: rules }, () => {
        state.hasEnabledRules = newEnabledState;
        
        if (newEnabledState) {
          // Re-inject styles
          state.applicableRules.forEach(rule => {
            chrome.scripting.executeScript({
              target: { tabId: tab.id, allFrames: true },
              func: (ruleId, cssText) => {
                let style = document.getElementById('pagepalette-' + ruleId);
                if (!style) {
                  style = document.createElement('style');
                  style.id = 'pagepalette-' + ruleId;
                  (document.head || document.documentElement).appendChild(style);
                }
                style.textContent = cssText;
              },
              args: [rule.id, rule.css]
            }).catch(() => {});
          });
          updateBadge(tab.id, state.applicableRules.length);
        } else {
          // Remove styles
          state.applicableRules.forEach(rule => {
            chrome.scripting.executeScript({
              target: { tabId: tab.id, allFrames: true },
              func: (ruleId) => {
                const style = document.getElementById('pagepalette-' + ruleId);
                if (style) style.remove();
              },
              args: [rule.id]
            }).catch(() => {});
          });
          updateBadge(tab.id, 0);
        }
      });
    });
  } else {
    // No matching rules for this page -> Open the Options Page
    chrome.runtime.openOptionsPage();
  }
});

// Cleanup memory when a tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  delete tabState[tabId];
});


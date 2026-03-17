// PagePalette Background Script

// State to track which tab has matched rules and their toggle status
// Format: { tabId: { applicableRules: [...], hasEnabledRules: boolean } }
const tabState = {};

/**
 * Ensures all rules have a unique ID. 
 * Migrates legacy rules without IDs and resolves duplicate IDs.
 */
function ensureUniqueIds(rules) {
  let changed = false;
  const seenIds = new Set();
  
  rules.forEach(rule => {
    if (!rule.id || seenIds.has(rule.id)) {
      rule.id = "rule_" + Math.random().toString(36).substr(2, 9) + "_" + Date.now();
      changed = true;
    }
    seenIds.add(rule.id);
  });
  return changed;
}

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

function getMatchingRules(rules, url) {
  const applicableRules = [];
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
  return applicableRules;
}

function evaluateRulesForTab(tabId, url) {
  chrome.storage.local.get({ rules: [] }, (data) => {
    const rules = data.rules;
    const rulesChanged = ensureUniqueIds(rules);
    if (rulesChanged) {
      chrome.storage.local.set({ rules: rules });
    }

    const applicableRules = getMatchingRules(rules, url);

    if (applicableRules.length > 0) {
      const hasEnabledRules = applicableRules.some(r => r.enabled);
      
      // Store state for this tab
      tabState[tabId] = {
        applicableRules: applicableRules,
        hasEnabledRules: hasEnabledRules
      };
      
      // Always process all applicable rules: inject if enabled, remove if disabled
      applicableRules.forEach(rule => {
        if (rule.enabled) {
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
        } else {
          chrome.scripting.executeScript({
            target: { tabId: tabId, allFrames: true },
            func: (ruleId) => {
              const style = document.getElementById('pagepalette-' + ruleId);
              if (style) style.remove();
            },
            args: [rule.id]
          }).catch(() => {});
        }
      });

      if (hasEnabledRules) {
        updateBadge(tabId, applicableRules.length, '#333333');
      } else {
        updateBadge(tabId, applicableRules.length, '#888888');
      }
    } else {
      // No rules matched
      delete tabState[tabId];
      updateBadge(tabId, 0);
    }
  });
}

// Function to update the extension icon badge
function updateBadge(tabId, count, color = '#333333') {
  if (count > 0) {
    chrome.action.setBadgeText({ text: count.toString(), tabId: tabId });
    chrome.action.setBadgeBackgroundColor({ color: color, tabId: tabId });
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
  if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('edge://')) {
    chrome.runtime.openOptionsPage();
    return;
  }

  chrome.storage.local.get({ rules: [] }, (data) => {
    const rules = data.rules;
    ensureUniqueIds(rules);
    const applicableRules = getMatchingRules(rules, tab.url);
    
    // If there are applicable rules for this page, toggle them
    if (applicableRules.length > 0) {
      const hasEnabledRules = applicableRules.some(r => r.enabled);
      const newEnabledState = !hasEnabledRules;
      
      // Update rules directly via reference
      applicableRules.forEach(appRule => {
        appRule.enabled = newEnabledState;
      });
      
      // Save the updated main rules array (which now contains the changed enabled states)
      chrome.storage.local.set({ rules: rules }, () => {
        // Update local state and badge immediately
        tabState[tab.id] = {
          applicableRules: applicableRules.map(r => ({ ...r, enabled: newEnabledState })),
          hasEnabledRules: newEnabledState
        };
        
        applicableRules.forEach(rule => {
          if (newEnabledState) {
            // Inject styles
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
          } else {
            // Remove styles
            chrome.scripting.executeScript({
              target: { tabId: tab.id, allFrames: true },
              func: (ruleId) => {
                const style = document.getElementById('pagepalette-' + ruleId);
                if (style) style.remove();
              },
              args: [rule.id]
            }).catch(() => {});
          }
        });
        
        updateBadge(tab.id, applicableRules.length, newEnabledState ? '#333333' : '#888888');
      });
    } else {
      // No matching rules for this page -> Open the Options Page
      chrome.runtime.openOptionsPage();
    }
  });
});

// Cleanup memory when a tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  delete tabState[tabId];
});


// PagePalette Background Script

// State to track which tab has matched rules and their toggle status
// Format: { tabId: { applicableRules: [...], hasEnabledRules: boolean } }
const tabState = {};

// Cache for rules to eliminate storage latency during navigation (FOUC protection)
let cachedRules = [];
let cachedPreviewRule = null;

function refreshCache(callback) {
  chrome.storage.local.get({ rules: [], previewRule: null }, (data) => {
    cachedRules = data.rules || [];
    cachedPreviewRule = data.previewRule || null;
    if (callback) callback();
  });
}

// Initial load
refreshCache();

// Injection Modes for evaluateRulesForTab
const INJECT_MODE = {
  INITIAL: 'initial',       // At navigation start (FOUC protection)
  LIVE_UPDATE: 'live',      // At storage change (Active editing)
  BADGE_ONLY: 'badge_only'  // At tab switch/complete (No re-injection)
};

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
            console.log('Migration successful.');
          });
        }
      });
    }
  });
}

// Listen for changes in storage to update all matching tabs immediately
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local') {
    if (changes.rules || changes.previewRule) {
      refreshCache(() => {
        // For live preview, we want to update all tabs that could match the new rules
        chrome.tabs.query({}, (tabs) => {
          tabs.forEach(tab => {
            if (tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('edge://')) {
              evaluateRulesForTab(tab.id, tab.url, INJECT_MODE.LIVE_UPDATE);
            }
          });
        });
      });
    }
  }
});

// We evaluate rules as early as possible when a navigation is committed
chrome.webNavigation.onCommitted.addListener((details) => {
  evaluateRulesForTab(details.tabId, details.url, INJECT_MODE.INITIAL, details.frameId);
});

// For SPAs and history state changes, we also want to catch early injection
chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
  evaluateRulesForTab(details.tabId, details.url, INJECT_MODE.INITIAL, details.frameId);
});

// We still check on complete to ensure everything is in sync, but don't re-inject
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    if (tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('edge://')) {
      evaluateRulesForTab(tabId, tab.url, INJECT_MODE.BADGE_ONLY);
    }
  }
});

// We evaluate for badge update when switching tabs
chrome.tabs.onActivated.addListener(({ tabId }) => {
  chrome.tabs.get(tabId, (tab) => {
    // Check for chrome.runtime.lastError or if tab exists
    if (chrome.runtime.lastError || !tab) return;
    if (tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('edge://')) {
      evaluateRulesForTab(tabId, tab.url, INJECT_MODE.BADGE_ONLY);
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

function evaluateRulesForTab(tabId, url, mode = INJECT_MODE.BADGE_ONLY, frameId = null) {
  // Use cached rules if available, otherwise fetch from storage
  if (cachedRules.length > 0 || cachedPreviewRule) {
    processRules(tabId, url, cachedRules, cachedPreviewRule, mode, frameId);
  } else {
    chrome.storage.local.get({ rules: [], previewRule: null }, (data) => {
      if (chrome.runtime.lastError) return;
      processRules(tabId, url, data.rules, data.previewRule, mode, frameId);
    });
  }
}

function processRules(tabId, url, originalRules, previewRule, mode, frameId) {
  // Always clone rules to avoid polluting the global cache
  const rules = originalRules ? [...originalRules.map(r => ({ ...r }))] : [];

  // Ensure unique IDs ONLY if this is not a transient preview (to avoid recursion)
  if (mode !== INJECT_MODE.LIVE_UPDATE) {
    const rulesChanged = ensureUniqueIds(rules);
    if (rulesChanged) {
      chrome.storage.local.set({ rules: rules });
      cachedRules = rules; // Update cache immediately
    }
  }

  // Merge preview rule if it exists (for live preview of unsaved rules)
  if (previewRule) {
    const existingIdx = rules.findIndex(r => r.id === previewRule.id);
    if (existingIdx !== -1) {
      rules[existingIdx] = { ...previewRule };
    } else {
      rules.push({ ...previewRule });
    }
  }

  const applicableRules = getMatchingRules(rules, url);
  const oldState = tabState[tabId];
  const oldRules = oldState ? oldState.applicableRules : [];

  // Identify rules that were removed (either deleted or no longer match the URL)
  const removedRules = oldRules.filter(oldRule => !rules.some(r => r.id === oldRule.id));

  // Identify rules that were disabled but still match (they are in applicableRules but rule.enabled is false)
  // This is already handled by the rule.enabled check below.

  const hasEnabledRules = applicableRules.some(r => r.enabled);

  // Store state for this tab (Only update state for main frame or if we don't have one)
  if (frameId === 0 || frameId === null) {
    tabState[tabId] = {
      applicableRules: applicableRules,
      hasEnabledRules: hasEnabledRules
    };
  }

  // Helper for applying/removing styles
  const target = { tabId: tabId };
  if (frameId !== null) {
    target.frameIds = [frameId];
  } else {
    target.allFrames = true;
  }

  // 1. Cleanup removed rules (Deleted rules)
  removedRules.forEach(rule => {
    chrome.scripting.removeCSS({
      target: target,
      css: rule.css
    }).catch(() => { });

    chrome.scripting.executeScript({
      target: target,
      func: (ruleId) => {
        const style = document.getElementById('pagepalette-' + ruleId);
        if (style) style.remove();
      },
      args: [rule.id]
    }).catch(() => { });
  });

  // 2. Process current rules (Inject or remove based on toggle)
  if (mode === INJECT_MODE.INITIAL || mode === INJECT_MODE.LIVE_UPDATE) {
    applicableRules.forEach(rule => {
      if (rule.enabled) {
            // INITIAL mode uses insertCSS for maximum speed (FOUC prevention)
            // insertCSS at onCommitted applies the style before the page is fully rendered.
            if (mode === INJECT_MODE.INITIAL) {
              chrome.scripting.insertCSS({
                target: target,
                css: rule.css
              }).catch(() => { }); 
            }

            // Also update/inject the ID-based style tag for LIVE_UPDATE synchronization
            // We use executeScript for this because it allows us to handle replacement via specific IDs.
            chrome.scripting.executeScript({
              target: target,
              func: (ruleId, cssText) => {
                let style = document.getElementById('pagepalette-' + ruleId);
                if (!style) {
                  style = document.createElement('style');
                  style.id = 'pagepalette-' + ruleId;
                  (document.head || document.documentElement).appendChild(style);
                }
                if (style.textContent !== cssText) {
                  style.textContent = cssText;
                }
              },
              args: [rule.id, rule.css]
            }).catch(() => { }); 
          } else {
            // Rule disabled: Cleanup
            chrome.scripting.removeCSS({
              target: target,
              css: rule.css
            }).catch(() => { }); 

            chrome.scripting.executeScript({
              target: target,
              func: (ruleId) => {
                const style = document.getElementById('pagepalette-' + ruleId);
                if (style) style.remove();
              },
              args: [rule.id]
            }).catch(() => { }); 
          }
    });
  }

  // Update badge
  if (hasEnabledRules) {
    updateBadge(tabId, applicableRules.length, '#333333');
  } else if (applicableRules.length > 0) {
    updateBadge(tabId, applicableRules.length, '#888888');
  } else {
    updateBadge(tabId, 0);
  }
}

// Function to update the extension icon badge
function updateBadge(tabId, count, color = '#333333') {
  try {
    if (count > 0) {
      chrome.action.setBadgeText({ text: count.toString(), tabId: tabId }, () => {
        if (chrome.runtime.lastError) { /* Tab might be gone */ }
      });
      chrome.action.setBadgeBackgroundColor({ color: color, tabId: tabId }, () => {
        if (chrome.runtime.lastError) { /* Tab might be gone */ }
      });
      if (chrome.action.setBadgeTextColor) {
        chrome.action.setBadgeTextColor({ color: '#eeeeee', tabId: tabId }, () => {
          if (chrome.runtime.lastError) { /* Tab might be gone */ }
        });
      }
    } else {
      // Remove badge completely
      chrome.action.setBadgeText({ text: '', tabId: tabId }, () => {
        if (chrome.runtime.lastError) { /* Tab might be gone */ }
      });
    }
  } catch (e) {
    // Catch-all for unexpected errors in badge update
  }
}

// Rule evaluation and badge updates are handled via storage listeners and webNavigation events.
// The popup (popup.html) handles individual rule toggling.

// Cleanup memory when a tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  delete tabState[tabId];
});


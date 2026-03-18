// DOM Elements
const rulesSection = document.getElementById('rulesSection');
const editorSection = document.getElementById('editorSection');
const rulesList = document.getElementById('rulesList');
const addNewBtn = document.getElementById('addNewBtn');

const editorTitle = document.getElementById('editorTitle');
const ruleNameInput = document.getElementById('ruleName');
const ruleRegexInput = document.getElementById('ruleRegex');
const ruleCssInput = document.getElementById('ruleCss');
const saveRuleBtn = document.getElementById('saveRuleBtn');
const cancelRuleBtn = document.getElementById('cancelRuleBtn');

const exportBtn = document.getElementById('exportBtn');
const importBtn = document.getElementById('importBtn');
const importFile = document.getElementById('importFile');

// State
let allRules = [];
let editingRuleId = null;
let currentMessages = {};
let lastDeletedRule = null;
let toastTimeout = null;
let liveUpdateTimeout = null;

// Utility: Ensure all rules have IDs and resolve duplicates
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

// Drag and Drop Logic
rulesList.addEventListener('dragover', e => {
  e.preventDefault();
  const draggingElement = document.querySelector('.dragging');
  if (!draggingElement) return;
  
  const afterElement = getDragAfterElement(rulesList, e.clientY);
  if (afterElement == null) {
    rulesList.appendChild(draggingElement);
  } else {
    rulesList.insertBefore(draggingElement, afterElement);
  }
});

function getDragAfterElement(container, y) {
  const draggableElements = [...container.querySelectorAll('.rule-card:not(.dragging)')];

  return draggableElements.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) {
      return { offset: offset, element: child };
    } else {
      return closest;
    }
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function getMessage(key) {
  return currentMessages[key] ? currentMessages[key].message : key;
}

function initLocalization(callback) {
  chrome.storage.sync.get({ language: 'auto' }, (data) => {
    let lang = data.language;
    if (lang === 'auto') {
      lang = chrome.i18n.getUILanguage().replace('-', '_');
      const supported = ['en', 'de', 'es', 'fr', 'ja', 'pt_BR', 'zh_CN'];
      if (!supported.includes(lang)) {
        lang = lang.split('_')[0];
        if (!supported.includes(lang)) lang = 'en';
      }
    }
    
    fetch(`/_locales/${lang}/messages.json`)
      .then(res => res.ok ? res.json() : fetch(`/_locales/en/messages.json`).then(r => r.json()))
      .then(messages => {
        currentMessages = messages;
        document.getElementById('langSelect').value = data.language;
        localizeHtmlPage();
        renderRules(); // re-render rules to catch dynamic buttons
        if (callback) callback();
      })
      .catch(err => {
        console.error("Failed to load locales", err);
        if (callback) callback();
      });
  });
}

function localizeHtmlPage() {
  document.title = getMessage('optionsTitle');
  document.getElementById('titleH1').textContent = getMessage('extName');
    document.getElementById('optionsDescription').textContent = chrome.i18n.getMessage('optionsDescription');
  document.querySelector('.rules-header h2').textContent = getMessage('optionsYourRules');
  document.getElementById('addNewBtn').textContent = getMessage('optionsAddNew');
  document.getElementById('exportBtn').textContent = getMessage('optionsBtnExport');
  document.getElementById('importBtn').textContent = getMessage('optionsBtnImport');
  
  if (!editingRuleId) {
    document.getElementById('editorTitle').textContent = getMessage('optionsAddNewRule');
  } else {
    document.getElementById('editorTitle').textContent = getMessage('optionsEditRule');
  }
  
  document.getElementById('labelRuleName').textContent = getMessage('optionsNameLabel');
  document.getElementById('ruleName').placeholder = getMessage('optionsNamePlaceholder');
  
  document.getElementById('labelRuleRegex').textContent = getMessage('optionsRegexLabel');
  document.getElementById('ruleRegex').placeholder = getMessage('optionsRegexPlaceholder');
  document.getElementById('hintRegex').textContent = getMessage('optionsRegexHint');
  
  document.querySelector('label[for="ruleCss"]').textContent = getMessage('optionsCssLabel');
  document.getElementById('saveRuleBtn').textContent = getMessage('optionsBtnSave');
  document.getElementById('cancelRuleBtn').textContent = getMessage('optionsBtnCancel');
  
  // Undo Toast
  document.getElementById('toastMessage').textContent = getMessage('optionsRuleDeleted');
  document.getElementById('toastUndoBtn').textContent = getMessage('optionsUndo');
}

// Initialize
function init() {
  loadRules();
  
  // Event Listeners
  addNewBtn.addEventListener('click', openEditorForNew);
  cancelRuleBtn.addEventListener('click', closeEditor);
  saveRuleBtn.addEventListener('click', saveRule);
  
  exportBtn.addEventListener('click', exportRules);
  importBtn.addEventListener('click', () => importFile.click());
  importFile.addEventListener('change', importRules);
  
  document.getElementById('toastUndoBtn').addEventListener('click', undoDelete);
  
  // Live Preview listener
  ruleCssInput.addEventListener('input', triggerLiveUpdate);
  ruleRegexInput.addEventListener('input', triggerLiveUpdate);
}

// Load rules from storage
function loadRules() {
  chrome.storage.local.get({ rules: [] }, (data) => {
    allRules = data.rules;
    if (ensureUniqueIds(allRules)) {
      saveToStorage();
    }
    renderRules();
  });
}

// Render the rules list
function renderRules() {
  rulesList.innerHTML = '';
  
  if (allRules.length === 0) {
    rulesList.innerHTML = '<p>' + escapeHTML(getMessage('optionsNoRules')) + '</p>';
    exportBtn.disabled = true;
    return;
  }
  exportBtn.disabled = false;

  allRules.forEach(rule => {
    const card = document.createElement('div');
    card.className = 'rule-card';
    card.dataset.id = rule.id;
    card.draggable = true;

    card.addEventListener('dragstart', () => {
      card.classList.add('dragging');
    });

    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
      // Update state based on new DOM order
      const reorderedIds = [...rulesList.querySelectorAll('.rule-card')].map(c => c.dataset.id);
      allRules = reorderedIds.map(id => allRules.find(r => r.id === id)).filter(Boolean);
      saveToStorage();
    });
    
    // Preview a snippet of CSS
    const cssPreview = rule.css.replace(/[\n\r]/g, ' ').substring(0, 80) + '...';
    const displayName = rule.name || rule.urlRegex;

    card.innerHTML = `
      <div class="rule-info">
        <div class="rule-regex">${escapeHTML(displayName)}</div>
        ${rule.name ? `<div class="rule-css-preview">${escapeHTML(rule.urlRegex)}</div>` : ''}
        <div class="rule-css-preview">${escapeHTML(cssPreview)}</div>
      </div>
      <div class="rule-actions">
        <label class="switch" title="Toggle active status">
          <input type="checkbox" class="toggle-rule-btn" data-id="${rule.id}" ${rule.enabled ? 'checked' : ''}>
          <span class="slider"></span>
        </label>
        <button class="secondary-btn edit-rule-btn" data-id="${rule.id}">${escapeHTML(getMessage('optionsBtnEdit'))}</button>
        <button class="danger-btn delete-rule-btn" data-id="${rule.id}">${escapeHTML(getMessage('optionsBtnDelete'))}</button>
      </div>
    `;
    rulesList.appendChild(card);
  });

  // Attach listeners to new buttons
  document.querySelectorAll('.edit-rule-btn').forEach(btn => {
    btn.addEventListener('click', (e) => openEditorForEdit(e.target.dataset.id));
  });
  
  document.querySelectorAll('.delete-rule-btn').forEach(btn => {
    btn.addEventListener('click', (e) => deleteRule(e.target.dataset.id));
  });

  document.querySelectorAll('.toggle-rule-btn').forEach(checkbox => {
    checkbox.addEventListener('change', (e) => toggleRule(e.target.dataset.id, e.target.checked));
  });
}

// Open editor to create a new rule
function openEditorForNew() {
  editingRuleId = "rule_new_" + Date.now(); // Temporary ID for live preview
  editorTitle.textContent = getMessage('optionsAddNewRule');
  ruleNameInput.value = '';
  ruleRegexInput.value = '';
  ruleCssInput.value = '';
  
  rulesSection.classList.add('hidden');
  editorSection.classList.remove('hidden');
}

// Open editor to modify an existing rule
function openEditorForEdit(id) {
  const rule = allRules.find(r => r.id === id);
  if (!rule) return;

  editingRuleId = id;
  editorTitle.textContent = getMessage('optionsEditRule');
  ruleNameInput.value = rule.name || '';
  ruleRegexInput.value = rule.urlRegex;
  ruleCssInput.value = rule.css;
  
  rulesSection.classList.add('hidden');
  editorSection.classList.remove('hidden');
}

// Close the editor
function closeEditor() {
  editingRuleId = null;
  rulesSection.classList.remove('hidden');
  editorSection.classList.add('hidden');
  loadRules(); // Reload to revert any unsaved live changes
}

// Save the rule
function saveRule() {
  const nameValue = ruleNameInput.value.trim();
  const regexValue = ruleRegexInput.value.trim();
  const cssValue = ruleCssInput.value.trim();

  if (!regexValue || !cssValue) {
    showToast(getMessage('errorMissingFields'));
    return;
  }

  // Basic regex validation
  try {
    new RegExp(regexValue);
  } catch (e) {
    showToast(getMessage('errorInvalidRegex'));
    return;
  }

  // If we were editing an existing rule (not a temporary preview ID)
  if (editingRuleId && !editingRuleId.startsWith('rule_new_')) {
    // Edit existing
    const ruleIndex = allRules.findIndex(r => r.id === editingRuleId);
    if (ruleIndex !== -1) {
      allRules[ruleIndex].name = nameValue;
      allRules[ruleIndex].urlRegex = regexValue;
      allRules[ruleIndex].css = cssValue;
    }
  } else {
    // Create new (replaces any temporary preview ID with a permanent one)
    allRules.push({
      id: "rule_" + Date.now().toString(),
      name: nameValue,
      urlRegex: regexValue,
      css: cssValue,
      enabled: true
    });
  }

  editingRuleId = null;
  saveToStorage(() => {
    closeEditor();
    renderRules();
  });
}

// Show a unified toast notification
function showToast(message, duration = 5000, undoAction = null) {
  const toast = document.getElementById('toast');
  const toastMessage = document.getElementById('toastMessage');
  const toastUndoBtn = document.getElementById('toastUndoBtn');

  // Clear previous timeout
  if (toastTimeout) {
    clearTimeout(toastTimeout);
  }

  toastMessage.textContent = message;
  
  if (undoAction) {
    toastUndoBtn.classList.remove('hidden');
    toastUndoBtn.onclick = () => {
      undoAction();
      hideToast();
    };
  } else {
    toastUndoBtn.classList.add('hidden');
  }

  toast.classList.remove('hidden');

  toastTimeout = setTimeout(hideToast, duration);
}

function hideToast() {
  const toast = document.getElementById('toast');
  toast.classList.add('hidden');
  if (toastTimeout) {
    clearTimeout(toastTimeout);
    toastTimeout = null;
  }
}

// Delete a rule with Undo
function deleteRule(id) {
  const index = allRules.findIndex(r => r.id === id);
  if (index === -1) return;

  // Save for undo
  lastDeletedRule = {
    rule: { ...allRules[index] },
    index: index
  };

  // Remove immediately from UI
  allRules.splice(index, 1);
  renderRules();
  saveToStorage();

  // Show toast with undo
  showToast(getMessage('optionsRuleDeleted'), 5000, undoDelete);
}

// Undo the deletion
function undoDelete() {
  if (!lastDeletedRule) return;

  // Restore rule
  allRules.splice(lastDeletedRule.index, 0, lastDeletedRule.rule);
  lastDeletedRule = null;
  
  renderRules();
  saveToStorage();
}

// Toggle a rule on/off
function toggleRule(id, isEnabled) {
  const rule = allRules.find(r => r.id === id);
  if (rule) {
    rule.enabled = isEnabled;
    saveToStorage();
  }
}

// Trigger a debounced update for live preview
function triggerLiveUpdate() {
  if (liveUpdateTimeout) clearTimeout(liveUpdateTimeout);
  
  liveUpdateTimeout = setTimeout(() => {
    const regexValue = ruleRegexInput.value.trim();
    const cssValue = ruleCssInput.value.trim();
    
    if (!regexValue || !cssValue) return;
    
    // Check if regex is valid before attempting update
    try {
      new RegExp(regexValue);
    } catch (e) {
      return; 
    }

    // Update the rule in memory
    let rule = allRules.find(r => r.id === editingRuleId);
    if (!rule) {
      // It's a new rule being previewed - always allow preview
      rule = {
        id: editingRuleId,
        name: ruleNameInput.value.trim(),
        urlRegex: regexValue,
        css: cssValue,
        enabled: true
      };
      const previewRules = [...allRules, rule];
      chrome.storage.local.set({ rules: previewRules });
    } else {
      // For existing rules, only trigger live preview if it's currently enabled
      if (rule.enabled) {
        rule.urlRegex = regexValue;
        rule.css = cssValue;
        saveToStorage();
      }
    }
  }, 300); // 300ms debounce
}

// Dump to chrome.storage
function saveToStorage(callback) {
  chrome.storage.local.set({ rules: allRules }, () => {
    if (callback) callback();
  });
}

// Export rules to JSON
function exportRules() {
  const dataStr = JSON.stringify(allRules, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `pagepalette-rules-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  
  URL.revokeObjectURL(url);
}

// Import rules from JSON
function importRules(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const importedRules = JSON.parse(event.target.result);
      
      if (!Array.isArray(importedRules)) {
        throw new Error('Invalid format');
      }

      // Basic validation and merging
      // We'll append them, but you could also overwrite
      // For now, let's merge and ensure unique IDs if needed, 
      // but keeping original IDs is also fine if they don't collide.
      // Actually, it's safer to generate new IDs if they collide or just overwrite.
      // The user probably wants to ADD these rules.
      
      importedRules.forEach(rule => {
        if (rule.urlRegex && rule.css) {
          // If ID exists and collides, generate new one
          if (rule.id && allRules.some(r => r.id === rule.id)) {
            rule.id = "rule_" + Math.random().toString(36).substr(2, 9) + "_" + Date.now();
          }
          allRules.push(rule);
        }
      });
      
      ensureUniqueIds(allRules);

      saveToStorage(() => {
        renderRules();
        showToast(getMessage('optionsImportSuccess'));
      });
    } catch (err) {
      console.error(err);
      showToast(getMessage('optionsImportError'));
    }
    // Reset file input
    importFile.value = '';
  };
  reader.readAsText(file);
}

// Utility: Prevent XSS in preview
function escapeHTML(str) {
  const div = document.createElement('div');
  div.innerText = str;
  return div.innerHTML;
}

// Boot
document.addEventListener('DOMContentLoaded', () => {
  initLocalization(() => {
    init();
  });
  
  document.getElementById('langSelect').addEventListener('change', (e) => {
    chrome.storage.sync.set({ language: e.target.value }, () => {
      initLocalization();
    });
  });

  // Keep rules in sync with storage (e.g., if toggled via toolbar)
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.rules) {
      const newRules = changes.rules.newValue;
      
      if (!editingRuleId) {
        allRules = newRules;
        renderRules();
      } else {
        // If we're editing, we want to stay in sync with the enabled status (from toolbar)
        // but avoid overwriting our current editor fields or starting an infinite loop.
        let statusChanged = false;
        newRules.forEach(newRule => {
          const localRule = allRules.find(r => r.id === newRule.id);
          if (localRule) {
            if (localRule.enabled !== newRule.enabled) {
              localRule.enabled = newRule.enabled;
              statusChanged = true;
            }
          } else {
            // A rule was added or deleted elsewhere
            allRules = newRules;
            statusChanged = true;
          }
        });

        // If the enabled status of our current rule changed via toolbar, 
        // we might now need to trigger a live update with our current CSS.
        const currentRule = allRules.find(r => r.id === editingRuleId);
        if (statusChanged && currentRule && currentRule.enabled) {
          triggerLiveUpdate();
        }
      }
    }
  });
});

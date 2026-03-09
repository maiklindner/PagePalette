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
  document.getElementById('descText').textContent = getMessage('optionsDesc');
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
}

// Load rules from storage
function loadRules() {
  chrome.storage.local.get({ rules: [] }, (data) => {
    allRules = data.rules;
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
  editingRuleId = null;
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
  rulesSection.classList.remove('hidden');
  editorSection.classList.add('hidden');
}

// Save the rule
function saveRule() {
  const nameValue = ruleNameInput.value.trim();
  const regexValue = ruleRegexInput.value.trim();
  const cssValue = ruleCssInput.value.trim();

  if (!regexValue || !cssValue) {
    alert(getMessage('errorMissingFields'));
    return;
  }

  // Basic regex validation
  try {
    new RegExp(regexValue);
  } catch (e) {
    alert(getMessage('errorInvalidRegex'));
    return;
  }

  if (editingRuleId) {
    // Edit existing
    const ruleIndex = allRules.findIndex(r => r.id === editingRuleId);
    if (ruleIndex !== -1) {
      allRules[ruleIndex].name = nameValue;
      allRules[ruleIndex].urlRegex = regexValue;
      allRules[ruleIndex].css = cssValue;
    }
  } else {
    // Create new
    allRules.push({
      id: "rule_" + Date.now().toString(),
      name: nameValue,
      urlRegex: regexValue,
      css: cssValue,
      enabled: true
    });
  }

  saveToStorage(() => {
    closeEditor();
    renderRules();
  });
}

// Delete a rule
function deleteRule(id) {
  if (confirm(getMessage('confirmDelete'))) {
    allRules = allRules.filter(r => r.id !== id);
    saveToStorage(() => {
      renderRules();
    });
  }
}

// Toggle a rule on/off
function toggleRule(id, isEnabled) {
  const rule = allRules.find(r => r.id === id);
  if (rule) {
    rule.enabled = isEnabled;
    saveToStorage();
  }
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
          // If ID exists, generate new one to avoid collisions
          if (!rule.id || allRules.some(r => r.id === rule.id)) {
            rule.id = "rule_" + Math.random().toString(36).substr(2, 9) + "_" + Date.now();
          }
          allRules.push(rule);
        }
      });

      saveToStorage(() => {
        renderRules();
        alert(getMessage('optionsImportSuccess'));
      });
    } catch (err) {
      console.error(err);
      alert(getMessage('optionsImportError'));
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
});

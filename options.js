// DOM Elements
const rulesSection = document.getElementById('rulesSection');
const editorSection = document.getElementById('editorSection');
const rulesList = document.getElementById('rulesList');
const addNewBtn = document.getElementById('addNewBtn');

const editorTitle = document.getElementById('editorTitle');
const ruleRegexInput = document.getElementById('ruleRegex');
const ruleCssInput = document.getElementById('ruleCss');
const saveRuleBtn = document.getElementById('saveRuleBtn');
const cancelRuleBtn = document.getElementById('cancelRuleBtn');

// State
let allRules = [];
let editingRuleId = null;

// Initialize
function init() {
  loadRules();
  
  // Event Listeners
  addNewBtn.addEventListener('click', openEditorForNew);
  cancelRuleBtn.addEventListener('click', closeEditor);
  saveRuleBtn.addEventListener('click', saveRule);
}

// Load rules from storage
function loadRules() {
  chrome.storage.sync.get({ rules: [] }, (data) => {
    allRules = data.rules;
    renderRules();
  });
}

// Render the rules list
function renderRules() {
  rulesList.innerHTML = '';
  
  if (allRules.length === 0) {
    rulesList.innerHTML = '<p>No rules defined yet.</p>';
    return;
  }

  allRules.forEach(rule => {
    const card = document.createElement('div');
    card.className = 'rule-card';
    
    // Preview a snippet of CSS
    const cssPreview = rule.css.replace(/[\n\r]/g, ' ').substring(0, 80) + '...';

    card.innerHTML = `
      <div class="rule-info">
        <div class="rule-regex">${escapeHTML(rule.urlRegex)}</div>
        <div class="rule-css-preview">${escapeHTML(cssPreview)}</div>
      </div>
      <div class="rule-actions">
        <label class="switch" title="Toggle active status">
          <input type="checkbox" class="toggle-rule-btn" data-id="${rule.id}" ${rule.enabled ? 'checked' : ''}>
          <span class="slider"></span>
        </label>
        <button class="secondary-btn edit-rule-btn" data-id="${rule.id}">Edit</button>
        <button class="danger-btn delete-rule-btn" data-id="${rule.id}">Delete</button>
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
  editorTitle.textContent = 'Add New Rule';
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
  editorTitle.textContent = 'Edit Rule';
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
  const regexValue = ruleRegexInput.value.trim();
  const cssValue = ruleCssInput.value.trim();

  if (!regexValue || !cssValue) {
    alert("Please provide both a URL regular expression and CSS.");
    return;
  }

  // Basic regex validation
  try {
    new RegExp(regexValue);
  } catch (e) {
    alert("Invalid Regular Expression.");
    return;
  }

  if (editingRuleId) {
    // Edit existing
    const ruleIndex = allRules.findIndex(r => r.id === editingRuleId);
    if (ruleIndex !== -1) {
      allRules[ruleIndex].urlRegex = regexValue;
      allRules[ruleIndex].css = cssValue;
    }
  } else {
    // Create new
    allRules.push({
      id: "rule_" + Date.now().toString(),
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
  if (confirm("Are you sure you want to delete this rule?")) {
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
  chrome.storage.sync.set({ rules: allRules }, () => {
    if (callback) callback();
  });
}

// Utility: Prevent XSS in preview
function escapeHTML(str) {
  const div = document.createElement('div');
  div.innerText = str;
  return div.innerHTML;
}

// Boot
document.addEventListener('DOMContentLoaded', init);

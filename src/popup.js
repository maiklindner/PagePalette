let currentMessages = {};
let allRules = [];
let activeTab = null;

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
                localizeHtmlPage();
                if (callback) callback();
            })
            .catch(err => {
                console.error("Failed to load locales", err);
                if (callback) callback();
            });
    });
}

function localizeHtmlPage() {
    document.getElementById('popupTitle').textContent = getMessage('extName');
    document.getElementById('optionsBtn').title = getMessage('optionsTitle');
    document.getElementById('noMatchingLoc').textContent = getMessage('popupNoMatching');
    document.getElementById('addNewLoc').textContent = getMessage('optionsAddNew');
}

async function init() {
    // Get current tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    activeTab = tab;

    // Load rules
    chrome.storage.local.get({ rules: [] }, (data) => {
        allRules = data.rules;
        renderRules();
    });

    // Listeners
    document.getElementById('optionsBtn').addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
    });

    document.getElementById('addNewBtn').addEventListener('click', () => {
        const url = activeTab ? activeTab.url : '';
        const domain = url ? new URL(url).hostname : '';
        chrome.tabs.create({ 
            url: `options.html?action=new&url=${encodeURIComponent(url)}&domain=${encodeURIComponent(domain)}` 
        });
    });
}

function renderRules() {
    const container = document.getElementById('matchingRulesContainer');
    const noRulesMsg = document.getElementById('noRulesMsg');
    
    if (!activeTab || !activeTab.url) return;

    const matchingRules = allRules.filter(rule => {
        try {
            return new RegExp(rule.urlRegex).test(activeTab.url);
        } catch (e) {
            return false;
        }
    });

    if (matchingRules.length === 0) {
        noRulesMsg.classList.remove('hidden');
        return;
    }

    noRulesMsg.classList.add('hidden');
    container.innerHTML = '';

    matchingRules.forEach(rule => {
        const item = document.createElement('div');
        item.className = 'rule-item';
        
        const info = document.createElement('div');
        info.className = 'rule-info';
        
        const name = document.createElement('div');
        name.className = 'rule-name';
        name.textContent = rule.name || rule.urlRegex;
        
        const regex = document.createElement('div');
        regex.className = 'rule-regex';
        regex.textContent = rule.urlRegex;
        
        info.appendChild(name);
        info.appendChild(regex);
        
        const actions = document.createElement('div');
        actions.className = 'rule-actions';

        const editBtn = document.createElement('button');
        editBtn.className = 'icon-btn edit-btn';
        editBtn.title = getMessage('optionsBtnEdit');
        editBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>';
        editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            chrome.tabs.create({ 
                url: `options.html?action=edit&id=${encodeURIComponent(rule.id)}` 
            });
        });
        
        const switchLabel = document.createElement('label');
        switchLabel.className = 'switch';
        
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = rule.enabled;
        input.addEventListener('change', () => toggleRule(rule.id, input.checked));
        
        const slider = document.createElement('span');
        slider.className = 'slider';
        
        switchLabel.appendChild(input);
        switchLabel.appendChild(slider);
        
        actions.appendChild(editBtn);
        actions.appendChild(switchLabel);

        item.appendChild(info);
        item.appendChild(actions);
        container.appendChild(item);
    });
}

function toggleRule(id, enabled) {
    const rule = allRules.find(r => r.id === id);
    if (rule) {
        rule.enabled = enabled;
        chrome.storage.local.set({ rules: allRules });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initLocalization(() => {
        init();
    });
});

(function() {
  // Use local storage for speed and to avoid sync limits
  chrome.storage.local.get({ rules: [] }, (data) => {
    const url = window.location.href;
    const rules = data.rules || [];
    
    rules.forEach(rule => {
      if (rule.enabled && rule.urlRegex && rule.css) {
        try {
          const regex = new RegExp(rule.urlRegex, 'i');
          if (regex.test(url)) {
            // Apply CSS immediately
            const style = document.createElement('style');
            style.id = 'pagepalette-inject-' + rule.id;
            style.textContent = rule.css;
            
            // Appending to documentElement ensures it's applied even if <head>
            // hasn't been fully parsed yet (at document_start).
            (document.head || document.documentElement).appendChild(style);
          }
        } catch (e) {
          // Ignore invalid regexes during early injection
        }
      }
    });
  });
})();

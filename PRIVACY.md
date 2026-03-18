### ## Deutsch

**Datenschutzrichtlinie für die Erweiterung "PagePalette"**

Diese Datenschutzrichtlinie beschreibt, wie die Browser-Erweiterung "PagePalette" (im Folgenden "die Erweiterung" genannt) mit Daten umgeht.

Der Schutz deiner Privatsphäre ist uns sehr wichtig. Die Erweiterung wurde nach dem Prinzip der Datensparsamkeit entwickelt. Es werden nur die Daten verarbeitet, die absolut notwendig sind.

**1. Welche Daten werden erfasst?**

Die Erweiterung erfasst und speichert die folgenden Informationen:

*   **Deine Regeln:** Die von dir festgelegten URL-Muster (Regular Expressions) und die zugehörigen CSS-Stile, die auf diesen Seiten angewendet werden sollen.

Die Erweiterung erfasst, sammelt oder verarbeitet **keine** persönlichen Daten, E-Mail-Adressen, Identifikatoren oder Browser-Verläufe. 

**2. Wie und wo werden die Daten gespeichert?**

Alle oben genannten Daten werden ausschließlich in deinem Browser gespeichert.

*   Deine **eingestellten CSS-Regeln** werden mit der `chrome.storage.sync` API gespeichert. Das bedeutet, die Daten werden sicher über dein Browser-Konto synchronisiert, sodass deine Einstellungen auf allen deinen Geräten verfügbar sind. **Der Entwickler hat keinen Zugriff auf diese Daten.**

**3. Datenübertragung**

Es findet **keine Datenübertragung an den Entwickler oder Dritte** statt. Die Erweiterung arbeitet zu 100 % lokal in deinem Browser. Es gibt keine Analyse-Tools, Third-Party-Tracker, oder externe Font-Dienste.

**4. Notwendige Berechtigungen und deren Zweck**

Bei der Installation bittet die Erweiterung um folgende Berechtigungen:

*   **`tabs` & `*://*/*` (host_permissions)**: Wird benötigt, um die URL des gerade geöffneten Tabs auszulesen und mit deinen definierten Regeln abzugleichen, sowie um das CSS in die Seite zu injizieren. Die Erweiterung liest nicht den Inhalt deiner Webseiten (wie Texte, Passwörter oder Formulareingaben).
*   **`storage`**: Wird benötigt, um deine CSS-Regeln zu speichern.
*   **`scripting`**: Wird benötigt, um das CSS-Styling physisch auf die abgerufene Seite anzuwenden.
*   **`webNavigation`**: Wird benötigt, um URL-Änderungen bereits beim frühestmöglichen Zeitpunkt der Seitennavigation zu erkennen, um Anzeigeverzögerungen (Flash of Unstyled Content) zu vermeiden.

**5. Kontakt**

Wenn du Fragen zu dieser Datenschutzrichtlinie hast, kontaktiere bitte den Entwickler.

***

### ## English

**Privacy Policy for the "PagePalette" Extension**

This Privacy Policy describes how the "PagePalette" browser extension (hereafter "the extension") handles data.

Protecting your privacy is very important to us. The extension was developed following the principle of data minimization. Only the absolute necessary data is processed.

**1. What Data Is Collected?**

The extension collects and stores the following information:

*   **Your Rules:** The URL patterns (Regular Expressions) and the corresponding CSS styles you have defined to be applied on those pages.

The extension does **not** collect, gather, or process any personal data, email addresses, identifiers, or browsing history.

**2. How and Where Is Data Stored?**

All the data mentioned above is stored exclusively within your browser.

*   Your **custom CSS rules** are stored using the `chrome.storage.sync` API. This means the data is securely synchronized via your browser account, making your settings available across your devices. **The developer has no access to this data.**

**3. Data Transmission**

There is **no data transmission to the developer or third parties**. The extension works 100% locally in your browser. There are no analytics tools, third-party trackers, or external font services.

**4. Required Permissions and Their Purpose**

During installation, the extension requests the following permissions:

*   **`tabs` & `*://*/*` (host_permissions)**: Required to read the URL of the currently open tab to match it against your defined rules, and to inject the CSS into the page. The extension does not read the content of your websites (such as text, passwords, or form inputs).
*   **`storage`**: Required to save your custom CSS rules.
*   **`scripting`**: Required to physically apply the CSS styling to the matching page.
*   **`webNavigation`**: Required to detect URL changes at the earliest possible stage of navigation to apply CSS styling and prevent display delays (Flash of Unstyled Content).

**5. Contact**

If you have any questions about this Privacy Policy, please contact the developer.

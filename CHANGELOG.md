# Changelog - PagePalette

All notable changes to this project will be documented in this file.

## [1.6.1] - 2026-03-20

### Fixed
- **FOUC Glitch**: Switched to `chrome.scripting.insertCSS` for initial navigation, which applies styles before the page renders, eliminating the "Original Content Glitch".
- **Iframe Styling**: Enabled rule evaluation for all frames via `webNavigation` listeners, ensuring that iframes are correctly styled immediately upon loading.

## [1.6.0] - 2026-03-19

### Added
- **Rules Management Popup**: A new interactive popup (styled after FeeFier) that lists all matching rules for the current website.
- **Individual Rule Toggles**: Rules can now be enabled or disabled individually directly from the popup.
- **Direct Rule Editing**: Clicking on a rule in the popup now jumps directly to its editor in the settings.
- **Smart Rule Creation**: The "Add New Rule" button in the popup now automatically opens the editor with a suggested RegEx for the current domain.

### Changed
- **New Interaction Model**: Clicking the extension icon now opens the popup instead of immediately toggling all styles.

### Fixed
- **Double Padding**: Fixed editor layout issues with Prism.js integration.
- **Editor Scrolling**: Fixed scrolling and alignment between textarea and highlight layer.
- **Navigation Logic**: Fixed "Cancel" button behavior when navigating via deep-links from the popup.
- **Label Alignment**: Corrected various UI spacing and alignment issues.

## [1.5.0] - 2026-03-19

### Added
- **CSS Syntax Highlighting**: Integrated Prism.js into the rule editor for real-time CSS highlighting.
- **Improved Editor**: Added Tab-key support and scroll synchronization for a better editing experience.

## [1.4.3] - 2026-03-19

### Fixed
- **Duplicate Rule Suppression**: Fixed an issue where new rules were created twice due to Live Preview conflicts. Temporary previews are now isolated from the permanent list.

## [1.4.2] - 2026-03-18

### Changed
- **Screenshot Refinement**: Centralized and localized demo data in `locales.json` for high-quality screenshots.
- **Fixed**: Corrected property mapping for RegEx patterns in screenshots.

## [1.4.1] - 2026-03-17

### Fixed
- **Console Error**: Fixed a `TypeError` in the options page where it couldn't find the `undoBtn` element after it was renamed to `toastUndoBtn`.

## [1.4] - 2026-03-17

### Added
- **Undo Deletion**: Replaced the deletion confirmation dialog with a modern "Undo" toast, allowing you to quickly restore accidentally deleted rules.

### Fixed
- **Robust Multi-Rule Toggle**: Fixed an issue where the icon click would only toggle one of multiple matching rules.
- **Hibernation Resilience**: The extension now works reliably even after the Service Worker hibernates.
- **Data Integrity**: Automatically fixes duplicate or missing rule IDs in legacy data for a smoother experience.

## [1.3] - 2026-03-17

### Added
- **Rule Reordering**: You can now reorder your CSS rules directly on the options page using drag and drop. 
- **Auto-Save**: The new order is automatically saved when you drop a rule.

## [1.2] - 2026-03-09

### Changed
- **UI Refinements**: The Export button now correctly reflects its disabled state visually when no rules are present.
- **Project Structure**: Optimized internal directory structure for better maintainability.

---

## [1.1] - 2026-03-09

### Added
- **Rule Naming**: You can now give your CSS rules descriptive names (e.g., "Google Dark Mode") to stay organized.
- **Import & Export**: Easily backup your entire rule collection or sync it manually between devices using JSON files.
- **Internationalization**: Full support for German, Spanish, French, Japanese, Portuguese, and Chinese.

### Changed
- **Storage Migration**: Switched to a more robust local storage system. This allows for much larger CSS rules without hitting the old "quota exceeded" limits.

---

## [1.0] - 2026-03-05

### Added
- Initial release of PagePalette.
- Custom CSS injection based on URL Regular Expressions.
- Simple options page for rule management.
- Real-time application of styles.
- Privacy-focused: 100% offline and no data tracking.

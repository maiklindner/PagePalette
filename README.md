# PagePalette 🎨

[![Manifest V3](https://img.shields.io/badge/Manifest-V3-orange)]()
[![Privacy](https://img.shields.io/badge/Privacy-Friendly-green)](PRIVACY.md)

**PagePalette** is a lightweight browser extension that lets you customize your favorite websites by automatically injecting specific CSS styles based on URL rules.

## Features

- **Custom Styles:** Add your own CSS to any website to hide annoying elements, change colors, or adjust layouts.
- **Regex Support:** Match exact URLs or broad domains using Regular Expressions.
- **Easy Toggle:** Quickly disable or enable rules without deleting them.
- **Privacy First:** 100% offline. No data is sent to external servers. Your synced rules never leave your browser account.

## Installation

### For Developers (Unpacked Extension)
1. Download or clone this repository.
2. Open your browser and go to the extensions page (e.g., `chrome://extensions/` or `edge://extensions/`).
3. Enable **Developer mode** in the top right corner.
4. Click on **Load unpacked**.
5. Select the folder containing this repository.

## Usage

1. Click on the extension icon in your browser toolbar to open the **Options Page**.
2. Click **+ Add New Rule**.
3. Under **URL Regular Expression**, type the pattern for the sites you want to style (e.g., `.*github\.com.*`).
4. Under **Custom CSS**, type your CSS (e.g., `body { background-color: #222 !important; }`).
5. Click **Save** and reload your target website to see the changes.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

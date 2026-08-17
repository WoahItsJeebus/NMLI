# Nexus Steam Library Importer

A Manifest V3 Chromium extension that adds **Import from Steam** beside **My games** on the Nexus Mods home page. It is designed for Opera GX first and does not use Chrome's side panel.

## What it does

1. Reads the Steam library visible to the Steam account signed in to the browser, or a public profile you paste.
2. Compares the Steam titles with Nexus Mods' current games catalog.
3. Separates confident matches, matches needing review, games already in **My games**, and games not found on Nexus.
4. Adds only the games you select. It uses Nexus' own bookmark control in one inactive tab at a time and closes each tab after Nexus confirms the change.

The extension never removes games from **My games**.

## Install in Opera GX

1. Extract the release ZIP.
2. Open `opera://extensions`.
3. Enable **Developer mode**.
4. Choose **Load unpacked** and select the extracted folder containing `manifest.json`.
5. Open [Nexus Mods](https://www.nexusmods.com/) while signed in.
6. Click **Import from Steam** beside **My games**.

The toolbar button also opens or focuses the Nexus home page and launches the same in-page importer. There is no side panel.

## Steam visibility

- Leaving the profile field blank uses the Steam account currently signed in to Opera GX.
- A private library works only when that same Steam account is signed in and can see it.
- You can instead paste a public Steam Community profile URL, custom ID, or 17-digit SteamID64.

## Permissions and privacy

- `storage`: caches a compact Nexus game-name catalog, remembers the last profile URL, and preserves import progress if the modal or service worker reconnects.
- `www.nexusmods.com`: inserts the button and uses Nexus' native bookmark controls.
- `steamcommunity.com`: reads game-title links from the Steam library page.
- `data.nexusmods.com`: downloads Nexus' public game catalog.

No passwords, cookies, API tokens, Nexus session data, browsing history, or Steam playtime are read or stored. Temporary Steam/Nexus tabs are opened inactive and closed automatically.

## Matching safety

Exact titles and a small set of verified Steam app IDs are selected automatically. Edition markers such as **Remastered**, **Special Edition**, **Legacy**, **Enhanced**, and platform-specific pages are kept distinct. Lower-confidence title matches appear under **Review** and remain unchecked.

Because storefront and Nexus titles can differ, review the selected list before confirming a large import.

## Development

```powershell
npm.cmd test
npm.cmd run check
powershell -NoProfile -ExecutionPolicy Bypass -File .\Build.ps1
```

`tests/fixture.html` is a standalone visual fixture for the injected button and modal.

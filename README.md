# Nexus Library Importer

A Manifest V3 WebExtension for Firefox and Chromium browsers that adds one **Import** button beside **My games** on the Nexus Mods home page. The button opens an in-page platform chooser. It is designed for Opera GX first and does not use Chrome's side panel.

Version 1.0 includes Steam support, a Beta GOG adapter, honest availability states for desktop-only libraries, locally bundled official-site provider icons, and Chrome, Opera, and Firefox release materials.

## Supported platforms

- **Steam:** scans the Steam account signed in to the browser, or a public Steam Community profile URL, custom ID, or SteamID64.
- **GOG (Beta):** scans the game collection visible on the GOG account page after the user signs in to GOG in the browser.
- **Ubisoft Connect:** shown in the chooser as unavailable because Ubisoft currently exposes the owned PC library through its desktop client rather than a browser library.
- **EA app:** shown in the chooser as unavailable because EA currently exposes the owned library through its Windows app rather than a browser library.

The provider boundary is reusable, so another browser-visible library can be added without replacing the Nexus matching or import workflow.

## What it does

1. Reads game names and platform IDs from the selected browser-visible library.
2. Compares those titles with Nexus Mods' current games catalog.
3. Separates confident matches, matches needing review, games already in **My games**, and games not found on Nexus.
4. Adds only the games the user selects, one at a time through Nexus' native bookmark control.
5. Provides a separate **Manage My games** panel for explicitly selected removals, with a final confirmation before any bookmark is turned off.

Import and removal lists both start with nothing selected. Use **Select all ready matches** for a bulk import, **Unselect all** to clear it, or choose individual games.

## Install in Opera GX

1. Extract the Opera release ZIP.
2. Open `opera://extensions`.
3. Enable **Developer mode**.
4. Choose **Load unpacked** and select the extracted folder containing `manifest.json`.
5. Open [Nexus Mods](https://www.nexusmods.com/) while signed in.
6. Click **Import** beside **My games** and choose a platform.

The toolbar button opens or focuses the Nexus home page and launches the same in-page importer. There is no side panel.

## Install temporarily in Firefox

1. Extract the Firefox release ZIP.
2. Open `about:debugging#/runtime/this-firefox`.
3. Choose **Load Temporary Add-on**.
4. Select the extracted `manifest.json`.
5. Open [Nexus Mods](https://www.nexusmods.com/) while signed in and click **Import** beside **My games**.

Temporary add-ons are removed when Firefox closes. Normal installation requires the package to be signed by Firefox Add-ons (AMO).

## Browser sign-in

- The importer can open the official Steam or GOG library/sign-in page in a normal browser tab.
- Sign-in is completed directly on that platform's website. The extension does not render a login form or receive the password.
- A private Steam library works when the signed-in Steam account can view it. A public profile can be scanned without signing in.
- GOG support is marked Beta because the browser library exists, but GOG does not publish a documented public library API. The adapter stops with a clear error if the account page cannot be read reliably.

## Permissions and privacy

- `storage`: caches the public Nexus catalog, remembers the last provider and optional Steam profile URL, and preserves the latest import job.
- `www.nexusmods.com`: inserts the button, reads My games, and uses Nexus' native bookmark controls.
- `steamcommunity.com`: reads visible Steam library names and app IDs.
- `www.gog.com`: reads visible GOG account-library names and product IDs.
- `data.nexusmods.com`: downloads Nexus' public game catalog.

No passwords, cookies, authentication tokens, API keys, payment data, playtime, orders, or general browsing history are read or stored. Temporary scanning and Nexus worker tabs are opened only for the requested operation and closed automatically.

Public extension pages:

- [Privacy policy](https://woahitsjeebus.github.io/NMLI/privacy.html)
- [Support](https://woahitsjeebus.github.io/NMLI/support.html)

Platform icons are bundled in the extension from artwork served by the providers' official websites. Steam, GOG, and Ubisoft are packaged at 256 x 256 for high-DPI displays, while EA remains a scalable SVG. Their source URLs are documented in `provider-icons/SOURCES.md`; opening the chooser does not contact those websites just to display an icon.

## Matching safety

Exact titles and verified Steam app-ID aliases are placed in **Ready**. Edition markers such as **Remastered**, **Special Edition**, **Legacy**, and **Enhanced** stay distinct. Lower-confidence title matches appear under **Review**. Nothing is preselected; choose individual games or use **Select all ready matches**.

Because storefront and Nexus titles can differ, review the selected list before confirming a large import.

## Development

```powershell
npm.cmd test
npm.cmd run check
powershell -NoProfile -ExecutionPolicy Bypass -File .\Build.ps1
```

`tests/fixture.html` is a standalone visual fixture for the injected button, provider chooser, results, removal manager, and progress states.

GitHub Actions deploys only `store-listing/site` to GitHub Pages. A separate Gitleaks workflow scans every push and pull request, while `.gitignore` excludes common local credential and signing-key files.

## Web-store release

- Production browser packages are written to `Releases` by `Build.ps1`.
- Paste-ready listing copy, privacy answers, reviewer notes, and the publisher checklist are in `store-listing`.
- Chrome, Opera, and Firefox-ready listing materials are in `store-assets` and `store-listing`.
- Publishing remains manual because the final submission uses the publisher's developer accounts, public support/privacy URLs, and license choice.

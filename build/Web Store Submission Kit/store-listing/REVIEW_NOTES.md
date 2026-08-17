# Reviewer notes - 1.0.0

## What the extension changes

The extension adds one in-page Import button beside Nexus Mods' My games heading. It does not add a side panel, replace search, alter the new-tab page, inject ads, or bundle unrelated functionality.

## Review path

1. Install the ZIP with `manifest.json` at the archive root.
2. Sign in to Nexus Mods and open `https://www.nexusmods.com/`.
3. Click Import beside My games.
4. Choose Steam or GOG.
5. For Steam, leave the profile field blank when a visible Steam library is signed in, or paste a public Steam Community profile. For GOG, use Open GOG sign-in / library, sign in directly on GOG, return to Nexus, and click Scan GOG library.
6. Review Ready and Review. No Nexus state changes occur before Add selected games is clicked.
7. If confirmed, the extension opens one inactive Nexus game-search tab at a time, operates the native My games bookmark control, verifies the result, and closes the tab.
8. To review removal, return to the platform chooser, click Manage My games, select one or more current games, click Remove, and review the final confirmation. Nothing is preselected and no bookmark is turned off before the final Remove confirmation.

Ubisoft Connect and EA are intentionally visible but unavailable. Their official owned-game workflows use desktop clients, so the extension does not request host permission or credentials for either platform.

## Network behavior

- `data.nexusmods.com/file/nexus-data/games.json` supplies a public catalog cached for up to 24 hours.
- Steam Community supplies visible game-title links and Steam app IDs.
- The signed-in GOG account page supplies visible game names and product IDs. GOG is labeled Beta because this browser feed is not a documented public API.
- Nexus game pages supply the native bookmark control used for user-confirmed additions and removals.
- No request is made to a developer-owned server. There is no analytics or remote executable code.

## Account and failure behavior

- Platform sign-in is completed on the official platform website. The extension does not host login forms or read credentials.
- A private Steam library produces a clear error unless the signed-in Steam account can view it.
- A signed-out or unreadable GOG library produces a clear error and imports nothing.
- A Nexus account is required only when the user confirms additions or removals.
- Cancelling stops the remaining queue. Any already completed additions or removals remain changed and all unprocessed games remain untouched.
- Temporary tabs close after success, failure, cancellation, or timeout.

## Opera GX compatibility

The extension is standard Manifest V3 Chromium code and does not declare or call the Chrome side-panel API. Its responsive layouts are designed and tested as an in-page modal for Opera GX.

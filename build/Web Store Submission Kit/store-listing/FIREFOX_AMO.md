# Firefox Add-ons listing - 1.0.0

## Product details

- Name: `Nexus Library Importer`
- Summary: `Import supported Steam and GOG games into Nexus Mods My games.`
- Category: `Games & Entertainment`
- Language: `English (United States)`
- License: select the publisher's chosen license before submission

## Description

Bring the PC games Nexus Mods supports into My games from one in-page importer.

Nexus Library Importer adds a single Import button beside My games. Choose Steam or GOG, scan the library visible to the signed-in Firefox account, and compare it with the current Nexus Mods games catalog. Steam also supports public Community profiles. Results are sorted into Ready, Review, Already added, and Not on Nexus groups.

You stay in control:

- Review every match before anything changes.
- Nothing is preselected; select individual games or use Select all ready matches.
- Unselect all clears a large selection in one click.
- Ambiguous title matches remain unchecked.
- Add only the games you choose.
- Imports run one at a time through Nexus Mods' own My games control.
- Progress continues if you close the importer.
- A separate Manage My games panel removes only explicitly selected games after a final confirmation.

GOG support is labeled Beta because GOG offers a browser account library but no documented public library API. Ubisoft Connect and EA are explanatory desktop-app-only entries and request no account access.

Game names, platform product IDs, the games visible in Nexus My games, and an optional Steam profile identifier are processed locally. Sign-in happens directly on Steam or GOG. There is no developer server, analytics, advertising, remote code, or sale of data.

Nexus Mods, Steam, GOG, Ubisoft, EA, and Firefox are trademarks of their respective owners. This independent extension is not affiliated with or endorsed by those companies or Mozilla.

## Submission notes

- Upload `Nexus-Library-Importer-1.0.0-Firefox.zip` to addons.mozilla.org.
- The Manifest V3 add-on ID is `{1c7ffba3-5837-428d-9414-13d353402dde}`.
- The manifest declares Mozilla's required data-collection value as `none`; all handled library and Nexus data remains local to the extension/browser.
- Reuse the Chrome 1280 x 800 screenshots under `store-assets/chrome` for the AMO listing.
- Add the public privacy-policy and support URLs before submission.
- AMO signing is required for normal installation in release Firefox.

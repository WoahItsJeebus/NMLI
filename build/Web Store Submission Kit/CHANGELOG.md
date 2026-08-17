# Changelog

## 1.0.0

- Added a single Opera GX-compatible **Import** button beside Nexus **My games**.
- Added an in-page provider chooser for Steam, GOG, Ubisoft Connect, and the EA app.
- Added signed-in and public-profile Steam library scanning.
- Added a Beta GOG adapter that reads the signed-in browser account library without handling credentials.
- Marked Ubisoft Connect and EA honestly as desktop-app-only until they expose a safe browser library.
- Added conservative Nexus catalog matching with separate Ready, Review, Already added, and Not on Nexus groups.
- Added resumable sequential imports through Nexus' native bookmark controls.
- Added **Unselect all** beside **Select all ready matches** and changed scan results to start with no games selected.
- Added a searchable **Manage My games** removal panel with no preselection, a final confirmation screen, resumable progress, and native Nexus unbookmark verification.
- Added cancellation, progress, completion summaries, privacy safeguards, automated tests, and release packaging.
- Added an original multi-size extension icon and Chrome Web Store and Opera Add-ons release materials.
- Replaced provider letter placeholders with locally bundled icons sourced from each platform's official website.
- Upgraded the raster provider icons for high-DPI displays, replacing the low-resolution GOG and Ubisoft favicons with official press-kit artwork.
- Added a Firefox Manifest V3 package with an AMO add-on ID, Mozilla's required data-collection declaration, and a Firefox event-page background configuration.
- Made the open importer own wheel scrolling while preserving and restoring the Nexus page's original scroll styles.

# 1.0 web-store submission checklist

## Already prepared

- Manifest V3 version `1.0.0`
- Single in-page Import button and provider chooser
- Searchable, confirmed Manage My games removal panel
- Import and removal selections start empty, with Select all ready matches and Unselect all controls
- Steam and Beta GOG browser-library adapters
- Honest unavailable states for Ubisoft Connect and EA
- Store and toolbar icon set
- Chrome 128x128 store icon, screenshots, and promo tiles
- Opera 64x64 and 128x128 icons and 800x600 screenshots
- Paste-ready Chrome, Opera, and Firefox listing copy
- Chrome privacy-practices answers and permission justifications
- Reviewer notes and host-ready privacy/support pages
- Separate Chrome, Opera, and Firefox production ZIPs with no tests or source artwork

## Publisher decisions required before upload

- Confirm the public publisher/developer name.
- Confirm a monitored support email in both developer accounts.
- Host `site/privacy.html` over HTTPS and paste its public URL into both listings.
- Host `site/support.html`, or use a relevant public support URL.
- Choose the Opera distribution license or provide an EULA.
- Choose the Firefox Add-ons distribution license.

## Chrome Web Store

1. Enroll the publisher account and enable two-step verification.
2. Upload `Nexus-Library-Importer-1.0.0-Chrome.zip`.
3. Paste `CHROME_WEB_STORE.md` into the Store listing fields.
4. Upload the files under `store-assets/chrome`.
5. Complete the Privacy tab from `PRIVACY_PRACTICES.md`.
6. Add the public privacy-policy and support URLs.
7. Select public or unlisted distribution, review, and submit when ready.

## Opera Add-ons

1. Sign in to the Opera Add-ons developer portal.
2. Upload `Nexus-Library-Importer-1.0.0-Opera.zip`.
3. Paste `OPERA_ADDONS.md` into the listing fields.
4. Upload the files under `store-assets/opera`.
5. Add the public privacy/support URLs and select the distribution license.
6. Include `REVIEW_NOTES.md` where reviewer instructions are accepted.
7. Review the final form and submit when ready.

## Firefox Add-ons

1. Sign in to the Firefox Add-on Developer Hub.
2. Upload `Nexus-Library-Importer-1.0.0-Firefox.zip`.
3. Paste `FIREFOX_AMO.md` into the listing fields.
4. Reuse the 1280 x 800 screenshots under `store-assets/chrome`.
5. Confirm the manifest's `none` data-collection declaration and complete AMO's privacy questions consistently with `PRIVACY_PRACTICES.md`.
6. Add the public privacy/support URLs and select a license.
7. Submit for AMO signing and review. Distribute the resulting signed package, not the unsigned source ZIP.

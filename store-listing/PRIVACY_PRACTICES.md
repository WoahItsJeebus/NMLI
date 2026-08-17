# Chrome privacy-practices answers

## Single purpose description

Match games in a user's browser-visible Steam or GOG library with Nexus Mods, then add or remove only the Nexus My games entries the user explicitly reviews and confirms.

## Permission justifications

### Storage justification

Stores the last selected provider, an optional last-used Steam profile URL, a 24-hour cache of the public Nexus games catalog, and the latest user-confirmed My games change job so visible progress survives a closed modal or service-worker restart. Data remains in `chrome.storage.local` and is not used for analytics, advertising, or tracking.

### Host permission justification

Access to `nexusmods.com` inserts the importer, reads the user's visible My games list, and activates Nexus Mods' native bookmark control only for confirmed additions or removals. Access to `steamcommunity.com` reads visible game names and app IDs from the signed-in user's or a specified public games page. Access to `gog.com` reads visible game names and product IDs from the signed-in GOG library. Access to `data.nexusmods.com` downloads the public `games.json` catalog used for title matching. Sign-in stays on each provider; the extension does not read or store passwords, cookies, tokens, payment data, orders, messages, friends, purchases, or playtime.

## Remote code

Select `No, I am not using remote code.` All executable JavaScript and CSS is contained in the extension package. The extension downloads only data and webpage content needed for its single purpose, so no remote-code justification is required.

## Data-use disclosures

Disclose these handled data categories:

- `Personally identifiable information`: an optional Steam Community profile URL, custom ID, SteamID64, and the account display name returned by a supported provider. The last resolved Steam profile URL is stored locally.
- `Website content`: visible Steam or GOG game names/product IDs and games visible in Nexus My games. Scan results are processed locally; selected game names and IDs can appear in the locally stored My games change job.

Do not select these categories:

- Health information
- Financial and payment information
- Authentication information
- Personal communications
- Location
- Web history
- User activity

The extension accesses only the four declared services for its feature. Ubisoft Connect and EA are explanatory chooser entries only; the extension requests no host access to either service. It does not inspect general browsing history or behavior.

## Required certifications

Certify that:

- Data is used only for the extension's disclosed single purpose.
- Data is not sold or transferred for unrelated purposes.
- Data is not used for creditworthiness, lending, or personalized advertising.
- Humans do not read user data.
- The disclosed practices match the public privacy policy.

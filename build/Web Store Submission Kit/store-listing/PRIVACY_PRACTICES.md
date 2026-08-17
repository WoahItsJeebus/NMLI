# Chrome privacy-practices answers

## Single purpose

Match a user's supported browser-visible PC game libraries with games supported by Nexus Mods, add only user-confirmed missing matches, and remove only games the user explicitly selects and confirms in the My games manager.

## Permission justifications

### `storage`

Stores the last selected provider, optional last-used Steam profile URL, a public Nexus games-catalog cache, and the latest My games change job so progress can survive a closed modal or service-worker restart. It is not used for analytics, advertising, or tracking.

### `https://www.nexusmods.com/*`

Adds the Import button to the Nexus home page, reads the games already visible in My games, and uses Nexus Mods' native bookmark control to add or remove only the games the user confirms.

### `https://steamcommunity.com/*`

Loads the signed-in user's or user-specified public Steam Community games page and reads game names and Steam app IDs for matching. It does not read passwords, cookies, tokens, playtime, friends, messages, or purchases.

### `https://www.gog.com/*`

Loads the signed-in user's GOG account library and reads visible game names and product IDs for matching. Sign-in is completed directly on GOG. The extension does not read passwords, cookies, tokens, orders, payment details, or account secrets.

### `https://data.nexusmods.com/*`

Downloads Nexus Mods' public `games.json` catalog so platform titles can be matched to current Nexus game domains. The response is data, not executable code.

## Remote code

Select `No, I am not using remote code.` All executable JavaScript and CSS is contained in the extension package. The extension downloads only data and webpage content needed for its single purpose.

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

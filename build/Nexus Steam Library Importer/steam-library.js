(function initSteamLibrary(root, factory) {
  const api = factory();

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  root.NSISteamLibrary = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createSteamLibrary() {
  "use strict";

  const GENERIC_LINK_TEXT = new Set([
    "community hub",
    "discussions",
    "find community groups",
    "guides",
    "market",
    "my game content",
    "related groups",
    "screenshots",
    "store page",
    "workshop"
  ]);

  function cleanText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function extractAppId(href) {
    const match = String(href || "").match(/store\.steampowered\.com\/app\/(\d+)/i);
    return match ? match[1] : null;
  }

  function collectGamesFromLinks(links) {
    const byAppId = new Map();

    for (const link of links || []) {
      const appId = extractAppId(link.href);
      const text = cleanText(link.text);
      if (!appId || !text || GENERIC_LINK_TEXT.has(text.toLowerCase())) {
        continue;
      }

      const current = byAppId.get(appId);
      if (!current || text.length > current.name.length) {
        byAppId.set(appId, { appId, name: text });
      }
    }

    return [...byAppId.values()].sort((left, right) => left.name.localeCompare(right.name));
  }

  function expectedGameCount(text) {
    const match = cleanText(text).match(/All Games\s*\(([\d,]+)\)/i);
    return match ? Number(match[1].replace(/,/g, "")) : null;
  }

  function profileNameFromDocument(doc) {
    const titleMatch = String(doc.title || "").match(/Steam Community\s*::\s*(.*?)\s*::\s*Games/i);
    if (titleMatch) {
      return cleanText(titleMatch[1]);
    }

    const breadcrumb = [...doc.querySelectorAll("a")].find((anchor) => /\/((id)|(profiles))\//i.test(anchor.href));
    return cleanText(breadcrumb?.textContent) || "Steam profile";
  }

  async function scrapeDocument(doc) {
    let stableCount = -1;
    let stablePasses = 0;
    let games = [];
    let expected = null;

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const links = [...doc.querySelectorAll('a[href*="store.steampowered.com/app/"]')].map(
        (anchor) => ({ href: anchor.href, text: anchor.textContent })
      );
      games = collectGamesFromLinks(links);
      expected = expectedGameCount(doc.body?.innerText || "");

      if (games.length === stableCount) {
        stablePasses += 1;
      } else {
        stableCount = games.length;
        stablePasses = 0;
      }

      if (
        games.length > 0 &&
        ((expected !== null && games.length >= expected) || (expected === null && stablePasses >= 2))
      ) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 350));
    }

    const bodyText = doc.body?.innerText || "";
    expected = expected ?? expectedGameCount(bodyText);
    const signedOut = /sign in|login/i.test(doc.title) && games.length === 0;
    const unavailable =
      /This profile is private|game details are private|There was an error loading/i.test(bodyText);

    if (signedOut) {
      throw new Error("Steam is not signed in. Sign in to Steam Community in Opera GX, then try again.");
    }
    if (unavailable) {
      throw new Error("That Steam library is private or unavailable. Use the signed-in account or make Game details public.");
    }
    if (!games.length) {
      throw new Error(
        expected === 0
          ? "Steam reports no games for that profile."
          : "Steam did not expose any library games on this page."
      );
    }

    return {
      games,
      expectedCount: expected,
      profileName: profileNameFromDocument(doc),
      resolvedUrl: doc.URL
    };
  }

  if (typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message?.type !== "NSI_SCRAPE_STEAM") {
        return undefined;
      }

      scrapeDocument(document)
        .then((result) => sendResponse({ ok: true, result }))
        .catch((error) => sendResponse({ ok: false, error: error.message }));
      return true;
    });
  }

  return {
    cleanText,
    collectGamesFromLinks,
    expectedGameCount,
    extractAppId
  };
});

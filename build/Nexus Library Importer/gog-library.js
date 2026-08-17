(function initGogLibrary(root, factory) {
  const api = factory();

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  root.NSIGogLibrary = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createGogLibrary() {
  "use strict";

  const MAX_LIBRARY_PAGES = 100;

  function cleanText(value) {
    return String(value || "")
      .replace(/<[^>]*>/g, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;|&apos;/gi, "'")
      .replace(/\s+/g, " ")
      .trim();
  }

  function productList(payload) {
    const candidates = [
      payload?.products,
      payload?.items,
      payload?.data?.products,
      payload?.data?.items
    ];
    return candidates.find(Array.isArray) || [];
  }

  function extractGamesFromPayload(payload) {
    const games = new Map();
    for (const product of productList(payload)) {
      const name = cleanText(
        product?.title || product?.name || product?.gameTitle || product?.productTitle
      );
      const rawId = product?.id || product?.productId || product?.gameId || product?.slug;
      const id = cleanText(rawId);
      if (!name || !id || name.length > 200) {
        continue;
      }
      games.set(id.toLowerCase(), {
        appId: `gog:${id}`,
        name,
        providerId: "gog"
      });
    }
    return [...games.values()].sort((left, right) => left.name.localeCompare(right.name));
  }

  function paginationFromPayload(payload) {
    const totalPages = Number(
      payload?.totalPages || payload?.pages || payload?.pagination?.totalPages || 1
    );
    const totalProducts = Number(
      payload?.totalProducts || payload?.total || payload?.pagination?.totalItems
    );
    return {
      totalPages: Number.isFinite(totalPages) && totalPages > 0 ? Math.ceil(totalPages) : 1,
      totalProducts: Number.isFinite(totalProducts) && totalProducts >= 0 ? totalProducts : null
    };
  }

  function collectGamesFromDocument(doc) {
    const games = new Map();
    const selectors = [
      "[data-product-id]",
      "[data-game-id]",
      'a[href*="/game/"]'
    ];

    for (const element of doc.querySelectorAll(selectors.join(","))) {
      const container = element.closest?.("[data-product-id],[data-game-id]") || element;
      const href = element.href || container.querySelector?.('a[href*="/game/"]')?.href || "";
      const slug = String(href).match(/\/game\/([^/?#]+)/i)?.[1] || "";
      const rawId =
        container.dataset?.productId ||
        container.dataset?.gameId ||
        element.dataset?.productId ||
        element.dataset?.gameId ||
        slug;
      const titleNode = container.querySelector?.(
        "[data-product-title],[data-game-title],.product-title,.product__title,.game-title"
      );
      const name = cleanText(
        container.dataset?.productTitle ||
        container.dataset?.gameTitle ||
        element.getAttribute?.("aria-label") ||
        element.getAttribute?.("title") ||
        titleNode?.textContent ||
        element.textContent
      );
      const id = cleanText(rawId);
      if (!id || !name || name.length > 200 || /^(buy|details|download|more)$/i.test(name)) {
        continue;
      }
      games.set(id.toLowerCase(), {
        appId: `gog:${id}`,
        name,
        providerId: "gog"
      });
    }

    return [...games.values()].sort((left, right) => left.name.localeCompare(right.name));
  }

  function isSignedOutDocument(doc) {
    const url = String(doc.URL || "");
    const bodyText = cleanText(doc.body?.innerText || "");
    return (
      /##?openlogin|\/login(?:[/?#]|$)/i.test(url) ||
      /log in to your gog account|create your gog account/i.test(bodyText)
    );
  }

  function accountNameFromDocument(doc) {
    const candidate = doc.querySelector(
      '[data-testid="account-username"],.menu-account__user-name,.account__username'
    );
    return cleanText(candidate?.textContent) || "Signed-in GOG account";
  }

  async function fetchLibraryPages(doc, fetchImpl) {
    const allGames = new Map();
    let expectedCount = null;
    let totalPages = 1;

    for (let page = 1; page <= Math.min(totalPages, MAX_LIBRARY_PAGES); page += 1) {
      const url = new URL("/account/getFilteredProducts", doc.location?.origin || "https://www.gog.com");
      url.searchParams.set("mediaType", "1");
      url.searchParams.set("sortBy", "title");
      url.searchParams.set("page", String(page));

      const response = await fetchImpl(url.href, {
        cache: "no-store",
        credentials: "include",
        headers: { Accept: "application/json" }
      });
      if (response.status === 401 || response.status === 403 || /openlogin|\/login/i.test(response.url)) {
        throw new Error("GOG is not signed in. Open GOG sign-in, finish signing in, then return to Nexus and retry.");
      }
      if (!response.ok) {
        throw new Error(`GOG returned HTTP ${response.status} while reading the library.`);
      }
      const contentType = response.headers?.get?.("content-type") || "";
      if (!/json/i.test(contentType)) {
        throw new Error("GOG did not expose the signed-in game library on its account page.");
      }

      const payload = await response.json();
      const pagination = paginationFromPayload(payload);
      totalPages = Math.min(pagination.totalPages, MAX_LIBRARY_PAGES);
      expectedCount = pagination.totalProducts ?? expectedCount;
      for (const game of extractGamesFromPayload(payload)) {
        allGames.set(game.appId.toLowerCase(), game);
      }
    }

    return {
      games: [...allGames.values()].sort((left, right) => left.name.localeCompare(right.name)),
      expectedCount
    };
  }

  async function scrapeDocument(doc, fetchImpl = fetch) {
    if (isSignedOutDocument(doc)) {
      throw new Error("GOG is not signed in. Open GOG sign-in, finish signing in, then return to Nexus and retry.");
    }

    let library;
    let feedError;
    try {
      library = await fetchLibraryPages(doc, fetchImpl);
    } catch (error) {
      feedError = error;
    }

    const domGames = collectGamesFromDocument(doc);
    const games = library?.games?.length ? library.games : domGames;
    if (!games.length) {
      if (feedError) {
        throw feedError;
      }
      if (library?.expectedCount === 0) {
        throw new Error("GOG reports no games in this account library.");
      }
      throw new Error("GOG did not expose any games on the signed-in account page.");
    }

    return {
      games,
      expectedCount: library?.expectedCount ?? games.length,
      profileName: accountNameFromDocument(doc),
      resolvedUrl: doc.URL
    };
  }

  if (typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message?.type !== "NSI_SCRAPE_GOG") {
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
    collectGamesFromDocument,
    extractGamesFromPayload,
    fetchLibraryPages,
    paginationFromPayload
  };
});

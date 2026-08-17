(function initMatcher(root, factory) {
  const api = factory();

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  root.NSIMatcher = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createMatcher() {
  "use strict";

  const NEXUS_ALIASES_BY_STEAM_APP = Object.freeze({
    "22330": "oblivion",
    "22380": "newvegas",
    "22490": "fallout3",
    "72850": "skyrim",
    "211420": "darksouls",
    "264710": "subnautica",
    "271590": "gta5",
    "292030": "witcher3",
    "377160": "fallout4",
    "413150": "stardewvalley",
    "489830": "skyrimspecialedition",
    "582010": "monsterhunterworld",
    "990080": "hogwartslegacy",
    "1091500": "cyberpunk2077",
    "1174180": "reddeadredemption2",
    "1245620": "eldenring",
    "1086940": "baldursgate3"
  });

  const EDITION_TOKENS = new Set([
    "anniversary",
    "classic",
    "enhanced",
    "legacy",
    "online",
    "remake",
    "remastered",
    "special",
    "vr"
  ]);

  const PLATFORM_TOKENS = new Set([
    "playstation",
    "ps4",
    "ps5",
    "switch",
    "xbox"
  ]);

  const GENERIC_EDITION_SUFFIXES = [
    "complete edition",
    "definitive edition",
    "deluxe edition",
    "game of the year edition",
    "goty edition",
    "ultimate edition"
  ];

  function normalizeName(value) {
    return String(value || "")
      .replace(/[™®©]/g, "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[’'`]/g, "")
      .replace(/&/g, " and ")
      .toLowerCase()
      .replace(/\biii\b/g, "3")
      .replace(/\bii\b/g, "2")
      .replace(/\biv\b/g, "4")
      .replace(/\bvi\b/g, "6")
      .replace(/\bv\b/g, "5")
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .replace(/\s+/g, " ");
  }

  function unique(values) {
    return [...new Set(values.filter(Boolean))];
  }

  function buildNameVariants(value) {
    const base = normalizeName(value);
    const variants = [base];

    variants.push(base.replace(/^(the|a|an)\s+/, ""));
    variants.push(base.replace(/^the elder scrolls\s+\d+\s+/, ""));
    variants.push(base.replace(/^sid meiers\s+/, ""));
    variants.push(base.replace(/\s+(steam|windows|pc)$/, ""));

    for (const suffix of GENERIC_EDITION_SUFFIXES) {
      if (base.endsWith(` ${suffix}`)) {
        variants.push(base.slice(0, -(suffix.length + 1)));
      }
    }

    return unique(variants.map((entry) => entry.trim()));
  }

  function tokens(value) {
    return new Set(normalizeName(value).split(" ").filter(Boolean));
  }

  function diceCoefficient(left, right) {
    if (!left.size || !right.size) {
      return 0;
    }

    let intersection = 0;
    for (const token of left) {
      if (right.has(token)) {
        intersection += 1;
      }
    }

    return (2 * intersection) / (left.size + right.size);
  }

  function hasTokenMismatch(steamTokens, nexusTokens, tokenSet) {
    for (const token of tokenSet) {
      if (steamTokens.has(token) !== nexusTokens.has(token)) {
        return true;
      }
    }
    return false;
  }

  function prepareName(value) {
    return {
      variants: buildNameVariants(value),
      tokens: tokens(value)
    };
  }

  function scorePreparedNames(steamPrepared, nexusPrepared) {
    const steamVariants = steamPrepared.variants;
    const nexusVariants = nexusPrepared.variants;

    if (steamVariants.some((entry) => nexusVariants.includes(entry))) {
      return 0.99;
    }

    const steamTokens = steamPrepared.tokens;
    const nexusTokens = nexusPrepared.tokens;
    let score = diceCoefficient(steamTokens, nexusTokens);

    const normalizedSteam = steamVariants[0];
    const normalizedNexus = nexusVariants[0];
    if (
      normalizedSteam.length >= 6 &&
      normalizedNexus.length >= 6 &&
      (normalizedSteam.includes(normalizedNexus) || normalizedNexus.includes(normalizedSteam))
    ) {
      score = Math.max(score, 0.93);
    }

    if (hasTokenMismatch(steamTokens, nexusTokens, EDITION_TOKENS)) {
      score -= 0.2;
    }

    if (hasTokenMismatch(steamTokens, nexusTokens, PLATFORM_TOKENS)) {
      score -= 0.35;
    }

    return Math.max(0, Math.min(1, score));
  }

  function scoreNames(steamName, nexusName) {
    return scorePreparedNames(prepareName(steamName), prepareName(nexusName));
  }

  function compactCatalog(catalog) {
    if (!Array.isArray(catalog)) {
      return [];
    }

    return catalog
      .map((game) => ({
        id: Number(game.id ?? game.game_id ?? game.gameId),
        name: String(game.name ?? game.game_name ?? game.gameName ?? "").trim(),
        domain: String(
          game.domain ?? game.domain_name ?? game.domainName ?? game.slug ?? ""
        ).trim()
      }))
      .filter((game) => Number.isFinite(game.id) && game.name && game.domain);
  }

  function isLikelyNonGame(game) {
    const name = normalizeName(game?.name);
    return /\b(dedicated server|benchmark|editor|modding tools|sdk|soundtrack|test server|playtest)\b/.test(
      name
    );
  }

  function findBestMatch(steamGame, catalog, catalogByDomain, preparedCatalog) {
    const aliasDomain = NEXUS_ALIASES_BY_STEAM_APP[String(steamGame.appId || "")];
    if (aliasDomain && catalogByDomain.has(aliasDomain)) {
      return {
        game: catalogByDomain.get(aliasDomain),
        confidence: 1,
        reason: "Steam ID match",
        autoSelect: true,
        ambiguous: false
      };
    }

    let best = null;
    let secondScore = 0;
    const steamPrepared = prepareName(steamGame.name);
    const candidates = preparedCatalog || catalog.map((game) => ({ game, prepared: prepareName(game.name) }));
    for (const candidate of candidates) {
      const nexusGame = candidate.game;
      const score = scorePreparedNames(steamPrepared, candidate.prepared);
      if (!best || score > best.confidence) {
        secondScore = best?.confidence || 0;
        best = { game: nexusGame, confidence: score };
      } else if (score > secondScore) {
        secondScore = score;
      }
    }

    if (!best || best.confidence < 0.72) {
      return null;
    }

    const gap = best.confidence - secondScore;
    const ambiguous = gap < 0.045 || best.confidence < 0.9;
    return {
      ...best,
      confidence: Math.round(best.confidence * 100) / 100,
      reason: best.confidence >= 0.98 ? "Exact title" : "Title match",
      autoSelect: best.confidence >= 0.93 && !ambiguous,
      ambiguous
    };
  }

  function matchLibrary(steamGames, rawCatalog, currentGames = []) {
    const catalog = compactCatalog(rawCatalog);
    const catalogByDomain = new Map(catalog.map((game) => [game.domain.toLowerCase(), game]));
    const preparedCatalog = catalog.map((game) => ({ game, prepared: prepareName(game.name) }));
    const currentDomains = new Set(
      currentGames.map((game) => String(game.domain || "").toLowerCase()).filter(Boolean)
    );
    const currentNames = new Set(
      currentGames.map((game) => normalizeName(game.name)).filter(Boolean)
    );

    const results = [];
    for (const steamGame of steamGames || []) {
      const cleaned = {
        appId: String(steamGame.appId || ""),
        name: String(steamGame.name || "").trim()
      };

      if (!cleaned.appId || !cleaned.name || isLikelyNonGame(cleaned)) {
        results.push({ steam: cleaned, status: "not_found", skipped: true, match: null });
        continue;
      }

      const match = findBestMatch(cleaned, catalog, catalogByDomain, preparedCatalog);
      if (!match) {
        results.push({ steam: cleaned, status: "not_found", match: null });
        continue;
      }

      const alreadyAdded =
        currentDomains.has(match.game.domain.toLowerCase()) ||
        currentNames.has(normalizeName(match.game.name));

      results.push({
        steam: cleaned,
        status: alreadyAdded ? "existing" : match.ambiguous ? "review" : "ready",
        match
      });
    }

    return results.sort((left, right) => {
      const order = { ready: 0, review: 1, existing: 2, not_found: 3 };
      return order[left.status] - order[right.status] || left.steam.name.localeCompare(right.steam.name);
    });
  }

  function normalizeSteamProfileInput(input) {
    const value = String(input || "").trim();
    if (!value) {
      return {
        libraryUrl: "https://steamcommunity.com/my/games/?tab=all",
        profileUrl: "https://steamcommunity.com/my/",
        kind: "signed_in"
      };
    }

    let identifier = value;
    let kind = "id";

    if (/^\d{17}$/.test(value)) {
      kind = "profiles";
    } else if (/^https?:\/\//i.test(value)) {
      let url;
      try {
        url = new URL(value);
      } catch {
        throw new Error("Enter a Steam profile URL, custom ID, or SteamID64.");
      }

      if (!/(^|\.)steamcommunity\.com$/i.test(url.hostname)) {
        throw new Error("Only steamcommunity.com profile URLs are supported.");
      }

      const match = url.pathname.match(/^\/(id|profiles)\/([^/]+)/i);
      if (!match) {
        throw new Error("That URL does not look like a Steam Community profile.");
      }
      kind = match[1].toLowerCase();
      identifier = decodeURIComponent(match[2]);
    } else if (!/^[a-z0-9_-]{2,64}$/i.test(value)) {
      throw new Error("Enter a Steam profile URL, custom ID, or SteamID64.");
    }

    if (kind === "profiles" && !/^\d{17}$/.test(identifier)) {
      throw new Error("A SteamID64 must contain exactly 17 digits.");
    }
    if (kind === "id" && !/^[a-z0-9_-]{2,64}$/i.test(identifier)) {
      throw new Error("That Steam custom ID contains unsupported characters.");
    }

    const encoded = encodeURIComponent(identifier);
    return {
      libraryUrl: `https://steamcommunity.com/${kind}/${encoded}/games/?tab=all`,
      profileUrl: `https://steamcommunity.com/${kind}/${encoded}`,
      kind
    };
  }

  return {
    buildNameVariants,
    compactCatalog,
    findBestMatch,
    isLikelyNonGame,
    matchLibrary,
    normalizeName,
    normalizeSteamProfileInput,
    scoreNames
  };
});

"use strict";

if (typeof importScripts === "function" && !globalThis.NSIMatcher) {
  importScripts("matcher.js");
}

const extensionApi = globalThis.browser ?? globalThis.chrome;

const {
  compactCatalog,
  matchLibrary,
  normalizeSteamProfileInput
} = globalThis.NSIMatcher;

const CATALOG_URL = "https://data.nexusmods.com/file/nexus-data/games.json";
const CATALOG_CACHE_KEY = "nsiCatalogCacheV1";
const JOB_KEY = "nsiImportJobV1";
const SETTINGS_KEY = "nsiSettingsV1";
const CATALOG_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const TAB_LOAD_TIMEOUT_MS = 45_000;
const PROVIDERS = Object.freeze({
  steam: {
    id: "steam",
    name: "Steam",
    accountUrl: "https://steamcommunity.com/my/games/?tab=all"
  },
  gog: {
    id: "gog",
    name: "GOG",
    accountUrl: "https://www.gog.com/en/account"
  }
});

let pumpRunning = false;

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error || "Unknown error");
}

async function getStored(key) {
  const stored = await extensionApi.storage.local.get(key);
  return stored[key];
}

async function setStored(key, value) {
  await extensionApi.storage.local.set({ [key]: value });
}

async function removeStored(key) {
  await extensionApi.storage.local.remove(key);
}

function waitForTabComplete(tabId, timeoutMs = TAB_LOAD_TIMEOUT_MS) {
  return new Promise(async (resolve, reject) => {
    let settled = false;
    let timeoutId;

    const cleanup = () => {
      extensionApi.tabs.onUpdated.removeListener(onUpdated);
      extensionApi.tabs.onRemoved.removeListener(onRemoved);
      clearTimeout(timeoutId);
    };

    const finish = (callback, value) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      callback(value);
    };

    const onUpdated = (updatedTabId, changeInfo) => {
      if (updatedTabId === tabId && changeInfo.status === "complete") {
        finish(resolve);
      }
    };

    const onRemoved = (removedTabId) => {
      if (removedTabId === tabId) {
        finish(reject, new Error("The temporary browser tab was closed before it finished loading."));
      }
    };

    extensionApi.tabs.onUpdated.addListener(onUpdated);
    extensionApi.tabs.onRemoved.addListener(onRemoved);
    timeoutId = setTimeout(
      () => finish(reject, new Error("The page took too long to load.")),
      timeoutMs
    );

    try {
      const tab = await extensionApi.tabs.get(tabId);
      if (tab.status === "complete") {
        finish(resolve);
      }
    } catch (error) {
      finish(reject, error);
    }
  });
}

async function sendMessageWithRetry(tabId, message, attempts = 12) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await extensionApi.tabs.sendMessage(tabId, message);
    } catch (error) {
      lastError = error;
      await delay(300);
    }
  }
  throw lastError || new Error("The helper script did not start on the temporary tab.");
}

async function closeTabQuietly(tabId) {
  if (!Number.isInteger(tabId)) {
    return;
  }
  try {
    await extensionApi.tabs.remove(tabId);
  } catch {
    // The user or browser may already have closed it.
  }
}

async function loadNexusCatalog(forceRefresh = false) {
  const cached = await getStored(CATALOG_CACHE_KEY);
  const cacheIsFresh =
    cached?.fetchedAt &&
    Array.isArray(cached.games) &&
    Date.now() - cached.fetchedAt < CATALOG_MAX_AGE_MS;

  if (!forceRefresh && cacheIsFresh) {
    return cached.games;
  }

  try {
    const response = await fetch(CATALOG_URL, {
      cache: "no-cache",
      credentials: "omit",
      headers: { Accept: "application/json" }
    });
    if (!response.ok) {
      throw new Error(`Nexus returned HTTP ${response.status}.`);
    }

    const games = compactCatalog(await response.json());
    if (games.length < 1000) {
      throw new Error("Nexus returned an incomplete games catalog.");
    }

    try {
      await setStored(CATALOG_CACHE_KEY, { fetchedAt: Date.now(), games });
    } catch {
      // A live scan can continue even if this browser has an unusually small storage quota.
    }
    return games;
  } catch (error) {
    if (Array.isArray(cached?.games) && cached.games.length > 0) {
      return cached.games;
    }
    throw new Error(`Could not load the Nexus games catalog. ${errorMessage(error)}`);
  }
}

async function scrapeSteamLibrary(profileInput) {
  const normalized = normalizeSteamProfileInput(profileInput);
  let tab;

  try {
    tab = await extensionApi.tabs.create({ active: false, url: normalized.libraryUrl });
    await waitForTabComplete(tab.id);

    const response = await sendMessageWithRetry(tab.id, { type: "NSI_SCRAPE_STEAM" });
    if (!response?.ok) {
      throw new Error(response?.error || "Steam library scanning failed.");
    }

    const resolvedUrl = response.result?.resolvedUrl || normalized.profileUrl;
    const profileMatch = resolvedUrl.match(
      /^https:\/\/steamcommunity\.com\/(id|profiles)\/([^/]+)/i
    );
    const resolvedProfileUrl = profileMatch
      ? `https://steamcommunity.com/${profileMatch[1]}/${profileMatch[2]}`
      : normalized.profileUrl;

    return {
      ...response.result,
      profileUrl: resolvedProfileUrl
    };
  } finally {
    await closeTabQuietly(tab?.id);
  }
}

async function scrapeGogLibrary() {
  let tab;

  try {
    tab = await extensionApi.tabs.create({ active: false, url: PROVIDERS.gog.accountUrl });
    await waitForTabComplete(tab.id);
    const loadedTab = await extensionApi.tabs.get(tab.id);
    if (!/\/account(?:[/?#]|$)/i.test(loadedTab.url || "")) {
      throw new Error(
        "GOG is not signed in. Open GOG sign-in, finish signing in, then return to Nexus and retry."
      );
    }

    const response = await sendMessageWithRetry(tab.id, { type: "NSI_SCRAPE_GOG" });
    if (!response?.ok) {
      throw new Error(response?.error || "GOG library scanning failed.");
    }
    return {
      ...response.result,
      profileUrl: PROVIDERS.gog.accountUrl
    };
  } finally {
    await closeTabQuietly(tab?.id);
  }
}

function buildScanSummary(results) {
  const summary = { ready: 0, review: 0, existing: 0, notFound: 0 };
  for (const result of results) {
    if (result.status === "not_found") {
      summary.notFound += 1;
    } else {
      summary[result.status] += 1;
    }
  }
  return summary;
}

async function handleScan(message) {
  const providerId = String(message.providerId || "steam").toLowerCase();
  const provider = PROVIDERS[providerId];
  if (!provider) {
    throw new Error("That library provider is not supported.");
  }

  const [library, catalog] = await Promise.all([
    providerId === "steam" ? scrapeSteamLibrary(message.profileInput) : scrapeGogLibrary(),
    loadNexusCatalog(Boolean(message.forceCatalogRefresh))
  ]);
  const currentGames = Array.isArray(message.currentGames) ? message.currentGames : [];
  const sourceGames = library.games.map((game) => ({ ...game, providerId }));
  const results = matchLibrary(sourceGames, catalog, currentGames);

  const previousSettings = (await getStored(SETTINGS_KEY)) || {};
  const nextSettings = {
    ...previousSettings,
    lastProviderId: providerId,
    updatedAt: Date.now()
  };
  if (providerId === "steam") {
    nextSettings.lastSteamProfileUrl = library.profileUrl;
    delete nextSettings.lastProfileUrl;
  }
  await setStored(SETTINGS_KEY, nextSettings);

  return {
    providerId,
    providerName: provider.name,
    accountName: library.profileName,
    profileName: library.profileName,
    profileUrl: library.profileUrl,
    libraryGameCount: library.games.length,
    expectedLibraryGameCount: library.expectedCount,
    steamGameCount: providerId === "steam" ? library.games.length : undefined,
    expectedSteamGameCount: providerId === "steam" ? library.expectedCount : undefined,
    catalogGameCount: catalog.length,
    summary: buildScanSummary(results),
    results
  };
}

function publicJob(job) {
  if (!job) {
    return null;
  }
  return {
    id: job.id,
    operation: job.operation || "add",
    status: job.status,
    createdAt: job.createdAt,
    completedAt: job.completedAt || null,
    currentIndex: job.currentIndex,
    items: job.items,
    totals: job.totals,
    currentGame: job.items[job.currentIndex]?.nexusName || null
  };
}

function recalculateTotals(job) {
  const totals = {
    total: job.items.length,
    queued: 0,
    added: 0,
    removed: 0,
    already: 0,
    failed: 0,
    cancelled: 0
  };

  for (const item of job.items) {
    if (item.status === "opening") {
      totals.queued += 1;
    } else if (Object.hasOwn(totals, item.status)) {
      totals[item.status] += 1;
    }
  }
  job.totals = totals;
}

async function notifyJobOwner(job) {
  if (!Number.isInteger(job?.ownerTabId)) {
    return;
  }
  try {
    await extensionApi.tabs.sendMessage(job.ownerTabId, {
      type: "NSI_JOB_UPDATE",
      job: publicJob(job)
    });
  } catch {
    // The Nexus home tab can be reloaded; it reconnects through NSI_GET_JOB.
  }
}

function validateJobItems(items, operation = "add") {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("Select at least one game.");
  }
  if (items.length > 500) {
    throw new Error("A single library change is limited to 500 games.");
  }

  return items.map((item) => {
    const domain = String(item.domain || "").toLowerCase().trim();
    const nexusName = String(item.nexusName || "").trim();
    const sourceName = String(item.sourceName || item.steamName || "").trim();
    const providerId = String(item.providerId || (operation === "remove" ? "nexus" : "steam")).toLowerCase();
    const providerIsValid = operation === "remove"
      ? providerId === "nexus"
      : Boolean(PROVIDERS[providerId]);
    if (
      !providerIsValid ||
      !/^[a-z0-9][a-z0-9._;'-]{0,120}$/.test(domain) ||
      !nexusName ||
      nexusName.length > 200 ||
      !sourceName ||
      sourceName.length > 200
    ) {
      throw new Error("One of the selected Nexus matches is invalid.");
    }
    return {
      providerId: providerId.slice(0, 32),
      sourceId: String(item.sourceId || item.steamAppId || "").slice(0, 200),
      sourceName: sourceName.slice(0, 200),
      nexusName,
      domain,
      status: "queued",
      error: null
    };
  });
}

async function startJob(items, ownerTabId, operation = "add") {
  const existing = await getStored(JOB_KEY);
  if (existing?.status === "running") {
    throw new Error("A My games change is already running.");
  }
  if (operation !== "add" && operation !== "remove") {
    throw new Error("That My games operation is not supported.");
  }

  const job = {
    id: crypto.randomUUID(),
    operation,
    ownerTabId,
    createdAt: Date.now(),
    completedAt: null,
    status: "running",
    currentIndex: 0,
    workerTabId: null,
    items: validateJobItems(items, operation),
    totals: null
  };
  recalculateTotals(job);
  await setStored(JOB_KEY, job);
  await notifyJobOwner(job);
  schedulePump();
  return publicJob(job);
}

function startImport(items, ownerTabId) {
  return startJob(items, ownerTabId, "add");
}

function startRemoval(items, ownerTabId) {
  return startJob(items, ownerTabId, "remove");
}

async function completeJob(job, status = "complete") {
  job.status = status;
  job.completedAt = Date.now();
  job.workerTabId = null;
  recalculateTotals(job);
  await setStored(JOB_KEY, job);
  await notifyJobOwner(job);
}

function schedulePump(delayMs = 0) {
  setTimeout(() => {
    void pumpJob();
  }, delayMs);
}

async function markWorkerFailure(job, message) {
  const item = job.items[job.currentIndex];
  if (item) {
    item.status = "failed";
    item.error = message;
  }
  job.currentIndex += 1;
  job.workerTabId = null;
  recalculateTotals(job);
  await setStored(JOB_KEY, job);
  await notifyJobOwner(job);
}

async function processWorkerTab(job, tab) {
  const item = job.items[job.currentIndex];
  if (!item) {
    await closeTabQuietly(job.workerTabId);
    await completeJob(job);
    return;
  }

  try {
    const response = await sendMessageWithRetry(tab.id, {
      type: "NSI_SET_NEXUS_GAME_STATE",
      game: { name: item.nexusName, domain: item.domain },
      shouldBookmark: job.operation !== "remove"
    });
    if (!response?.ok) {
      throw new Error(response?.error || "Nexus did not confirm the My games change.");
    }

    const latest = (await getStored(JOB_KEY)) || job;
    if (latest.status !== "running" || latest.workerTabId !== tab.id) {
      await closeTabQuietly(tab.id);
      return;
    }

    const latestItem = latest.items[latest.currentIndex];
    latestItem.status = response.status === "already"
      ? "already"
      : latest.operation === "remove"
        ? "removed"
        : "added";
    latestItem.error = null;
    latest.currentIndex += 1;
    latest.workerTabId = null;
    recalculateTotals(latest);
    await setStored(JOB_KEY, latest);
    await closeTabQuietly(tab.id);
    await notifyJobOwner(latest);
  } catch (error) {
    const latest = (await getStored(JOB_KEY)) || job;
    if (latest.status === "running" && latest.workerTabId === tab.id) {
      await markWorkerFailure(latest, errorMessage(error));
    }
    await closeTabQuietly(tab.id);
  }

  schedulePump(250);
}

async function pumpJob() {
  if (pumpRunning) {
    return;
  }
  pumpRunning = true;

  try {
    const job = await getStored(JOB_KEY);
    if (!job || job.status !== "running") {
      return;
    }

    if (job.currentIndex >= job.items.length) {
      await completeJob(job);
      return;
    }

    if (Number.isInteger(job.workerTabId)) {
      try {
        const workerTab = await extensionApi.tabs.get(job.workerTabId);
        if (workerTab.status === "complete") {
          await processWorkerTab(job, workerTab);
        }
        return;
      } catch {
        job.workerTabId = null;
        const item = job.items[job.currentIndex];
        if (item?.status === "opening") {
          item.status = "queued";
        }
        recalculateTotals(job);
        await setStored(JOB_KEY, job);
      }
    }

    const item = job.items[job.currentIndex];
    item.status = "opening";
    const searchUrl = `https://www.nexusmods.com/games?keyword=${encodeURIComponent(item.nexusName)}`;

    try {
      const tab = await extensionApi.tabs.create({ active: false, url: searchUrl });
      job.workerTabId = tab.id;
      recalculateTotals(job);
      await setStored(JOB_KEY, job);
      await notifyJobOwner(job);
      if (tab.status === "complete") {
        schedulePump();
      }
    } catch (error) {
      item.status = "failed";
      item.error = errorMessage(error);
      job.currentIndex += 1;
      job.workerTabId = null;
      recalculateTotals(job);
      await setStored(JOB_KEY, job);
      await notifyJobOwner(job);
      schedulePump(250);
    }
  } finally {
    pumpRunning = false;
  }
}

async function cancelImport() {
  const job = await getStored(JOB_KEY);
  if (!job || job.status !== "running") {
    return publicJob(job);
  }

  const workerTabId = job.workerTabId;
  for (const item of job.items) {
    if (item.status === "queued" || item.status === "opening") {
      item.status = "cancelled";
      item.error = null;
    }
  }
  job.currentIndex = job.items.length;
  job.workerTabId = null;
  await completeJob(job, "cancelled");
  await closeTabQuietly(workerTabId);
  return publicJob(job);
}

extensionApi.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message?.type) {
    return undefined;
  }

  if (message.type === "NSI_SCAN_LIBRARY") {
    handleScan(message)
      .then((data) => sendResponse({ ok: true, data }))
      .catch((error) => sendResponse({ ok: false, error: errorMessage(error) }));
    return true;
  }

  if (message.type === "NSI_START_IMPORT") {
    startImport(message.items, sender.tab?.id)
      .then((job) => sendResponse({ ok: true, job }))
      .catch((error) => sendResponse({ ok: false, error: errorMessage(error) }));
    return true;
  }

  if (message.type === "NSI_START_REMOVE") {
    startRemoval(message.items, sender.tab?.id)
      .then((job) => sendResponse({ ok: true, job }))
      .catch((error) => sendResponse({ ok: false, error: errorMessage(error) }));
    return true;
  }

  if (message.type === "NSI_CANCEL_IMPORT") {
    cancelImport()
      .then((job) => sendResponse({ ok: true, job }))
      .catch((error) => sendResponse({ ok: false, error: errorMessage(error) }));
    return true;
  }

  if (message.type === "NSI_GET_JOB") {
    getStored(JOB_KEY)
      .then((job) => sendResponse({ ok: true, job: publicJob(job) }))
      .catch((error) => sendResponse({ ok: false, error: errorMessage(error) }));
    return true;
  }

  if (message.type === "NSI_GET_SETTINGS") {
    getStored(SETTINGS_KEY)
      .then((settings) => sendResponse({ ok: true, settings: settings || {} }))
      .catch((error) => sendResponse({ ok: false, error: errorMessage(error) }));
    return true;
  }

  if (message.type === "NSI_OPEN_PROVIDER_PAGE") {
    const provider = PROVIDERS[String(message.providerId || "").toLowerCase()];
    if (!provider) {
      sendResponse({ ok: false, error: "That provider does not have a browser sign-in page." });
      return undefined;
    }
    extensionApi.tabs.create({ active: true, url: provider.accountUrl })
      .then((tab) => sendResponse({ ok: true, tabId: tab.id }))
      .catch((error) => sendResponse({ ok: false, error: errorMessage(error) }));
    return true;
  }

  if (message.type === "NSI_CLEAR_FINISHED_JOB") {
    getStored(JOB_KEY)
      .then(async (job) => {
        if (job && job.status !== "running") {
          await removeStored(JOB_KEY);
        }
        sendResponse({ ok: true });
      })
      .catch((error) => sendResponse({ ok: false, error: errorMessage(error) }));
    return true;
  }

  if (message.type === "NSI_NEXUS_WORKER_READY") {
    schedulePump();
    sendResponse({ ok: true });
    return undefined;
  }

  return undefined;
});

extensionApi.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status !== "complete") {
    return;
  }
  getStored(JOB_KEY)
    .then((job) => {
      if (job?.status === "running" && job.workerTabId === tabId) {
        schedulePump();
      }
    })
    .catch(() => {});
});

extensionApi.tabs.onRemoved.addListener((tabId) => {
  getStored(JOB_KEY)
    .then(async (job) => {
      if (job?.status !== "running" || job.workerTabId !== tabId) {
        return;
      }
      await markWorkerFailure(job, "The temporary Nexus tab was closed before the game was added.");
      schedulePump(250);
    })
    .catch(() => {});
});

extensionApi.action.onClicked.addListener(async () => {
  const tabs = await extensionApi.tabs.query({ url: "https://www.nexusmods.com/" });
  let tab = tabs[0];
  if (tab?.id) {
    await extensionApi.tabs.update(tab.id, { active: true });
  } else {
    tab = await extensionApi.tabs.create({ active: true, url: "https://www.nexusmods.com/" });
    await waitForTabComplete(tab.id);
  }

  try {
    await sendMessageWithRetry(tab.id, { type: "NSI_OPEN_IMPORTER" });
  } catch {
    // The in-page button remains the primary entry point if the page is still hydrating.
  }
});

extensionApi.runtime.onStartup.addListener(() => schedulePump(500));
schedulePump(500);

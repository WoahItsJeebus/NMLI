"use strict";

const fixtureResults = [
  {
    steam: { appId: "489830", name: "The Elder Scrolls V: Skyrim Special Edition" },
    status: "existing",
    match: { game: { id: 1704, name: "Skyrim Special Edition", domain: "skyrimspecialedition" }, confidence: 1, reason: "Steam ID match", autoSelect: true }
  },
  {
    steam: { appId: "413150", name: "Stardew Valley" },
    status: "ready",
    match: { game: { id: 1303, name: "Stardew Valley", domain: "stardewvalley" }, confidence: 1, reason: "Steam ID match", autoSelect: true }
  },
  {
    steam: { appId: "1086940", name: "Baldur's Gate 3" },
    status: "ready",
    match: { game: { id: 3474, name: "Baldur's Gate 3", domain: "baldursgate3" }, confidence: 1, reason: "Steam ID match", autoSelect: true }
  },
  {
    steam: { appId: "1265920", name: "Life is Strange Remastered" },
    status: "review",
    match: { game: { id: 4298, name: "Life Is Strange Remastered", domain: "lifeisstrangeremastered" }, confidence: 0.91, reason: "Title match", autoSelect: false, ambiguous: true }
  },
  {
    steam: { appId: "438100", name: "VRChat" },
    status: "not_found",
    match: null
  }
];

const fixtureState = new URLSearchParams(location.search).get("state") || "results";
const fixtureScanResults = fixtureState === "scroll"
  ? Array.from({ length: 24 }, (_, index) => ({
      steam: { appId: String(900000 + index), name: `Fixture Game ${String(index + 1).padStart(2, "0")}` },
      status: "ready",
      match: {
        game: {
          id: 8000 + index,
          name: `Fixture Game ${String(index + 1).padStart(2, "0")}`,
          domain: `fixturegame${index + 1}`
        },
        confidence: 1,
        reason: "Steam ID match",
        autoSelect: true
      }
    }))
  : fixtureResults;
const fixtureJob = fixtureState === "progress" ? {
  status: "running",
  currentGame: "Baldur's Gate 3",
  totals: { total: 8, added: 4, already: 1, failed: 0, queued: 3, cancelled: 0 }
} : fixtureState === "complete" ? {
  status: "complete",
  currentGame: null,
  totals: { total: 8, added: 7, already: 1, failed: 0, queued: 0, cancelled: 0 }
} : null;

window.chrome = {
  runtime: {
    lastError: null,
    getURL(path) {
      return new URL(`../${path}`, location.href).href;
    },
    onMessage: { addListener() {} },
    sendMessage(message, callback) {
      const responses = {
        NSI_GET_JOB: { ok: true, job: fixtureJob },
        NSI_GET_SETTINGS: { ok: true, settings: {} },
        NSI_SCAN_LIBRARY: {
          ok: true,
          data: {
            providerId: message.providerId || "steam",
            providerName: message.providerId === "gog" ? "GOG" : "Steam",
            accountName: message.providerId === "gog" ? "Signed-in GOG account" : "Jeebus",
            profileName: "Jeebus",
            profileUrl: "https://steamcommunity.com/id/example",
            libraryGameCount: 303,
            steamGameCount: 303,
            catalogGameCount: 5095,
            summary: fixtureState === "scroll"
              ? { ready: fixtureScanResults.length, review: 0, existing: 0, notFound: 0 }
              : { ready: 2, review: 1, existing: 1, notFound: 1 },
            results: fixtureScanResults
          }
        }
      };
      setTimeout(() => callback(responses[message.type] || { ok: true }), 20);
    }
  }
};

window.__NSI_FIXTURE_PROVIDER__ = fixtureState === "results" || fixtureState === "scroll" ? "steam" : null;
window.__NSI_FIXTURE_AUTO_SCAN__ = fixtureState === "results" || fixtureState === "scroll";
window.__NSI_FIXTURE_REMOVE__ = fixtureState === "remove";

window.addEventListener("load", () => {
  const timer = setInterval(() => {
    const importButton = document.getElementById("nsi-import-button");
    if (!importButton) return;
    clearInterval(timer);
    if (fixtureState !== "home") {
      importButton.click();
    }
  }, 30);
});

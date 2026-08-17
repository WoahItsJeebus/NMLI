"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  collectGamesFromLinks,
  expectedGameCount,
  extractAppId
} = require("../steam-library.js");

test("extracts Steam app IDs from store links", () => {
  assert.equal(extractAppId("https://store.steampowered.com/app/377160"), "377160");
  assert.equal(extractAppId("https://steamcommunity.com/app/377160"), null);
});

test("deduplicates app links and ignores generic navigation labels", () => {
  assert.deepEqual(
    collectGamesFromLinks([
      { href: "https://store.steampowered.com/app/377160", text: "Fallout 4" },
      { href: "https://store.steampowered.com/app/377160", text: "Store Page" },
      { href: "https://store.steampowered.com/app/1245620", text: "ELDEN RING" },
      { href: "https://store.steampowered.com/app/1245620", text: "My Game Content" }
    ]),
    [
      { appId: "1245620", name: "ELDEN RING" },
      { appId: "377160", name: "Fallout 4" }
    ]
  );
});

test("reads the All Games count with comma separators", () => {
  assert.equal(expectedGameCount("Recently Played (4) All Games (1,234)"), 1234);
  assert.equal(expectedGameCount("No library counter"), null);
});

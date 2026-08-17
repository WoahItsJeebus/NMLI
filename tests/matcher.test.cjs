"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  compactCatalog,
  matchLibrary,
  normalizeName,
  normalizeSteamProfileInput,
  scoreNames
} = require("../matcher.js");

const catalog = [
  { id: 110, name: "Skyrim", domain_name: "skyrim" },
  { id: 1704, name: "Skyrim Special Edition", domain_name: "skyrimspecialedition" },
  { id: 2830, name: "Skyrim - PlayStation 4", domain_name: "skyrimplaystation4" },
  { id: 162, name: "Dark Souls", domain_name: "darksouls" },
  { id: 883, name: "Life is Strange", domain_name: "lifeistrange" },
  { id: 4298, name: "Life Is Strange Remastered", domain_name: "lifeisstrangeremastered" },
  { id: 893, name: "Grand Theft Auto V Legacy", domain_name: "gta5" },
  { id: 7627, name: "Grand Theft Auto V Enhanced", domain_name: "gta5enhanced" },
  { id: 952, name: "The Witcher 3", domain_name: "witcher3" },
  { id: 4333, name: "Elden Ring", domain_name: "eldenring" }
];

test("normalizes trademarks, punctuation, accents, and Roman numerals", () => {
  assert.equal(normalizeName("DARK SOULS™ III"), "dark souls 3");
  assert.equal(normalizeName("Pokémon®: Café"), "pokemon cafe");
});

test("compacts the live Nexus catalog shape", () => {
  assert.deepEqual(compactCatalog(catalog).at(0), {
    id: 110,
    name: "Skyrim",
    domain: "skyrim"
  });
});

test("uses a verified Steam app ID alias for franchise-prefixed titles", () => {
  const [result] = matchLibrary(
    [{ appId: "489830", name: "The Elder Scrolls V: Skyrim Special Edition" }],
    catalog,
    []
  );
  assert.equal(result.status, "ready");
  assert.equal(result.match.game.domain, "skyrimspecialedition");
  assert.equal(result.match.reason, "Steam ID match");
  assert.equal(result.match.autoSelect, true);
});

test("does not apply Steam app ID aliases to another provider", () => {
  const [result] = matchLibrary(
    [{ appId: "489830", name: "Unrelated GOG title", providerId: "gog" }],
    catalog,
    []
  );
  assert.equal(result.status, "not_found");
  assert.equal(result.source.providerId, "gog");
});

test("keeps remastered and original Nexus pages separate", () => {
  const [result] = matchLibrary(
    [{ appId: "1265920", name: "Life is Strange Remastered" }],
    catalog,
    []
  );
  assert.equal(result.match.game.domain, "lifeisstrangeremastered");
  assert.equal(result.status, "ready");
  assert.ok(scoreNames("Life is Strange Remastered", "Life is Strange") < 0.9);
});

test("keeps Legacy and Enhanced editions separate", () => {
  const [result] = matchLibrary(
    [{ appId: "999999", name: "Grand Theft Auto V Enhanced" }],
    catalog,
    []
  );
  assert.equal(result.match.game.domain, "gta5enhanced");
});

test("recognizes games that are already in My games by domain", () => {
  const [result] = matchLibrary(
    [{ appId: "1245620", name: "ELDEN RING" }],
    catalog,
    [{ domain: "eldenring", name: "Elden Ring" }]
  );
  assert.equal(result.status, "existing");
});

test("does not surface Steam utilities as import candidates", () => {
  const [result] = matchLibrary(
    [{ appId: "123", name: "Example Dedicated Server" }],
    catalog,
    []
  );
  assert.equal(result.status, "not_found");
  assert.equal(result.skipped, true);
});

test("normalizes signed-in, vanity, SteamID64, and profile URL inputs", () => {
  assert.equal(
    normalizeSteamProfileInput("").libraryUrl,
    "https://steamcommunity.com/my/games/?tab=all"
  );
  assert.equal(
    normalizeSteamProfileInput("WoahItsJeebus").libraryUrl,
    "https://steamcommunity.com/id/WoahItsJeebus/games/?tab=all"
  );
  assert.equal(
    normalizeSteamProfileInput("76561198092832112").libraryUrl,
    "https://steamcommunity.com/profiles/76561198092832112/games/?tab=all"
  );
  assert.equal(
    normalizeSteamProfileInput("https://steamcommunity.com/id/WoahItsJeebus/games/?tab=all").profileUrl,
    "https://steamcommunity.com/id/WoahItsJeebus"
  );
});

test("rejects non-Steam URLs and malformed IDs", () => {
  assert.throws(() => normalizeSteamProfileInput("https://example.com/id/test"), /Only steamcommunity/);
  assert.throws(() => normalizeSteamProfileInput("bad profile value!"), /Steam profile URL/);
});

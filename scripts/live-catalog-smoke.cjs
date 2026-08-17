"use strict";

const { matchLibrary } = require("../matcher.js");

const samples = [
  { appId: "271590", name: "Grand Theft Auto V Legacy" },
  { appId: "211420", name: "DARK SOULS™: Prepare To Die Edition" },
  { appId: "377160", name: "Fallout 4" },
  { appId: "1245620", name: "ELDEN RING" },
  { appId: "489830", name: "The Elder Scrolls V: Skyrim Special Edition" },
  { appId: "438100", name: "VRChat" }
];

async function main() {
  const startedAt = performance.now();
  const response = await fetch("https://data.nexusmods.com/file/nexus-data/games.json", {
    headers: { "User-Agent": "Mozilla/5.0" }
  });
  if (!response.ok) {
    throw new Error(`Nexus catalog returned HTTP ${response.status}`);
  }
  const catalog = await response.json();
  const results = matchLibrary(samples, catalog, []);
  const elapsed = Math.round(performance.now() - startedAt);

  console.log(`Matched ${samples.length} sample Steam titles against ${catalog.length} Nexus games in ${elapsed} ms.`);
  for (const result of results) {
    console.log(
      `${(result.source || result.steam).name} -> ${result.match?.game?.name || "no confident match"} [${result.status}]`
    );
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

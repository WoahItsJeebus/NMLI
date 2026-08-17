"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
const firefoxManifest = JSON.parse(
  fs.readFileSync(path.join(root, "manifest.firefox.json"), "utf8")
);

function pngDimensions(file) {
  const data = fs.readFileSync(file);
  assert.deepEqual([...data.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
}

test("uses Manifest V3 without Chrome side panel APIs", () => {
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.side_panel, undefined);
  assert.ok(!manifest.permissions.includes("sidePanel"));
});

test("ships a Firefox Manifest V3 variant for AMO signing", () => {
  assert.equal(firefoxManifest.manifest_version, 3);
  assert.deepEqual(firefoxManifest.background, {
    scripts: ["matcher.js", "background.js"]
  });
  assert.equal(firefoxManifest.background.service_worker, undefined);
  assert.deepEqual(firefoxManifest.browser_specific_settings, {
    gecko: {
      id: "{1c7ffba3-5837-428d-9414-13d353402dde}",
      strict_min_version: "142.0",
      data_collection_permissions: {
        required: ["none"]
      }
    }
  });
  assert.deepEqual(firefoxManifest.permissions, manifest.permissions);
  assert.deepEqual(firefoxManifest.host_permissions, manifest.host_permissions);
  assert.deepEqual(firefoxManifest.content_scripts, manifest.content_scripts);
  assert.deepEqual(firefoxManifest.web_accessible_resources, manifest.web_accessible_resources);
});

test("keeps permissions narrow and includes the four required hosts", () => {
  assert.deepEqual(manifest.permissions, ["storage"]);
  assert.deepEqual(new Set(manifest.host_permissions), new Set([
    "https://www.nexusmods.com/*",
    "https://steamcommunity.com/*",
    "https://www.gog.com/*",
    "https://data.nexusmods.com/*"
  ]));
});

test("ships the 1.0 manifest metadata and store-ready icons", () => {
  assert.equal(manifest.version, "1.0.0");
  assert.ok(manifest.description.length <= 132);
  assert.deepEqual(manifest.icons, {
    16: "icons/icon-16.png",
    32: "icons/icon-32.png",
    48: "icons/icon-48.png",
    64: "icons/icon-64.png",
    128: "icons/icon-128.png"
  });
  for (const [size, file] of Object.entries(manifest.icons)) {
    assert.deepEqual(pngDimensions(path.join(root, file)), {
      width: Number(size),
      height: Number(size)
    });
  }
  assert.deepEqual(manifest.action.default_icon, {
    16: "icons/icon-16.png",
    32: "icons/icon-32.png",
    48: "icons/icon-48.png"
  });
});

test("store listing artwork has the required dimensions", () => {
  const expected = new Map([
    ["store-assets/chrome/icon-128.png", [128, 128]],
    ["store-assets/chrome/01-platform-chooser-1280x800.png", [1280, 800]],
    ["store-assets/chrome/02-import-progress-1280x800.png", [1280, 800]],
    ["store-assets/chrome/small-promo-440x280.png", [440, 280]],
    ["store-assets/chrome/marquee-promo-1400x560.png", [1400, 560]],
    ["store-assets/opera/icon-64.png", [64, 64]],
    ["store-assets/opera/icon-128.png", [128, 128]],
    ["store-assets/opera/01-platform-chooser-800x600.png", [800, 600]],
    ["store-assets/opera/02-import-progress-800x600.png", [800, 600]]
  ]);
  for (const [file, [width, height]] of expected) {
    assert.deepEqual(pngDimensions(path.join(root, file)), { width, height }, file);
  }
});

test("submission kit includes privacy, disclosure, and reviewer materials", () => {
  for (const file of [
    "store-listing/CHROME_WEB_STORE.md",
    "store-listing/OPERA_ADDONS.md",
    "store-listing/PRIVACY_PRACTICES.md",
    "store-listing/REVIEW_NOTES.md",
    "store-listing/SUBMISSION_CHECKLIST.md",
    "store-listing/site/index.html",
    "store-listing/site/privacy.html",
    "store-listing/site/support.html"
  ]) {
    assert.equal(fs.existsSync(path.join(root, file)), true, `${file} should exist`);
  }
});

test("all packaged script and stylesheet files exist", () => {
  const files = new Set();
  files.add(manifest.background.service_worker);
  for (const file of firefoxManifest.background.scripts) files.add(file);
  for (const script of manifest.content_scripts) {
    for (const file of script.js || []) files.add(file);
    for (const file of script.css || []) files.add(file);
  }
  for (const file of files) {
    assert.equal(fs.existsSync(path.join(root, file)), true, `${file} should exist`);
  }
});

test("background code selects promise APIs and supports Firefox event pages", () => {
  const background = fs.readFileSync(path.join(root, "background.js"), "utf8");
  const worker = fs.readFileSync(path.join(root, "nexus-worker.js"), "utf8");
  assert.match(background, /typeof importScripts === "function"/);
  assert.match(background, /globalThis\.browser \?\? globalThis\.chrome/);
  assert.match(worker, /globalThis\.browser \?\? globalThis\.chrome/);
});

test("the account-changing modal uses a closed shadow root", () => {
  const content = fs.readFileSync(path.join(root, "content.js"), "utf8");
  assert.match(content, /attachShadow\(\{ mode: "closed" \}\)/);
});

test("uses one generic Import entry point with a platform chooser", () => {
  const content = fs.readFileSync(path.join(root, "content.js"), "utf8");
  assert.match(content, /nsi-import-label\">Import<\/span>/);
  assert.match(content, /Where should we import from\?/);
  assert.match(content, /data-provider=\"steam\"/);
  assert.match(content, /data-provider=\"gog\"/);
  assert.match(content, /Ubisoft Connect/);
  assert.match(content, /EA app/);
});

test("starts with no import matches selected and offers both bulk selection controls", () => {
  const content = fs.readFileSync(path.join(root, "content.js"), "utf8");
  assert.match(content, /data-action="select-safe">Select all ready matches<\/button>/);
  assert.match(content, /data-action="clear-selection" disabled>Unselect all<\/button>/);
  assert.match(content, /state\.selected = new Set\(\);\s+renderResults\(\);\s+announce\("Scan complete\. No games are selected yet\."\)/);
});

test("ships a confirmed, opt-in My games removal workflow", () => {
  const content = fs.readFileSync(path.join(root, "content.js"), "utf8");
  const background = fs.readFileSync(path.join(root, "background.js"), "utf8");
  const worker = fs.readFileSync(path.join(root, "nexus-worker.js"), "utf8");
  assert.match(content, /data-action="manage-games">Manage My games<\/button>/);
  assert.match(content, /Nothing is preselected\./);
  assert.match(content, /data-action="review-removal"/);
  assert.match(content, /data-action="confirm-removal"/);
  assert.match(content, /type: "NSI_START_REMOVE"/);
  assert.match(background, /message\.type === "NSI_START_REMOVE"/);
  assert.match(background, /operation: job\.operation \|\| "add"/);
  assert.match(background, /shouldBookmark: job\.operation !== "remove"/);
  assert.match(worker, /NSI_SET_NEXUS_GAME_STATE/);
  assert.match(worker, /return shouldBookmark \? "added" : "removed"/);
});

test("ships locally bundled official-site provider icons", () => {
  assert.deepEqual(manifest.web_accessible_resources, [{
    resources: ["provider-icons/*.png", "provider-icons/*.svg"],
    matches: ["https://www.nexusmods.com/*"]
  }]);
  for (const provider of ["steam", "gog", "ubisoft"]) {
    assert.deepEqual(pngDimensions(path.join(root, `provider-icons/${provider}.png`)), {
      width: 256,
      height: 256
    });
  }
  const eaIcon = fs.readFileSync(path.join(root, "provider-icons/ea.svg"), "utf8");
  assert.match(eaIcon, /viewBox="0 0 399 399"/);
  const sources = fs.readFileSync(path.join(root, "provider-icons/SOURCES.md"), "utf8");
  assert.match(sources, /GOG_LOGO_DARK\.png/);
  assert.match(sources, /Ubisoft_logos1116\.zip/);
});

test("the open importer owns wheel scrolling and restores the Nexus page", () => {
  const content = fs.readFileSync(path.join(root, "content.js"), "utf8");
  assert.match(content, /addEventListener\("wheel", handleModalWheel, \{ passive: false \}\)/);
  assert.match(content, /root\.style\.overflow = "hidden"/);
  assert.match(content, /body\.style\.overflow = "hidden"/);
  assert.match(content, /content\.scrollBy\(\{ left: deltaX, top: deltaY, behavior: "auto" \}\)/);
  assert.match(content, /root\.style\.overflow = pageScrollLock\.rootOverflow/);
  assert.match(content, /body\.style\.overflow = pageScrollLock\.bodyOverflow/);
});

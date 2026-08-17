"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  extractGamesFromPayload,
  fetchLibraryPages,
  paginationFromPayload
} = require("../gog-library.js");

test("extracts and deduplicates GOG products without HTML in titles", () => {
  assert.deepEqual(
    extractGamesFromPayload({
      products: [
        { id: 1207664643, title: "The Witcher 3: Wild Hunt" },
        { productId: "1207664643", title: "The Witcher 3: Wild Hunt" },
        { slug: "baldurs_gate_3", name: "Baldur's Gate 3 &amp; Bonus" },
        { id: 99, title: "" }
      ]
    }),
    [
      { appId: "gog:baldurs_gate_3", name: "Baldur's Gate 3 & Bonus", providerId: "gog" },
      { appId: "gog:1207664643", name: "The Witcher 3: Wild Hunt", providerId: "gog" }
    ]
  );
});

test("reads alternate GOG pagination shapes", () => {
  assert.deepEqual(paginationFromPayload({ pagination: { totalPages: 3, totalItems: 73 } }), {
    totalPages: 3,
    totalProducts: 73
  });
});

test("reads every reported GOG library page with browser credentials", async () => {
  const requested = [];
  const pages = {
    1: { products: [{ id: 1, title: "Alpha" }], totalPages: 2, totalProducts: 2 },
    2: { products: [{ id: 2, title: "Beta" }], totalPages: 2, totalProducts: 2 }
  };
  const fetchImpl = async (url, options) => {
    const page = Number(new URL(url).searchParams.get("page"));
    requested.push({ url, options });
    return {
      ok: true,
      status: 200,
      url,
      headers: { get: () => "application/json" },
      json: async () => pages[page]
    };
  };

  const result = await fetchLibraryPages({ location: { origin: "https://www.gog.com" } }, fetchImpl);
  assert.equal(requested.length, 2);
  assert.equal(requested[0].options.credentials, "include");
  assert.deepEqual(result, {
    games: [
      { appId: "gog:1", name: "Alpha", providerId: "gog" },
      { appId: "gog:2", name: "Beta", providerId: "gog" }
    ],
    expectedCount: 2
  });
});

test("turns a GOG sign-in redirect into an actionable error", async () => {
  const fetchImpl = async () => ({
    ok: true,
    status: 200,
    url: "https://www.gog.com/en/account##openlogin",
    headers: { get: () => "text/html" }
  });

  await assert.rejects(
    fetchLibraryPages({ location: { origin: "https://www.gog.com" } }, fetchImpl),
    /not signed in/i
  );
});

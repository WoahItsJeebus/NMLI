"use strict";

function nsiNormalize(value) {
  return String(value || "")
    .replace(/[™®©]/g, "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function nsiDomainFromHref(href) {
  try {
    const path = new URL(href, location.href).pathname.split("/").filter(Boolean);
    if (path[0] === "games" && path[1]) {
      return decodeURIComponent(path[1]).toLowerCase();
    }
    return path[0] ? decodeURIComponent(path[0]).toLowerCase() : "";
  } catch {
    return "";
  }
}

function nsiFindGameTile(game) {
  const tiles = [...document.querySelectorAll('[data-e2eid="game-tile"]')];
  const domainMatch = tiles.find((tile) =>
    [...tile.querySelectorAll("a[href]")].some(
      (anchor) => nsiDomainFromHref(anchor.href) === game.domain.toLowerCase()
    )
  );
  if (domainMatch) {
    return domainMatch;
  }

  return tiles.find((tile) => {
    const title = tile.querySelector('[data-e2eid="game-tile-title"]')?.textContent;
    return nsiNormalize(title) === nsiNormalize(game.name);
  });
}

async function nsiWaitForTile(game, timeoutMs = 20_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const tile = nsiFindGameTile(game);
    if (tile) {
      return tile;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return null;
}

async function nsiSetBookmarkState(game, shouldBookmark) {
  const tile = await nsiWaitForTile(game);
  if (!tile) {
    throw new Error(`Nexus did not return an exact result for ${game.name}.`);
  }

  const button = tile.querySelector(
    'button[aria-pressed][aria-label*="bookmark" i], button[aria-label^="Bookmark "]'
  );
  if (!button) {
    throw new Error(`Nexus did not expose a bookmark control for ${game.name}.`);
  }
  const alreadyInDesiredState = (button.getAttribute("aria-pressed") === "true") === shouldBookmark;
  if (alreadyInDesiredState) {
    return "already";
  }

  button.click();
  const startedAt = Date.now();
  while (Date.now() - startedAt < 15_000) {
    if ((button.getAttribute("aria-pressed") === "true") === shouldBookmark) {
      return shouldBookmark ? "added" : "removed";
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  throw new Error(
    `Nexus did not confirm that ${game.name} was ${shouldBookmark ? "added" : "removed"}.`
  );
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (
    message?.type !== "NSI_SET_NEXUS_GAME_STATE" &&
    message?.type !== "NSI_BOOKMARK_NEXUS_GAME"
  ) {
    return undefined;
  }

  const shouldBookmark = message.type === "NSI_BOOKMARK_NEXUS_GAME"
    ? true
    : message.shouldBookmark !== false;
  nsiSetBookmarkState(message.game, shouldBookmark)
    .then((status) => sendResponse({ ok: true, status }))
    .catch((error) => sendResponse({ ok: false, error: error.message }));
  return true;
});

(globalThis.browser ?? globalThis.chrome).runtime
  .sendMessage({ type: "NSI_NEXUS_WORKER_READY" })
  .catch(() => {});

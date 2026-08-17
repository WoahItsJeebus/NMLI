"use strict";

(function initializeNexusImporter() {
  if (window.top !== window || document.documentElement.dataset.nsiContentLoaded === "true") {
    return;
  }
  document.documentElement.dataset.nsiContentLoaded = "true";

  const PROVIDERS = Object.freeze({
    steam: {
      id: "steam",
      name: "Steam",
      icon: chrome.runtime.getURL("provider-icons/steam.png"),
      status: "Ready",
      statusClass: "ready",
      description: "Scan the signed-in account or paste a public Steam profile.",
      available: true
    },
    gog: {
      id: "gog",
      name: "GOG",
      icon: chrome.runtime.getURL("provider-icons/gog.png"),
      status: "Beta",
      statusClass: "beta",
      description: "Read the game collection visible on your signed-in GOG account page.",
      available: true
    },
    ubisoft: {
      id: "ubisoft",
      name: "Ubisoft Connect",
      icon: chrome.runtime.getURL("provider-icons/ubisoft.png"),
      status: "Desktop app only",
      statusClass: "unavailable",
      description: "Ubisoft currently exposes the owned library through Ubisoft Connect for PC.",
      available: false
    },
    ea: {
      id: "ea",
      name: "EA app",
      icon: chrome.runtime.getURL("provider-icons/ea.svg"),
      status: "Desktop app only",
      statusClass: "unavailable",
      description: "EA currently exposes the owned library through the EA app for Windows.",
      available: false
    }
  });

  const state = {
    modalOpen: false,
    providerId: null,
    scan: null,
    selected: new Set(),
    activeTab: "ready",
    search: "",
    removeGames: [],
    removeSelected: new Set(),
    removeSearch: "",
    job: null,
    previousFocus: null
  };

  let modalHost;
  let shadow;
  let headerButton;
  let enhancedSection;
  let resizeObserver;
  let pageScrollLock;

  const MODAL_STYLES = `
    :host { color-scheme: dark; font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    * { box-sizing: border-box; }
    button, input { font: inherit; }
    button { color: inherit; }
    a { color: inherit; }
    .backdrop { align-items: center; background: rgba(4, 5, 7, .76); display: none; inset: 0; justify-content: center; overscroll-behavior: none; padding: 24px; pointer-events: auto; position: fixed; backdrop-filter: blur(8px); }
    .backdrop[data-open="true"] { display: flex; }
    .dialog { background: linear-gradient(180deg, #202126 0%, #17181c 100%); border: 1px solid rgba(255,255,255,.11); border-radius: 14px; box-shadow: 0 28px 90px rgba(0,0,0,.58); color: #f2f3f5; display: flex; flex-direction: column; max-height: min(820px, calc(100vh - 48px)); max-width: 960px; overflow: hidden; width: 100%; }
    .topbar { align-items: flex-start; border-bottom: 1px solid rgba(255,255,255,.09); display: flex; gap: 20px; justify-content: space-between; padding: 22px 24px 20px; }
    .brand { align-items: center; display: flex; gap: 13px; }
    .brand-icon { align-items: center; background: linear-gradient(145deg, #f18b3d, #bb5522); border-radius: 10px; box-shadow: 0 8px 25px rgba(225,112,45,.24); display: flex; height: 42px; justify-content: center; width: 42px; }
    .brand-icon svg { height: 23px; width: 23px; }
    h2 { font-size: 1.25rem; line-height: 1.25; margin: 0; }
    .subtitle { color: #a9acb5; font-size: .86rem; line-height: 1.45; margin: 4px 0 0; }
    .icon-button { align-items: center; background: transparent; border: 0; border-radius: 8px; color: #aeb1b9; cursor: pointer; display: flex; height: 34px; justify-content: center; transition: background .15s, color .15s; width: 34px; }
    .icon-button:hover { background: rgba(255,255,255,.08); color: #fff; }
    .icon-button:focus-visible, .button:focus-visible, input:focus-visible, .tab:focus-visible { outline: 2px solid #f08a43; outline-offset: 2px; }
    .content { min-height: 310px; overflow: auto; overscroll-behavior: contain; padding: 24px; }
    .intro { margin: 12px auto 8px; max-width: 680px; }
    .provider-intro { margin: 2px auto 18px; max-width: 780px; text-align: center; }
    .provider-intro h3 { font-size: 1.45rem; margin: 0 0 8px; }
    .provider-intro p { color: #a8acb5; font-size: .88rem; line-height: 1.55; margin: 0; }
    .provider-grid { display: grid; gap: 12px; grid-template-columns: repeat(2,minmax(0,1fr)); margin: 0 auto; max-width: 780px; }
    .provider-card { align-items: center; background: rgba(255,255,255,.035); border: 1px solid rgba(255,255,255,.09); border-radius: 11px; cursor: pointer; display: grid; gap: 12px; grid-template-columns: 48px minmax(0,1fr) auto; min-height: 100px; padding: 15px; text-align: left; transition: background .15s, border .15s, transform .15s; width: 100%; }
    .provider-card:hover { background: rgba(255,255,255,.065); border-color: rgba(240,138,67,.42); transform: translateY(-1px); }
    .provider-card:focus-visible { outline: 2px solid #f08a43; outline-offset: 2px; }
    .provider-card[data-available="false"] { background: rgba(255,255,255,.02); color: #a1a5ae; }
    .provider-mark { align-items: center; background: linear-gradient(145deg,#343842,#22252c); border: 1px solid rgba(255,255,255,.09); border-radius: 10px; display: flex; height: 48px; justify-content: center; overflow: hidden; width: 48px; }
    .provider-mark img { height: 38px; max-width: 38px; object-fit: contain; width: 38px; }
    .provider-card[data-provider="steam"] .provider-mark { background: linear-gradient(145deg,#173858,#0b1c31); }
    .provider-card[data-provider="gog"] .provider-mark, .provider-card[data-provider="ea"] .provider-mark { background: #f6f7f9; }
    .provider-name { display: block; font-size: .93rem; font-weight: 800; }
    .provider-description { color: #9297a1; display: block; font-size: .75rem; line-height: 1.4; margin-top: 5px; }
    .provider-status { border-radius: 999px; font-size: .66rem; font-weight: 800; padding: 5px 8px; white-space: nowrap; }
    .provider-status-ready { background: rgba(67,176,108,.14); color: #8fe0ab; }
    .provider-status-beta { background: rgba(232,160,53,.14); color: #f4c274; }
    .provider-status-unavailable { background: rgba(255,255,255,.07); color: #a8acb5; }
    .provider-notice { background: rgba(255,255,255,.035); border: 1px solid rgba(255,255,255,.075); border-radius: 10px; margin-top: 18px; padding: 16px; }
    .provider-notice h4 { font-size: .92rem; margin: 0 0 7px; }
    .provider-notice p { color: #a4a8b1; font-size: .82rem; line-height: 1.55; margin: 0; }
    .setup-actions { display: flex; flex-wrap: wrap; gap: 10px; }
    .eyebrow { color: #f09a5c; font-size: .73rem; font-weight: 800; letter-spacing: .12em; margin-bottom: 8px; text-transform: uppercase; }
    .intro h3 { font-size: 1.55rem; line-height: 1.25; margin: 0 0 10px; }
    .intro-copy { color: #b8bbc3; font-size: .94rem; line-height: 1.62; margin: 0 0 22px; }
    .field-label { color: #f1f2f4; display: block; font-size: .85rem; font-weight: 700; margin-bottom: 8px; }
    .input-row { display: flex; gap: 10px; }
    .text-input { background: #101115; border: 1px solid rgba(255,255,255,.14); border-radius: 8px; color: #f4f5f6; flex: 1; min-height: 42px; padding: 0 13px; transition: border .15s, background .15s; }
    .text-input::placeholder { color: #747984; }
    .text-input:hover { border-color: rgba(255,255,255,.25); }
    .text-input:focus { background: #14151a; border-color: #e98641; outline: none; }
    .helper { color: #898d97; font-size: .78rem; line-height: 1.45; margin: 8px 0 0; }
    .privacy { align-items: flex-start; background: rgba(255,255,255,.035); border: 1px solid rgba(255,255,255,.075); border-radius: 9px; color: #aeb1b9; display: flex; font-size: .78rem; gap: 9px; line-height: 1.5; margin-top: 22px; padding: 12px 13px; }
    .privacy svg { flex: none; height: 17px; margin-top: 1px; width: 17px; }
    .button { align-items: center; border: 0; border-radius: 8px; cursor: pointer; display: inline-flex; font-size: .86rem; font-weight: 750; gap: 7px; justify-content: center; min-height: 40px; padding: 0 16px; transition: background .15s, color .15s, opacity .15s, transform .15s; }
    .button svg, .icon-button svg { height: 18px; width: 18px; }
    .button:active { transform: translateY(1px); }
    .button:disabled { cursor: not-allowed; opacity: .45; }
    .button-primary { background: #df762e; color: #fff; }
    .button-primary:hover:not(:disabled) { background: #ef8840; }
    .button-secondary { background: rgba(255,255,255,.08); color: #e4e6e9; }
    .button-secondary:hover:not(:disabled) { background: rgba(255,255,255,.13); }
    .button-quiet { background: transparent; color: #b9bcc4; }
    .button-quiet:hover:not(:disabled) { background: rgba(255,255,255,.07); color: #fff; }
    .button-danger { background: rgba(211,76,76,.14); color: #ffaaa5; }
    .loading { align-items: center; display: flex; flex-direction: column; justify-content: center; min-height: 350px; text-align: center; }
    .spinner { animation: spin .8s linear infinite; border: 3px solid rgba(255,255,255,.12); border-radius: 50%; border-top-color: #ed883f; height: 42px; margin-bottom: 18px; width: 42px; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .loading h3, .empty h3 { font-size: 1.12rem; margin: 0 0 7px; }
    .loading p, .empty p { color: #969aa4; font-size: .86rem; line-height: 1.5; margin: 0; max-width: 470px; }
    .summary-grid { display: grid; gap: 10px; grid-template-columns: repeat(4, minmax(0,1fr)); margin-bottom: 18px; }
    .summary-card { background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.08); border-radius: 9px; padding: 12px 14px; }
    .summary-value { display: block; font-size: 1.15rem; font-weight: 800; }
    .summary-label { color: #90949e; display: block; font-size: .72rem; margin-top: 2px; }
    .result-toolbar { align-items: center; display: flex; gap: 12px; justify-content: space-between; margin-bottom: 12px; }
    .selection-actions { display: flex; flex: none; flex-wrap: wrap; gap: 8px; }
    .search-wrap { flex: 1; max-width: 410px; position: relative; }
    .search-wrap svg { color: #777c86; height: 17px; left: 12px; pointer-events: none; position: absolute; top: 50%; transform: translateY(-50%); width: 17px; }
    .search-wrap input { padding-left: 38px; width: 100%; }
    .tabs { border-bottom: 1px solid rgba(255,255,255,.09); display: flex; gap: 4px; margin-bottom: 14px; overflow-x: auto; }
    .tab { background: transparent; border: 0; border-bottom: 2px solid transparent; color: #9498a2; cursor: pointer; font-size: .8rem; font-weight: 700; padding: 9px 11px; white-space: nowrap; }
    .tab:hover { color: #d7d9de; }
    .tab[data-active="true"] { border-bottom-color: #e88038; color: #fff; }
    .game-list { display: flex; flex-direction: column; gap: 7px; min-height: 220px; }
    .game-row { align-items: center; background: rgba(255,255,255,.035); border: 1px solid rgba(255,255,255,.07); border-radius: 9px; display: grid; gap: 12px; grid-template-columns: auto 80px minmax(0,1fr) auto; min-height: 68px; padding: 9px 11px; transition: background .15s, border .15s; }
    .game-row[data-checkable="true"] { cursor: pointer; }
    .game-row[data-checkable="true"]:hover { background: rgba(255,255,255,.06); border-color: rgba(255,255,255,.12); }
    .game-row[data-selected="true"] { background: rgba(224,118,46,.08); border-color: rgba(232,128,57,.38); }
    .game-check { accent-color: #e67f37; height: 17px; width: 17px; }
    .game-art { align-items: center; background: linear-gradient(145deg,#333740,#202229); border-radius: 7px; color: #c4c7ce; display: flex; font-size: .9rem; font-weight: 800; height: 44px; justify-content: center; overflow: hidden; position: relative; width: 78px; }
    .game-art img { height: 100%; object-fit: cover; position: absolute; width: 100%; }
    .game-names { min-width: 0; }
    .steam-name { color: #f0f1f3; display: block; font-size: .87rem; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .nexus-name { color: #969aa4; display: block; font-size: .75rem; margin-top: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .nexus-name a { color: #d9a47e; text-decoration: none; }
    .nexus-name a:hover { text-decoration: underline; }
    .badge { border-radius: 999px; font-size: .68rem; font-weight: 750; padding: 4px 7px; white-space: nowrap; }
    .badge-ready { background: rgba(67,176,108,.14); color: #8fe0ab; }
    .badge-review { background: rgba(232,160,53,.14); color: #f4c274; }
    .badge-existing { background: rgba(95,143,205,.14); color: #9ec5f1; }
    .badge-muted { background: rgba(255,255,255,.07); color: #a5a9b1; }
    .empty { align-items: center; display: flex; flex-direction: column; justify-content: center; min-height: 220px; text-align: center; }
    .footer { align-items: center; border-top: 1px solid rgba(255,255,255,.09); display: flex; gap: 10px; justify-content: space-between; min-height: 68px; padding: 13px 24px; }
    .footer-note { color: #90949e; font-size: .78rem; }
    .footer-actions { display: flex; gap: 9px; }
    .error-box { background: rgba(204,61,61,.1); border: 1px solid rgba(239,99,92,.35); border-radius: 9px; color: #ffc1bd; font-size: .84rem; line-height: 1.5; margin: 0 auto 16px; max-width: 680px; padding: 12px 14px; }
    .progress-shell { margin: 4px auto; max-width: 720px; }
    .progress-heading { align-items: flex-end; display: flex; justify-content: space-between; margin-bottom: 16px; }
    .progress-heading h3 { font-size: 1.28rem; margin: 0 0 5px; }
    .progress-heading p { color: #9a9ea8; font-size: .82rem; margin: 0; }
    .progress-number { color: #f09a5d; font-size: 1rem; font-weight: 800; }
    .progress-track { background: rgba(255,255,255,.08); border-radius: 999px; height: 8px; overflow: hidden; }
    .progress-bar { background: linear-gradient(90deg,#d96c26,#f29c56); border-radius: inherit; height: 100%; transition: width .25s ease; }
    .current-game { align-items: center; background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.08); border-radius: 9px; display: flex; gap: 10px; margin-top: 17px; padding: 13px 14px; }
    .pulse { animation: pulse 1.2s ease-in-out infinite; background: #ed873f; border-radius: 50%; height: 8px; width: 8px; }
    @keyframes pulse { 50% { box-shadow: 0 0 0 6px rgba(237,135,63,0); opacity:.65; } }
    .job-results { display: grid; gap: 8px; grid-template-columns: repeat(4,minmax(0,1fr)); margin-top: 18px; }
    .job-stat { background: rgba(255,255,255,.035); border-radius: 8px; padding: 11px; text-align: center; }
    .job-stat b { display: block; font-size: 1rem; }
    .job-stat span { color: #8f939d; font-size: .7rem; }
    .complete-mark { align-items: center; background: rgba(69,180,107,.15); border: 1px solid rgba(84,202,126,.28); border-radius: 50%; color: #8ce0aa; display: flex; height: 54px; justify-content: center; margin: 2px auto 15px; width: 54px; }
    .complete { margin: 20px auto; max-width: 650px; text-align: center; }
    .complete h3 { font-size: 1.35rem; margin: 0 0 7px; }
    .complete p { color: #9da1aa; font-size: .86rem; line-height: 1.5; margin: 0; }
    .removal-warning { align-items: flex-start; background: rgba(211,76,76,.09); border: 1px solid rgba(255,116,107,.2); border-radius: 10px; color: #d7a7a3; display: flex; font-size: .8rem; gap: 9px; line-height: 1.5; margin: 0 auto 16px; max-width: 780px; padding: 12px 13px; }
    .removal-warning svg { color: #ff8f88; flex: none; height: 18px; margin-top: 1px; width: 18px; }
    .confirm-list { background: rgba(255,255,255,.035); border: 1px solid rgba(255,255,255,.08); border-radius: 10px; list-style: none; margin: 18px 0 0; max-height: 250px; overflow: auto; padding: 8px 14px; }
    .confirm-list li { border-bottom: 1px solid rgba(255,255,255,.06); color: #c9ccd2; font-size: .82rem; padding: 9px 0; }
    .confirm-list li:last-child { border-bottom: 0; }
    .sr-only { clip: rect(0,0,0,0); clip-path: inset(50%); height: 1px; overflow: hidden; position: absolute; white-space: nowrap; width: 1px; }
    @media (max-width: 720px) {
      .backdrop { align-items: stretch; padding: 0; }
      .dialog { border: 0; border-radius: 0; max-height: 100vh; }
      .topbar, .content, .footer { padding-left: 16px; padding-right: 16px; }
      .summary-grid { grid-template-columns: repeat(2,minmax(0,1fr)); }
      .provider-grid { grid-template-columns: 1fr; }
      .provider-card { grid-template-columns: 44px minmax(0,1fr); }
      .provider-mark { height: 44px; width: 44px; }
      .provider-status { grid-column: 2; justify-self: start; }
      .input-row, .result-toolbar { align-items: stretch; flex-direction: column; }
      .search-wrap { max-width: none; }
      .selection-actions { width: 100%; }
      .selection-actions .button { flex: 1; }
      .game-row { grid-template-columns: auto 66px minmax(0,1fr); }
      .game-art { height: 38px; width: 64px; }
      .game-row .badge { grid-column: 3; justify-self: start; }
      .footer { align-items: stretch; flex-direction: column; }
      .footer-actions { justify-content: flex-end; }
    }
  `;

  function sendRuntimeMessage(message) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response) => {
        const runtimeError = chrome.runtime.lastError;
        if (runtimeError) {
          reject(new Error(runtimeError.message));
          return;
        }
        resolve(response);
      });
    });
  }

  function svgIcon(name) {
    const icons = {
      close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M18.3 5.7 12 12l6.3 6.3-1.4 1.4-6.3-6.3-6.3 6.3-1.4-1.4L9.2 12 2.9 5.7l1.4-1.4 6.3 6.3 6.3-6.3z"/></svg>',
      download: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M11 4h2v9l3.5-3.5 1.4 1.4-5.9 5.9-5.9-5.9 1.4-1.4L11 13V4Zm-6 14h14v2H5v-2Z"/></svg>',
      lock: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M17 9h-1V7a4 4 0 0 0-8 0v2H7a2 2 0 0 0-2 2v9h14v-9a2 2 0 0 0-2-2Zm-7-2a2 2 0 0 1 4 0v2h-4V7Zm3 8.7V18h-2v-2.3a2 2 0 1 1 2 0Z"/></svg>',
      search: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="m20.7 19.3-4.1-4.1a7 7 0 1 0-1.4 1.4l4.1 4.1 1.4-1.4ZM5 11a6 6 0 1 1 12 0 6 6 0 0 1-12 0Z"/></svg>',
      check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="m9 17.2-4.2-4.2-1.4 1.4L9 20 21 8l-1.4-1.4L9 17.2Z"/></svg>',
      trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M9 3h6l1 2h4v2H4V5h4l1-2Zm-3 6h12l-1 12H7L6 9Zm3 2v8h2v-8H9Zm4 0v8h2v-8h-2Z"/></svg>',
      warning: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 3 1.7 21h20.6L12 3Zm0 5.2 6.9 10.8H5.1L12 8.2ZM11 11v4h2v-4h-2Zm0 5.5v2h2v-2h-2Z"/></svg>'
    };
    return icons[name] || "";
  }

  function replaceMarkup(target, html) {
    const parsed = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
    target.replaceChildren(...parsed.body.childNodes);
  }

  function createModal() {
    if (modalHost?.isConnected) {
      return;
    }

    modalHost = document.createElement("div");
    modalHost.id = "nsi-modal-host";
    shadow = modalHost.attachShadow({ mode: "closed" });
    replaceMarkup(shadow, `
      <style>${MODAL_STYLES}</style>
      <div class="backdrop" data-open="false">
        <section class="dialog" role="dialog" aria-modal="true" aria-labelledby="nsi-title">
          <header class="topbar">
            <div class="brand">
              <span class="brand-icon">${svgIcon("download")}</span>
              <div>
                <h2 id="nsi-title">Import games</h2>
                <p class="subtitle">Match a PC game library with games supported by Nexus Mods.</p>
              </div>
            </div>
            <button class="icon-button" data-action="close" aria-label="Close library importer">${svgIcon("close")}</button>
          </header>
          <main class="content" id="nsi-view"></main>
          <footer class="footer" id="nsi-footer"></footer>
          <div class="sr-only" aria-live="polite" id="nsi-live"></div>
        </section>
      </div>`);
    document.documentElement.appendChild(modalHost);

    shadow.addEventListener("click", handleModalClick);
    shadow.addEventListener("input", handleModalInput);
    const backdrop = shadow.querySelector(".backdrop");
    backdrop.addEventListener("wheel", handleModalWheel, { passive: false });
    backdrop.addEventListener("click", (event) => {
      if (event.target === event.currentTarget) {
        closeModal();
      }
    });
  }

  function announce(message) {
    const live = shadow?.getElementById("nsi-live");
    if (live) {
      live.textContent = "";
      requestAnimationFrame(() => {
        live.textContent = message;
      });
    }
  }

  function setView(html) {
    replaceMarkup(shadow.getElementById("nsi-view"), html);
  }

  function setFooter(html) {
    replaceMarkup(shadow.getElementById("nsi-footer"), html);
  }

  function setDialogHeader(title, subtitle) {
    const heading = shadow?.getElementById("nsi-title");
    const copy = shadow?.querySelector(".subtitle");
    if (heading) {
      heading.textContent = title;
    }
    if (copy) {
      copy.textContent = subtitle;
    }
  }

  function renderProviderChooser() {
    setDialogHeader("Import games", "Match a PC game library with games supported by Nexus Mods.");
    const cards = Object.values(PROVIDERS).map((provider) => `
      <button class="provider-card" data-action="choose-provider" data-provider="${provider.id}" data-available="${provider.available}">
        <span class="provider-mark" aria-hidden="true"><img src="${provider.icon}" alt="" /></span>
        <span><span class="provider-name">${provider.name}</span><span class="provider-description">${provider.description}</span></span>
        <span class="provider-status provider-status-${provider.statusClass}">${provider.status}</span>
      </button>`).join("");
    setView(`
      <div class="provider-intro">
        <div class="eyebrow">Choose a platform</div>
        <h3>Where should we import from?</h3>
        <p>Supported browser libraries can be scanned after you sign in. Nothing is added until you review the matches.</p>
      </div>
      <div class="provider-grid">${cards}</div>`);
    setFooter('<span class="footer-note">Passwords and sign-in cookies stay with each platform.</span><div class="footer-actions"><button class="button button-secondary" data-action="manage-games">Manage My games</button><button class="button button-quiet" data-action="close">Close</button></div>');
  }

  function renderSteamSetup(error = "") {
    setView(`
      ${error ? '<div class="error-box" id="nsi-error"></div>' : ""}
      <div class="intro">
        <div class="eyebrow">Steam library sync</div>
        <h3>Find the games Nexus can add</h3>
        <p class="intro-copy">Leave the field blank to use the Steam account currently signed in to Opera GX. You can also paste a public Steam profile URL, custom ID, or SteamID64.</p>
        <label class="field-label" for="nsi-profile">Steam profile <span style="color:#8f939c;font-weight:500">(optional)</span></label>
        <div class="input-row">
          <input class="text-input" id="nsi-profile" autocomplete="off" spellcheck="false" placeholder="Signed-in Steam account" />
          <button class="button button-primary" data-action="scan">${svgIcon("search")}Scan library</button>
        </div>
        <p class="helper">Steam must expose the library to the signed-in account. Private profiles still work when you are signed in to that Steam account.</p>
        <div class="setup-actions"><button class="button button-secondary" data-action="open-provider-page" data-provider="steam">Open Steam sign-in / library</button></div>
        <div class="privacy">${svgIcon("lock")}<span>The extension reads game names and Steam app IDs only. It never reads or stores Steam passwords, cookies, session tokens, or Nexus login data.</span></div>
      </div>`);
    setFooter('<span class="footer-note">Nothing is added until you review and confirm the matches.</span><div class="footer-actions"><button class="button button-quiet" data-action="choose-platform">Back to platforms</button><button class="button button-quiet" data-action="close">Close</button></div>');
    if (error) {
      shadow.getElementById("nsi-error").textContent = error;
    }
    void populateLastProfile();
  }

  function renderGogSetup(error = "") {
    setView(`
      ${error ? '<div class="error-box" id="nsi-error"></div>' : ""}
      <div class="intro">
        <div class="eyebrow">GOG library sync - Beta</div>
        <h3>Scan your GOG collection</h3>
        <p class="intro-copy">Sign in to GOG in this browser, then scan the games shown on your account library page. The scan opens that page in a temporary background tab and closes it automatically.</p>
        <div class="setup-actions">
          <button class="button button-primary" data-action="scan">${svgIcon("search")}Scan GOG library</button>
          <button class="button button-secondary" data-action="open-provider-page" data-provider="gog">Open GOG sign-in / library</button>
        </div>
        <div class="provider-notice"><h4>Why Beta?</h4><p>GOG provides a browser library, but not a documented public library API. This adapter reads only GOG's own account page and stops with an error if the page cannot be read reliably.</p></div>
        <div class="privacy">${svgIcon("lock")}<span>The extension reads visible GOG game names and product IDs only. Your password, sign-in cookies, orders, payment details, and account secrets are never read or stored.</span></div>
      </div>`);
    setFooter('<span class="footer-note">Finish signing in on GOG, then return here and scan.</span><div class="footer-actions"><button class="button button-quiet" data-action="choose-platform">Back to platforms</button><button class="button button-quiet" data-action="close">Close</button></div>');
    if (error) {
      shadow.getElementById("nsi-error").textContent = error;
    }
  }

  function renderUnavailableProvider() {
    const provider = PROVIDERS[state.providerId];
    setView(`
      <div class="intro">
        <div class="eyebrow">${provider.name}</div>
        <h3>A browser library is not available</h3>
        <p class="intro-copy">${provider.description} This extension cannot safely discover the games you own from a normal browser sign-in, so it does not request access to your ${provider.name} account.</p>
        <div class="provider-notice"><h4>Why it is shown here</h4><p>The platform picker is ready for additional adapters, but providers are enabled only when there is a browser-visible library the extension can read without collecting credentials or installing a native helper.</p></div>
      </div>`);
    setFooter('<span class="footer-note">No permission or account access is requested for this platform.</span><div class="footer-actions"><button class="button button-secondary" data-action="choose-platform">Choose another platform</button><button class="button button-quiet" data-action="close">Close</button></div>');
  }

  function renderIntro(error = "") {
    if (!state.providerId) {
      renderProviderChooser();
    } else if (state.providerId === "steam") {
      renderSteamSetup(error);
    } else if (state.providerId === "gog") {
      renderGogSetup(error);
    } else {
      renderUnavailableProvider();
    }
  }

  async function populateLastProfile() {
    const input = shadow?.getElementById("nsi-profile");
    if (!input || input.value) {
      return;
    }
    try {
      const response = await sendRuntimeMessage({ type: "NSI_GET_SETTINGS" });
      const profile = response?.settings?.lastSteamProfileUrl || response?.settings?.lastProfileUrl;
      if (profile && !profile.endsWith("/my/")) {
        input.value = profile;
      }
    } catch {
      // Remembering the last non-sensitive profile URL is optional.
    }
  }

  function renderLoading() {
    const provider = PROVIDERS[state.providerId] || PROVIDERS.steam;
    setView(`<div class="loading"><div class="spinner"></div><h3>Reading your ${provider.name} library</h3><p>Then I’ll compare it with the current Nexus games catalog. The temporary ${provider.name} tab stays in the background and closes automatically.</p></div>`);
    setFooter('<span class="footer-note">Large libraries can take a few seconds.</span><div class="footer-actions"><button class="button button-quiet" data-action="close">Hide</button></div>');
  }

  function resultCounts() {
    return state.scan?.summary || { ready: 0, review: 0, existing: 0, notFound: 0 };
  }

  function resultForSelection(domain) {
    return state.scan?.results.find((entry) => entry.match?.game?.domain === domain);
  }

  function sourceForEntry(entry) {
    return entry.source || entry.steam || { appId: "", name: "Unknown game", providerId: state.scan?.providerId };
  }

  function renderResultRow(entry) {
    const source = sourceForEntry(entry);
    const checkable = entry.status === "ready" || entry.status === "review";
    const selected = checkable && state.selected.has(entry.match.game.domain);
    const row = document.createElement(checkable ? "label" : "div");
    row.className = "game-row";
    row.dataset.checkable = String(checkable);
    row.dataset.selected = String(selected);

    if (checkable) {
      const checkbox = document.createElement("input");
      checkbox.className = "game-check";
      checkbox.type = "checkbox";
      checkbox.checked = selected;
      checkbox.dataset.domain = entry.match.game.domain;
      checkbox.setAttribute("aria-label", `Select ${source.name}`);
      row.appendChild(checkbox);
    } else {
      const spacer = document.createElement("span");
      spacer.setAttribute("aria-hidden", "true");
      row.appendChild(spacer);
    }

    const art = document.createElement("span");
    art.className = "game-art";
    art.textContent = source.name.slice(0, 1).toUpperCase();
    if ((source.providerId || state.scan?.providerId) === "steam" && /^\d+$/.test(source.appId)) {
      const image = document.createElement("img");
      image.alt = "";
      image.loading = "lazy";
      image.src = `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${source.appId}/capsule_184x69.jpg`;
      image.addEventListener("error", () => image.remove(), { once: true });
      art.appendChild(image);
    }
    row.appendChild(art);

    const names = document.createElement("span");
    names.className = "game-names";
    const steamName = document.createElement("span");
    steamName.className = "steam-name";
    steamName.textContent = source.name;
    names.appendChild(steamName);

    const nexusName = document.createElement("span");
    nexusName.className = "nexus-name";
    if (entry.match) {
      nexusName.append("Nexus: ");
      const link = document.createElement("a");
      link.href = `https://www.nexusmods.com/games/${entry.match.game.domain}`;
      link.target = "_blank";
      link.rel = "noreferrer";
      link.textContent = entry.match.game.name;
      link.addEventListener("click", (event) => event.stopPropagation());
      nexusName.appendChild(link);
    } else {
      nexusName.textContent = entry.skipped
        ? "Utility or non-game entry"
        : "No confident Nexus match";
    }
    names.appendChild(nexusName);
    row.appendChild(names);

    const badge = document.createElement("span");
    badge.className = `badge badge-${entry.status === "not_found" ? "muted" : entry.status}`;
    badge.textContent =
      entry.status === "ready"
        ? entry.match.reason
        : entry.status === "review"
          ? `${Math.round(entry.match.confidence * 100)}% — review`
          : entry.status === "existing"
            ? "Already added"
            : entry.skipped
              ? "Skipped"
              : "Not found";
    row.appendChild(badge);
    return row;
  }

  function filteredResults() {
    const query = state.search.trim().toLowerCase();
    return (state.scan?.results || []).filter((entry) => {
      const tabMatches =
        state.activeTab === "not_found"
          ? entry.status === "not_found"
          : entry.status === state.activeTab;
      if (!tabMatches) {
        return false;
      }
      if (!query) {
        return true;
      }
      return `${sourceForEntry(entry).name} ${entry.match?.game?.name || ""}`.toLowerCase().includes(query);
    });
  }

  function renderResultList() {
    const list = shadow.getElementById("nsi-result-list");
    if (!list) {
      return;
    }
    list.replaceChildren();
    const entries = filteredResults();
    if (!entries.length) {
      const empty = document.createElement("div");
      empty.className = "empty";
      const heading = document.createElement("h3");
      heading.textContent = state.search ? "No games match that search" : "Nothing in this group";
      const copy = document.createElement("p");
      copy.textContent = state.search
        ? "Try a shorter game title."
        : "Choose another tab to review the rest of this library.";
      empty.append(heading, copy);
      list.appendChild(empty);
      return;
    }
    const fragment = document.createDocumentFragment();
    for (const entry of entries) {
      fragment.appendChild(renderResultRow(entry));
    }
    list.appendChild(fragment);
  }

  function renderResults() {
    const counts = resultCounts();
    const providerName = state.scan.providerName || PROVIDERS[state.scan.providerId]?.name || "Library";
    const libraryGameCount = state.scan.libraryGameCount ?? state.scan.steamGameCount ?? 0;
    const tabs = [
      ["ready", "Ready", counts.ready],
      ["review", "Review", counts.review],
      ["existing", "Already added", counts.existing],
      ["not_found", "Not on Nexus", counts.notFound]
    ];
    setView(`
      <div class="summary-grid">
        <div class="summary-card"><span class="summary-value">${libraryGameCount}</span><span class="summary-label">${providerName} games</span></div>
        <div class="summary-card"><span class="summary-value">${counts.ready}</span><span class="summary-label">Ready to add</span></div>
        <div class="summary-card"><span class="summary-value">${counts.review}</span><span class="summary-label">Need review</span></div>
        <div class="summary-card"><span class="summary-value">${counts.existing}</span><span class="summary-label">Already in My games</span></div>
      </div>
      <div class="result-toolbar">
        <div class="search-wrap">${svgIcon("search")}<input class="text-input" id="nsi-result-search" placeholder="Filter games" value=""></div>
        <div class="selection-actions">
          <button class="button button-secondary" data-action="select-safe">Select all ready matches</button>
          <button class="button button-quiet" data-action="clear-selection" disabled>Unselect all</button>
        </div>
      </div>
      <nav class="tabs" aria-label="Import result groups">
        ${tabs.map(([id, label, count]) => `<button class="tab" data-action="tab" data-tab="${id}" data-active="${state.activeTab === id}">${label} (${count})</button>`).join("")}
      </nav>
      <div class="game-list" id="nsi-result-list"></div>`);
    renderResultList();
    updateResultsFooter();
  }

  function updateResultsFooter() {
    const selectedCount = state.selected.size;
    setFooter(`<span class="footer-note" id="nsi-results-note"></span><div class="footer-actions"><button class="button button-quiet" data-action="choose-platform">Choose platform</button><button class="button button-quiet" data-action="rescan">Scan again</button><button class="button button-primary" data-action="add-selected" ${selectedCount ? "" : "disabled"}>Add ${selectedCount || "selected"} game${selectedCount === 1 ? "" : "s"}</button></div>`);
    const note = shadow.getElementById("nsi-results-note");
    if (note) {
      note.textContent = `${state.scan.accountName || state.scan.profileName || state.scan.providerName} · ${state.scan.catalogGameCount.toLocaleString()} Nexus games checked`;
    }
    const clearSelection = shadow.querySelector('[data-action="clear-selection"]');
    if (clearSelection) {
      clearSelection.disabled = selectedCount === 0;
    }
  }

  function renderJob() {
    const job = state.job;
    if (!job) {
      return;
    }
    const totals = job.totals;
    const removing = job.operation === "remove";
    const changed = removing ? (totals.removed || 0) : totals.added;
    const finished = changed + totals.already + totals.failed;
    const percent = totals.total ? Math.round((finished / totals.total) * 100) : 0;

    if (job.status === "complete" || job.status === "cancelled") {
      renderCompleteJob(job);
      return;
    }

    setDialogHeader(
      removing ? "Removing games" : "Import games",
      removing
        ? "Update your Nexus Mods My games list through native bookmark controls."
        : "Match a PC game library with games supported by Nexus Mods."
    );
    setView(`
      <div class="progress-shell">
        <div class="progress-heading"><div><div class="eyebrow">${removing ? "Removal" : "Import"} in progress</div><h3>${removing ? "Removing" : "Adding"} games ${removing ? "from" : "to"} My games</h3><p>You can close this window. Progress continues in the background.</p></div><span class="progress-number">${finished} / ${totals.total}</span></div>
        <div class="progress-track"><div class="progress-bar" style="width:${percent}%"></div></div>
        <div class="current-game"><span class="pulse"></span><span>${job.currentGame ? "Working on " : "Preparing next game"}<strong id="nsi-current-game"></strong></span></div>
        <div class="job-results">
          <div class="job-stat"><b>${changed}</b><span>${removing ? "Removed" : "Added"}</span></div>
          <div class="job-stat"><b>${totals.already}</b><span>${removing ? "Already absent" : "Already there"}</span></div>
          <div class="job-stat"><b>${totals.failed}</b><span>Failed</span></div>
          <div class="job-stat"><b>${totals.queued}</b><span>Waiting</span></div>
        </div>
      </div>`);
    const current = shadow.getElementById("nsi-current-game");
    if (current) {
      current.textContent = job.currentGame || "";
    }
    setFooter(`<span class="footer-note">Nexus opens one inactive search tab at a time and closes it after confirmation.</span><div class="footer-actions"><button class="button button-quiet" data-action="close">Hide</button><button class="button button-danger" data-action="cancel-import">Cancel ${removing ? "removal" : "import"}</button></div>`);
  }

  function renderCompleteJob(job) {
    const totals = job.totals;
    const cancelled = job.status === "cancelled";
    const removing = job.operation === "remove";
    const changed = removing ? (totals.removed || 0) : totals.added;
    setDialogHeader(
      removing ? "Manage My games" : "Import games",
      "Review the completed Nexus Mods My games changes."
    );
    setView(`
      <div class="complete">
        <div class="complete-mark">${svgIcon("check")}</div>
        <div class="eyebrow">${cancelled ? `${removing ? "Removal" : "Import"} stopped` : `${removing ? "Removal" : "Import"} complete`}</div>
        <h3>${cancelled ? "The remaining games were left unchanged" : "Your Nexus game list is updated"}</h3>
        <p>${changed} ${removing ? "removed" : "added"}, ${totals.already} already ${removing ? "absent" : "present"}, and ${totals.failed} failed. Refresh the Nexus home page to show the updated tiles.</p>
        <div class="job-results">
          <div class="job-stat"><b>${changed}</b><span>${removing ? "Removed" : "Added"}</span></div>
          <div class="job-stat"><b>${totals.already}</b><span>${removing ? "Already absent" : "Already there"}</span></div>
          <div class="job-stat"><b>${totals.failed}</b><span>Failed</span></div>
          <div class="job-stat"><b>${totals.cancelled}</b><span>Cancelled</span></div>
        </div>
      </div>`);
    setFooter(`<span class="footer-note">Only the games you confirmed were changed.</span><div class="footer-actions"><button class="button button-secondary" data-action="new-scan">${removing ? "Back to importer" : "New scan"}</button><button class="button button-primary" data-action="refresh-page">Refresh My games</button></div>`);
  }

  function extractCurrentGames() {
    const section = findMyGamesSection();
    if (!section) {
      return [];
    }

    const found = new Map();
    for (const anchor of section.querySelectorAll('a[href*="nexusmods.com/games/"]')) {
      try {
        const url = new URL(anchor.href);
        const parts = url.pathname.split("/").filter(Boolean);
        const domain = parts[0] === "games" ? parts[1] : parts[0];
        const image = anchor.querySelector("img");
        const name = image?.alt || anchor.textContent?.trim() || "";
        if (domain && name) {
          const key = domain.toLowerCase();
          const existing = found.get(key);
          found.set(key, {
            domain: key,
            name,
            imageUrl: image?.currentSrc || image?.src || existing?.imageUrl || ""
          });
        }
      } catch {
        // Ignore malformed links injected by other page customizations.
      }
    }
    return [...found.values()].sort((left, right) => left.name.localeCompare(right.name));
  }

  function filteredRemovalGames() {
    const query = state.removeSearch.trim().toLowerCase();
    if (!query) {
      return state.removeGames;
    }
    return state.removeGames.filter((game) =>
      `${game.name} ${game.domain}`.toLowerCase().includes(query)
    );
  }

  function renderRemovalRow(game) {
    const selected = state.removeSelected.has(game.domain);
    const row = document.createElement("label");
    row.className = "game-row";
    row.dataset.checkable = "true";
    row.dataset.selected = String(selected);

    const checkbox = document.createElement("input");
    checkbox.className = "game-check remove-game-check";
    checkbox.type = "checkbox";
    checkbox.checked = selected;
    checkbox.dataset.domain = game.domain;
    checkbox.setAttribute("aria-label", `Select ${game.name} for removal`);
    row.appendChild(checkbox);

    const art = document.createElement("span");
    art.className = "game-art";
    art.textContent = game.name.slice(0, 1).toUpperCase();
    if (game.imageUrl) {
      try {
        const imageUrl = new URL(game.imageUrl, location.href);
        if (imageUrl.protocol === "https:") {
          const image = document.createElement("img");
          image.alt = "";
          image.loading = "lazy";
          image.src = imageUrl.href;
          image.addEventListener("error", () => image.remove(), { once: true });
          art.appendChild(image);
        }
      } catch {
        // Keep the initial fallback when Nexus exposes a malformed image URL.
      }
    }
    row.appendChild(art);

    const names = document.createElement("span");
    names.className = "game-names";
    const title = document.createElement("span");
    title.className = "steam-name";
    title.textContent = game.name;
    const nexusName = document.createElement("span");
    nexusName.className = "nexus-name";
    const link = document.createElement("a");
    link.href = `https://www.nexusmods.com/games/${game.domain}`;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.textContent = game.domain;
    link.addEventListener("click", (event) => event.stopPropagation());
    nexusName.append("Nexus: ", link);
    names.append(title, nexusName);
    row.appendChild(names);

    const badge = document.createElement("span");
    badge.className = "badge badge-existing";
    badge.textContent = "In My games";
    row.appendChild(badge);
    return row;
  }

  function renderRemovalList() {
    const list = shadow.getElementById("nsi-remove-list");
    if (!list) {
      return;
    }
    list.replaceChildren();
    const games = filteredRemovalGames();
    if (!games.length) {
      const empty = document.createElement("div");
      empty.className = "empty";
      const heading = document.createElement("h3");
      heading.textContent = state.removeSearch ? "No games match that search" : "No games were found";
      const copy = document.createElement("p");
      copy.textContent = state.removeSearch
        ? "Try a shorter title."
        : "Expand My games on the Nexus home page, then reopen this panel.";
      empty.append(heading, copy);
      list.appendChild(empty);
      return;
    }

    const fragment = document.createDocumentFragment();
    for (const game of games) {
      fragment.appendChild(renderRemovalRow(game));
    }
    list.appendChild(fragment);
  }

  function updateRemovalFooter() {
    const selectedCount = state.removeSelected.size;
    setFooter(`<span class="footer-note">${selectedCount} selected for removal</span><div class="footer-actions"><button class="button button-quiet" data-action="back-to-import">Back to import</button><button class="button button-danger" data-action="review-removal" ${selectedCount ? "" : "disabled"}>Remove ${selectedCount || "selected"} game${selectedCount === 1 ? "" : "s"}</button></div>`);
    const clearSelection = shadow.querySelector('[data-action="clear-removal-selection"]');
    if (clearSelection) {
      clearSelection.disabled = selectedCount === 0;
    }
  }

  function renderRemovePanel(error = "") {
    setDialogHeader("Manage My games", "Remove selected games from your Nexus Mods My games list.");
    setView(`
      ${error ? '<div class="error-box" id="nsi-remove-error"></div>' : ""}
      <div class="provider-intro">
        <div class="eyebrow">Manage My games</div>
        <h3>Choose games to remove</h3>
        <p>Nothing is preselected. Search the games currently shown in My games and choose only the ones you want to unbookmark.</p>
      </div>
      <div class="removal-warning">${svgIcon("warning")}<span>Removal changes your Nexus account. You will review the selection again before the extension clicks any bookmark controls.</span></div>
      <div class="result-toolbar">
        <div class="search-wrap">${svgIcon("search")}<input class="text-input" id="nsi-remove-search" placeholder="Filter My games" value=""></div>
        <div class="selection-actions"><button class="button button-quiet" data-action="clear-removal-selection" disabled>Unselect all</button></div>
      </div>
      <div class="game-list" id="nsi-remove-list"></div>`);
    if (error) {
      shadow.getElementById("nsi-remove-error").textContent = error;
    }
    const search = shadow.getElementById("nsi-remove-search");
    if (search) {
      search.value = state.removeSearch;
    }
    renderRemovalList();
    updateRemovalFooter();
  }

  function openRemovalPanel() {
    state.removeGames = extractCurrentGames();
    state.removeSelected.clear();
    state.removeSearch = "";
    renderRemovePanel();
  }

  function renderRemoveConfirmation() {
    const selectedGames = state.removeGames.filter((game) =>
      state.removeSelected.has(game.domain)
    );
    if (!selectedGames.length) {
      renderRemovePanel();
      return;
    }

    setDialogHeader("Confirm removal", "Review the games that will be removed from Nexus Mods My games.");
    setView(`
      <div class="intro">
        <div class="eyebrow">Final confirmation</div>
        <h3>Remove ${selectedGames.length} game${selectedGames.length === 1 ? "" : "s"}?</h3>
        <p class="intro-copy">The extension will open one inactive Nexus search tab at a time and turn off that game's native bookmark. This can be stopped, but games already processed will remain removed.</p>
        <ul class="confirm-list" id="nsi-remove-confirm-list"></ul>
      </div>`);
    const list = shadow.getElementById("nsi-remove-confirm-list");
    for (const game of selectedGames) {
      const item = document.createElement("li");
      item.textContent = game.name;
      list.appendChild(item);
    }
    setFooter(`<span class="footer-note">No game is removed until you confirm.</span><div class="footer-actions"><button class="button button-quiet" data-action="cancel-removal-review">Back</button><button class="button button-danger" data-action="confirm-removal">${svgIcon("trash")}Remove ${selectedGames.length} game${selectedGames.length === 1 ? "" : "s"}</button></div>`);
  }

  async function scanLibrary() {
    const input = shadow.getElementById("nsi-profile");
    const profileInput = input?.value || "";
    renderLoading();
    const provider = PROVIDERS[state.providerId] || PROVIDERS.steam;
    announce(`${provider.name} library scan started`);
    try {
      const response = await sendRuntimeMessage({
        type: "NSI_SCAN_LIBRARY",
        providerId: provider.id,
        profileInput,
        currentGames: extractCurrentGames()
      });
      if (!response?.ok) {
        throw new Error(response?.error || "The library scan failed.");
      }
      state.scan = response.data;
      state.activeTab = "ready";
      state.search = "";
      state.selected = new Set();
      renderResults();
      announce("Scan complete. No games are selected yet.");
    } catch (error) {
      renderIntro(error.message);
      announce(`Scan failed. ${error.message}`);
    }
  }

  async function startSelectedImport() {
    const items = [...state.selected]
      .map(resultForSelection)
      .filter(Boolean)
      .map((entry) => {
        const source = sourceForEntry(entry);
        return {
          providerId: source.providerId || state.scan?.providerId || "steam",
          sourceId: source.appId,
          sourceName: source.name,
          nexusName: entry.match.game.name,
          domain: entry.match.game.domain
        };
      });
    if (!items.length) {
      return;
    }

    try {
      const response = await sendRuntimeMessage({ type: "NSI_START_IMPORT", items });
      if (!response?.ok) {
        throw new Error(response?.error || "The import could not start.");
      }
      state.job = response.job;
      renderJob();
      announce("Nexus game import started");
    } catch (error) {
      renderIntro(error.message);
    }
  }

  async function startSelectedRemoval() {
    const items = state.removeGames
      .filter((game) => state.removeSelected.has(game.domain))
      .map((game) => ({
        providerId: "nexus",
        sourceId: game.domain,
        sourceName: game.name,
        nexusName: game.name,
        domain: game.domain
      }));
    if (!items.length) {
      renderRemovePanel();
      return;
    }

    try {
      const response = await sendRuntimeMessage({ type: "NSI_START_REMOVE", items });
      if (!response?.ok) {
        throw new Error(response?.error || "The removal job could not start.");
      }
      state.job = response.job;
      renderJob();
      announce("Nexus game removal started");
    } catch (error) {
      renderRemovePanel(error.message);
      announce(`Removal could not start. ${error.message}`);
    }
  }

  async function cancelImport() {
    try {
      const response = await sendRuntimeMessage({ type: "NSI_CANCEL_IMPORT" });
      if (response?.job) {
        state.job = response.job;
        renderJob();
      }
    } catch (error) {
      const operation = state.job?.operation === "remove" ? "removal" : "import";
      announce(`Could not cancel the ${operation}. ${error.message}`);
    }
  }

  async function openProviderPage(providerId) {
    try {
      const response = await sendRuntimeMessage({ type: "NSI_OPEN_PROVIDER_PAGE", providerId });
      if (!response?.ok) {
        throw new Error(response?.error || "The sign-in page could not be opened.");
      }
      announce(`${PROVIDERS[providerId]?.name || "Provider"} opened in a browser tab.`);
    } catch (error) {
      renderIntro(error.message);
    }
  }

  function handleModalClick(event) {
    const actionButton = event.target.closest("[data-action]");
    if (!actionButton) {
      return;
    }
    const action = actionButton.dataset.action;

    if (action === "close") {
      closeModal();
    } else if (action === "manage-games") {
      openRemovalPanel();
    } else if (action === "back-to-import") {
      state.removeGames = [];
      state.removeSelected.clear();
      state.removeSearch = "";
      renderProviderChooser();
    } else if (action === "choose-provider") {
      state.providerId = actionButton.dataset.provider;
      renderIntro();
    } else if (action === "choose-platform") {
      state.scan = null;
      state.providerId = null;
      state.selected.clear();
      state.removeGames = [];
      state.removeSelected.clear();
      state.removeSearch = "";
      renderProviderChooser();
    } else if (action === "open-provider-page") {
      void openProviderPage(actionButton.dataset.provider);
    } else if (action === "scan") {
      void scanLibrary();
    } else if (action === "rescan" || action === "new-scan") {
      state.scan = null;
      state.selected.clear();
      if (action === "new-scan") {
        void sendRuntimeMessage({ type: "NSI_CLEAR_FINISHED_JOB" }).catch(() => {});
        state.job = null;
        state.providerId = null;
        state.removeGames = [];
        state.removeSelected.clear();
        state.removeSearch = "";
      }
      renderIntro();
    } else if (action === "tab") {
      state.activeTab = actionButton.dataset.tab;
      for (const tab of shadow.querySelectorAll(".tab")) {
        tab.dataset.active = String(tab === actionButton);
      }
      renderResultList();
    } else if (action === "select-safe") {
      for (const entry of state.scan?.results || []) {
        if (entry.status === "ready") {
          state.selected.add(entry.match.game.domain);
        }
      }
      renderResultList();
      updateResultsFooter();
    } else if (action === "clear-selection") {
      state.selected.clear();
      renderResultList();
      updateResultsFooter();
    } else if (action === "clear-removal-selection") {
      state.removeSelected.clear();
      renderRemovalList();
      updateRemovalFooter();
    } else if (action === "review-removal") {
      renderRemoveConfirmation();
    } else if (action === "cancel-removal-review") {
      renderRemovePanel();
    } else if (action === "confirm-removal") {
      void startSelectedRemoval();
    } else if (action === "add-selected") {
      void startSelectedImport();
    } else if (action === "cancel-import") {
      void cancelImport();
    } else if (action === "refresh-page") {
      location.reload();
    }
  }

  function handleModalInput(event) {
    if (event.target.matches(".remove-game-check")) {
      const domain = event.target.dataset.domain;
      if (event.target.checked) {
        state.removeSelected.add(domain);
      } else {
        state.removeSelected.delete(domain);
      }
      event.target.closest(".game-row").dataset.selected = String(event.target.checked);
      updateRemovalFooter();
    } else if (event.target.matches(".game-check")) {
      const domain = event.target.dataset.domain;
      if (event.target.checked) {
        state.selected.add(domain);
      } else {
        state.selected.delete(domain);
      }
      event.target.closest(".game-row").dataset.selected = String(event.target.checked);
      updateResultsFooter();
    } else if (event.target.id === "nsi-result-search") {
      state.search = event.target.value;
      renderResultList();
    } else if (event.target.id === "nsi-remove-search") {
      state.removeSearch = event.target.value;
      renderRemovalList();
    }
  }

  function lockPageScroll() {
    if (pageScrollLock || !document.body) {
      return;
    }

    const root = document.documentElement;
    const body = document.body;
    const scrollbarWidth = Math.max(0, window.innerWidth - root.clientWidth);
    pageScrollLock = {
      rootOverflow: root.style.overflow,
      rootOverscrollBehavior: root.style.overscrollBehavior,
      bodyOverflow: body.style.overflow,
      bodyOverscrollBehavior: body.style.overscrollBehavior,
      bodyPaddingRight: body.style.paddingRight
    };

    root.style.overflow = "hidden";
    root.style.overscrollBehavior = "none";
    body.style.overflow = "hidden";
    body.style.overscrollBehavior = "none";
    if (scrollbarWidth > 0) {
      const currentPadding = Number.parseFloat(getComputedStyle(body).paddingRight) || 0;
      body.style.paddingRight = `${currentPadding + scrollbarWidth}px`;
    }
  }

  function unlockPageScroll() {
    if (!pageScrollLock || !document.body) {
      return;
    }

    const root = document.documentElement;
    const body = document.body;
    root.style.overflow = pageScrollLock.rootOverflow;
    root.style.overscrollBehavior = pageScrollLock.rootOverscrollBehavior;
    body.style.overflow = pageScrollLock.bodyOverflow;
    body.style.overscrollBehavior = pageScrollLock.bodyOverscrollBehavior;
    body.style.paddingRight = pageScrollLock.bodyPaddingRight;
    pageScrollLock = null;
  }

  function handleModalWheel(event) {
    if (!state.modalOpen || event.ctrlKey) {
      return;
    }

    const content = shadow?.getElementById("nsi-view");
    if (!content) {
      event.preventDefault();
      return;
    }

    const multiplier = event.deltaMode === 1
      ? 18
      : event.deltaMode === 2
        ? Math.max(1, content.clientHeight)
        : 1;
    const deltaX = event.deltaX * multiplier;
    const deltaY = event.deltaY * multiplier;

    event.preventDefault();
    content.scrollBy({ left: deltaX, top: deltaY, behavior: "auto" });
  }

  async function openModal() {
    createModal();
    if (!state.providerId && typeof globalThis.__NSI_FIXTURE_PROVIDER__ === "string") {
      state.providerId = globalThis.__NSI_FIXTURE_PROVIDER__;
    }
    state.modalOpen = true;
    state.previousFocus = document.activeElement;
    lockPageScroll();
    shadow.querySelector(".backdrop").dataset.open = "true";

    try {
      const response = await sendRuntimeMessage({ type: "NSI_GET_JOB" });
      if (response?.job) {
        state.job = response.job;
      }
    } catch {
      // The importer remains usable even if an old job cannot be restored.
    }

    if (globalThis.__NSI_FIXTURE_REMOVE__ === true) {
      openRemovalPanel();
    } else if (state.job?.status) {
      renderJob();
    } else if (state.scan) {
      state.providerId = state.scan.providerId || state.providerId || "steam";
      renderResults();
    } else {
      renderIntro();
    }

    if (globalThis.__NSI_FIXTURE_AUTO_SCAN__ === true && !state.scan && !state.job) {
      setTimeout(() => void scanLibrary(), 80);
    }

    requestAnimationFrame(() => {
      shadow.querySelector('[data-action="close"]')?.focus();
    });
  }

  function closeModal() {
    if (!shadow) {
      return;
    }
    state.modalOpen = false;
    shadow.querySelector(".backdrop").dataset.open = "false";
    unlockPageScroll();
    state.previousFocus?.focus?.();
  }

  function findMyGamesSection() {
    for (const button of document.querySelectorAll("section > button")) {
      const heading = [...button.querySelectorAll("span")].find(
        (span) => span.textContent?.trim().toLowerCase() === "my games"
      );
      const section = button.parentElement;
      if (heading && section?.querySelector('a[aria-label="Add game"]')) {
        return section;
      }
    }
    return null;
  }

  function positionHeaderButton() {
    if (!headerButton?.isConnected || !enhancedSection?.isConnected) {
      return;
    }
    const nativeButton = enhancedSection.querySelector(":scope > button:not(#nsi-import-button)");
    const title = [...(nativeButton?.querySelectorAll("span") || [])].find(
      (span) => span.textContent?.trim().toLowerCase() === "my games"
    );
    if (!title) {
      return;
    }
    const sectionRect = enhancedSection.getBoundingClientRect();
    const titleRect = title.getBoundingClientRect();
    const desiredLeft = titleRect.right - sectionRect.left + 12;
    const available = sectionRect.width - desiredLeft - 48;
    headerButton.dataset.compact = String(available < 92);
    headerButton.style.left = `${Math.max(112, desiredLeft)}px`;
  }

  function injectHeaderButton() {
    if (location.pathname !== "/" && document.documentElement.dataset.nsiFixture !== "true") {
      return;
    }
    const section = findMyGamesSection();
    if (!section) {
      return;
    }
    if (section.querySelector("#nsi-import-button")) {
      enhancedSection = section;
      headerButton = section.querySelector("#nsi-import-button");
      positionHeaderButton();
      return;
    }

    enhancedSection = section;
    section.style.position = "relative";
    headerButton = document.createElement("button");
    headerButton.id = "nsi-import-button";
    headerButton.type = "button";
    headerButton.title = "Import missing games from a PC game library";
    headerButton.setAttribute("aria-label", "Import games from a PC library");
    replaceMarkup(headerButton, `${svgIcon("download")}<span class="nsi-import-label">Import</span>`);
    headerButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      void openModal();
    });
    section.appendChild(headerButton);

    resizeObserver?.disconnect();
    resizeObserver = new ResizeObserver(positionHeaderButton);
    resizeObserver.observe(section);
    positionHeaderButton();
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && state.modalOpen) {
      closeModal();
    }
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "NSI_OPEN_IMPORTER") {
      void openModal();
      sendResponse({ ok: true });
    } else if (message?.type === "NSI_JOB_UPDATE") {
      state.job = message.job;
      if (state.modalOpen) {
        renderJob();
      }
      sendResponse({ ok: true });
    }
    return undefined;
  });

  const observer = new MutationObserver(() => injectHeaderButton());
  observer.observe(document.documentElement, { childList: true, subtree: true });
  injectHeaderButton();
})();

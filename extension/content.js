import { parsePhoneNumberFromString } from 'libphonenumber-js';

(() => {
  const TARGET_TITLE = 'Taxe Dashboard | Leads';
  const ALLOWED_HOSTS = new Set(['dashboard.taxe.ro', 'taxe.amdav.ro']);

  const HIDDEN_COL_CLASS = 'copilot-hidden-dt-col';
  const OPEN_BUTTON_REPLACED_ATTR = 'data-copilot-open-replaced';
  const STYLE_ID = 'new-taxe-leads-tweaks-style';
  const COUNTRY_ROW_CLASS = 'copilot-lead-country-row';
  const DETAILS_PAIRED_ATTR = 'data-copilot-details-paired';
  const DETAIL_ROW_CLASS = 'copilot-detail-row';
  const DETAIL_LABEL_CLASS = 'copilot-detail-label';
  const DETAIL_VALUE_CLASS = 'copilot-detail-value';
  const DETAILS_BOX_CLASS = 'copilot-details-box';
  const DETAILS_LAYOUT_VERSION = '2';
  const INLINE_CARDS_LAYOUT_ATTR = 'data-copilot-inline-cards-layout';
  const INLINE_CARDS_LAYOUT_VERSION = '1';
  const TIMELINE_TOGGLE_ATTR = 'data-copilot-timeline-toggle';
  const TIMELINE_STATE_ATTR = 'data-copilot-timeline-state';

  const OPENED_LEADS_STORAGE_KEY = 'copilot_opened_leads_v1';
  const OPENED_BTN_CLASS = 'copilot-opened-open-btn';
  const OPENED_ROW_CLASS = 'copilot-opened-lead-row';
  const OPEN_BTN_ATTR = 'data-copilot-open-btn';
  const OPEN_BTN_LEAD_ID_ATTR = 'data-copilot-open-btn-lead-id';
  const MAX_OPENED_LEADS = 5000;

  const LEAD_FLAG_REPLACED_ATTR = 'data-copilot-lead-flag-replaced';
  const LEAD_FLAG_CLASS = 'copilot-lead-flag';
  const LEAD_YEARS_FORMATTED_ATTR = 'data-copilot-years-formatted';

  const STATUS_TRACKING_ATTR = 'data-copilot-status-tracking';
  const STATUS_DEBOUNCE_MS = 350;

  const LEAD_STATUS_STORAGE_KEY = 'copilot_lead_status_map_v1';
  const LEAD_STATUS_LAST_EVENT_KEY = 'copilot_lead_status_last_v1';
  const LIVE_STATUS_LIST_ATTR = 'data-copilot-live-status-list';

  const CREATED_DATE_RENDERED_ATTR = 'data-copilot-created-date-rendered';
  const CREATED_DATE_CLASS = 'copilot-created-date';
  const LEAD_HEADER_TITLE_CLASS = 'copilot-lead-header-title';

  let openedLeadIds = new Set();
  let openedLeadIdsLoadPromise = null;

  let leadStatusMap = {};
  let leadStatusMapLoadPromise = null;
  const statusColumnIndexCache = new WeakMap();



  function ws(s) {
    return String(s || '').replace(/\s+/g, ' ').trim();
  }

  const COPILOT_TOOLTIP_ID = 'copilot-tooltip-bubble';
  const COPILOT_TOOLTIP_TEXT_ATTR = 'data-copilot-tooltip';
  const COPILOT_TOOLTIP_BOUND_ATTR = 'data-copilot-tooltip-bound';
  let copilotTooltipListenersInstalled = false;

  const COPILOT_THEME_ATTR = 'data-copilot-theme';
  const COPILOT_THEME_STORAGE_KEY = 'copilot_dashboard_theme_v1';
  const COPILOT_THEME_TOGGLE_ID = 'copilot-theme-toggle';
  const COPILOT_THEME_TOGGLE_BTN_ID = 'copilot-theme-toggle-btn';

  const COPILOT_USER_ICONIZED_ATTR = 'data-copilot-user-iconized';

  let storedThemeCache = null;
  let storedThemeLoadPromise = null;

  function loadStoredThemeOnce() {
    if (storedThemeLoadPromise) return storedThemeLoadPromise;

    storedThemeLoadPromise = new Promise((resolve) => {
      try {
        if (!chrome || !chrome.storage || !chrome.storage.local || !chrome.storage.local.get) {
          resolve(null);
          return;
        }

        chrome.storage.local.get([COPILOT_THEME_STORAGE_KEY], (res) => {
          const v = res ? String(res[COPILOT_THEME_STORAGE_KEY] || '').toLowerCase() : '';
          if (v === 'dark' || v === 'light') resolve(v);
          else resolve(null);
        });
      } catch {
        resolve(null);
      }
    }).then((v) => {
      if (v === 'dark' || v === 'light') {
        storedThemeCache = v;
        try {
          localStorage.setItem(COPILOT_THEME_STORAGE_KEY, v);
        } catch {
        }
      }
      return v;
    });

    return storedThemeLoadPromise;
  }

  function getStoredTheme() {
    if (storedThemeCache === 'dark' || storedThemeCache === 'light') return storedThemeCache;
    try {
      const v = String(localStorage.getItem(COPILOT_THEME_STORAGE_KEY) || '').toLowerCase();
      if (v === 'dark' || v === 'light') return v;
    } catch {
    }
    return 'light';
  }

  function storeTheme(theme) {
    try {
      storedThemeCache = theme;
      localStorage.setItem(COPILOT_THEME_STORAGE_KEY, theme);
    } catch {
    }

    // Keep the cached "load once" promise in sync so theme doesn't revert
    // when applyAll() re-runs and reuses the first resolved value.
    storedThemeLoadPromise = Promise.resolve(theme);

    try {
      if (chrome && chrome.storage && chrome.storage.local && chrome.storage.local.set) {
        chrome.storage.local.set({ [COPILOT_THEME_STORAGE_KEY]: theme });
      }
    } catch {
    }
  }

  function applyTheme(theme) {
    const t = theme === 'dark' ? 'dark' : 'light';
    document.documentElement.setAttribute(COPILOT_THEME_ATTR, t);
    const btn = document.getElementById(COPILOT_THEME_TOGGLE_BTN_ID);
    if (btn) btn.textContent = t === 'dark' ? 'Dark: On' : 'Dark: Off';
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute(COPILOT_THEME_ATTR) || getStoredTheme();
    const next = String(current).toLowerCase() === 'dark' ? 'light' : 'dark';
    storeTheme(next);
    applyTheme(next);
  }

  function ensureThemeToggle() {
    if (document.getElementById(COPILOT_THEME_TOGGLE_ID)) return;

    const wrap = document.createElement('div');
    wrap.id = COPILOT_THEME_TOGGLE_ID;

    const btn = document.createElement('button');
    btn.id = COPILOT_THEME_TOGGLE_BTN_ID;
    btn.type = 'button';
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleTheme();
    });

    wrap.appendChild(btn);
    (document.body || document.documentElement).appendChild(wrap);

    // Initialize label from stored value.
    applyTheme(getStoredTheme());

    // Sync theme across subdomains (storage API is extension-scoped).
    loadStoredThemeOnce().then((v) => {
      if (v === 'dark' || v === 'light') applyTheme(v);
    });
  }

  function ensureCopilotTooltipBubble() {
    let bubble = document.getElementById(COPILOT_TOOLTIP_ID);
    if (bubble) return bubble;

    bubble = document.createElement('div');
    bubble.id = COPILOT_TOOLTIP_ID;
    bubble.style.display = 'none';
    (document.body || document.documentElement).appendChild(bubble);
    return bubble;
  }

  function hideCopilotTooltip() {
    const bubble = document.getElementById(COPILOT_TOOLTIP_ID);
    if (!bubble) return;
    bubble.style.display = 'none';
    bubble.textContent = '';
  }

  function showCopilotTooltipFor(el) {
    if (!el) return;
    const text = String(el.getAttribute(COPILOT_TOOLTIP_TEXT_ATTR) || '');
    if (!text.trim()) return;

    const bubble = ensureCopilotTooltipBubble();
    bubble.textContent = text;
    bubble.style.display = 'block';

    // Position relative to viewport.
    const rect = el.getBoundingClientRect();

    // Measure after text is set.
    bubble.style.left = '-9999px';
    bubble.style.top = '-9999px';
    const bw = bubble.offsetWidth || 0;
    const bh = bubble.offsetHeight || 0;

    const margin = 8;
    const centerX = rect.left + rect.width / 2;
    let left = Math.round(centerX - bw / 2);
    left = Math.max(margin, Math.min(left, window.innerWidth - bw - margin));

    // Prefer above the element, fall back below if needed.
    let top = Math.round(rect.top - bh - margin);
    if (top < margin) top = Math.round(rect.bottom + margin);
    top = Math.max(margin, Math.min(top, window.innerHeight - bh - margin));

    bubble.style.left = `${left}px`;
    bubble.style.top = `${top}px`;
  }

  function ensureCopilotTooltipListeners() {
    if (copilotTooltipListenersInstalled) return;
    copilotTooltipListenersInstalled = true;

    // Hide on scroll/resize so it never gets stuck.
    window.addEventListener('scroll', hideCopilotTooltip, true);
    window.addEventListener('resize', hideCopilotTooltip, true);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') hideCopilotTooltip();
    });
  }

  function setCopilotTooltip(el, text) {
    if (!el) return;
    const t = String(text || '').replace(/\r\n/g, '\n').trim();

    // Avoid browser/toolkit tooltips.
    try {
      el.removeAttribute('title');
    } catch {
    }

    if (!t) {
      el.removeAttribute(COPILOT_TOOLTIP_TEXT_ATTR);
      hideCopilotTooltip();
      return;
    }

    ensureCopilotTooltipListeners();
    el.setAttribute(COPILOT_TOOLTIP_TEXT_ATTR, t);

    if (el.getAttribute(COPILOT_TOOLTIP_BOUND_ATTR) === '1') return;
    el.setAttribute(COPILOT_TOOLTIP_BOUND_ATTR, '1');

    el.addEventListener('mouseenter', () => showCopilotTooltipFor(el));
    el.addEventListener('mouseleave', hideCopilotTooltip);
    el.addEventListener('focus', () => showCopilotTooltipFor(el));
    el.addEventListener('blur', hideCopilotTooltip);
  }

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .${HIDDEN_COL_CLASS} { display: none !important; }

      button.${OPENED_BTN_CLASS} {
        background-color: rgba(0, 123, 255, 0.45) !important;
        border-color: rgba(0, 123, 255, 0.35) !important;
        color: #fff !important;
      }

      button.${OPENED_BTN_CLASS}:hover {
        background-color: rgba(0, 123, 255, 0.55) !important;
        border-color: rgba(0, 123, 255, 0.45) !important;
      }

      #leads-table_wrapper button.${OPENED_BTN_CLASS},
      .dataTables_wrapper button.${OPENED_BTN_CLASS} {
        filter: brightness(1.15) saturate(0.95);
        opacity: 0.9;
      }

      #leads-table_wrapper button.${OPENED_BTN_CLASS}:hover,
      .dataTables_wrapper button.${OPENED_BTN_CLASS}:hover {
        filter: none;
        opacity: 1;
      }

      #leads-table_wrapper table tbody tr.${OPENED_ROW_CLASS} > td,
      .dataTables_wrapper table tbody tr.${OPENED_ROW_CLASS} > td {
        background-color: rgba(40, 167, 69, 0.10) !important;
      }

      #leads-table_wrapper table tbody tr.${OPENED_ROW_CLASS}:hover > td,
      .dataTables_wrapper table tbody tr.${OPENED_ROW_CLASS}:hover > td {
        background-color: rgba(40, 167, 69, 0.14) !important;
      }

      #precalcs-table thead th.copilot-motiv-col,
      #precalcs-table tbody td.copilot-motiv-col {
        width: 140px;
        max-width: 140px;
      }

      #precalcs-table tbody td.copilot-motiv-col {
        white-space: normal !important;
        overflow-wrap: anywhere;
        word-break: break-word;
        font-size: 0.9em;
        line-height: 1.2;
      }

      #precalcs-table tbody tr.alert-warning > td {
        background-color: #8e0f0fb0 !important;
      }

      #precalcs-table tbody tr.alert-warning:hover > td {
        background-color: #8e0f0fb0 !important;
      }

      #precalcs-table tbody tr.alert-danger > td {
        background-color: rgba(220, 53, 69, 0.16) !important;
      }

      #precalcs-table tbody tr.alert-danger:hover > td {
        background-color: rgba(220, 53, 69, 0.20) !important;
      }

      #precalc_element [style*="color:#707070"],
      #precalc_element [style*="color: #707070"],
      #precalc_element [style*="color:#707070;"],
      #precalc_element [style*="color: #707070;"] {
        color: var(--copilot-text) !important;
      }

      #precalc_element a {
        color: var(--copilot-primary) !important;
      }

      .${LEAD_FLAG_CLASS} {
        display: inline-block;
        width: 18px;
        height: 12px;
        margin-right: 6px;
        vertical-align: -2px;
        background-repeat: no-repeat;
        background-size: contain;
        background-position: center;
      }

      .${LEAD_FLAG_CLASS}[data-flag="de"] {
        background-image: url("data:image/svg+xml,%3Csvg%20xmlns%3D%27http%3A//www.w3.org/2000/svg%27%20width%3D%2718%27%20height%3D%2712%27%20viewBox%3D%270%200%2018%2012%27%3E%3Crect%20width%3D%2718%27%20height%3D%274%27%20y%3D%270%27%20fill%3D%27%23000%27/%3E%3Crect%20width%3D%2718%27%20height%3D%274%27%20y%3D%274%27%20fill%3D%27%23DD0000%27/%3E%3Crect%20width%3D%2718%27%20height%3D%274%27%20y%3D%278%27%20fill%3D%27%23FFCE00%27/%3E%3C/svg%3E");
      }

      .${LEAD_FLAG_CLASS}[data-flag="nl"] {
        background-image: url("data:image/svg+xml,%3Csvg%20xmlns%3D%27http%3A//www.w3.org/2000/svg%27%20width%3D%2718%27%20height%3D%2712%27%20viewBox%3D%270%200%2018%2012%27%3E%3Crect%20width%3D%2718%27%20height%3D%274%27%20y%3D%270%27%20fill%3D%27%23AE1C28%27/%3E%3Crect%20width%3D%2718%27%20height%3D%274%27%20y%3D%274%27%20fill%3D%27%23FFF%27/%3E%3Crect%20width%3D%2718%27%20height%3D%274%27%20y%3D%278%27%20fill%3D%27%2321468B%27/%3E%3C/svg%3E");
      }

      #edit-session .${DETAILS_BOX_CLASS} {
        position: relative;
      }

      #edit-session .${DETAILS_BOX_CLASS}::before {
        content: '';
        position: absolute;
        top: 0;
        bottom: 0;
        left: 50%;
        width: 1px;
        transform: translateX(-0.5px);
        background: rgba(0, 0, 0, 0.1);
        pointer-events: none;
      }

      #edit-session .${DETAIL_ROW_CLASS} {
        display: grid;
        grid-template-columns: 1fr 1fr;
        align-items: start;
      }

      #edit-session .${DETAIL_LABEL_CLASS} {
        text-align: left;
        padding-right: 12px;
      }

      #edit-session .${DETAIL_VALUE_CLASS} {
        text-align: left;
        word-break: break-word;
        padding-left: 12px;
      }

      #edit-session #statusDropdown {
        display: inline-block;
        min-width: 12rem;
        text-align: center;
        white-space: nowrap;
      }

      #leads-table_wrapper,
      #leads-table_wrapper .dataTables_scroll,
      #leads-table_wrapper .dataTables_scrollHead,
      #leads-table_wrapper .dataTables_scrollBody,
      #leads-table_wrapper .dataTables_scrollHeadInner {
        width: 100% !important;
      }

      #leads-table,
      #leads-table_wrapper table {
        width: 100% !important;
      }

      #leads-table_wrapper {
        overflow-x: hidden !important;
      }

      .${CREATED_DATE_CLASS} {
        margin-left: auto;
        font-size: 0.85em;
        opacity: 0.8;
        white-space: nowrap;
      }

      h6.${CREATED_DATE_CLASS} {
        margin: 0 0 0 auto;
      }

      .${LEAD_HEADER_TITLE_CLASS} {
        display: flex !important;
        align-items: center;
        width: 100%;
      }

      #${COPILOT_TOOLTIP_ID} {
        position: fixed;
        z-index: 2147483647;
        max-width: 420px;
        padding: 6px 8px;
        border-radius: 6px;
        background: rgba(108, 117, 125, 0.96);
        color: #fff;
        font-size: 12px;
        line-height: 1.35;
        white-space: pre-line;
        pointer-events: none;
      }

      #${COPILOT_THEME_TOGGLE_ID} {
        position: fixed;
        left: 16px;
        bottom: 16px;
        z-index: 2147483646;
        user-select: none;
      }

      #${COPILOT_THEME_TOGGLE_BTN_ID} {
        appearance: none;
        border: 1px solid rgba(255, 255, 255, 0.18);
        background: rgba(108, 117, 125, 0.35);
        color: #fff;
        padding: 6px 10px;
        border-radius: 999px;
        font-size: 12px;
        line-height: 1;
        cursor: pointer;
        backdrop-filter: blur(6px);
      }

      #${COPILOT_THEME_TOGGLE_BTN_ID}:hover {
        background: rgba(108, 117, 125, 0.5);
      }

      /* Dark mode overrides (scoped to an attribute so it is easy to disable). */
      html[${COPILOT_THEME_ATTR}='dark'] {
        /* Preferred tokens (new). */
        --new-bg: #1b2432;
        --new-surface: #202b3b;
        --new-surface-2: #263246;
        /* Lighten separators/spacers (tables, dividers, borders). */
        --new-border: rgba(255, 255, 255, 0.10);
        /* Slightly darker white for comfort. */
        --new-text: #dbe4f3;
        --new-muted: rgba(219, 228, 243, 0.70);

        --new-primary: #3d7bff;
        --new-primary-2: #2f6bee;

        /* Used by dashboard counters (Argon uses #673AB7). */
        --new-purple: #a78bfa;

        /* Status accents. */
        --new-green: #16c79a;
        --new-green-2: #10b981;
        --new-red: #ff4d4f;
        --new-red-2: #ef4444;

        /* DashStack-inspired neutrals (tweakable). */
        --new-sidebar: #182234;
        --new-nav-hover: rgba(255, 255, 255, 0.06);
        --new-nav-active: rgba(61, 123, 255, 0.22);
        --new-radius: 12px;

        /* Back-compat: keep existing '--copilot-*' rules working. */
        --copilot-bg: var(--new-bg);
        --copilot-surface: var(--new-surface);
        --copilot-surface-2: var(--new-surface-2);
        --copilot-border: var(--new-border);
        --copilot-text: var(--new-text);
        --copilot-muted: var(--new-muted);
        --copilot-primary: var(--new-primary);
        --copilot-primary-2: var(--new-primary-2);
        --copilot-purple: var(--new-purple);
        --copilot-green: var(--new-green);
        --copilot-green-2: var(--new-green-2);
        --copilot-red: var(--new-red);
        --copilot-red-2: var(--new-red-2);
        --copilot-sidebar: var(--new-sidebar);
        --copilot-nav-hover: var(--new-nav-hover);
        --copilot-nav-active: var(--new-nav-active);
        --copilot-radius: var(--new-radius);
      }

      html[${COPILOT_THEME_ATTR}='dark'],
      html[${COPILOT_THEME_ATTR}='dark'] body {
        background-color: var(--copilot-bg) !important;
        color: var(--copilot-text) !important;
        /* Prevent the page from horizontally overflowing a few px. */
        overflow-x: hidden !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] #panel,
      html[${COPILOT_THEME_ATTR}='dark'] .main-content {
        overflow-x: hidden !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] .bg-white,
      html[${COPILOT_THEME_ATTR}='dark'] .bg-secondary,
      html[${COPILOT_THEME_ATTR}='dark'] .navbar,
      html[${COPILOT_THEME_ATTR}='dark'] .navbar-top,
      html[${COPILOT_THEME_ATTR}='dark'] .navbar-top.bg-secondary,
      html[${COPILOT_THEME_ATTR}='dark'] .navbar-light.bg-white,
      html[${COPILOT_THEME_ATTR}='dark'] .card,
      html[${COPILOT_THEME_ATTR}='dark'] .card-header,
      html[${COPILOT_THEME_ATTR}='dark'] .card-footer,
      html[${COPILOT_THEME_ATTR}='dark'] .modal-content,
      html[${COPILOT_THEME_ATTR}='dark'] .dropdown-menu,
      html[${COPILOT_THEME_ATTR}='dark'] .header,
      html[${COPILOT_THEME_ATTR}='dark'] .footer,
      html[${COPILOT_THEME_ATTR}='dark'] footer.footer {
        background-color: var(--copilot-surface) !important;
        color: var(--copilot-text) !important;
      }

      /* Tailwind-ish submit buttons (e.g. "Save") should match green submit styling. */
      html[${COPILOT_THEME_ATTR}='dark'] button[type='submit'].bg-gray-800,
      html[${COPILOT_THEME_ATTR}='dark'] button[type='submit'].bg-gray-700,
      html[${COPILOT_THEME_ATTR}='dark'] button[type='submit'].bg-white {
        background-color: var(--copilot-green) !important;
        border-color: transparent !important;
        color: #fff !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] button[type='submit'].bg-gray-800:hover,
      html[${COPILOT_THEME_ATTR}='dark'] button[type='submit'].bg-gray-700:hover,
      html[${COPILOT_THEME_ATTR}='dark'] button[type='submit'].bg-white:hover {
        background-color: var(--copilot-green-2) !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] button[type='submit'].bg-gray-800:active,
      html[${COPILOT_THEME_ATTR}='dark'] button[type='submit'].bg-gray-700:active,
      html[${COPILOT_THEME_ATTR}='dark'] button[type='submit'].bg-white:active {
        filter: brightness(0.95);
      }

      /* The header strip (above Lead Details) should blend with the page background. */
      html[${COPILOT_THEME_ATTR}='dark'] .header {
        background-color: var(--copilot-bg) !important;
        background-image: none !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] .footer,
      html[${COPILOT_THEME_ATTR}='dark'] footer.footer {
        background-color: var(--copilot-bg) !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] .main-content,
      html[${COPILOT_THEME_ATTR}='dark'] #sidenav-main {
        background-color: var(--copilot-bg) !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] .person-info-rightSidebar {
        background-color: var(--copilot-bg) !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] .text-dark,
      html[${COPILOT_THEME_ATTR}='dark'] .text-default,
      html[${COPILOT_THEME_ATTR}='dark'] .navbar-light .navbar-nav .nav-link,
      html[${COPILOT_THEME_ATTR}='dark'] .nav-link-text,
      html[${COPILOT_THEME_ATTR}='dark'] .dropdown-item,
      html[${COPILOT_THEME_ATTR}='dark'] h1,
      html[${COPILOT_THEME_ATTR}='dark'] h2,
      html[${COPILOT_THEME_ATTR}='dark'] h3,
      html[${COPILOT_THEME_ATTR}='dark'] h4,
      html[${COPILOT_THEME_ATTR}='dark'] .h5,
      html[${COPILOT_THEME_ATTR}='dark'] h6 {
        color: var(--copilot-text) !important;
      }

      /* Argon also uses utility heading classes (.h1-.h6) that can stay #32325d. */
      html[${COPILOT_THEME_ATTR}='dark'] .card .h1,
      html[${COPILOT_THEME_ATTR}='dark'] .card .h2,
      html[${COPILOT_THEME_ATTR}='dark'] .card .h3,
      html[${COPILOT_THEME_ATTR}='dark'] .card .h4,
      html[${COPILOT_THEME_ATTR}='dark'] .card .h5,
      html[${COPILOT_THEME_ATTR}='dark'] .card .h6 {
        color: var(--copilot-text) !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] .text-muted,
      html[${COPILOT_THEME_ATTR}='dark'] small.text-muted,
      html[${COPILOT_THEME_ATTR}='dark'] .copyright,
      html[${COPILOT_THEME_ATTR}='dark'] .footer .text-muted {
        color: var(--copilot-muted) !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] .dropdown-item:hover,
      html[${COPILOT_THEME_ATTR}='dark'] .dropdown-item:focus {
        background-color: var(--copilot-nav-hover) !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] .border,
      html[${COPILOT_THEME_ATTR}='dark'] .card,
      html[${COPILOT_THEME_ATTR}='dark'] .dropdown-divider,
      html[${COPILOT_THEME_ATTR}='dark'] .table th,
      html[${COPILOT_THEME_ATTR}='dark'] .table td,
      html[${COPILOT_THEME_ATTR}='dark'] .table-custom th,
      html[${COPILOT_THEME_ATTR}='dark'] .table-custom td {
        border-color: var(--copilot-border) !important;
      }

      /* Remove the bright "card borders" look. Keep table cell separators subtle via --copilot-border above. */
      html[${COPILOT_THEME_ATTR}='dark'] .card,
      html[${COPILOT_THEME_ATTR}='dark'] .modal-content,
      html[${COPILOT_THEME_ATTR}='dark'] .dropdown-menu,
      html[${COPILOT_THEME_ATTR}='dark'] .applicants-filters {
        border-color: transparent !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] .card,
      html[${COPILOT_THEME_ATTR}='dark'] .modal-content {
        background-color: var(--copilot-surface-2) !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] .shadow,
      html[${COPILOT_THEME_ATTR}='dark'] .shadow-sm,
      html[${COPILOT_THEME_ATTR}='dark'] .shadow-lg {
        box-shadow: 0 0.35rem 0.85rem rgba(0, 0, 0, 0.45) !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] .card,
      html[${COPILOT_THEME_ATTR}='dark'] .dropdown-menu,
      html[${COPILOT_THEME_ATTR}='dark'] .modal-content,
      html[${COPILOT_THEME_ATTR}='dark'] .header,
      html[${COPILOT_THEME_ATTR}='dark'] .footer {
        /* Argon uses colored shadows (e.g. rgba(136,152,170,.15)) that look like a white glow on dark bg. */
        box-shadow: none !important;
        filter: none !important;
      }

      /* Keep the navbar distinguishable: subtle border + dark shadow (not white glow). */
      html[${COPILOT_THEME_ATTR}='dark'] .navbar,
      html[${COPILOT_THEME_ATTR}='dark'] .navbar-top {
        border-bottom: none !important;
        box-shadow: 0 10px 24px rgba(0, 0, 0, 0.35) !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] #sidenav-main {
        border-right: none !important;
      }

      /* Make the burger lines a touch lighter. */
      html[${COPILOT_THEME_ATTR}='dark'] .sidenav-toggler-line {
        background-color: rgba(255, 255, 255, 0.70) !important;
      }

      /* Sidebar + nav (DashStack-like hover/active). */
      html[${COPILOT_THEME_ATTR}='dark'] #sidenav-main,
      html[${COPILOT_THEME_ATTR}='dark'] #sidenav-main.bg-white,
      html[${COPILOT_THEME_ATTR}='dark'] #sidenav-main.navbar-light.bg-white {
        background-color: var(--copilot-sidebar) !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] #sidenav-main .navbar-nav .nav-link {
        color: rgba(231, 231, 235, 0.78) !important;
        border-radius: calc(var(--copilot-radius) - 2px) !important;
        transition: background-color 120ms ease, color 120ms ease;
      }

      html[${COPILOT_THEME_ATTR}='dark'] #sidenav-main .navbar-nav .nav-link:hover {
        background-color: var(--copilot-nav-hover) !important;
        color: var(--copilot-text) !important;
      }

      /* Match Argon sizing: active highlight should be inset (not full sidenav width). */
      html[${COPILOT_THEME_ATTR}='dark'] #sidenav-main.navbar-vertical.navbar-expand-xs .navbar-nav > .nav-item > .nav-link.active,
      html[${COPILOT_THEME_ATTR}='dark'] #sidenav-main.navbar-vertical.navbar-expand-xs .navbar-nav .nav .nav-link.active {
        margin-right: .5rem !important;
        margin-left: .5rem !important;
        padding-right: 1rem !important;
        padding-left: 1rem !important;
        border-radius: .375rem !important;
        background-color: var(--copilot-nav-active) !important;
        color: var(--copilot-text) !important;
        box-shadow: inset 3px 0 0 0 var(--copilot-primary) !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] #sidenav-main .navbar-nav .nav-link i,
      html[${COPILOT_THEME_ATTR}='dark'] #sidenav-main .navbar-nav .nav-link svg {
        color: currentColor !important;
      }

      /* Global rounding to better match modern dashboard kits. */
      html[${COPILOT_THEME_ATTR}='dark'] .card,
      html[${COPILOT_THEME_ATTR}='dark'] .dropdown-menu,
      html[${COPILOT_THEME_ATTR}='dark'] .modal-content,
      html[${COPILOT_THEME_ATTR}='dark'] .form-control,
      html[${COPILOT_THEME_ATTR}='dark'] input,
      html[${COPILOT_THEME_ATTR}='dark'] select,
      html[${COPILOT_THEME_ATTR}='dark'] textarea {
        border-radius: var(--copilot-radius) !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] .btn {
        border-radius: calc(var(--copilot-radius) - 2px) !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] .selected {
        background-color: rgba(255, 255, 255, 0.06) !important;
        border-color: rgba(255, 255, 255, 0.10) !important;
      }

      /* Remove the remaining white-ish glows; keep subtle, tinted focus rings. */
      html[${COPILOT_THEME_ATTR}='dark'] .btn,
      html[${COPILOT_THEME_ATTR}='dark'] .badge,
      html[${COPILOT_THEME_ATTR}='dark'] .form-control,
      html[${COPILOT_THEME_ATTR}='dark'] .custom-control-input:focus ~ .custom-control-label::before {
        box-shadow: none !important;
      }

      /* Badges: prevent white/light variants from staying bright on dark pages. */
      html[${COPILOT_THEME_ATTR}='dark'] .badge.badge-white,
      html[${COPILOT_THEME_ATTR}='dark'] .badge.badge-light,
      html[${COPILOT_THEME_ATTR}='dark'] .badge.badge-neutral,
      html[${COPILOT_THEME_ATTR}='dark'] .badge.badge-default,
      html[${COPILOT_THEME_ATTR}='dark'] .badge.badge-info {
        background-color: rgba(255, 255, 255, 0.10) !important;
        border: 1px solid var(--copilot-border) !important;
        color: var(--copilot-text) !important;
      }

      /* Some pages use only "badge-info" and still render as white. */
      html[${COPILOT_THEME_ATTR}='dark'] .badge-info {
        background-color: rgba(255, 255, 255, 0.10) !important;
        border: 1px solid var(--copilot-border) !important;
        color: var(--copilot-text) !important;
      }

      /* Select2: force dark surfaces (default theme is white). */
      html[${COPILOT_THEME_ATTR}='dark'] .select2-container {
        color: var(--copilot-text) !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] .select2-container--default .select2-selection--single,
      html[${COPILOT_THEME_ATTR}='dark'] .select2-container--default .select2-selection--multiple {
        background-color: var(--copilot-surface-2) !important;
        border: 1px solid var(--copilot-border) !important;
        color: var(--copilot-text) !important;
        box-shadow: none !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] .select2-container--default .select2-selection--single .select2-selection__rendered {
        color: var(--copilot-text) !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] .select2-container--default .select2-selection--multiple .select2-selection__choice {
        background-color: rgba(255, 255, 255, 0.10) !important;
        border: 1px solid var(--copilot-border) !important;
        color: var(--copilot-text) !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] .select2-container--default .select2-selection--multiple .select2-selection__choice__remove {
        color: var(--copilot-muted) !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] .select2-dropdown {
        background-color: var(--copilot-surface) !important;
        border: 1px solid var(--copilot-border) !important;
        color: var(--copilot-text) !important;
        box-shadow: 0 18px 40px rgba(0, 0, 0, 0.45) !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] .select2-results {
        background-color: transparent !important;
        color: var(--copilot-text) !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] .select2-results__options {
        background-color: transparent !important;
        color: var(--copilot-text) !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] .select2-results__option {
        color: var(--copilot-text) !important;
        background-color: transparent !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] .select2-results__option.select2-results__message {
        color: var(--copilot-muted) !important;
        background-color: transparent !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] .select2-container--default .select2-results__option--highlighted[aria-selected] {
        background-color: var(--copilot-nav-hover) !important;
        color: var(--copilot-text) !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] .select2-container--default .select2-results__option[aria-selected='true'] {
        background-color: rgba(61, 123, 255, 0.14) !important;
        color: var(--copilot-text) !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] .select2-container--focus .select2-selection,
      html[${COPILOT_THEME_ATTR}='dark'] .select2-container--open .select2-selection {
        border-color: rgba(61, 123, 255, 0.55) !important;
        box-shadow: 0 0 0 0.12rem rgba(61, 123, 255, 0.22) !important;
      }

      /* Vue Multiselect (classes: multiselect__*). */
      html[${COPILOT_THEME_ATTR}='dark'] .multiselect {
        color: var(--copilot-text) !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] .multiselect__tags {
        background-color: var(--copilot-surface-2) !important;
        border: 1px solid var(--copilot-border) !important;
        color: var(--copilot-text) !important;
        box-shadow: none !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] .multiselect__input {
        background-color: transparent !important;
        color: var(--copilot-text) !important;
        box-shadow: none !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] .multiselect__input::placeholder {
        color: var(--copilot-muted) !important;
        opacity: 1 !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] .multiselect__placeholder {
        color: var(--copilot-muted) !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] .multiselect__select {
        background-color: transparent !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] .multiselect__select::before {
        border-color: var(--copilot-muted) transparent transparent transparent !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] .multiselect__content-wrapper {
        background-color: var(--copilot-surface) !important;
        border: 1px solid var(--copilot-border) !important;
        box-shadow: 0 18px 40px rgba(0, 0, 0, 0.45) !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] .multiselect__content {
        background-color: transparent !important;
        color: var(--copilot-text) !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] .multiselect__option {
        background-color: transparent !important;
        color: var(--copilot-text) !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] .multiselect__option--highlight,
      html[${COPILOT_THEME_ATTR}='dark'] .multiselect__option--highlight::after {
        background-color: var(--copilot-nav-hover) !important;
        color: var(--copilot-text) !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] .multiselect__option--selected,
      html[${COPILOT_THEME_ATTR}='dark'] .multiselect__option--selected::after {
        background-color: rgba(61, 123, 255, 0.14) !important;
        color: var(--copilot-text) !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] .multiselect__option--disabled {
        color: rgba(219, 228, 243, 0.40) !important;
        background-color: transparent !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] .multiselect__spinner {
        background-color: var(--copilot-surface-2) !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] .btn:focus,
      html[${COPILOT_THEME_ATTR}='dark'] .btn.focus,
      html[${COPILOT_THEME_ATTR}='dark'] .form-control:focus,
      html[${COPILOT_THEME_ATTR}='dark'] input:focus,
      html[${COPILOT_THEME_ATTR}='dark'] select:focus,
      html[${COPILOT_THEME_ATTR}='dark'] textarea:focus {
        outline: none !important;
        box-shadow: 0 0 0 0.12rem rgba(61, 123, 255, 0.22) !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] .btn-primary:focus,
      html[${COPILOT_THEME_ATTR}='dark'] .btn-primary.focus {
        box-shadow: 0 0 0 0.14rem rgba(61, 123, 255, 0.30) !important;
      }

      /* Doc type selector tiles (doc-type-grid / doc-type-card). */
      html[${COPILOT_THEME_ATTR}='dark'] .doc-type-grid {
        color: var(--copilot-text) !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] .doc-type-option {
        color: inherit !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] .doc-type-option input[type='radio'] {
        accent-color: var(--copilot-primary) !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] .doc-type-card {
        background-color: var(--copilot-surface-2) !important;
        border: 1px solid var(--copilot-border) !important;
        color: var(--copilot-text) !important;
        box-shadow: none !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] .doc-type-option:hover .doc-type-card {
        background-color: color-mix(in srgb, var(--copilot-surface-2) 90%, #ffffff 10%) !important;
        background-color: rgba(255, 255, 255, 0.06) !important;
        border-color: rgba(255, 255, 255, 0.18) !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] .doc-type-option input[type='radio']:checked + .doc-type-card {
        border-color: rgba(61, 123, 255, 0.55) !important;
        background-color: rgba(61, 123, 255, 0.10) !important;
        box-shadow: 0 0 0 0.12rem rgba(61, 123, 255, 0.18) !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] .doc-type-option input[type='radio']:focus-visible + .doc-type-card {
        outline: none !important;
        box-shadow: 0 0 0 0.14rem rgba(61, 123, 255, 0.26) !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] .doc-type-title {
        color: var(--copilot-text) !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] .doc-type-subtitle {
        color: var(--copilot-muted) !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] .doc-type-title i,
      html[${COPILOT_THEME_ATTR}='dark'] .doc-type-title svg {
        color: var(--copilot-muted) !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] .btn-danger:focus,
      html[${COPILOT_THEME_ATTR}='dark'] .btn-danger.focus {
        box-shadow: 0 0 0 0.14rem rgba(239, 68, 68, 0.26) !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] .table,
      html[${COPILOT_THEME_ATTR}='dark'] table {
        color: var(--copilot-text) !important;
      }

      /* vue3-easy-data-table: defaults to white; force dark surfaces. */
      html[${COPILOT_THEME_ATTR}='dark'] .vue3-easy-data-table,
      html[${COPILOT_THEME_ATTR}='dark'] .vue3-easy-data-table__main,
      html[${COPILOT_THEME_ATTR}='dark'] .vue3-easy-data-table__body,
      html[${COPILOT_THEME_ATTR}='dark'] .vue3-easy-data-table__header,
      html[${COPILOT_THEME_ATTR}='dark'] .vue3-easy-data-table__footer,
      html[${COPILOT_THEME_ATTR}='dark'] .vue3-easy-data-table table,
      html[${COPILOT_THEME_ATTR}='dark'] .vue3-easy-data-table .table-header {
        background-color: var(--copilot-surface-2) !important;
        color: var(--copilot-text) !important;
        border-color: var(--copilot-border) !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] .vue3-easy-data-table thead,
      html[${COPILOT_THEME_ATTR}='dark'] .vue3-easy-data-table thead th,
      html[${COPILOT_THEME_ATTR}='dark'] .vue3-easy-data-table .table-header {
        background-color: rgba(255, 255, 255, 0.04) !important;
        color: var(--copilot-text) !important;
        border-color: var(--copilot-border) !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] .vue3-easy-data-table tbody td,
      html[${COPILOT_THEME_ATTR}='dark'] .vue3-easy-data-table__body td {
        background-color: transparent !important;
        color: var(--copilot-text) !important;
        border-color: var(--copilot-border) !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] .vue3-easy-data-table__body tr:hover td {
        background-color: rgba(255, 255, 255, 0.06) !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] .easy-checkbox,
      html[${COPILOT_THEME_ATTR}='dark'] .easy-checkbox * {
        border-color: var(--copilot-border) !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] .direction-left,
      html[${COPILOT_THEME_ATTR}='dark'] .expand-icon,
      html[${COPILOT_THEME_ATTR}='dark'] .can-expand {
        color: var(--copilot-muted) !important;
        fill: currentColor !important;
        background-color: transparent !important;
      }

      /* Some nav items get a white background on certain pages; neutralize it. */
      html[${COPILOT_THEME_ATTR}='dark'] .nav-item,
      html[${COPILOT_THEME_ATTR}='dark'] .navbar-nav .nav-item,
      html[${COPILOT_THEME_ATTR}='dark'] .nav-item > .nav-link,
      html[${COPILOT_THEME_ATTR}='dark'] .navbar-nav .nav-item > .nav-link {
        background-color: transparent !important;
      }

      /* DataTables: retint the remaining white container borders. */
      html[${COPILOT_THEME_ATTR}='dark'] .data-table,
      html[${COPILOT_THEME_ATTR}='dark'] .dataTables_wrapper,
      html[${COPILOT_THEME_ATTR}='dark'] table.dataTable,
      html[${COPILOT_THEME_ATTR}='dark'] table.dataTable.no-footer,
      html[${COPILOT_THEME_ATTR}='dark'] .dataTables_wrapper.no-footer .dataTables_scrollBody,
      html[${COPILOT_THEME_ATTR}='dark'] .dataTables_wrapper .dataTables_scroll,
      html[${COPILOT_THEME_ATTR}='dark'] .dataTables_wrapper .dataTables_scrollHead,
      html[${COPILOT_THEME_ATTR}='dark'] .dataTables_wrapper .dataTables_scrollHeadInner,
      html[${COPILOT_THEME_ATTR}='dark'] .dataTables_wrapper .dataTables_scrollBody {
        border-color: var(--copilot-border) !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] .dataTables_wrapper.no-footer .dataTables_scrollBody,
      html[${COPILOT_THEME_ATTR}='dark'] .dataTables_wrapper .dataTables_scrollBody {
        border: 1px solid var(--copilot-border) !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] .table thead th,
      html[${COPILOT_THEME_ATTR}='dark'] thead {
        background-color: rgba(255, 255, 255, 0.04) !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] .table-hover tbody tr:hover {
        color: var(--copilot-text) !important;
        background-color: rgba(255, 255, 255, 0.06) !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] .table-custom th,
      html[${COPILOT_THEME_ATTR}='dark'] .table-custom td {
        background-color: var(--copilot-surface-2) !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] .table-custom tbody tr:hover {
        background-color: rgba(255, 255, 255, 0.06) !important;
        box-shadow: 0 6px 16px rgba(0, 0, 0, 0.55) !important;
      }

      /* Pagination / DataTables controls (often remain white). */
      /* Keep the site's default sizing/spacing; only recolor. */
      html[${COPILOT_THEME_ATTR}='dark'] .data-table .pagination,
      html[${COPILOT_THEME_ATTR}='dark'] .dataTables_wrapper .pagination,
      html[${COPILOT_THEME_ATTR}='dark'] #leads-table_wrapper .pagination {
        background-color: var(--copilot-surface) !important;
        box-shadow: 0 0 8px rgba(0, 0, 0, 0.55) !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] .pagination .page-link {
        background-color: transparent !important;
        border-color: transparent !important;
        color: var(--copilot-text) !important;
        box-shadow: none !important;
      }

      /* DataTables adds inline colors on inner <span>; force it to inherit our theme. */
      html[${COPILOT_THEME_ATTR}='dark'] .pagination .page-link span,
      html[${COPILOT_THEME_ATTR}='dark'] .pagination .page-link i {
        color: inherit !important;
      }

      /*
       * Argon ships a rule that effectively does:
       *   .data-table .page-item span:hover { background-color: #fff; }
       * The "Next" control uses an inner <span>, so this becomes a white hover blob.
       * Keep layout intact; only neutralize that background in dark mode.
       */
      html[${COPILOT_THEME_ATTR}='dark'] .data-table .page-item.next span,
      html[${COPILOT_THEME_ATTR}='dark'] .data-table .page-item.next span:hover,
      html[${COPILOT_THEME_ATTR}='dark'] .data-table .page-item.previous span,
      html[${COPILOT_THEME_ATTR}='dark'] .data-table .page-item.previous span:hover,
      html[${COPILOT_THEME_ATTR}='dark'] #leads-table_next span,
      html[${COPILOT_THEME_ATTR}='dark'] #leads-table_next span:hover,
      html[${COPILOT_THEME_ATTR}='dark'] #leads-table_previous span,
      html[${COPILOT_THEME_ATTR}='dark'] #leads-table_previous span:hover {
        background-color: transparent !important;
      }

      /* Make Next/Prev hitbox + hover background exactly 50px wide. */
      html[${COPILOT_THEME_ATTR}='dark'] .pagination .page-item.next .page-link,
      html[${COPILOT_THEME_ATTR}='dark'] .pagination .page-item.previous .page-link,
      html[${COPILOT_THEME_ATTR}='dark'] #leads-table_next .page-link,
      html[${COPILOT_THEME_ATTR}='dark'] #leads-table_previous .page-link {
        width: 50px !important;
        box-sizing: border-box !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] .pagination .page-item.first .page-link {
        color: var(--copilot-muted) !important;
        width: 50px !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] .pagination .page-item.disabled .page-link {
        color: var(--copilot-muted) !important;
        width: 50px !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] .pagination .page-item.next:not(.disabled) .page-link {
        color: var(--copilot-primary) !important;
        width: 50px !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] .pagination .page-link:hover {
        background-color: var(--copilot-nav-hover) !important;
        color: var(--copilot-text) !important;
      }

      /* DataTables/Bootstrap can apply a light hover bg; force dark hover for prev/next. */
      html[${COPILOT_THEME_ATTR}='dark'] .data-table .pagination .page-link:hover,
      html[${COPILOT_THEME_ATTR}='dark'] .dataTables_wrapper .pagination .page-link:hover,
      html[${COPILOT_THEME_ATTR}='dark'] #leads-table_wrapper .pagination .page-link:hover,
      html[${COPILOT_THEME_ATTR}='dark'] #leads-table_next .page-link:hover,
      html[${COPILOT_THEME_ATTR}='dark'] #leads-table_previous .page-link:hover {
        background-color: var(--copilot-nav-hover) !important;
        border-color: transparent !important;
        color: var(--copilot-text) !important;
        width: 50px !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] #leads-table_next .page-link:hover {
        color: var(--copilot-primary) !important;
      }

      /* Some themes draw hover/focus via shadows/pseudo elements; neutralize for pager links. */
      html[${COPILOT_THEME_ATTR}='dark'] #leads-table_next .page-link:hover,
      html[${COPILOT_THEME_ATTR}='dark'] #leads-table_next .page-link:focus,
      html[${COPILOT_THEME_ATTR}='dark'] #leads-table_next .page-link:active,
      html[${COPILOT_THEME_ATTR}='dark'] #leads-table_previous .page-link:hover,
      html[${COPILOT_THEME_ATTR}='dark'] #leads-table_previous .page-link:focus,
      html[${COPILOT_THEME_ATTR}='dark'] #leads-table_previous .page-link:active {
        background: var(--copilot-nav-hover) !important;
        background-image: none !important;
        box-shadow: none !important;
        outline: none !important;
        filter: none !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] #leads-table_next .page-link::before,
      html[${COPILOT_THEME_ATTR}='dark'] #leads-table_next .page-link::after,
      html[${COPILOT_THEME_ATTR}='dark'] #leads-table_previous .page-link::before,
      html[${COPILOT_THEME_ATTR}='dark'] #leads-table_previous .page-link::after {
        content: none !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] .dataTables_wrapper .dataTables_info,
      html[${COPILOT_THEME_ATTR}='dark'] .dataTables_wrapper .dataTables_length,
      html[${COPILOT_THEME_ATTR}='dark'] .dataTables_wrapper .dataTables_filter {
        color: var(--copilot-muted) !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] .dataTables_wrapper .dataTables_length select,
      html[${COPILOT_THEME_ATTR}='dark'] .dataTables_wrapper .dataTables_filter input {
        background-color: var(--copilot-surface-2) !important;
        color: var(--copilot-text) !important;
        border: 1px solid var(--copilot-border) !important;
        box-shadow: none !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] .close,
      html[${COPILOT_THEME_ATTR}='dark'] .btn-close {
        color: var(--copilot-muted) !important;
        text-shadow: none !important;
        opacity: 0.9 !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] .form-control,
      html[${COPILOT_THEME_ATTR}='dark'] input,
      html[${COPILOT_THEME_ATTR}='dark'] select,
      html[${COPILOT_THEME_ATTR}='dark'] textarea,
      html[${COPILOT_THEME_ATTR}='dark'] .input-group-text {
        background-color: var(--copilot-surface-2) !important;
        color: var(--copilot-text) !important;
        border-color: var(--copilot-border) !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] textarea.form-control {
        background-color: var(--copilot-surface-2) !important;
      }

      /* Argon/Bootstrap alerts + toasts (and other notification UIs). */
      html[${COPILOT_THEME_ATTR}='dark'] .alert,
      html[${COPILOT_THEME_ATTR}='dark'] .toast,
      html[${COPILOT_THEME_ATTR}='dark'] .toast-header,
      html[${COPILOT_THEME_ATTR}='dark'] .toast-body {
        background-color: var(--copilot-surface-2) !important;
        color: var(--copilot-text) !important;
        border-color: var(--copilot-border) !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] .alert a {
        color: var(--copilot-green) !important;
      }

      /* SweetAlert2 (inline styles in the dashboard are white by default). */
      html[${COPILOT_THEME_ATTR}='dark'] .swal2-container {
        color: var(--copilot-text) !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] .swal2-popup,
      html[${COPILOT_THEME_ATTR}='dark'] .swal2-modal,
      html[${COPILOT_THEME_ATTR}='dark'] .swal2-toast {
        background: var(--copilot-surface-2) !important;
        color: var(--copilot-text) !important;
        border: 1px solid var(--copilot-border) !important;
        box-shadow: 0 10px 28px rgba(0, 0, 0, 0.55) !important;
      }

      /* Leads list: session search UI uses inline light styles. */
      html[${COPILOT_THEME_ATTR}='dark'] #session-search {
        background-color: var(--copilot-surface-2) !important;
        border: 1px solid var(--copilot-border) !important;
        box-shadow: none !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] #session-search svg {
        color: var(--copilot-muted) !important;
        fill: currentColor !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] #new_search,
      html[${COPILOT_THEME_ATTR}='dark'] #search_client,
      html[${COPILOT_THEME_ATTR}='dark'] #search_staff_members {
        background-color: var(--copilot-surface-2) !important;
        color: var(--copilot-text) !important;
        border-color: var(--copilot-border) !important;
      }

      /* Expanded search UI wrapper (prevents an outer white box when expanding). */
      html[${COPILOT_THEME_ATTR}='dark'] .search-container,
      html[${COPILOT_THEME_ATTR}='dark'] .search-container.active,
      html[${COPILOT_THEME_ATTR}='dark'] .search-container.open,
      html[${COPILOT_THEME_ATTR}='dark'] .search-container:focus-within {
        background-color: var(--copilot-surface-2) !important;
        border: 1px solid var(--copilot-border) !important;
        border-radius: var(--copilot-radius) !important;
        box-shadow: none !important;
        color: var(--copilot-text) !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] .search-container .search-icon,
      html[${COPILOT_THEME_ATTR}='dark'] .search-container .cancel-icon {
        color: var(--copilot-muted) !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] .search-container .search-icon svg,
      html[${COPILOT_THEME_ATTR}='dark'] .search-container .cancel-icon svg {
        color: currentColor !important;
        fill: currentColor !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] .search-container .search-icon svg path,
      html[${COPILOT_THEME_ATTR}='dark'] .search-container .cancel-icon svg path {
        fill: currentColor !important;
      }

      /* If the expanded search uses a dropdown/menu for results, keep it dark too. */
      html[${COPILOT_THEME_ATTR}='dark'] .search-container .dropdown-menu {
        background-color: var(--copilot-surface) !important;
        border: 1px solid var(--copilot-border) !important;
        box-shadow: 0 18px 40px rgba(0, 0, 0, 0.45) !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] #new_search::placeholder,
      html[${COPILOT_THEME_ATTR}='dark'] #search_client::placeholder,
      html[${COPILOT_THEME_ATTR}='dark'] #search_staff_members::placeholder {
        color: rgba(231, 231, 235, 0.55) !important;
      }

      /* Comments list (list-group items are white in Argon by default). */
      html[${COPILOT_THEME_ATTR}='dark'] .list-group-item {
        background-color: var(--copilot-surface-2) !important;
        color: var(--copilot-text) !important;
        border-color: var(--copilot-border) !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] .list-group-item-action:hover,
      html[${COPILOT_THEME_ATTR}='dark'] .list-group-item-action:focus {
        background-color: rgba(255, 255, 255, 0.06) !important;
        color: var(--copilot-text) !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] .list-group-item small {
        color: var(--copilot-muted) !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] .swal2-title,
      html[${COPILOT_THEME_ATTR}='dark'] .swal2-html-container,
      html[${COPILOT_THEME_ATTR}='dark'] .swal2-content,
      html[${COPILOT_THEME_ATTR}='dark'] .swal2-footer {
        color: var(--copilot-text) !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] .swal2-close {
        color: var(--copilot-muted) !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] .swal2-input,
      html[${COPILOT_THEME_ATTR}='dark'] .swal2-textarea,
      html[${COPILOT_THEME_ATTR}='dark'] .swal2-select {
        background: var(--copilot-surface) !important;
        color: var(--copilot-text) !important;
        border: 1px solid var(--copilot-border) !important;
        box-shadow: none !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] .btn-primary,
      html[${COPILOT_THEME_ATTR}='dark'] .badge-primary,
      html[${COPILOT_THEME_ATTR}='dark'] .bg-primary {
        background-color: var(--copilot-primary) !important;
        border-color: var(--copilot-primary) !important;
        color: #fff !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] .btn-primary:hover,
      html[${COPILOT_THEME_ATTR}='dark'] .btn-primary:focus {
        background-color: var(--copilot-primary-2) !important;
        border-color: var(--copilot-primary-2) !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] .btn-danger,
      html[${COPILOT_THEME_ATTR}='dark'] .badge-danger,
      html[${COPILOT_THEME_ATTR}='dark'] .bg-danger {
        background-color: var(--copilot-red) !important;
        border-color: var(--copilot-red) !important;
        color: var(--copilot-bg) !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] .btn-danger:hover,
      html[${COPILOT_THEME_ATTR}='dark'] .btn-danger:focus {
        background-color: var(--copilot-red-2) !important;
        border-color: var(--copilot-red-2) !important;
      }

      /* Dark-mode active nav items (avoid white backgrounds). */
      html[${COPILOT_THEME_ATTR}='dark'] .navbar-nav .nav-link.active,
      html[${COPILOT_THEME_ATTR}='dark'] .navbar-nav .active > .nav-link,
      html[${COPILOT_THEME_ATTR}='dark'] .nav-pills .nav-link.active,
      html[${COPILOT_THEME_ATTR}='dark'] .nav-pills .show > .nav-link {
        color: var(--copilot-text) !important;
        background-color: rgba(255, 255, 255, 0.06) !important;
        border-radius: 8px;
      }

      html[${COPILOT_THEME_ATTR}='dark'] .navbar-top .navbar-nav .nav-link,
      html[${COPILOT_THEME_ATTR}='dark'] .navbar-top .navbar-nav .nav-link i {
        color: var(--copilot-text) !important;
      }

      /* Profile dropdown/name text sometimes stays dark. */
      html[${COPILOT_THEME_ATTR}='dark'] .navbar-top .nav-link .media-body,
      html[${COPILOT_THEME_ATTR}='dark'] .navbar-top .nav-link .media-body span,
      html[${COPILOT_THEME_ATTR}='dark'] .navbar-top .dropdown-menu,
      html[${COPILOT_THEME_ATTR}='dark'] .navbar-top .dropdown-menu .dropdown-item {
        color: var(--copilot-text) !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] .navbar-top .dropdown-menu * {
        color: inherit;
      }

      html[${COPILOT_THEME_ATTR}='dark'] .nav-item.dropdown h1,
      .nav-item.dropdown,
      #selectAccount,
      #selectStaff {
        color: var(--copilot-text) !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] .card-footer {
        background-color: var(--copilot-surface-2) !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] .navbar-top .dropdown-menu .text-muted,
      html[${COPILOT_THEME_ATTR}='dark'] .navbar-top .dropdown-menu small,
      html[${COPILOT_THEME_ATTR}='dark'] .navbar-top .dropdown-menu .small {
        color: var(--copilot-muted) !important;
      }

      /* Applicants filters: remove light borders/shadows and recolor counters/icons. */
      html[${COPILOT_THEME_ATTR}='dark'] .applicants-filters {
        border: none !important;
        box-shadow: none !important;
      }

      /* Argon uses a solid purple background for the selected filter; keep it subtle on dark. */
      html[${COPILOT_THEME_ATTR}='dark'] .selectedFilterBackground {
        background-color: rgba(167, 139, 250, 0.14) !important;
        background-color: color-mix(in srgb, var(--copilot-purple) 18%, transparent) !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] #completedCounter,
      html[${COPILOT_THEME_ATTR}='dark'] #seenCounter {
        color: var(--copilot-purple) !important;
      }

      /* Confirmed filter sometimes renders smaller than the other tiles; normalize sizing. */
      html[${COPILOT_THEME_ATTR}='dark'] #confirmedFilter {
        font-size: 1rem !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] #confirmedFilter .filter-titles {
        font-size: 0.875rem !important;
        font-weight: 600 !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] #confirmedFilter > div > svg {
        width: 39px !important;
        height: 38px !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] #confirmedCounter {
        font-size: 1rem !important;
        font-weight: 600 !important;
      }

      /* The filter icons are inline SVG with light rect backgrounds; retint them in dark mode. */
      html[${COPILOT_THEME_ATTR}='dark'] .applicants-filters svg rect {
        fill: rgba(255, 255, 255, 0.08) !important;
      }

      /* Replace Argon's dark-purple accents inside inline SVGs with the theme purple token. */
      html[${COPILOT_THEME_ATTR}='dark'] svg [fill="#311B92"],
      html[${COPILOT_THEME_ATTR}='dark'] svg [fill="#673AB7"],
      html[${COPILOT_THEME_ATTR}='dark'] svg [fill="#512DA8"],
      html[${COPILOT_THEME_ATTR}='dark'] svg [fill="#5E35B1"],
      html[${COPILOT_THEME_ATTR}='dark'] svg [fill="#4527A0"],
      html[${COPILOT_THEME_ATTR}='dark'] svg [fill="#311b92"],
      html[${COPILOT_THEME_ATTR}='dark'] svg [fill="#673ab7"],
      html[${COPILOT_THEME_ATTR}='dark'] svg [fill="#512da8"],
      html[${COPILOT_THEME_ATTR}='dark'] svg [fill="#5e35b1"],
      html[${COPILOT_THEME_ATTR}='dark'] svg [fill="#4527a0"] {
        fill: var(--copilot-purple) !important;
      }

      /* Also catch inline styles that hardcode Argon purple for text/backgrounds. */
      html[${COPILOT_THEME_ATTR}='dark'] [style*="color: #673AB7"],
      html[${COPILOT_THEME_ATTR}='dark'] [style*="color:#673AB7"],
      html[${COPILOT_THEME_ATTR}='dark'] [style*="color: #311B92"],
      html[${COPILOT_THEME_ATTR}='dark'] [style*="color:#311B92"],
      html[${COPILOT_THEME_ATTR}='dark'] [style*="color: #512DA8"],
      html[${COPILOT_THEME_ATTR}='dark'] [style*="color:#32325d"],
      html[${COPILOT_THEME_ATTR}='dark'] [style*="color:#512DA8"] {
        color: var(--copilot-purple) !important;
      }

      /* Applicants filters separator line defaults to black; retint it for dark mode. */
      html[${COPILOT_THEME_ATTR}='dark'] .applicants-filters line[stroke="black"],
      html[${COPILOT_THEME_ATTR}='dark'] .applicants-filters line[stroke="#000"],
      html[${COPILOT_THEME_ATTR}='dark'] .applicants-filters line[stroke="#000000"] {
        stroke: rgba(255, 255, 255, 0.20) !important;
        opacity: 1 !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] .applicants-filters svg g[filter] {
        filter: none !important;
      }

      /* Spacers/dividers across the app (hr and similar). */
      html[${COPILOT_THEME_ATTR}='dark'] hr {
        border-color: var(--copilot-border) !important;
        opacity: 1 !important;
      }

      /* DataTables sometimes uses its own header/footer borders. */
      html[${COPILOT_THEME_ATTR}='dark'] table.dataTable thead th,
      html[${COPILOT_THEME_ATTR}='dark'] table.dataTable thead td,
      html[${COPILOT_THEME_ATTR}='dark'] table.dataTable tfoot th,
      html[${COPILOT_THEME_ATTR}='dark'] table.dataTable tfoot td {
        border-color: var(--copilot-border) !important;
      }

      /* FullCalendar: override its default CSS vars (it ships white defaults). */
      html[${COPILOT_THEME_ATTR}='dark'] {
        --fc-page-bg-color: var(--copilot-surface-2);
        --fc-neutral-bg-color: rgba(255, 255, 255, 0.04);
        --fc-neutral-text-color: var(--copilot-muted);
        --fc-border-color: var(--copilot-border);

        --fc-button-text-color: var(--copilot-text);
        --fc-button-bg-color: var(--copilot-surface);
        --fc-button-border-color: transparent;
        --fc-button-hover-bg-color: var(--copilot-surface-2);
        --fc-button-hover-border-color: transparent;
        --fc-button-active-bg-color: var(--copilot-surface-2);
        --fc-button-active-border-color: transparent;

        --fc-event-bg-color: var(--copilot-primary);
        --fc-event-border-color: var(--copilot-primary);
        --fc-event-text-color: var(--copilot-text);
        --fc-today-bg-color: rgba(61, 123, 255, 0.10);
      }

      html[${COPILOT_THEME_ATTR}='dark'] .fc,
      html[${COPILOT_THEME_ATTR}='dark'] .fc-theme-standard,
      html[${COPILOT_THEME_ATTR}='dark'] .fc .fc-scrollgrid-section-sticky > * {
        background-color: var(--copilot-surface-2) !important;
      }

      /* DateRangePicker (daterangepicker) dark mode. */
      html[${COPILOT_THEME_ATTR}='dark'] .daterangepicker {
        background-color: var(--copilot-surface-2) !important;
        border: 1px solid var(--copilot-border) !important;
        color: var(--copilot-text) !important;
        box-shadow: 0 18px 40px rgba(0, 0, 0, 0.45) !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] .daterangepicker:before,
      html[${COPILOT_THEME_ATTR}='dark'] .daterangepicker:after {
        border-bottom-color: var(--copilot-surface-2) !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] .daterangepicker .drp-calendar,
      html[${COPILOT_THEME_ATTR}='dark'] .daterangepicker .calendar-table {
        background-color: transparent !important;
        border-color: transparent !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] .daterangepicker .calendar-table table {
        color: var(--copilot-text) !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] .daterangepicker th,
      html[${COPILOT_THEME_ATTR}='dark'] .daterangepicker td {
        color: var(--copilot-text) !important;
        border-color: transparent !important;
        background-color: transparent !important;
      }

      /* Some builds paint available day cells white; force them transparent in dark mode. */
      html[${COPILOT_THEME_ATTR}='dark'] .daterangepicker td.available,
      html[${COPILOT_THEME_ATTR}='dark'] .daterangepicker td.available:hover {
        background-color: transparent !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] .daterangepicker td.off,
      html[${COPILOT_THEME_ATTR}='dark'] .daterangepicker td.off.in-range,
      html[${COPILOT_THEME_ATTR}='dark'] .daterangepicker td.off.start-date,
      html[${COPILOT_THEME_ATTR}='dark'] .daterangepicker td.off.end-date,
      html[${COPILOT_THEME_ATTR}='dark'] .daterangepicker td.disabled,
      html[${COPILOT_THEME_ATTR}='dark'] .daterangepicker option.disabled {
        color: rgba(219, 228, 243, 0.40) !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] .daterangepicker td.available:hover,
      html[${COPILOT_THEME_ATTR}='dark'] .daterangepicker th.available:hover {
        background-color: rgba(255, 255, 255, 0.06) !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] .daterangepicker td.in-range {
        background-color: rgba(61, 123, 255, 0.14) !important;
        color: var(--copilot-text) !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] .daterangepicker td.active,
      html[${COPILOT_THEME_ATTR}='dark'] .daterangepicker td.active:hover,
      html[${COPILOT_THEME_ATTR}='dark'] .daterangepicker td.start-date,
      html[${COPILOT_THEME_ATTR}='dark'] .daterangepicker td.end-date {
        background-color: var(--copilot-primary) !important;
        color: #ffffff !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] .daterangepicker .drp-buttons {
        border-top: 1px solid var(--copilot-border) !important;
        background-color: var(--copilot-surface) !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] .daterangepicker .drp-selected {
        color: var(--copilot-muted) !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] .daterangepicker .calendar-time select,
      html[${COPILOT_THEME_ATTR}='dark'] .daterangepicker select.hourselect,
      html[${COPILOT_THEME_ATTR}='dark'] .daterangepicker select.minuteselect,
      html[${COPILOT_THEME_ATTR}='dark'] .daterangepicker select.ampmselect {
        background-color: var(--copilot-surface-2) !important;
        border: 1px solid var(--copilot-border) !important;
        color: var(--copilot-text) !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] .daterangepicker .ranges {
        background-color: transparent !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] .fc,
      html[${COPILOT_THEME_ATTR}='dark'] .fc .fc-toolbar-title,
      html[${COPILOT_THEME_ATTR}='dark'] .fc a {
        color: var(--copilot-text) !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] .fc .fc-button {
        box-shadow: none !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] .fc .fc-daygrid-day-number,
      html[${COPILOT_THEME_ATTR}='dark'] .fc .fc-col-header-cell-cushion {
        color: var(--copilot-muted) !important;
      }

      /* FullCalendar day cells can still render white frames in some themes. */
      html[${COPILOT_THEME_ATTR}='dark'] .fc .fc-scrollgrid,
      html[${COPILOT_THEME_ATTR}='dark'] .fc .fc-scrollgrid-section > *,
      html[${COPILOT_THEME_ATTR}='dark'] .fc .fc-daygrid-day-frame {
        background-color: var(--copilot-surface-2) !important;
        border-color: var(--copilot-border) !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] .fc .fc-daygrid-day.fc-day-today .fc-daygrid-day-frame {
        background-color: rgba(61, 123, 255, 0.10) !important;
      }

      /* User-menu icon button (replaces username text in dark mode). */
      html[${COPILOT_THEME_ATTR}='dark'] .copilot-user-menu-btn {
        width: 34px;
        height: 34px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 999px;
        background: rgba(176, 172, 172, 0.08);
        border: 1px solid var(--copilot-border);
      }

      html[${COPILOT_THEME_ATTR}='dark'] .copilot-user-menu-btn:hover {
        background: rgba(255, 255, 255, 0.12);
      }

      html[${COPILOT_THEME_ATTR}='dark'] .copilot-user-menu-btn svg {
        width: 16px;
        height: 16px;
        fill: rgb(140 146 155);
        opacity: 0.92;
      }

      html[${COPILOT_THEME_ATTR}='dark'] .text-primary {
        color: var(--copilot-primary) !important;
      }

      html[${COPILOT_THEME_ATTR}='dark'] a {
        color: var(--copilot-primary) !important;
      }
    `;
    document.documentElement.appendChild(style);
  }

  const LEGACY_PURPLE_HEX = '#32325d';
  const LEGACY_PURPLE_REPLACER_STYLE_ID = 'copilot-legacy-purple-replacements-style';
  let legacyPurpleReplacerInstalled = false;
  let legacyPurpleReplacerScheduled = false;

  function prefixSelectorForDarkMode(selector) {
    const sel = String(selector || '').trim();
    if (!sel) return '';
    const scope = `html[${COPILOT_THEME_ATTR}='dark']`;
    if (sel === ':root' || sel === 'html') return scope;
    if (sel.startsWith(scope)) return sel;
    return `${scope} ${sel}`;
  }

  function buildLegacyPurpleOverrideCssFromRules(cssRules) {
    let out = '';
    const rules = cssRules ? Array.from(cssRules) : [];
    for (const rule of rules) {
      try {
        if (!rule) continue;

        // STYLE_RULE
        if (rule.type === 1) {
          const styleText = rule.style && rule.style.cssText ? String(rule.style.cssText) : '';
          if (!styleText) continue;
          if (styleText.toLowerCase().indexOf(LEGACY_PURPLE_HEX) === -1) continue;

          const selectorText = String(rule.selectorText || '').trim();
          if (!selectorText) continue;

          const prefixedSelectors = selectorText
            .split(',')
            .map((s) => prefixSelectorForDarkMode(s))
            .filter(Boolean)
            .join(', ');
          if (!prefixedSelectors) continue;

          const decls = styleText.replace(/#32325d\b/gi, 'var(--copilot-purple)');
          out += `${prefixedSelectors} { ${decls} }\n`;
          continue;
        }

        // MEDIA_RULE
        if (rule.type === 4) {
          const inner = buildLegacyPurpleOverrideCssFromRules(rule.cssRules);
          if (inner && inner.trim()) {
            const cond = String(rule.conditionText || '').trim();
            out += `@media ${cond} {\n${inner}}\n`;
          }
          continue;
        }

        // SUPPORTS_RULE
        if (rule.type === 12) {
          const inner = buildLegacyPurpleOverrideCssFromRules(rule.cssRules);
          if (inner && inner.trim()) {
            const cond = String(rule.conditionText || '').trim();
            out += `@supports ${cond} {\n${inner}}\n`;
          }
          continue;
        }
      } catch {
      }
    }
    return out;
  }

  function buildLegacyPurpleReplacementCss() {
    let css = '';

    // Inline styles / SVG attributes that hardcode the legacy purple.
    css += `html[${COPILOT_THEME_ATTR}='dark'] [style*="${LEGACY_PURPLE_HEX}" i] { color: var(--copilot-purple) !important; }\n`;
    css += `html[${COPILOT_THEME_ATTR}='dark'] [style*="background:${LEGACY_PURPLE_HEX}" i],\n`;
    css += `html[${COPILOT_THEME_ATTR}='dark'] [style*="background-color:${LEGACY_PURPLE_HEX}" i] { background-color: var(--copilot-purple) !important; }\n`;
    css += `html[${COPILOT_THEME_ATTR}='dark'] [style*="border-color:${LEGACY_PURPLE_HEX}" i] { border-color: var(--copilot-purple) !important; }\n`;
    css += `html[${COPILOT_THEME_ATTR}='dark'] [fill="${LEGACY_PURPLE_HEX}"],\n`;
    css += `html[${COPILOT_THEME_ATTR}='dark'] [fill="${LEGACY_PURPLE_HEX.toUpperCase()}"],\n`;
    css += `html[${COPILOT_THEME_ATTR}='dark'] [stroke="${LEGACY_PURPLE_HEX}"],\n`;
    css += `html[${COPILOT_THEME_ATTR}='dark'] [stroke="${LEGACY_PURPLE_HEX.toUpperCase()}"] { fill: var(--copilot-purple) !important; stroke: var(--copilot-purple) !important; }\n`;

    // Same-origin / readable CSSOM rules.
    const sheets = Array.from(document.styleSheets || []);
    for (const sheet of sheets) {
      try {
        const rules = sheet && sheet.cssRules ? sheet.cssRules : null;
        if (!rules || !rules.length) continue;
        css += buildLegacyPurpleOverrideCssFromRules(rules);
      } catch {
        // Cross-origin or blocked CSSOM access; ignore.
      }
    }

    return css;
  }

  function ensureLegacyPurpleReplacements() {
    if (legacyPurpleReplacerInstalled) return;
    legacyPurpleReplacerInstalled = true;

    let style = document.getElementById(LEGACY_PURPLE_REPLACER_STYLE_ID);
    if (!style) {
      style = document.createElement('style');
      style.id = LEGACY_PURPLE_REPLACER_STYLE_ID;
      document.documentElement.appendChild(style);
    }

    const rebuildNow = () => {
      try {
        style.textContent = buildLegacyPurpleReplacementCss();
      } catch {
      }
    };

    const schedule = () => {
      if (legacyPurpleReplacerScheduled) return;
      legacyPurpleReplacerScheduled = true;
      setTimeout(() => {
        legacyPurpleReplacerScheduled = false;
        rebuildNow();
      }, 250);
    };

    schedule();
    window.addEventListener('load', schedule, { once: true });

    const head = document.head || document.documentElement;
    const mo = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (!m) continue;
        if (m.type === 'childList' && m.addedNodes && m.addedNodes.length) {
          for (const n of m.addedNodes) {
            if (!n || !n.nodeName) continue;
            const tag = String(n.nodeName || '').toUpperCase();
            if (tag === 'STYLE' || tag === 'LINK') {
              schedule();
              return;
            }
          }
        }
      }
    });

    try {
      mo.observe(head, { childList: true, subtree: true });
    } catch {
    }
  }

  function ensureNavbarUserIcon() {
    // Only apply this tweak in dark mode, since it is part of the dark-theme UX.
    if ((document.documentElement.getAttribute(COPILOT_THEME_ATTR) || getStoredTheme()) !== 'dark') return;

    const nav = document.querySelector('nav.navbar-top');
    if (!nav) return;

    const toggle = nav.querySelector(
      'li.nav-item.dropdown a.nav-link[data-toggle="dropdown"], li.nav-item.dropdown a.nav-link[aria-haspopup="true"]'
    );
    if (!toggle) return;
    if (toggle.getAttribute(COPILOT_USER_ICONIZED_ATTR) === '1') return;

    const iconWrap = document.createElement('span');
    iconWrap.className = 'copilot-user-menu-btn';
    iconWrap.setAttribute('aria-hidden', 'true');
    iconWrap.innerHTML = `
      <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
        <path d="M12 12c2.76 0 5-2.24 5-5S14.76 2 12 2 7 4.24 7 7s2.24 5 5 5zm0 2c-4.42 0-8 2.24-8 5v1h16v-1c0-2.76-3.58-5-8-5z" />
      </svg>
    `;

    // Replace the visible username with the icon, but keep the existing dropdown toggle anchor.
    const media = toggle.querySelector('.media');
    if (media) {
      while (media.firstChild) media.removeChild(media.firstChild);
      media.appendChild(iconWrap);
    } else {
      toggle.textContent = '';
      toggle.appendChild(iconWrap);
    }

    toggle.setAttribute('aria-label', 'User menu');
    toggle.setAttribute(COPILOT_USER_ICONIZED_ATTR, '1');
  }

  const SIDENAV_FALLBACK_ATTR = 'data-copilot-sidenav-fallback';

  function pinSidenavFallback() {
    const body = document.body;
    if (!body) return;

    body.classList.remove('g-sidenav-hidden');
    body.classList.add('g-sidenav-show', 'g-sidenav-pinned');

    document.querySelectorAll('.sidenav-toggler').forEach((t) => {
      try {
        t.classList.add('active');
        t.setAttribute('data-action', 'sidenav-unpin');
      } catch {
      }
    });

    if (!body.querySelector('.backdrop.d-xl-none')) {
      const target = document.getElementById('sidenav-main');
      const targetAttr = target ? (target.getAttribute('data-target') || '#sidenav-main') : '#sidenav-main';

      const backdrop = document.createElement('div');
      backdrop.className = 'backdrop d-xl-none';
      backdrop.setAttribute('data-action', 'sidenav-unpin');
      backdrop.setAttribute('data-target', targetAttr);
      body.appendChild(backdrop);
    }
  }

  function unpinSidenavFallback() {
    const body = document.body;
    if (!body) return;

    body.classList.remove('g-sidenav-pinned');
    body.classList.add('g-sidenav-hidden');

    document.querySelectorAll('.sidenav-toggler').forEach((t) => {
      try {
        t.classList.remove('active');
        t.setAttribute('data-action', 'sidenav-pin');
      } catch {
      }
    });

    body.querySelectorAll('.backdrop').forEach((b) => b.remove());
  }

  function ensureSidenavToggleFallback() {
    if (document.documentElement.getAttribute(SIDENAV_FALLBACK_ATTR) === '1') return;
    document.documentElement.setAttribute(SIDENAV_FALLBACK_ATTR, '1');

    document.addEventListener('click', (e) => {
      const el = e.target && e.target.closest ? e.target.closest('[data-action]') : null;
      if (!el) return;

      const action = String(el.getAttribute('data-action') || '').toLowerCase();
      if (action !== 'sidenav-pin' && action !== 'sidenav-unpin') return;

      const before = document.body ? document.body.className : '';
      setTimeout(() => {
        const after = document.body ? document.body.className : '';
        // If Argon's handler ran, do nothing.
        if (after !== before) return;

        if (action === 'sidenav-pin') pinSidenavFallback();
        if (action === 'sidenav-unpin') unpinSidenavFallback();
      }, 0);
    });
  }

  function parseCssColorToRgb(value) {
    if (!value) return null;
    const v = String(value).trim().toLowerCase();
    if (v === 'none' || v === 'transparent' || v === 'currentcolor') return null;
    if (v === 'black') return { r: 0, g: 0, b: 0 };
    if (v === 'white') return { r: 255, g: 255, b: 255 };

    const hexMatch = v.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (hexMatch) {
      let hex = hexMatch[1];
      if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
      };
    }

    const rgbMatch = v.match(/^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/);
    if (rgbMatch) {
      return {
        r: Math.max(0, Math.min(255, Number(rgbMatch[1]))),
        g: Math.max(0, Math.min(255, Number(rgbMatch[2]))),
        b: Math.max(0, Math.min(255, Number(rgbMatch[3]))),
      };
    }

    return null;
  }

  function isDarkColor(rgb) {
    if (!rgb) return false;
    // Relative luminance (simple approximation).
    const luminance = (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;
    return luminance < 0.35;
  }

  async function ensureWhiteBrandLogo() {
    if ((document.documentElement.getAttribute(COPILOT_THEME_ATTR) || getStoredTheme()) !== 'dark') return;

    const img = document.querySelector('img.navbar-brand-img');
    if (!img) return;
    if (img.getAttribute('data-copilot-logo') === '1') return;

    const src = img.currentSrc || img.src;
    if (!src || !/logo-taxe\.svg/i.test(src)) return;

    const fetchTextViaBackground = (url) => {
      return new Promise((resolve, reject) => {
        try {
          if (!chrome || !chrome.runtime || !chrome.runtime.sendMessage) {
            reject(new Error('Extension messaging unavailable'));
            return;
          }

          chrome.runtime.sendMessage({ type: 'COPILOT_FETCH_TEXT', url }, (resp) => {
            const err = chrome.runtime.lastError;
            if (err) {
              reject(new Error(String(err.message || err)));
              return;
            }
            if (!resp || resp.ok !== true || typeof resp.text !== 'string') {
              reject(new Error(String((resp && resp.error) || 'Fetch failed')));
              return;
            }
            resolve(resp.text);
          });
        } catch (e) {
          reject(e);
        }
      });
    };

    try {
      // Fetch through the extension service worker to avoid page CORS.
      const svgText = await fetchTextViaBackground(src);
      if (!svgText || !svgText.includes('<svg')) throw new Error('Logo is not SVG');

      const parser = new DOMParser();
      const doc = parser.parseFromString(svgText, 'image/svg+xml');
      const svg = doc.documentElement;

      // Replace only dark fills (logo text is typically dark); preserve non-dark colors (e.g. green X).
      const filled = svg.querySelectorAll('[fill]');
      for (const el of filled) {
        const fill = el.getAttribute('fill');
        const rgb = parseCssColorToRgb(fill);
        if (rgb && isDarkColor(rgb)) el.setAttribute('fill', '#ffffff');
      }

      const styled = svg.querySelectorAll('[style]');
      for (const el of styled) {
        const style = el.getAttribute('style') || '';
        const m = style.match(/fill\s*:\s*([^;]+)\s*;?/i);
        if (!m) continue;
        const rgb = parseCssColorToRgb(m[1]);
        if (!rgb || !isDarkColor(rgb)) continue;
        el.setAttribute('style', style.replace(/fill\s*:\s*([^;]+)\s*;?/i, 'fill: #ffffff;'));
      }

      const serialized = new XMLSerializer().serializeToString(svg);
      const dataUri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(serialized)}`;
      img.src = dataUri;
      img.setAttribute('data-copilot-logo', '1');
    } catch (e) {
      // Fallback: at least make it visible in dark mode.
      img.style.filter = 'brightness(0) invert(1)';
      img.setAttribute('data-copilot-logo', '1');
    }
  }

  function stripCountryEmojiFromTextNodes(el) {
    if (!el) return { hadDE: false, hadNL: false };
    let hadDE = false;
    let hadNL = false;

    try {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      const nodes = [];
      let node = walker.nextNode();
      while (node) {
        nodes.push(node);
        node = walker.nextNode();
      }

      for (const n of nodes) {
        const t = String(n.nodeValue || '');
        if (!t) continue;
        if (t.includes('🇩🇪')) hadDE = true;
        if (t.includes('🇳🇱')) hadNL = true;
        if (!hadDE && !hadNL) continue;
        const cleaned = t.replace(/🇩🇪|🇳🇱/g, '');
        if (cleaned !== t) n.nodeValue = cleaned;
      }
    } catch {
      const t = String(el.textContent || '');
      hadDE = t.includes('🇩🇪');
      hadNL = t.includes('🇳🇱');
      if (hadDE || hadNL) el.textContent = t.replace(/🇩🇪|🇳🇱/g, '');
    }

    return { hadDE, hadNL };
  }

  function beautifyArrayLikeText(raw) {
    let t = ws(raw);
    if (!t) return t;

    // Strip surrounding brackets for array-like values: [2024,2025] -> 2024,2025
    if (t.startsWith('[') && t.endsWith(']')) {
      t = ws(t.slice(1, -1));
    }

    // Normalize spacing after separators.
    t = t.replace(/\s*,\s*/g, ', ');
    t = t.replace(/\s*:\s*/g, ': ');
    return t;
  }

  function removeLeadIdYearsHoverAndBeautify(candidateTables) {
    const tables = candidateTables || findCandidateTables();
    if (!tables.length) return;

    for (const table of tables) {
      const body = table.tBodies && table.tBodies.length ? table.tBodies[0] : table.querySelector('tbody');
      if (!body) continue;

      const rows = body.querySelectorAll('tr[role="row"]');
      for (const row of rows) {
        // 1) Lead ID cell hover tooltip: remove title and beautify if present
        const leadSpan = row.querySelector('td.sorting_1 span[title]');
        if (leadSpan && leadSpan.getAttribute(LEAD_YEARS_FORMATTED_ATTR) !== '1') {
          const title = leadSpan.getAttribute('title');
          if (title) {
            // If someone later re-adds it, keep it pretty.
            const pretty = beautifyArrayLikeText(title);
            // Remove hover tooltip entirely.
            leadSpan.removeAttribute('title');
            // Store pretty value in case you want it later (no hover).
            leadSpan.setAttribute('data-copilot-years', pretty);
          }
          leadSpan.setAttribute(LEAD_YEARS_FORMATTED_ATTR, '1');
        }

        // 2) Beautify the separate years column cell (usually contains [2024,2025])
        // Only touch simple text-only cells to avoid breaking nested markup.
        const cells = row.querySelectorAll('td');
        for (const cell of cells) {
          if (cell.getAttribute(LEAD_YEARS_FORMATTED_ATTR) === '1') continue;

          const hasElementChildren = !!(cell.children && cell.children.length);
          if (hasElementChildren) continue;

          const raw = ws(cell.textContent);
          if (!raw) continue;
          if (!(raw.startsWith('[') && raw.endsWith(']'))) continue;

          const pretty = beautifyArrayLikeText(raw);
          if (pretty && pretty !== raw) {
            cell.textContent = pretty;
          }
          cell.setAttribute(LEAD_YEARS_FORMATTED_ATTR, '1');
        }
      }
    }
  }

  function replaceLeadIdCountryEmojiWithFlags(candidateTables) {
    const tables = candidateTables || findCandidateTables();
    if (!tables.length) return;

    for (const table of tables) {
      const body = table.tBodies && table.tBodies.length ? table.tBodies[0] : table.querySelector('tbody');
      if (!body) continue;

      const rows = body.querySelectorAll('tr[role="row"]');
      for (const row of rows) {
        const leadCellSpan =
          row.querySelector('td.sorting_1 span[title]') ||
          row.querySelector('td.sorting_1 span') ||
          row.querySelector('td.sorting_1') ||
          row.querySelector('td:first-child span') ||
          row.querySelector('td:first-child');

        if (!leadCellSpan) continue;
        if (leadCellSpan.getAttribute(LEAD_FLAG_REPLACED_ATTR) === '1') continue;
        if (leadCellSpan.querySelector && leadCellSpan.querySelector(`.${LEAD_FLAG_CLASS}`)) {
          leadCellSpan.setAttribute(LEAD_FLAG_REPLACED_ATTR, '1');
          continue;
        }

        // Remove hover tooltip from the lead-id span if present.
        if (leadCellSpan.removeAttribute) leadCellSpan.removeAttribute('title');

        const { hadDE, hadNL } = stripCountryEmojiFromTextNodes(leadCellSpan);
        if (!hadDE && !hadNL) continue;

        const flag = document.createElement('span');
        flag.className = LEAD_FLAG_CLASS;
        if (hadDE) {
          flag.setAttribute('data-flag', 'de');
          flag.setAttribute('aria-label', 'Germany');
          setCopilotTooltip(flag, 'Germany');
        } else {
          flag.setAttribute('data-flag', 'nl');
          flag.setAttribute('aria-label', 'Netherlands');
          setCopilotTooltip(flag, 'Netherlands');
        }
        leadCellSpan.insertBefore(flag, leadCellSpan.firstChild);
        leadCellSpan.setAttribute(LEAD_FLAG_REPLACED_ATTR, '1');
      }
    }
  }

  function extractLeadIdFromHref(href) {
    const s = String(href || '');
    const m = s.match(/\/leads\/(\d+)/);
    return m ? m[1] : null;
  }

  function extractLeadIdFromPathname() {
    const m = String(window.location.pathname || '').match(/^\/leads\/(\d+)/);
    return m ? m[1] : null;
  }

  function loadOpenedLeadIdsOnce() {
    if (openedLeadIdsLoadPromise) return openedLeadIdsLoadPromise;

    openedLeadIdsLoadPromise = new Promise((resolve) => {
      try {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.get([OPENED_LEADS_STORAGE_KEY], (res) => {
            const raw = res ? res[OPENED_LEADS_STORAGE_KEY] : null;
            const arr = Array.isArray(raw) ? raw : [];
            openedLeadIds = new Set(arr.map(String));
            resolve(openedLeadIds);
          });
          return;
        }
      } catch {
      }

      // Fallback (best-effort) if chrome.storage is unavailable.
      try {
        const raw = localStorage.getItem(OPENED_LEADS_STORAGE_KEY);
        const arr = raw ? JSON.parse(raw) : [];
        openedLeadIds = new Set((Array.isArray(arr) ? arr : []).map(String));
      } catch {
        openedLeadIds = new Set();
      }
      resolve(openedLeadIds);
    });

    openedLeadIdsLoadPromise.then(() => refreshOpenButtonsOpenedState());
    return openedLeadIdsLoadPromise;
  }

  function loadLeadStatusMapOnce() {
    if (leadStatusMapLoadPromise) return leadStatusMapLoadPromise;

    leadStatusMapLoadPromise = new Promise((resolve) => {
      try {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.get([LEAD_STATUS_STORAGE_KEY], (res) => {
            const raw = res ? res[LEAD_STATUS_STORAGE_KEY] : null;
            leadStatusMap = raw && typeof raw === 'object' ? raw : {};
            resolve(leadStatusMap);
          });
          return;
        }
      } catch {
      }

      resolve(leadStatusMap);
    });

    return leadStatusMapLoadPromise;
  }

  function recordLeadStatusUpdate(leadId, status) {
    const id = ws(leadId);
    const st = ws(status);
    if (!id || !st) return;

    leadStatusMap = leadStatusMap && typeof leadStatusMap === 'object' ? leadStatusMap : {};
    leadStatusMap[id] = { status: st, ts: Date.now() };

    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({
          [LEAD_STATUS_STORAGE_KEY]: leadStatusMap,
          [LEAD_STATUS_LAST_EVENT_KEY]: { leadId: id, status: st, ts: Date.now() }
        });
      }
    } catch {
    }
  }

  function persistOpenedLeadIds() {
    const arr = Array.from(openedLeadIds);
    const trimmed = arr.length > MAX_OPENED_LEADS ? arr.slice(arr.length - MAX_OPENED_LEADS) : arr;
    openedLeadIds = new Set(trimmed);

    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ [OPENED_LEADS_STORAGE_KEY]: trimmed });
        return;
      }
    } catch {
    }

    try {
      localStorage.setItem(OPENED_LEADS_STORAGE_KEY, JSON.stringify(trimmed));
    } catch {
    }
  }

  function markLeadAsOpened(leadId, btn) {
    const id = String(leadId || '').trim();
    if (!id) return;

    openedLeadIds.add(id);
    persistOpenedLeadIds();

    if (btn) setOpenedButtonUI(btn);
  }

  function setOpenedButtonUI(btn) {
    if (!btn || !btn.classList) return;
    btn.classList.add(OPENED_BTN_CLASS);
    if (typeof btn.textContent === 'string') btn.textContent = 'Opened';
    const row = btn.closest && btn.closest('tr');
    if (row) row.classList.add(OPENED_ROW_CLASS);
  }

  function refreshOpenButtonsOpenedState() {
    const btns = Array.from(document.querySelectorAll(`button[${OPEN_BTN_ATTR}="1"]`));
    for (const btn of btns) {
      const leadId = btn.getAttribute(OPEN_BTN_LEAD_ID_ATTR);
      if (leadId && openedLeadIds.has(String(leadId))) {
        setOpenedButtonUI(btn);
      }
    }
  }

  function findStatusDisplayElement(root) {
    if (!root) return null;

    const candidates = Array.from(root.querySelectorAll('span.session-status'));
    for (const el of candidates) {
      const t = ws(el.textContent).toLowerCase();
      if (t.startsWith('status:') || t.includes(' status:')) return el;
    }

    // Fallback: sometimes the dropdown itself shows the selected value.
    const dropdown = root.querySelector('#statusDropdown');
    if (dropdown) return dropdown;

    return null;
  }

  function extractStatusValueFromText(text) {
    const raw = ws(text);
    if (!raw) return null;

    const m = raw.match(/status\s*:\s*(.+)$/i);
    const v = ws(m ? m[1] : raw);
    if (!v) return null;
    if (v.toLowerCase() === 'status') return null;
    return v;
  }

  function setupLeadStatusCounting() {
    const root = document.querySelector('#edit-session');
    if (!root) return;
    if (root.getAttribute(STATUS_TRACKING_ATTR) === '1') return;

    const leadId = extractLeadIdFromPathname();
    if (!leadId) return;

    const statusEl = findStatusDisplayElement(root);
    if (!statusEl) return;

    let initialized = false;
    let lastStatus = null;
    let timer = null;

    function getCurrentStatus() {
      return extractStatusValueFromText(statusEl.textContent);
    }

    function sendStatus(status) {
      recordLeadStatusUpdate(leadId, status);
      try {
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
          chrome.runtime.sendMessage({
            type: 'COPILOT_LEAD_STATUS_CHANGED',
            leadId: String(leadId),
            status: String(status || ''),
            url: String(window.location.href || ''),
            ts: Date.now()
          });
        }
      } catch {
      }
    }

    function checkNow() {
      const current = getCurrentStatus();
      if (!initialized) {
        initialized = true;
        lastStatus = current;
        return;
      }
      if (!current) return;
      if (lastStatus && ws(lastStatus).toLowerCase() === ws(current).toLowerCase()) return;
      lastStatus = current;
      sendStatus(current);
    }

    function scheduleCheck() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        checkNow();
      }, STATUS_DEBOUNCE_MS);
    }

    // Initial baseline
    initialized = true;
    lastStatus = getCurrentStatus();

    const mo = new MutationObserver(() => scheduleCheck());
    mo.observe(statusEl, { childList: true, subtree: true, characterData: true });

    // Click fallback (covers cases where the status element updates after a request)
    root.addEventListener(
      'click',
      (e) => {
        const t = e.target;
        if (!t) return;

        const clickedInStatus = !!(
          t.closest && (t.closest('#statusDropdown') || t.closest('[aria-labelledby="statusDropdown"]'))
        );
        if (!clickedInStatus) return;

        // Send immediately on menu click (server dedupes by leadId).
        const clickedText = extractStatusValueFromText(t.textContent);
        sendStatus(clickedText || getCurrentStatus() || '');

        // Also re-check after a short delay in case UI updates async.
        scheduleCheck();
      },
      true
    );

    root.setAttribute(STATUS_TRACKING_ATTR, '1');
  }

  function findDetailValueByLabel(labelIncludes) {
    const root = document.querySelector('#edit-session');
    if (!root) return null;

    const normIncludes = (s) => {
      const t = ws(s).toLowerCase();
      return labelIncludes.some((needle) => t.includes(String(needle).toLowerCase()));
    };

    // Preferred: paired layout rows
    const pairedRows = Array.from(root.querySelectorAll(`.${DETAIL_ROW_CLASS}`));
    for (const row of pairedRows) {
      const labelEl = row.querySelector(`.${DETAIL_LABEL_CLASS}`);
      const valueEl = row.querySelector(`.${DETAIL_VALUE_CLASS}`);
      if (!labelEl || !valueEl) continue;
      if (!normIncludes(labelEl.textContent)) continue;
      const v = ws(valueEl.textContent);
      if (v) return v;
    }

    // Fallback: original label/value columns
    const labelsCol = root.querySelector('.session-details');
    const valuesCol = root.querySelector('.session-details-values');
    if (labelsCol && valuesCol) {
      const labelRows = Array.from(labelsCol.querySelectorAll(':scope > div'));
      const valueRows = Array.from(valuesCol.querySelectorAll(':scope > div'));
      const idx = labelRows.findIndex((d) => normIncludes(d.textContent));
      if (idx >= 0 && idx < valueRows.length) {
        const v = ws(valueRows[idx].textContent);
        if (v) return v;
      }
    }

    return null;
  }

  function extractCreatedDateFromTimeline() {
    const root = document.querySelector('#edit-session');
    if (!root) return null;

    const timelineCard = findCard(root, 'Timeline');
    if (!timelineCard) return null;

    const body = timelineCard.querySelector(':scope > .card-body') || timelineCard.querySelector('.card-body');
    if (!body) return null;

    // The first timeline element contains the created timestamp in:
    // <div class="timeline-content"> ... <small class="text-muted font-weight-bold">TIMESTAMP</small>
    const createdSmall = body.querySelector('.timeline-content small.text-muted.font-weight-bold');
    if (createdSmall) {
      const v = ws(createdSmall.textContent);
      if (v) return v;
    }

    const bell = body.querySelector(
      'i.fa-bell, i.fas.fa-bell, i.fa.fa-bell, i[class*="fa-bell"], svg[data-icon="bell"], svg[aria-label*="bell" i]'
    );
    if (!bell) return null;

    const container = bell.closest('li, .timeline-item, .timeline-block, .timeline, .d-flex, .row, div') || bell.parentElement;
    if (!container) return null;

    const rawText = ws(container.textContent);
    if (!rawText) return null;

    // Common timestamp patterns seen in the UI
    const patterns = [
      /\b\d{1,2}\.\d{1,2}\.\d{4}\s+\d{1,2}:\d{2}(?::\d{2})?\b/, // 16.12.2025 12:29(:56)
      /\b\d{4}-\d{2}-\d{2}\s+\d{1,2}:\d{2}(?::\d{2})?\b/, // 2025-12-16 12:29(:56)
      /\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?\b/ // 2025-12-16T12:29(:56)
    ];
    for (const re of patterns) {
      const m = rawText.match(re);
      if (m) return m[0];
    }

    // Fallback: return the container text minus obvious labels
    const cleaned = ws(rawText.replace(/\b(created|created at|lead created)\b\s*:?/gi, ''));
    return cleaned || null;
  }

  function addCreatedDateToLeadTitleLine() {
    const root = document.querySelector('#edit-session');
    if (!root) return;

    const created = extractCreatedDateFromTimeline();
    if (!created) return;

    // Primary: header-body -> first row -> <h6 class="h2 d-inline-block mb-0">Lead</h6>
    const headerBody = document.querySelector('.header-body');
    if (headerBody) {
      const firstHeaderRow = headerBody.querySelector('.row.align-items-center.py-4');
      if (firstHeaderRow) {
        const h6Candidates = Array.from(firstHeaderRow.querySelectorAll('h6.h2'));
        const leadH6 = h6Candidates.find((h6) => ws(h6.textContent).toLowerCase() === 'lead') || firstHeaderRow.querySelector('h6.h2');
        if (leadH6) {
          // Make the immediate container a flex row so we can push the created date to the right.
          const container = leadH6.parentElement;
          if (container) container.classList.add(LEAD_HEADER_TITLE_CLASS);

          // Create a separate <h6> element for the created date (not appended into the existing Lead <h6>).
          if (container && container.getAttribute(CREATED_DATE_RENDERED_ATTR) !== '1') {
            const createdH6 = document.createElement('h6');
            createdH6.className = `h2 d-inline-block mb-0 ${CREATED_DATE_CLASS}`;
            createdH6.textContent = created;

            // Insert right after the Lead title.
            container.insertBefore(createdH6, leadH6.nextSibling);
            container.setAttribute(CREATED_DATE_RENDERED_ATTR, '1');
          }
          return;
        }
      }
    }

    // Fallback: attach to "Lead" / "Comments" card header inside #edit-session
    const leadHeader = Array.from(root.querySelectorAll('.card .card-header h3, .card-header h3')).find((h3) => {
      return ws(h3.textContent).toLowerCase() === 'lead';
    });

    const commentsCard = findCard(root, 'Comments');
    const commentsHeader = commentsCard
      ? commentsCard.querySelector('.card .card-header h3') || commentsCard.querySelector('.card-header h3')
      : null;

    const headerTitle = leadHeader || commentsHeader;
    if (!headerTitle) return;
    if (headerTitle.getAttribute(CREATED_DATE_RENDERED_ATTR) === '1') return;

    headerTitle.style.display = 'flex';
    headerTitle.style.alignItems = 'center';

    const span = document.createElement('span');
    span.className = CREATED_DATE_CLASS;
    span.textContent = created;
    headerTitle.appendChild(span);

    headerTitle.setAttribute(CREATED_DATE_RENDERED_ATTR, '1');
  }

  function adjustDataTablesSizing() {
    const dt = window.LaravelDataTables && window.LaravelDataTables['leads-table'];
    if (!dt) return;

    try {
      if (typeof dt.columns === 'function') {
        if (dt.columns.adjust && typeof dt.columns.adjust === 'function') {
          dt.columns.adjust();
        } else {
          const cols = dt.columns();
          if (cols && typeof cols.adjust === 'function') cols.adjust();
        }
      }
    } catch {
    }
  }

  function isLeadsArea() {
    if (!ALLOWED_HOSTS.has(window.location.hostname)) return false;
    if (!window.location.pathname.startsWith('/leads')) return false;
    return true;
  }

  function isLeadsListPage() {
    const normalizedTitle = ws(document.title);
    const normalizedTarget = ws(TARGET_TITLE);
    if (normalizedTitle === normalizedTarget) return true;

    if (document.querySelector('table#leads-table')) return true;

    return findCandidateTables().length > 0;
  }

  function isLeadDetailsPage() {
    if (!/^\/leads\/[0-9]+/.test(window.location.pathname)) return false;
    return !!document.querySelector('#edit-session');
  }

  function isPrecalcsListPage() {
    if (!ALLOWED_HOSTS.has(window.location.hostname)) return false;

    const path = String(window.location.pathname || '').replace(/\/+$/, '');
    if (path === '/verificare/precalculari') return true;
    if (path.startsWith('/verificare/precalculari/')) return true;

    return !!document.querySelector('table#precalcs-table');
  }

  function applyPrecalcsTableColumnTweaks(table) {
    if (!table) return;

    const thead = table.querySelector('thead');
    if (!thead) return;

    const headers = Array.from(thead.querySelectorAll('th'));
    if (!headers.length) return;

    const motivIdx = headers.findIndex((th) => ws(th.textContent).toLowerCase() === 'motiv');
    if (motivIdx < 0) return;

    const header = headers[motivIdx];
    if (header && header.classList) header.classList.add('copilot-motiv-col');

    const rows = Array.from(table.querySelectorAll('tbody tr'));
    for (const row of rows) {
      const cells = Array.from(row.querySelectorAll('td'));
      const cell = cells[motivIdx];
      if (cell && cell.classList) cell.classList.add('copilot-motiv-col');
    }
  }

  function replacePrecalcsEyeWithOpenButton() {
    const table = document.querySelector('table#precalcs-table');
    if (!table) return;

    const tds = table.querySelectorAll(`tbody td.text-center:not([${OPEN_BUTTON_REPLACED_ATTR}="1"])`);
    for (const td of tds) {
      const link = td.querySelector('a[onclick]');
      if (!link) continue;

      const onclick = String(link.getAttribute('onclick') || '');
      if (!onclick.includes('openRightsidePanel')) continue;

      const hasEyeIcon =
        !!td.querySelector('i.fa-eye, i.fas.fa-eye, i.fa.fa-eye, i[class*="fa-eye"], svg[data-icon="eye"]');
      if (!hasEyeIcon) continue;

      const btn = document.createElement('button');
      btn.className = 'btn btn-primary btn-sm';
      btn.type = 'button';
      btn.textContent = 'Open';

      // Keep the page's existing behavior (runs in page context).
      const onkeydown = link.getAttribute('onkeydown');
      if (onkeydown) btn.setAttribute('onkeydown', onkeydown);
      const originalOnclick = link.getAttribute('onclick');
      if (originalOnclick) btn.setAttribute('onclick', originalOnclick);

      // Fallback: if inline handler isn't present for some reason, forward the click.
      btn.addEventListener('click', () => {
        try {
          link.click();
        } catch {
        }
      });

      link.style.display = 'none';
      td.appendChild(btn);
      td.setAttribute(OPEN_BUTTON_REPLACED_ATTR, '1');
    }
  }

  function applyPrecalcsEnhancements() {
    const table = document.querySelector('table#precalcs-table');
    const sidebar = document.querySelector('#precalc-info-rightSidebar');
    if (sidebar) {
      // The site sets an inline background with '!important', so we must override inline.
      try {
        sidebar.style.setProperty('background', 'var(--copilot-surface)', 'important');
      } catch {
      }

      try {
        const header = sidebar.querySelector('.card-header');
        if (header) header.style.setProperty('background', 'var(--copilot-surface)', 'important');
      } catch {
      }

      try {
        const footer = sidebar.querySelector('.card-footer');
        if (footer) footer.style.setProperty('background', 'var(--copilot-surface)', 'important');
      } catch {
      }
    }

    if (!table) return;
    applyPrecalcsTableColumnTweaks(table);
    replacePrecalcsEyeWithOpenButton();
  }

  function detectCountry() {
    const container = document.querySelector('#edit-session') || document.documentElement;
    const text = container ? container.textContent || '' : '';

    if (/"country_form"\s*:\s*"NL"/i.test(text)) return 'Netherlands';
    if (/"country_form"\s*:\s*"DE"/i.test(text)) return 'Germany';

    if (/newClientNL/i.test(text)) return 'Netherlands';
    if (/newClientDE/i.test(text)) return 'Germany';

    if (/\bOlanda\b/i.test(text) || text.includes('🇳🇱')) return 'Netherlands';
    if (/\bGermania\b/i.test(text) || text.includes('🇩🇪')) return 'Germany';

    return null;
  }

  function ensureStatusLabel() {
    const el = document.querySelector('#edit-session #statusDropdown');
    if (!el) return;

    if (!ws(el.textContent)) {
      el.textContent = 'Status';
    }
  }

  function setupTimelineToggle() {
    const root = document.querySelector('#edit-session');
    if (!root) return;

    const timelineHeaderTitle = Array.from(root.querySelectorAll('.card .card-header h3')).find((h) => {
      return ws(h.textContent).toLowerCase() === 'timeline';
    });
    if (!timelineHeaderTitle) return;

    const card = timelineHeaderTitle.closest('.card');
    if (!card) return;

    const body = card.querySelector(':scope > .card-body');
    if (!body) return;

    let btn = card.querySelector(`button[${TIMELINE_TOGGLE_ATTR}="1"]`);
    if (!btn) {
      btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-sm btn-primary';
      btn.setAttribute(TIMELINE_TOGGLE_ATTR, '1');

      timelineHeaderTitle.style.display = 'flex';
      timelineHeaderTitle.style.alignItems = 'center';

      btn.style.marginLeft = 'auto';

      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        const current = card.getAttribute(TIMELINE_STATE_ATTR) || 'collapsed';
        const next = current === 'expanded' ? 'collapsed' : 'expanded';
        card.setAttribute(TIMELINE_STATE_ATTR, next);
        applyTimelineState();
      });

      timelineHeaderTitle.appendChild(btn);
    }

    function applyTimelineState() {
      const state = card.getAttribute(TIMELINE_STATE_ATTR) || 'collapsed';
      const isExpanded = state === 'expanded';

      body.style.display = isExpanded ? '' : 'none';
      btn.textContent = isExpanded ? 'Hide' : 'Show';
    }

    if (!card.hasAttribute(TIMELINE_STATE_ATTR)) {
      card.setAttribute(TIMELINE_STATE_ATTR, 'collapsed');
    }

    applyTimelineState();
  }

  function findCard(root, headerText) {
    const desired = ws(headerText).toLowerCase();
    const headers = Array.from(root.querySelectorAll('.card .card-header h3'));
    for (const h3 of headers) {
      const text = ws(h3.textContent).toLowerCase();
      if (text === desired || text.startsWith(desired)) {
        const card = h3.closest('.card');
        if (card) return card;
      }
    }
    return null;
  }

  function inlineCards() {
    const root = document.querySelector('#edit-session');
    if (!root) return;

    if (root.getAttribute(INLINE_CARDS_LAYOUT_ATTR) === INLINE_CARDS_LAYOUT_VERSION) return;

    const row = root.querySelector(':scope > .row');
    if (!row) return;

    const leadDetailsCard = findCard(root, 'Lead Details');
    const leadActionsCard = findCard(root, 'Lead Actions');
    const commentsCard = findCard(root, 'Comments');
    const timelineCard = findCard(root, 'Timeline');

    if (!leadDetailsCard || !leadActionsCard || !commentsCard || !timelineCard) return;

    const colA = document.createElement('div');
    colA.className = 'col-6';
    colA.appendChild(leadDetailsCard);

    const colB = document.createElement('div');
    colB.className = 'col-6';
    colB.appendChild(commentsCard);

    const colC = document.createElement('div');
    colC.className = 'col-6';
    colC.appendChild(leadActionsCard);

    const colD = document.createElement('div');
    colD.className = 'col-6';
    colD.appendChild(timelineCard);

    row.replaceChildren(colA, colB, colC, colD);
    root.setAttribute(INLINE_CARDS_LAYOUT_ATTR, INLINE_CARDS_LAYOUT_VERSION);
  }

  function normalizePhone(raw) {
    const original = ws(raw);
    let s = String(original || '').trim();

    s = s.replace(/[()\s.-]/g, '');
    s = s.replace(/[^0-9+]/g, '');

    if (s.startsWith('00')) s = `+${s.slice(2)}`;

    if (s.startsWith('++')) {
      while (s.startsWith('++')) s = s.slice(1);
    }

    const digitsOnly = s.replace(/\D/g, '');

    return { original, cleaned: s, digitsOnly };
  }

  // Keep suggestions Europe-focused (plus a few explicitly allowed exceptions).
  // Ordered by most common in our leads, then broader Europe.
  const COMMON_CALLING_CODES = [
    // Most common for this dashboard
    '40', // Romania
    '49', // Germany
    '31', // Netherlands

    // Nearby / common Europe
    '33', // France
    '39', // Italy
    '34', // Spain
    '44', // United Kingdom
    '41', // Switzerland
    '43', // Austria
    '32', // Belgium
    '45', // Denmark
    '46', // Sweden
    '47', // Norway
    '48', // Poland
    '30', // Greece
    '351', // Portugal
    '353', // Ireland
    '352', // Luxembourg
    '36', // Hungary
    '359', // Bulgaria
    '420', // Czechia
    '421', // Slovakia
    '385', // Croatia
    '386', // Slovenia
    '381', // Serbia
    '387', // Bosnia and Herzegovina
    '382', // Montenegro
    '389', // North Macedonia
    '355', // Albania
    '90', // Turkey (partly in Europe)

    // Rare cases (explicitly allowed)
    '373', // Moldova
    '7', // Russia
    '61', // Australia
    '64', // New Zealand
    '358', // Finland
  ];

  function makeSuggestion(candidateE164) {
    try {
      const parsed = parsePhoneNumberFromString(candidateE164);
      if (!parsed || !parsed.isValid()) return null;
      return {
        e164: parsed.number,
        callingCode: parsed.countryCallingCode,
        country: parsed.country,
      };
    } catch {
      return null;
    }
  }

  function getPrefixSuggestions(parsed) {
    if (!parsed) return [];

    const callingCode = String(parsed.countryCallingCode || '');
    const national = String(parsed.nationalNumber || '');
    if (!callingCode || !national) return [];

    const suggestions = [];
    const seen = new Set();

    const tryAdd = (candidateE164) => {
      const s = makeSuggestion(candidateE164);
      if (!s) return;
      if (seen.has(s.e164)) return;
      seen.add(s.e164);
      suggestions.push(s);
    };

    // Fix common mistake: trunk '0' included after +CC.
    if (national.startsWith('0')) {
      tryAdd(`+${callingCode}${national.replace(/^0+/, '')}`);
    }

    // If the national part doesn't fit this calling code, try swapping the calling code.
    for (const cc of COMMON_CALLING_CODES) {
      if (cc === callingCode) continue;
      tryAdd(`+${cc}${national}`);

      if (national.startsWith('0')) {
        tryAdd(`+${cc}${national.replace(/^0+/, '')}`);
      }
    }

    // Keep it small to avoid noisy tooltips.
    return suggestions.slice(0, 2);
  }

  function validatePhone(raw) {
    const { original, cleaned, digitsOnly } = normalizePhone(raw);
    const e164 = `+${digitsOnly}`;
    const errors = [];
    const suggestions = [];

    if (!original) {
      return { ok: false, errors: ['Phone number is empty'], cleaned, e164, suggestions };
    }

    if (!digitsOnly) {
      return { ok: false, errors: ['Phone number contains no digits'], cleaned, e164, suggestions };
    }

    if (digitsOnly.length < 8) errors.push('Phone number is too short');
    if (digitsOnly.length > 15) errors.push('Phone number is too long');

    if (!/^\+[1-9]\d{7,14}$/.test(e164)) {
      errors.push('Invalid international format');
    } else {
      try {
        const parsed = parsePhoneNumberFromString(e164);
        if (!parsed) {
          errors.push('Invalid phone number');
        } else {
          const cc = String(parsed.countryCallingCode || '');
          const nn = String(parsed.nationalNumber || '');

          if (!parsed.isPossible()) {
            errors.push(
              `Wrong length for prefix +${cc} (got ${nn.length || 0} digits after the prefix)`
            );
          }

          // If isPossible is true but isValid is false, this is often a wrong prefix for the national digits.
          if (!parsed.isValid()) {
            errors.push(`Wrong prefix: +${cc} doesn't match these digits`);
            suggestions.push(...getPrefixSuggestions(parsed));
          }

          // If the calling code doesn't resolve to a single country (e.g. +7), it can be ambiguous.
          if (!parsed.country) {
            errors.push(`Prefix +${cc} is ambiguous/unknown (can't determine a single country)`);
            suggestions.push(...getPrefixSuggestions(parsed));
          }
        }
      } catch {
        errors.push('Invalid phone number');
      }
    }

    return { ok: errors.length === 0, errors, cleaned, e164, suggestions };
  }

  function setPhoneDecoration(el, validation) {
    if (!el) return;

    el.classList.remove('border', 'border-danger', 'rounded', 'px-1');
    setCopilotTooltip(el, '');

    if (!validation.ok) {
      el.classList.add('border', 'border-danger', 'rounded', 'px-1');

      const parts = [...(validation.errors || [])];
      const uniqueSuggestions = Array.from(
        new Map((validation.suggestions || []).map((s) => [s.e164, s])).values()
      );
      if (uniqueSuggestions.length) {
        const fmt = (s) => {
          const cc = s.callingCode ? `+${s.callingCode}` : '';
          const country = s.country ? ` (${s.country})` : '';
          return `${cc}${country}: ${s.e164}`.trim();
        };

        parts.push('Correct prefix / example:');
        for (const s of uniqueSuggestions) {
          parts.push(`- ${fmt(s)}`);
        }
      }

      setCopilotTooltip(el, parts.filter(Boolean).join('\n'));
    }
  }

  function pairLeadDetails() {
    const root = document.querySelector('#edit-session');
    if (!root) return;

    const labelsCol = root.querySelector('.session-details');
    const valuesCol = root.querySelector('.session-details-values');
    if (!labelsCol || !valuesCol) return;

    const pairContainer = labelsCol.parentElement;
    if (!pairContainer) return;
    if (pairContainer.getAttribute(DETAILS_PAIRED_ATTR) === DETAILS_LAYOUT_VERSION) return;

    const labelRows = Array.from(labelsCol.querySelectorAll(':scope > div'));
    const valueRows = Array.from(valuesCol.querySelectorAll(':scope > div'));
    if (!labelRows.length || !valueRows.length) return;

    const rowsCount = Math.min(labelRows.length, valueRows.length);
    const newContainer = document.createElement('div');
    newContainer.className = `w-100 ${DETAILS_BOX_CLASS}`;

    for (let i = 0; i < rowsCount; i++) {
      const row = document.createElement('div');
      row.className = `${DETAIL_ROW_CLASS} mb-1`;

      const label = document.createElement('div');
      label.className = DETAIL_LABEL_CLASS;
      label.innerHTML = labelRows[i].innerHTML;

      const value = document.createElement('div');
      value.className = DETAIL_VALUE_CLASS;
      value.textContent = ws(valueRows[i].textContent);

      row.appendChild(label);
      row.appendChild(value);
      newContainer.appendChild(row);
    }

    pairContainer.replaceChildren(newContainer);
    pairContainer.setAttribute(DETAILS_PAIRED_ATTR, DETAILS_LAYOUT_VERSION);
  }

  function findPhoneTargets() {
    const root = document.querySelector('#edit-session');
    if (!root) return [];

    const targets = [];

    const pairedRows = Array.from(root.querySelectorAll(`.${DETAIL_ROW_CLASS}`));
    for (const row of pairedRows) {
      const label = row.querySelector(`.${DETAIL_LABEL_CLASS}`);
      const value = row.querySelector(`.${DETAIL_VALUE_CLASS}`);
      if (!label || !value) continue;
      if (ws(label.textContent).toLowerCase() === 'phone') {
        targets.push({ el: value, getValue: () => ws(value.textContent) });
      }
    }

    const labelsCol = root.querySelector('.session-details');
    const valuesCol = root.querySelector('.session-details-values');
    if (labelsCol && valuesCol) {
      const labelRows = Array.from(labelsCol.querySelectorAll(':scope > div'));
      const valueRows = Array.from(valuesCol.querySelectorAll(':scope > div'));
      const phoneIdx = labelRows.findIndex((d) => ws(d.textContent).toLowerCase() === 'phone');
      if (phoneIdx >= 0 && phoneIdx < valueRows.length) {
        const valueEl = valueRows[phoneIdx];
        targets.push({ el: valueEl, getValue: () => ws(valueEl.textContent) });
      }
    }

    const inputs = Array.from(root.querySelectorAll('input[type="tel"], input[name*="phone" i], input[id*="phone" i]'));
    for (const input of inputs) {
      targets.push({ el: input, getValue: () => input.value });
    }

    return Array.from(new Map(targets.map((t) => [t.el, t])).values());
  }

  function validatePhones() {
    const targets = findPhoneTargets();
    if (!targets.length) return;

    for (const { el, getValue } of targets) {
      const raw = getValue();
      const validation = validatePhone(raw);
      setPhoneDecoration(el, validation);
    }
  }

  function addCountryRow() {
    const country = detectCountry();
    if (!country) return;

    const typeSpan = Array.from(document.querySelectorAll('#edit-session span.session-status')).find((el) => {
      const t = ws(el.textContent).toLowerCase();
      return t.startsWith('type:') || t.includes('type:');
    });
    if (!typeSpan) return;

    const typeRow = typeSpan.closest('.d-flex') || typeSpan.parentElement;
    if (!typeRow || !typeRow.parentElement) return;

    const existing = typeRow.parentElement.querySelector(`.${COUNTRY_ROW_CLASS}`);
    if (existing) {
      const valueEl = existing.querySelector('[data-copilot-country-value]');
      if (valueEl) valueEl.textContent = country;
      return;
    }

    const rowDiv = document.createElement('div');
    rowDiv.className = 'd-flex';

    const span = document.createElement('span');
    span.className = `session-status ${COUNTRY_ROW_CLASS}`;

    const b = document.createElement('b');
    b.textContent = 'Country: ';

    const value = document.createElement('span');
    value.setAttribute('data-copilot-country-value', '1');
    value.textContent = ` ${country}`;

    span.appendChild(b);
    span.appendChild(value);
    rowDiv.appendChild(span);

    typeRow.insertAdjacentElement('afterend', rowDiv);
  }

  const TARGET_SORT_KEYS = new Set(['utm_source', 'last_step', 'step']);
  const TARGET_TITLES = new Set(['utm source', 'last step change', 'step']);

  function headerCellMatches(cell) {
    const dataSort = ws(cell.getAttribute('data-sort') || '').toLowerCase();
    const titleAttr = ws(cell.getAttribute('title') || '').toLowerCase();
    const text = ws(cell.textContent).toLowerCase();

    if (dataSort && TARGET_SORT_KEYS.has(dataSort)) return true;
    if (titleAttr && TARGET_TITLES.has(titleAttr)) return true;
    if (text && TARGET_TITLES.has(text)) return true;
    return false;
  }

  function getHeaderRow(table) {
    const headerRows = Array.from(table.querySelectorAll('thead tr'));
    for (const row of headerRows) {
      const cells = Array.from(row.querySelectorAll('th, td'));
      if (cells.length) return row;
    }
    return null;
  }

  function getIndicesToRemoveFromTable(table) {
    const headerRow = getHeaderRow(table);
    if (!headerRow) return [];

    const headerCells = Array.from(headerRow.querySelectorAll('th, td'));
    if (!headerCells.length) return [];

    const indices = [];
    for (let i = 0; i < headerCells.length; i++) {
      if (headerCellMatches(headerCells[i])) indices.push(i);
    }

    return indices.sort((a, b) => b - a);
  }

  function removeColumnsFromSingleTable(table, indicesToRemove) {
    if (!indicesToRemove.length) return;
    const headerRows = Array.from(table.querySelectorAll('thead tr'));
    for (const hr of headerRows) {
      const cells = Array.from(hr.querySelectorAll('th, td'));
      for (const idx of indicesToRemove) {
        if (idx >= 0 && idx < cells.length) cells[idx].classList.add(HIDDEN_COL_CLASS);
      }
    }

    const bodyRows = Array.from(table.querySelectorAll('tbody tr'));
    for (const row of bodyRows) {
      const cells = Array.from(row.querySelectorAll('td, th'));
      for (const idx of indicesToRemove) {
        if (idx >= 0 && idx < cells.length) cells[idx].classList.add(HIDDEN_COL_CLASS);
      }
    }
  }

  function findCandidateTables() {
    const leadsTable = document.querySelector('table#leads-table');
    if (leadsTable) return [leadsTable];

    const allTables = Array.from(document.querySelectorAll('table'));
    return allTables.filter((t) => {
      const headerRow = getHeaderRow(t);
      if (!headerRow) return false;
      const headerCells = Array.from(headerRow.querySelectorAll('th, td'));
      if (!headerCells.length) return false;
      return headerCells.some(headerCellMatches);
    });
  }

  function hideColumnsInDataTables(candidateTables) {
    const tables = candidateTables || findCandidateTables();
    if (!tables.length) return;

    for (const baseTable of tables) {
      const indicesToRemove = getIndicesToRemoveFromTable(baseTable);
      if (!indicesToRemove.length) continue;

      const wrapper = baseTable.closest('.dataTables_wrapper') || baseTable.parentElement;
      const relatedTables = new Set([baseTable]);
      if (wrapper) {
        for (const t of Array.from(wrapper.querySelectorAll('table'))) {
          relatedTables.add(t);
        }
      }

      for (const t of relatedTables) {
        removeColumnsFromSingleTable(t, indicesToRemove);
      }
    }
  }

  function looksLikeLeadDetailsHref(href) {
    if (!href) return false;
    return /\/leads\/[0-9]+/.test(href) || href.includes('/leads/');
  }

  function getVisibleHeaderCells(table) {
    const headerRow = getHeaderRow(table);
    if (!headerRow) return [];
    return Array.from(headerRow.querySelectorAll('th, td')).filter((c) => !c.classList.contains(HIDDEN_COL_CLASS));
  }

  function getVisibleRowCells(row) {
    return Array.from(row.querySelectorAll('td, th')).filter((c) => !c.classList.contains(HIDDEN_COL_CLASS));
  }

  function getStatusColumnIndexForTable(table) {
    if (!table) return -1;
    const cached = statusColumnIndexCache.get(table);
    if (typeof cached === 'number' && cached >= 0) return cached;

    const headerCells = getVisibleHeaderCells(table);
    if (!headerCells.length) return -1;

    const idx = headerCells.findIndex((c) => {
      const t = ws(c.textContent).toLowerCase();
      return t === 'status' || t.includes('status');
    });

    if (idx >= 0) statusColumnIndexCache.set(table, idx);
    return idx;
  }

  function applyStatusToCell(cell, status) {
    if (!cell) return;
    const st = ws(status);
    if (!st) return;

    const badge = cell.querySelector && cell.querySelector('.badge');
    if (badge) {
      badge.textContent = st;
      return;
    }

    cell.textContent = st;
  }

  function updateLeadRowStatusOnList(leadId, status) {
    const id = ws(leadId);
    const st = ws(status);
    if (!id || !st) return;

    const btn = document.querySelector(`button[${OPEN_BTN_ATTR}="1"][${OPEN_BTN_LEAD_ID_ATTR}="${CSS.escape(id)}"]`);
    let row = btn ? btn.closest('tr') : null;
    if (!row) {
      const link = document.querySelector(`a[href*="/leads/${CSS.escape(id)}"]`);
      row = link ? link.closest('tr') : null;
    }
    if (!row) return;

    const table = row.closest('table');
    const statusIdx = getStatusColumnIndexForTable(table);
    if (statusIdx < 0) return;

    const cells = getVisibleRowCells(row);
    if (statusIdx >= cells.length) return;
    applyStatusToCell(cells[statusIdx], st);
  }

  function applyKnownStatusesToVisibleRows(candidateTables) {
    const tables = candidateTables || findCandidateTables();
    if (!tables.length) return;

    for (const table of tables) {
      const statusIdx = getStatusColumnIndexForTable(table);
      if (statusIdx < 0) continue;

      const rows = Array.from(table.querySelectorAll('tbody tr'));
      for (const row of rows) {
        const leadBtn = row.querySelector(`button[${OPEN_BTN_ATTR}="1"][${OPEN_BTN_LEAD_ID_ATTR}]`);
        const leadId = leadBtn ? leadBtn.getAttribute(OPEN_BTN_LEAD_ID_ATTR) : null;
        if (!leadId) continue;
        const entry = leadStatusMap && typeof leadStatusMap === 'object' ? leadStatusMap[String(leadId)] : null;
        const status = entry && typeof entry === 'object' ? entry.status : null;
        if (!status) continue;

        const cells = getVisibleRowCells(row);
        if (statusIdx >= cells.length) continue;
        applyStatusToCell(cells[statusIdx], status);
      }
    }
  }

  function setupLeadsListLiveStatusUpdates(candidateTables) {
    if (document.documentElement.getAttribute(LIVE_STATUS_LIST_ATTR) === '1') return;
    document.documentElement.setAttribute(LIVE_STATUS_LIST_ATTR, '1');

    loadLeadStatusMapOnce().then(() => applyKnownStatusesToVisibleRows(candidateTables));

    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
        chrome.storage.onChanged.addListener((changes, areaName) => {
          if (areaName !== 'local') return;

          if (changes && changes[LEAD_STATUS_STORAGE_KEY]) {
            const next = changes[LEAD_STATUS_STORAGE_KEY].newValue;
            leadStatusMap = next && typeof next === 'object' ? next : {};
          }

          if (changes && changes[LEAD_STATUS_LAST_EVENT_KEY]) {
            const ev = changes[LEAD_STATUS_LAST_EVENT_KEY].newValue;
            if (ev && ev.leadId && ev.status) {
              updateLeadRowStatusOnList(ev.leadId, ev.status);
              return;
            }
          }

          // Fallback: if we can't identify the changed lead, re-apply to visible rows.
          applyKnownStatusesToVisibleRows();
        });
      }
    } catch {
    }
  }

  function replaceEyeWithOpenButton(candidateTables) {
    loadOpenedLeadIdsOnce();

    const tables = candidateTables || findCandidateTables();
    if (!tables.length) return;

    for (const table of tables) {
      const tds = table.querySelectorAll(`tbody td.text-center:not([${OPEN_BUTTON_REPLACED_ATTR}="1"])`);
      for (const td of tds) {
        const link = td.querySelector('a[href]');
        if (!link) continue;

        const href = link.getAttribute('href');
        if (!looksLikeLeadDetailsHref(href)) continue;

        const leadId = extractLeadIdFromHref(href);

        const hasEyeIcon =
          !!td.querySelector('i.fa-eye, i.fas.fa-eye, i.fa.fa-eye, i[class*="fa-eye"], svg[data-icon="eye"]');
        if (!hasEyeIcon) continue;

        const btn = document.createElement('button');
        btn.className = 'btn btn-primary btn-sm';
        btn.type = 'button';
        btn.textContent = 'Open';
        btn.setAttribute(OPEN_BTN_ATTR, '1');
        if (leadId) btn.setAttribute(OPEN_BTN_LEAD_ID_ATTR, leadId);
        if (leadId && openedLeadIds.has(String(leadId))) {
          setOpenedButtonUI(btn);
        }
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();

          if (leadId) markLeadAsOpened(leadId, btn);
          window.open(href, '_blank');
        });

        link.style.display = 'none';
        td.appendChild(btn);
        td.setAttribute(OPEN_BUTTON_REPLACED_ATTR, '1');
      }
    }
  }

  function applyAll() {
    if (!ALLOWED_HOSTS.has(window.location.hostname)) return;
    loadStoredThemeOnce().then((v) => {
      if (v === 'dark' || v === 'light') applyTheme(v);
    });
    ensureStyles();
      ensureLegacyPurpleReplacements();
    applyTheme(getStoredTheme());
    ensureThemeToggle();
    ensureWhiteBrandLogo();
    ensureNavbarUserIcon();
    ensureSidenavToggleFallback();

    if (isPrecalcsListPage()) {
      applyPrecalcsEnhancements();
    }

    // Everything below is leads-only behavior.
    if (!isLeadsArea()) return;

    if (isLeadsListPage()) {
      const candidateTables = findCandidateTables();
      hideColumnsInDataTables(candidateTables);
      replaceEyeWithOpenButton(candidateTables);
      replaceLeadIdCountryEmojiWithFlags(candidateTables);
      removeLeadIdYearsHoverAndBeautify(candidateTables);
      setupLeadsListLiveStatusUpdates(candidateTables);
      adjustDataTablesSizing();
    }

    if (isLeadDetailsPage()) {
      // Visiting the details page counts as "opened".
      loadOpenedLeadIdsOnce();
      const leadId = extractLeadIdFromPathname();
      if (leadId) markLeadAsOpened(leadId);

      setupLeadStatusCounting();

      inlineCards();
      pairLeadDetails();
      addCreatedDateToLeadTitleLine();
      ensureStatusLabel();
      addCountryRow();
      validatePhones();
      setupTimelineToggle();
    }
  }

  applyAll();

  let scheduled = false;
  const observer = new MutationObserver(() => {
    if (!ALLOWED_HOSTS.has(window.location.hostname)) return;
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      applyAll();
    });
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });
})();

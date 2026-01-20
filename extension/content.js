import { parsePhoneNumberFromString } from 'libphonenumber-js';

(() => {
  const TARGET_TITLE = 'Taxe Dashboard | Leads';
  const ALLOWED_HOSTS = new Set(['dashboard.taxe.ro', 'taxe.amdav.ro']);

  const HIDDEN_COL_CLASS = 'txe-hidden-dt-col';
  const SHOULD_HIDE_COL_ATTR = 'data-txe-should-hide';
  const COLUMNS_HIDDEN_ATTR = 'data-txe-cols-hidden';
  const OPEN_BUTTON_REPLACED_ATTR = 'data-txe-open-replaced';
  const DETAILS_PAIRED_ATTR = 'data-txe-details-paired';
  const DETAIL_ROW_CLASS = 'txe-detail-row';
  const DETAIL_LABEL_CLASS = 'txe-detail-label';
  const DETAIL_VALUE_CLASS = 'txe-detail-value';
  const DETAILS_BOX_CLASS = 'txe-details-box';
  const DETAILS_LAYOUT_VERSION = '2';
  const INLINE_CARDS_LAYOUT_ATTR = 'data-txe-inline-cards-layout';
  const INLINE_CARDS_LAYOUT_VERSION = '1';
  const TIMELINE_TOGGLE_ATTR = 'data-txe-timeline-toggle';
  const TIMELINE_STATE_ATTR = 'data-txe-timeline-state';

  const OPENED_LEADS_STORAGE_KEY = 'txe_opened_leads_v1';
  const OPENED_BTN_CLASS = 'txe-opened-open-btn';
  const OPENED_ROW_CLASS = 'txe-opened-lead-row';
  const OPEN_BTN_ATTR = 'data-txe-open-btn';
  const OPEN_BTN_LEAD_ID_ATTR = 'data-txe-open-btn-lead-id';
  const MAX_OPENED_LEADS = 5000;

  const LEAD_FLAG_REPLACED_ATTR = 'data-txe-lead-flag-replaced';
  const LEAD_FLAG_CLASS = 'txe-lead-flag';
  const LEAD_YEARS_FORMATTED_ATTR = 'data-txe-years-formatted';
  const ACTION_COLUMN_MOVED_ATTR = 'data-txe-action-moved';
  const ACTION_COLUMN_MOVED_VERSION = '1';
  const LEAD_FLAGS_INITIALIZED_ATTR = 'data-txe-lead-flags-initialized';
  const INLINE_FLAG_STYLED_ATTR = 'data-txe-inline-flag-styled';

  const LEAD_FLAGS_OBSERVER_ATTR = 'data-txe-lead-flags-observer';
  const leadFlagsObserverByTable = new WeakMap();
  let leadFlagsObserverSuppression = 0;

  const STATUS_TRACKING_ATTR = 'data-txe-status-tracking';
  const STATUS_DEBOUNCE_MS = 350;

  const LEAD_STATUS_STORAGE_KEY = 'txe_lead_status_map_v1';
  const LEAD_STATUS_LAST_EVENT_KEY = 'txe_lead_status_last_v1';
  const LIVE_STATUS_LIST_ATTR = 'data-txe-live-status-list';

  const CREATED_DATE_RENDERED_ATTR = 'data-txe-created-date-rendered';
  const CREATED_DATE_CLASS = 'txe-created-date';
  const LEAD_HEADER_TITLE_CLASS = 'txe-lead-header-title';

  let openedLeadIds = new Set();
  let openedLeadIdsLoadPromise = null;

  let leadStatusMap = {};
  let leadStatusMapLoadPromise = null;
  const statusColumnIndexCache = new WeakMap();
  let stylesAndThemeApplied = false;
  let hostWhitelisted = ALLOWED_HOSTS.has(window.location.hostname);
  let domReady = document.readyState !== 'loading';
  let domReadyListenerAttached = false;
  let earlyThemeApplied = false;



  function ws(s) {
    return String(s || '').replace(/\s+/g, ' ').trim();
  }

  const deferNonCritical = (() => {
    const idle = typeof requestIdleCallback === 'function' ? requestIdleCallback : null;
    return (fn) => {
      if (typeof fn !== 'function') return;
      if (idle) {
        idle(
          () => {
            try {
              fn();
            } catch {
            }
          },
          { timeout: 1500 }
        );
        return;
      }
      setTimeout(() => {
        try {
          fn();
        } catch {
        }
      }, 200);
    };
  })();

  const txe_TOOLTIP_ID = 'txe-tooltip-bubble';
  const txe_TOOLTIP_TEXT_ATTR = 'data-txe-tooltip';
  const txe_TOOLTIP_BOUND_ATTR = 'data-txe-tooltip-bound';
  let txeTooltipListenersInstalled = false;

  const txe_BAD_PHONE_TOOLTIP_ID = 'txe-bad-phone-tooltip-bubble';
  const txe_BAD_PHONE_TOOLTIP_TEXT_ATTR = 'data-txe-bad-phone-tooltip';
  let badPhoneTooltipListenersInstalled = false;
  let activeBadPhoneEl = null;
  let badPhoneEls = new Set();

  const txe_THEME_ATTR = 'data-txe-theme';
  const txe_THEME_STORAGE_KEY = 'txe_dashboard_theme_v1';
  const txe_THEME_TOGGLE_ID = 'txe-theme-toggle';
  const txe_THEME_TOGGLE_BTN_ID = 'txe-theme-toggle-btn';
  const txe_EARLY_THEME_STYLE_ID = 'txe-early-theme-style';

  const txe_USER_ICONIZED_ATTR = 'data-txe-user-iconized';

  let storedThemeCache = null;
  let storedThemeLoadPromise = null;

  function applyThemeEarly() {
    if (earlyThemeApplied) return;
    earlyThemeApplied = true;
    try {
      const v = String(localStorage.getItem(txe_THEME_STORAGE_KEY) || '').toLowerCase();
      if (v === 'dark' || v === 'light') {
        document.documentElement.setAttribute(txe_THEME_ATTR, v);

        if (!document.getElementById(txe_EARLY_THEME_STYLE_ID)) {
          const style = document.createElement('style');
          style.id = txe_EARLY_THEME_STYLE_ID;
          style.textContent = `
            html[${txe_THEME_ATTR}='dark'],
            html[${txe_THEME_ATTR}='dark'] body {
              background-color: #1b2432 !important;
              color: #dbe4f3 !important;
            }
            html[${txe_THEME_ATTR}='light'],
            html[${txe_THEME_ATTR}='light'] body {
              background-color: #ffffff !important;
              color: #212529 !important;
            }
          `;
          const target = document.head || document.documentElement;
          if (target) target.appendChild(style);
        }
      }
    } catch {
    }
  }

  applyThemeEarly();

  function loadStoredThemeOnce() {
    if (storedThemeLoadPromise) return storedThemeLoadPromise;

    storedThemeLoadPromise = new Promise((resolve) => {
      try {
        if (!chrome || !chrome.storage || !chrome.storage.local || !chrome.storage.local.get) {
          resolve(null);
          return;
        }

        chrome.storage.local.get([txe_THEME_STORAGE_KEY], (res) => {
          const v = res ? String(res[txe_THEME_STORAGE_KEY] || '').toLowerCase() : '';
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
          localStorage.setItem(txe_THEME_STORAGE_KEY, v);
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
      const v = String(localStorage.getItem(txe_THEME_STORAGE_KEY) || '').toLowerCase();
      if (v === 'dark' || v === 'light') return v;
    } catch {
    }
    return 'light';
  }

  function storeTheme(theme) {
    try {
      storedThemeCache = theme;
      localStorage.setItem(txe_THEME_STORAGE_KEY, theme);
    } catch {
    }

    
    
    storedThemeLoadPromise = Promise.resolve(theme);

    try {
      if (chrome && chrome.storage && chrome.storage.local && chrome.storage.local.set) {
        chrome.storage.local.set({ [txe_THEME_STORAGE_KEY]: theme });
      }
    } catch {
    }
  }

  function applyTheme(theme) {
    const t = theme === 'dark' ? 'dark' : 'light';
    document.documentElement.setAttribute(txe_THEME_ATTR, t);
    const btn = document.getElementById(txe_THEME_TOGGLE_BTN_ID);
    if (btn) btn.textContent = t === 'dark' ? 'Dark: On' : 'Dark: Off';
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute(txe_THEME_ATTR) || getStoredTheme();
    const next = String(current).toLowerCase() === 'dark' ? 'light' : 'dark';
    storeTheme(next);
    applyTheme(next);
  }

  function ensureThemeToggle() {
    if (document.getElementById(txe_THEME_TOGGLE_ID)) return;

    const wrap = document.createElement('div');
    wrap.id = txe_THEME_TOGGLE_ID;

    const btn = document.createElement('button');
    btn.id = txe_THEME_TOGGLE_BTN_ID;
    btn.type = 'button';
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleTheme();
    });

    wrap.appendChild(btn);
    (document.body || document.documentElement).appendChild(wrap);

    
    applyTheme(getStoredTheme());

    
    loadStoredThemeOnce().then((v) => {
      if (v === 'dark' || v === 'light') applyTheme(v);
    });
  }

  function ensuretxeTooltipBubble() {
    let bubble = document.getElementById(txe_TOOLTIP_ID);
    if (bubble) return bubble;

    bubble = document.createElement('div');
    bubble.id = txe_TOOLTIP_ID;
    bubble.style.display = 'none';
    (document.body || document.documentElement).appendChild(bubble);
    return bubble;
  }

  function hidetxeTooltip() {
    const bubble = document.getElementById(txe_TOOLTIP_ID);
    if (!bubble) return;
    bubble.style.display = 'none';
    bubble.textContent = '';
  }

  function showtxeTooltipFor(el) {
    if (!el) return;
    const text = String(el.getAttribute(txe_TOOLTIP_TEXT_ATTR) || '');
    if (!text.trim()) return;

    const bubble = ensuretxeTooltipBubble();
    
    try {
      const host = document.body || document.documentElement;
      if (host && bubble.parentElement === host) host.appendChild(bubble);
    } catch {
    }
    bubble.textContent = text;
    bubble.style.display = 'block';

    
    const rect = el.getBoundingClientRect();

    
    bubble.style.left = '-9999px';
    bubble.style.top = '-9999px';
    const bw = bubble.offsetWidth || 0;
    const bh = bubble.offsetHeight || 0;

    const margin = 8;
    const centerX = rect.left + rect.width / 2;
    let left = Math.round(centerX - bw / 2);
    left = Math.max(margin, Math.min(left, window.innerWidth - bw - margin));

    
    let top = Math.round(rect.top - bh - margin);
    if (top < margin) top = Math.round(rect.bottom + margin);
    top = Math.max(margin, Math.min(top, window.innerHeight - bh - margin));

    bubble.style.left = `${left}px`;
    bubble.style.top = `${top}px`;
  }

  function ensuretxeTooltipListeners() {
    if (txeTooltipListenersInstalled) return;
    txeTooltipListenersInstalled = true;

    let activeTooltipTarget = null;
    let tooltipUpdateScheduled = false;

    const scheduleTooltipUpdate = () => {
      if (!activeTooltipTarget) return;
      if (tooltipUpdateScheduled) return;
      tooltipUpdateScheduled = true;
      requestAnimationFrame(() => {
        tooltipUpdateScheduled = false;
        if (activeTooltipTarget) showtxeTooltipFor(activeTooltipTarget);
      });
    };

    const findTooltipTarget = (node, evt) => {
      try {
        if (node && node.closest) {
          const closest = node.closest(`[${txe_TOOLTIP_TEXT_ATTR}]`);
          if (closest) {
            const v = closest.getAttribute(txe_TOOLTIP_TEXT_ATTR);
            if (v && String(v).trim()) return closest;
          }
        }
      } catch {
      }

      try {
        const path = evt && typeof evt.composedPath === 'function' ? evt.composedPath() : null;
        if (Array.isArray(path)) {
          for (const p of path) {
            if (!p || !p.getAttribute) continue;
            const v = p.getAttribute(txe_TOOLTIP_TEXT_ATTR);
            if (v && String(v).trim()) return p;
          }
        }
      } catch {
      }

      return null;
    };

    
    
    document.addEventListener(
      'mouseover',
      (e) => {
        const target = findTooltipTarget(e.target, e);
        if (!target) return;
        if (target === activeTooltipTarget) return;
        activeTooltipTarget = target;
        showtxeTooltipFor(activeTooltipTarget);
      },
      { capture: true, passive: true }
    );

    document.addEventListener(
      'mouseout',
      (e) => {
        if (!activeTooltipTarget) return;
        const rt = e && e.relatedTarget && e.relatedTarget.closest ? e.relatedTarget : null;
        if (rt && activeTooltipTarget.contains(rt)) return;

        const next = findTooltipTarget(rt, e);
        if (next) {
          activeTooltipTarget = next;
          showtxeTooltipFor(activeTooltipTarget);
          return;
        }

        activeTooltipTarget = null;
        hidetxeTooltip();
      },
      { capture: true, passive: true }
    );

    window.addEventListener(
      'scroll',
      scheduleTooltipUpdate,
      { capture: true, passive: true }
    );

    window.addEventListener('resize', scheduleTooltipUpdate, { passive: true });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        activeTooltipTarget = null;
        hidetxeTooltip();
      }
    });
  }

  function settxeTooltip(el, text) {
    if (!el || !el.setAttribute) return;
    const t = String(text || '').trim();
    if (!t) {
      try {
        el.removeAttribute(txe_TOOLTIP_TEXT_ATTR);
      } catch {
      }
      return;
    }

    el.setAttribute(txe_TOOLTIP_TEXT_ATTR, t);
    try {
      el.setAttribute(txe_TOOLTIP_BOUND_ATTR, '1');
    } catch {
    }
    ensuretxeTooltipListeners();
  }

  function ensureBadPhoneTooltipBubble() {
    let bubble = document.getElementById(txe_BAD_PHONE_TOOLTIP_ID);
    if (bubble) return bubble;

    bubble = document.createElement('div');
    bubble.id = txe_BAD_PHONE_TOOLTIP_ID;
    bubble.style.display = 'none';
    (document.body || document.documentElement).appendChild(bubble);
    return bubble;
  }

  function hideBadPhoneTooltip() {
    const bubble = document.getElementById(txe_BAD_PHONE_TOOLTIP_ID);
    if (!bubble) return;
    bubble.style.display = 'none';
    bubble.textContent = '';
  }

  function positionBadPhoneTooltipFor(el) {
    const bubble = document.getElementById(txe_BAD_PHONE_TOOLTIP_ID);
    if (!bubble || !el) return;

    const rect = el.getBoundingClientRect();
    const bw = bubble.offsetWidth || 0;
    const bh = bubble.offsetHeight || 0;
    const margin = 8;

    const centerX = rect.left + rect.width / 2;
    let left = Math.round(centerX - bw / 2);
    left = Math.max(margin, Math.min(left, window.innerWidth - bw - margin));

    let top = Math.round(rect.top - bh - margin);
    if (top < margin) top = Math.round(rect.bottom + margin);
    top = Math.max(margin, Math.min(top, window.innerHeight - bh - margin));

    bubble.style.left = `${left}px`;
    bubble.style.top = `${top}px`;
  }

  function showBadPhoneTooltipFor(el) {
    if (!el) return;
    const text = String(el.getAttribute(txe_BAD_PHONE_TOOLTIP_TEXT_ATTR) || '');
    if (!text.trim()) return;

    const bubble = ensureBadPhoneTooltipBubble();
    if (bubble.textContent !== text) bubble.textContent = text;
    bubble.style.display = 'block';

    
    bubble.style.left = '-9999px';
    bubble.style.top = '-9999px';
    positionBadPhoneTooltipFor(el);
  }

  function ensureBadPhoneTooltipListeners() {
    if (badPhoneTooltipListenersInstalled) return;
    badPhoneTooltipListenersInstalled = true;

    let mouseMoveScheduled = false;
    let lastMouseEvent = null;

    const handleMouseMove = (e) => {
      lastMouseEvent = e;
      if (mouseMoveScheduled) return;
      mouseMoveScheduled = true;
      requestAnimationFrame(() => {
        mouseMoveScheduled = false;

        const evt = lastMouseEvent;
        if (!evt) return;

        let under = null;
        try {
          under = document.elementFromPoint(evt.clientX, evt.clientY);
        } catch {
        }

        const hovered =
          under && under.closest ? under.closest(`.txe-bad-phone[${txe_BAD_PHONE_TOOLTIP_TEXT_ATTR}]`) : null;
        if (hovered === activeBadPhoneEl) return;

        activeBadPhoneEl = hovered;
        if (!activeBadPhoneEl) {
          hideBadPhoneTooltip();
        } else {
          showBadPhoneTooltipFor(activeBadPhoneEl);
        }
      });
    };

    document.addEventListener(
      'mousemove',
      handleMouseMove,
      { capture: true, passive: true }
    );

    let tooltipUpdateScheduled = false;
    const scheduleTooltipUpdate = () => {
      if (!activeBadPhoneEl) return;
      if (tooltipUpdateScheduled) return;
      tooltipUpdateScheduled = true;
      requestAnimationFrame(() => {
        tooltipUpdateScheduled = false;
        if (activeBadPhoneEl) positionBadPhoneTooltipFor(activeBadPhoneEl);
      });
    };

    window.addEventListener(
      'scroll',
      scheduleTooltipUpdate,
      { capture: true, passive: true }
    );

    window.addEventListener('resize', scheduleTooltipUpdate, { passive: true });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        activeBadPhoneEl = null;
        hideBadPhoneTooltip();
      }
    });
  }

  const txe_STYLE_ID = 'txe-injected-styles';

  function ensureStyles() {
    let style = document.getElementById(txe_STYLE_ID);
    if (style) return;

    style = document.createElement('style');
    style.id = txe_STYLE_ID;
    style.textContent = `

      /* Leads list: hide columns we mark via JS (utm_source, last_step). */
      .${HIDDEN_COL_CLASS} {
        display: none !important;
      }

      /* DataTables processing overlay should appear above table */
      .dataTables_wrapper .dataTables_processing {
        position: fixed !important;
        z-index: 9999 !important;
      }

      /* Hide feedback widget */
      #atlwdg-trigger,
      .atlwdg-trigger {
        display: none !important;
      }

      /* Argon sometimes forces legacy purple/dark-blue headings; normalize to theme text in dark mode. */
      html[${txe_THEME_ATTR}='dark'] .list-group-item h5,
      html[${txe_THEME_ATTR}='dark'] .list-group-item h5.mb-1 {
        color: var(--txe-text) !important;
      }

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

      #precalcs-table thead th.txe-motiv-col,
      #precalcs-table tbody td.txe-motiv-col {
        width: 140px;
        max-width: 140px;
      }

      #precalcs-table tbody td.txe-motiv-col {
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
        color: var(--txe-text) !important;
      }

      #precalc_element a {
        color: var(--txe-primary) !important;
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

      svg.txe-inline-flag {
        width: 18px !important;
        height: 12px !important;
        display: inline-block;
        vertical-align: middle;
        margin-right: 0;
        border-radius: 3px;
        overflow: hidden;
      }

      .txe-inline-flag-wrap {
        display: inline-flex;
        align-items: center;
        gap: 6px;
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

      #${txe_TOOLTIP_ID} {
        position: fixed;
        z-index: 2147483647;
        max-width: 420px;
        padding: 6px 8px;
        border-radius: 6px;
        background: rgba(33, 37, 41, 0.92);
        color: #fff;
        font-size: 12px;
        line-height: 1.35;
        white-space: pre-line;
        pointer-events: none;
      }

      html[${txe_THEME_ATTR}='dark'] #${txe_TOOLTIP_ID} {
        background: var(--txe-surface-2);
        color: var(--txe-text);
        border: 1px solid var(--txe-border);
        box-shadow: 0 14px 28px rgba(0, 0, 0, 0.45);
      }

      #${txe_BAD_PHONE_TOOLTIP_ID} {
        position: fixed;
        z-index: 2147483647;
        max-width: 520px;
        padding: 8px 10px;
        border-radius: 8px;
        background: rgba(33, 37, 41, 0.92);
        color: #fff;
        font-size: 12px;
        line-height: 1.35;
        white-space: pre-line;
        pointer-events: none;
      }

      html[${txe_THEME_ATTR}='dark'] #${txe_BAD_PHONE_TOOLTIP_ID} {
        background: var(--txe-surface-2);
        color: var(--txe-text);
        border: 1px solid var(--txe-border);
        box-shadow: 0 14px 28px rgba(0, 0, 0, 0.45);
      }

      #${txe_THEME_TOGGLE_ID} {
        position: fixed;
        left: 16px;
        bottom: 16px;
        z-index: 2147483646;
        user-select: none;
      }

      #${txe_THEME_TOGGLE_BTN_ID} {
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

      #${txe_THEME_TOGGLE_BTN_ID}:hover {
        background: rgba(108, 117, 125, 0.5);
      }

      /* Dark mode overrides (scoped to an attribute so it is easy to disable). */
      html[${txe_THEME_ATTR}='dark'] {
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

        /* Back-compat: keep existing '--txe-*' rules working. */
        --txe-bg: var(--new-bg);
        --txe-surface: var(--new-surface);
        --txe-surface-2: var(--new-surface-2);
        --txe-border: var(--new-border);
        --txe-text: var(--new-text);
        --txe-muted: var(--new-muted);
        --txe-primary: var(--new-primary);
        --txe-primary-2: var(--new-primary-2);
        --txe-purple: var(--new-purple);
        --txe-green: var(--new-green);
        --txe-green-2: var(--new-green-2);
        --txe-red: var(--new-red);
        --txe-red-2: var(--new-red-2);
        --txe-sidebar: var(--new-sidebar);
        --txe-nav-hover: var(--new-nav-hover);
        --txe-nav-active: var(--new-nav-active);
        --txe-radius: var(--new-radius);
      }

      html[${txe_THEME_ATTR}='dark'],
      html[${txe_THEME_ATTR}='dark'] body {
        background-color: var(--txe-bg) !important;
        color: var(--txe-text) !important;
        /* Prevent the page from horizontally overflowing a few px. */
        overflow-x: hidden !important;
      }

      html[${txe_THEME_ATTR}='dark'] #panel,
      html[${txe_THEME_ATTR}='dark'] .main-content {
        overflow-x: hidden !important;
      }

      html[${txe_THEME_ATTR}='dark'] .bg-white,
      html[${txe_THEME_ATTR}='dark'] .bg-secondary,
      html[${txe_THEME_ATTR}='dark'] .navbar,
      html[${txe_THEME_ATTR}='dark'] .navbar-top,
      html[${txe_THEME_ATTR}='dark'] .navbar-top.bg-secondary,
      html[${txe_THEME_ATTR}='dark'] .navbar-light.bg-white,
      html[${txe_THEME_ATTR}='dark'] .card,
      html[${txe_THEME_ATTR}='dark'] .card-header,
      html[${txe_THEME_ATTR}='dark'] .card-footer,
      html[${txe_THEME_ATTR}='dark'] .modal-content,
      html[${txe_THEME_ATTR}='dark'] .dropdown-menu,
      html[${txe_THEME_ATTR}='dark'] .header,
      html[${txe_THEME_ATTR}='dark'] .footer,
      html[${txe_THEME_ATTR}='dark'] footer.footer {
        background-color: var(--txe-surface) !important;
        color: var(--txe-text) !important;
      }

      /* Tailwind-ish submit buttons (e.g. "Save") should match green submit styling. */
      html[${txe_THEME_ATTR}='dark'] button[type='submit'].bg-gray-800,
      html[${txe_THEME_ATTR}='dark'] button[type='submit'].bg-gray-700,
      html[${txe_THEME_ATTR}='dark'] button[type='submit'].bg-white {
        background-color: var(--txe-green) !important;
        border-color: transparent !important;
        color: #fff !important;
      }

      html[${txe_THEME_ATTR}='dark'] button[type='submit'].bg-gray-800:hover,
      html[${txe_THEME_ATTR}='dark'] button[type='submit'].bg-gray-700:hover,
      html[${txe_THEME_ATTR}='dark'] button[type='submit'].bg-white:hover {
        background-color: var(--txe-green-2) !important;
      }

      html[${txe_THEME_ATTR}='dark'] button[type='submit'].bg-gray-800:active,
      html[${txe_THEME_ATTR}='dark'] button[type='submit'].bg-gray-700:active,
      html[${txe_THEME_ATTR}='dark'] button[type='submit'].bg-white:active {
        filter: brightness(0.95);
      }

      /* The header strip (above Lead Details) should blend with the page background. */
      html[${txe_THEME_ATTR}='dark'] .header {
        background-color: var(--txe-bg) !important;
        background-image: none !important;
      }

      html[${txe_THEME_ATTR}='dark'] .footer,
      html[${txe_THEME_ATTR}='dark'] footer.footer {
        background-color: var(--txe-bg) !important;
      }

      html[${txe_THEME_ATTR}='dark'] .main-content,
      html[${txe_THEME_ATTR}='dark'] #sidenav-main {
        background-color: var(--txe-bg) !important;
      }

      html[${txe_THEME_ATTR}='dark'] .person-info-rightSidebar {
        background-color: var(--txe-bg) !important;
      }

      html[${txe_THEME_ATTR}='dark'] .text-dark,
      html[${txe_THEME_ATTR}='dark'] .text-default,
      html[${txe_THEME_ATTR}='dark'] .navbar-light .navbar-nav .nav-link,
      html[${txe_THEME_ATTR}='dark'] .nav-link-text,
      html[${txe_THEME_ATTR}='dark'] .dropdown-item,
      html[${txe_THEME_ATTR}='dark'] h1,
      html[${txe_THEME_ATTR}='dark'] h2,
      html[${txe_THEME_ATTR}='dark'] h3,
      html[${txe_THEME_ATTR}='dark'] h4,
      html[${txe_THEME_ATTR}='dark'] .h5,
      html[${txe_THEME_ATTR}='dark'] h6 {
        color: var(--txe-text) !important;
      }

      /* Argon also uses utility heading classes (.h1-.h6) that can stay #32325d. */
      html[${txe_THEME_ATTR}='dark'] .card .h1,
      html[${txe_THEME_ATTR}='dark'] .card .h2,
      html[${txe_THEME_ATTR}='dark'] .card .h3,
      html[${txe_THEME_ATTR}='dark'] .card .h4,
      html[${txe_THEME_ATTR}='dark'] .card .h5,
      html[${txe_THEME_ATTR}='dark'] .card .h6 {
        color: var(--txe-text) !important;
      }

      html[${txe_THEME_ATTR}='dark'] .text-muted,
      html[${txe_THEME_ATTR}='dark'] small.text-muted,
      html[${txe_THEME_ATTR}='dark'] .copyright,
      html[${txe_THEME_ATTR}='dark'] .footer .text-muted {
        color: var(--txe-muted) !important;
      }

      html[${txe_THEME_ATTR}='dark'] .dropdown-item:hover,
      html[${txe_THEME_ATTR}='dark'] .dropdown-item:focus {
        background-color: var(--txe-nav-hover) !important;
      }

      html[${txe_THEME_ATTR}='dark'] .border,
      html[${txe_THEME_ATTR}='dark'] .card,
      html[${txe_THEME_ATTR}='dark'] .dropdown-divider,
      html[${txe_THEME_ATTR}='dark'] .table th,
      html[${txe_THEME_ATTR}='dark'] .table td,
      html[${txe_THEME_ATTR}='dark'] .table-custom th,
      html[${txe_THEME_ATTR}='dark'] .table-custom td {
        border-color: var(--txe-border) !important;
      }

      /* Phone validation: keep the red border visible even though we override '.border' above. */
      html[${txe_THEME_ATTR}='dark'] .txe-bad-phone,
      html[${txe_THEME_ATTR}='dark'] .txe-bad-phone.border {
        border-color: var(--txe-red-2) !important;
        display: inline-block;
        cursor: help;
      }

      /* Remove the bright "card borders" look. Keep table cell separators subtle via --txe-border above. */
      html[${txe_THEME_ATTR}='dark'] .card,
      html[${txe_THEME_ATTR}='dark'] .modal-content,
      html[${txe_THEME_ATTR}='dark'] .dropdown-menu,
      html[${txe_THEME_ATTR}='dark'] .applicants-filters {
        border-color: transparent !important;
      }

      html[${txe_THEME_ATTR}='dark'] .card,
      html[${txe_THEME_ATTR}='dark'] .modal-content {
        background-color: var(--txe-surface-2) !important;
      }

      html[${txe_THEME_ATTR}='dark'] .shadow,
      html[${txe_THEME_ATTR}='dark'] .shadow-sm,
      html[${txe_THEME_ATTR}='dark'] .shadow-lg {
        box-shadow: 0 0.35rem 0.85rem rgba(0, 0, 0, 0.45) !important;
      }

      html[${txe_THEME_ATTR}='dark'] .card,
      html[${txe_THEME_ATTR}='dark'] .dropdown-menu,
      html[${txe_THEME_ATTR}='dark'] .modal-content,
      html[${txe_THEME_ATTR}='dark'] .header,
      html[${txe_THEME_ATTR}='dark'] .footer {
        /* Argon uses colored shadows (e.g. rgba(136,152,170,.15)) that look like a white glow on dark bg. */
        box-shadow: none !important;
        filter: none !important;
      }

      /* Keep the navbar distinguishable: subtle border + dark shadow (not white glow). */
      html[${txe_THEME_ATTR}='dark'] .navbar,
      html[${txe_THEME_ATTR}='dark'] .navbar-top {
        border-bottom: none !important;
        box-shadow: 0 10px 24px rgba(0, 0, 0, 0.35) !important;
      }

      html[${txe_THEME_ATTR}='dark'] #sidenav-main {
        border-right: none !important;
      }

      /* Make the burger lines a touch lighter. */
      html[${txe_THEME_ATTR}='dark'] .sidenav-toggler-line {
        background-color: rgba(255, 255, 255, 0.70) !important;
      }

      /* Sidebar + nav (DashStack-like hover/active). */
      html[${txe_THEME_ATTR}='dark'] #sidenav-main,
      html[${txe_THEME_ATTR}='dark'] #sidenav-main.bg-white,
      html[${txe_THEME_ATTR}='dark'] #sidenav-main.navbar-light.bg-white {
        background-color: var(--txe-sidebar) !important;
      }

      html[${txe_THEME_ATTR}='dark'] #sidenav-main .navbar-nav .nav-link {
        color: rgba(231, 231, 235, 0.78) !important;
        border-radius: calc(var(--txe-radius) - 2px) !important;
        transition: background-color 120ms ease, color 120ms ease;
      }

      html[${txe_THEME_ATTR}='dark'] #sidenav-main .navbar-nav .nav-link:hover {
        background-color: var(--txe-nav-hover) !important;
        color: var(--txe-text) !important;
      }

      /* Match Argon sizing: active highlight should be inset (not full sidenav width). */
      html[${txe_THEME_ATTR}='dark'] #sidenav-main.navbar-vertical.navbar-expand-xs .navbar-nav > .nav-item > .nav-link.active,
      html[${txe_THEME_ATTR}='dark'] #sidenav-main.navbar-vertical.navbar-expand-xs .navbar-nav .nav .nav-link.active {
        margin-right: .5rem !important;
        margin-left: .5rem !important;
        padding-right: 1rem !important;
        padding-left: 1rem !important;
        border-radius: .375rem !important;
        background-color: var(--txe-nav-active) !important;
        color: var(--txe-text) !important;
        box-shadow: inset 3px 0 0 0 var(--txe-primary) !important;
      }

      html[${txe_THEME_ATTR}='dark'] #sidenav-main .navbar-nav .nav-link i,
      html[${txe_THEME_ATTR}='dark'] #sidenav-main .navbar-nav .nav-link svg {
        color: currentColor !important;
      }

      /* Global rounding to better match modern dashboard kits. */
      html[${txe_THEME_ATTR}='dark'] .card,
      html[${txe_THEME_ATTR}='dark'] .dropdown-menu,
      html[${txe_THEME_ATTR}='dark'] .modal-content,
      html[${txe_THEME_ATTR}='dark'] .form-control,
      html[${txe_THEME_ATTR}='dark'] input,
      html[${txe_THEME_ATTR}='dark'] select,
      html[${txe_THEME_ATTR}='dark'] textarea {
        border-radius: var(--txe-radius) !important;
      }

      html[${txe_THEME_ATTR}='dark'] .btn {
        border-radius: calc(var(--txe-radius) - 2px) !important;
      }

      html[${txe_THEME_ATTR}='dark'] .selected {
        background-color: rgba(255, 255, 255, 0.06) !important;
        border-color: rgba(255, 255, 255, 0.10) !important;
      }

      /* Remove the remaining white-ish glows; keep subtle, tinted focus rings. */
      html[${txe_THEME_ATTR}='dark'] .btn,
      html[${txe_THEME_ATTR}='dark'] .badge,
      html[${txe_THEME_ATTR}='dark'] .form-control,
      html[${txe_THEME_ATTR}='dark'] .custom-control-input:focus ~ .custom-control-label::before {
        box-shadow: none !important;
      }

      /* Badges: prevent white/light variants from staying bright on dark pages. */
      html[${txe_THEME_ATTR}='dark'] .badge.badge-white,
      html[${txe_THEME_ATTR}='dark'] .badge.badge-light,
      html[${txe_THEME_ATTR}='dark'] .badge.badge-neutral,
      html[${txe_THEME_ATTR}='dark'] .badge.badge-default,
      html[${txe_THEME_ATTR}='dark'] .badge.badge-info {
        background-color: rgba(255, 255, 255, 0.10) !important;
        border: 1px solid var(--txe-border) !important;
        color: var(--txe-text) !important;
      }

      /* Some pages use only "badge-info" and still render as white. */
      html[${txe_THEME_ATTR}='dark'] .badge-info {
        background-color: rgba(255, 255, 255, 0.10) !important;
        border: 1px solid var(--txe-border) !important;
        color: var(--txe-text) !important;
      }

      /* Select2: force dark surfaces (default theme is white). */
      html[${txe_THEME_ATTR}='dark'] .select2-container {
        color: var(--txe-text) !important;
      }

      html[${txe_THEME_ATTR}='dark'] .select2-container--default .select2-selection--single,
      html[${txe_THEME_ATTR}='dark'] .select2-container--default .select2-selection--multiple {
        background-color: var(--txe-surface-2) !important;
        border: 1px solid var(--txe-border) !important;
        color: var(--txe-text) !important;
        box-shadow: none !important;
      }

      html[${txe_THEME_ATTR}='dark'] .select2-container--default .select2-selection--single .select2-selection__rendered {
        color: var(--txe-text) !important;
      }

      html[${txe_THEME_ATTR}='dark'] .select2-container--default .select2-selection--multiple .select2-selection__choice {
        background-color: rgba(255, 255, 255, 0.10) !important;
        border: 1px solid var(--txe-border) !important;
        color: var(--txe-text) !important;
      }

      html[${txe_THEME_ATTR}='dark'] .select2-container--default .select2-selection--multiple .select2-selection__choice__remove {
        color: var(--txe-muted) !important;
      }

      html[${txe_THEME_ATTR}='dark'] .select2-dropdown {
        background-color: var(--txe-surface) !important;
        border: 1px solid var(--txe-border) !important;
        color: var(--txe-text) !important;
        box-shadow: 0 18px 40px rgba(0, 0, 0, 0.45) !important;
      }

      html[${txe_THEME_ATTR}='dark'] .select2-results {
        background-color: transparent !important;
        color: var(--txe-text) !important;
      }

      html[${txe_THEME_ATTR}='dark'] .select2-results__options {
        background-color: transparent !important;
        color: var(--txe-text) !important;
      }

      html[${txe_THEME_ATTR}='dark'] .select2-results__option {
        color: var(--txe-text) !important;
        background-color: transparent !important;
      }

      html[${txe_THEME_ATTR}='dark'] .select2-results__option.select2-results__message {
        color: var(--txe-muted) !important;
        background-color: transparent !important;
      }

      html[${txe_THEME_ATTR}='dark'] .select2-container--default .select2-results__option--highlighted[aria-selected] {
        background-color: var(--txe-nav-hover) !important;
        color: var(--txe-text) !important;
      }

      html[${txe_THEME_ATTR}='dark'] .select2-container--default .select2-results__option[aria-selected='true'] {
        background-color: rgba(61, 123, 255, 0.14) !important;
        color: var(--txe-text) !important;
      }

      html[${txe_THEME_ATTR}='dark'] .select2-container--focus .select2-selection,
      html[${txe_THEME_ATTR}='dark'] .select2-container--open .select2-selection {
        border-color: rgba(61, 123, 255, 0.55) !important;
        box-shadow: 0 0 0 0.12rem rgba(61, 123, 255, 0.22) !important;
      }

      /* Vue Multiselect (classes: multiselect__*). */
      html[${txe_THEME_ATTR}='dark'] .multiselect {
        color: var(--txe-text) !important;
      }

      html[${txe_THEME_ATTR}='dark'] .multiselect__tags {
        background-color: var(--txe-surface-2) !important;
        border: 1px solid var(--txe-border) !important;
        color: var(--txe-text) !important;
        box-shadow: none !important;
      }

      html[${txe_THEME_ATTR}='dark'] .multiselect__input {
        background-color: transparent !important;
        color: var(--txe-text) !important;
        box-shadow: none !important;
      }

      html[${txe_THEME_ATTR}='dark'] .multiselect__input::placeholder {
        color: var(--txe-muted) !important;
        opacity: 1 !important;
      }

      html[${txe_THEME_ATTR}='dark'] .multiselect__placeholder {
        color: var(--txe-muted) !important;
      }

      html[${txe_THEME_ATTR}='dark'] .multiselect__select {
        background-color: transparent !important;
      }

      html[${txe_THEME_ATTR}='dark'] .multiselect__select::before {
        border-color: var(--txe-muted) transparent transparent transparent !important;
      }

      html[${txe_THEME_ATTR}='dark'] .multiselect__content-wrapper {
        background-color: var(--txe-surface) !important;
        border: 1px solid var(--txe-border) !important;
        box-shadow: 0 18px 40px rgba(0, 0, 0, 0.45) !important;
      }

      html[${txe_THEME_ATTR}='dark'] .multiselect__content {
        background-color: transparent !important;
        color: var(--txe-text) !important;
      }

      html[${txe_THEME_ATTR}='dark'] .multiselect__option {
        background-color: transparent !important;
        color: var(--txe-text) !important;
      }

      html[${txe_THEME_ATTR}='dark'] .multiselect__option--highlight,
      html[${txe_THEME_ATTR}='dark'] .multiselect__option--highlight::after {
        background-color: var(--txe-nav-hover) !important;
        color: var(--txe-text) !important;
      }

      html[${txe_THEME_ATTR}='dark'] .multiselect__option--selected,
      html[${txe_THEME_ATTR}='dark'] .multiselect__option--selected::after {
        background-color: rgba(61, 123, 255, 0.14) !important;
        color: var(--txe-text) !important;
      }

      html[${txe_THEME_ATTR}='dark'] .multiselect__option--disabled {
        color: rgba(219, 228, 243, 0.40) !important;
        background-color: transparent !important;
      }

      html[${txe_THEME_ATTR}='dark'] .multiselect__spinner {
        background-color: var(--txe-surface-2) !important;
      }

      html[${txe_THEME_ATTR}='dark'] .btn:focus,
      html[${txe_THEME_ATTR}='dark'] .btn.focus,
      html[${txe_THEME_ATTR}='dark'] .form-control:focus,
      html[${txe_THEME_ATTR}='dark'] input:focus,
      html[${txe_THEME_ATTR}='dark'] select:focus,
      html[${txe_THEME_ATTR}='dark'] textarea:focus {
        outline: none !important;
        box-shadow: 0 0 0 0.12rem rgba(61, 123, 255, 0.22) !important;
      }

      html[${txe_THEME_ATTR}='dark'] .btn-primary:focus,
      html[${txe_THEME_ATTR}='dark'] .btn-primary.focus {
        box-shadow: 0 0 0 0.14rem rgba(61, 123, 255, 0.30) !important;
      }

      /* Doc type selector tiles (doc-type-grid / doc-type-card). */
      html[${txe_THEME_ATTR}='dark'] .doc-type-grid {
        color: var(--txe-text) !important;
      }

      html[${txe_THEME_ATTR}='dark'] .doc-type-option {
        color: inherit !important;
      }

      html[${txe_THEME_ATTR}='dark'] .doc-type-option input[type='radio'] {
        accent-color: var(--txe-primary) !important;
      }

      html[${txe_THEME_ATTR}='dark'] .doc-type-card {
        background-color: var(--txe-surface-2) !important;
        border: 1px solid var(--txe-border) !important;
        color: var(--txe-text) !important;
        box-shadow: none !important;
      }

      html[${txe_THEME_ATTR}='dark'] .doc-type-option:hover .doc-type-card {
        background-color: color-mix(in srgb, var(--txe-surface-2) 90%, #ffffff 10%) !important;
        background-color: rgba(255, 255, 255, 0.06) !important;
        border-color: rgba(255, 255, 255, 0.18) !important;
      }

      html[${txe_THEME_ATTR}='dark'] .doc-type-option input[type='radio']:checked + .doc-type-card {
        border-color: rgba(61, 123, 255, 0.55) !important;
        background-color: rgba(61, 123, 255, 0.10) !important;
        box-shadow: 0 0 0 0.12rem rgba(61, 123, 255, 0.18) !important;
      }

      html[${txe_THEME_ATTR}='dark'] .doc-type-option input[type='radio']:focus-visible + .doc-type-card {
        outline: none !important;
        box-shadow: 0 0 0 0.14rem rgba(61, 123, 255, 0.26) !important;
      }

      html[${txe_THEME_ATTR}='dark'] .doc-type-title {
        color: var(--txe-text) !important;
      }

      html[${txe_THEME_ATTR}='dark'] .doc-type-subtitle {
        color: var(--txe-muted) !important;
      }

      html[${txe_THEME_ATTR}='dark'] .doc-type-title i,
      html[${txe_THEME_ATTR}='dark'] .doc-type-title svg {
        color: var(--txe-muted) !important;
      }

      html[${txe_THEME_ATTR}='dark'] .btn-danger:focus,
      html[${txe_THEME_ATTR}='dark'] .btn-danger.focus {
        box-shadow: 0 0 0 0.14rem rgba(239, 68, 68, 0.26) !important;
      }

      html[${txe_THEME_ATTR}='dark'] .table,
      html[${txe_THEME_ATTR}='dark'] table {
        color: var(--txe-text) !important;
      }

      /* vue3-easy-data-table: defaults to white; force dark surfaces. */
      html[${txe_THEME_ATTR}='dark'] .vue3-easy-data-table,
      html[${txe_THEME_ATTR}='dark'] .vue3-easy-data-table__main,
      html[${txe_THEME_ATTR}='dark'] .vue3-easy-data-table__body,
      html[${txe_THEME_ATTR}='dark'] .vue3-easy-data-table__header,
      html[${txe_THEME_ATTR}='dark'] .vue3-easy-data-table__footer,
      html[${txe_THEME_ATTR}='dark'] .vue3-easy-data-table table,
      html[${txe_THEME_ATTR}='dark'] .vue3-easy-data-table .table-header {
        background-color: var(--txe-surface-2) !important;
        color: var(--txe-text) !important;
        border-color: var(--txe-border) !important;
      }

      html[${txe_THEME_ATTR}='dark'] .vue3-easy-data-table thead,
      html[${txe_THEME_ATTR}='dark'] .vue3-easy-data-table thead th,
      html[${txe_THEME_ATTR}='dark'] .vue3-easy-data-table .table-header {
        background-color: rgba(255, 255, 255, 0.04) !important;
        color: var(--txe-text) !important;
        border-color: var(--txe-border) !important;
      }

      html[${txe_THEME_ATTR}='dark'] .vue3-easy-data-table tbody td,
      html[${txe_THEME_ATTR}='dark'] .vue3-easy-data-table__body td {
        background-color: transparent !important;
        color: var(--txe-text) !important;
        border-color: var(--txe-border) !important;
      }

      html[${txe_THEME_ATTR}='dark'] .vue3-easy-data-table__body tr:hover td {
        background-color: rgba(255, 255, 255, 0.06) !important;
      }

      html[${txe_THEME_ATTR}='dark'] .easy-checkbox,
      html[${txe_THEME_ATTR}='dark'] #select-all-processing-checkbox,
      html[${txe_THEME_ATTR}='dark'] .easy-checkbox * {
        border-color: var(--txe-border) !important;
      }

      html[${txe_THEME_ATTR}='dark'] .direction-left,
      html[${txe_THEME_ATTR}='dark'] .expand-icon,
      html[${txe_THEME_ATTR}='dark'] .can-expand {
        color: var(--txe-muted) !important;
        fill: currentColor !important;
        background-color: transparent !important;
      }

      /* Some nav items get a white background on certain pages; neutralize it. */
      html[${txe_THEME_ATTR}='dark'] .nav-item,
      html[${txe_THEME_ATTR}='dark'] .navbar-nav .nav-item,
      html[${txe_THEME_ATTR}='dark'] .nav-item > .nav-link,
      html[${txe_THEME_ATTR}='dark'] .navbar-nav .nav-item > .nav-link {
        background-color: transparent !important;
      }

      /* DataTables: retint the remaining white container borders. */
      html[${txe_THEME_ATTR}='dark'] .data-table,
      html[${txe_THEME_ATTR}='dark'] .dataTables_wrapper,
      html[${txe_THEME_ATTR}='dark'] table.dataTable,
      html[${txe_THEME_ATTR}='dark'] table.dataTable.no-footer,
      html[${txe_THEME_ATTR}='dark'] .dataTables_wrapper.no-footer .dataTables_scrollBody,
      html[${txe_THEME_ATTR}='dark'] .dataTables_wrapper .dataTables_scroll,
      html[${txe_THEME_ATTR}='dark'] .dataTables_wrapper .dataTables_scrollHead,
      html[${txe_THEME_ATTR}='dark'] .dataTables_wrapper .dataTables_scrollHeadInner,
      html[${txe_THEME_ATTR}='dark'] .dataTables_wrapper .dataTables_scrollBody {
        border-color: var(--txe-border) !important;
      }

      html[${txe_THEME_ATTR}='dark'] .dataTables_wrapper.no-footer .dataTables_scrollBody,
      html[${txe_THEME_ATTR}='dark'] .dataTables_wrapper .dataTables_scrollBody {
        border: 1px solid var(--txe-border) !important;
      }

      html[${txe_THEME_ATTR}='dark'] .table thead th,
      html[${txe_THEME_ATTR}='dark'] thead {
        background-color: rgba(255, 255, 255, 0.04) !important;
      }

      html[${txe_THEME_ATTR}='dark'] .table-hover tbody tr:hover {
        color: var(--txe-text) !important;
        background-color: rgba(255, 255, 255, 0.06) !important;
      }

      html[${txe_THEME_ATTR}='dark'] .table-custom th,
      html[${txe_THEME_ATTR}='dark'] .table-custom td {
        background-color: var(--txe-surface-2) !important;
      }

      html[${txe_THEME_ATTR}='dark'] .table-custom tbody tr:hover {
        background-color: rgba(255, 255, 255, 0.06) !important;
        box-shadow: 0 6px 16px rgba(0, 0, 0, 0.55) !important;
      }

      /* Pagination / DataTables controls (often remain white). */
      /* Keep the site's default sizing/spacing; only recolor. */
      html[${txe_THEME_ATTR}='dark'] .data-table .pagination,
      html[${txe_THEME_ATTR}='dark'] .dataTables_wrapper .pagination,
      html[${txe_THEME_ATTR}='dark'] #leads-table_wrapper .pagination {
        background-color: var(--txe-surface) !important;
        box-shadow: 0 0 8px rgba(0, 0, 0, 0.55) !important;
      }

      html[${txe_THEME_ATTR}='dark'] .pagination .page-link {
        background-color: transparent !important;
        border-color: transparent !important;
        color: var(--txe-text) !important;
        box-shadow: none !important;
      }

      /* DataTables adds inline colors on inner <span>; force it to inherit our theme. */
      html[${txe_THEME_ATTR}='dark'] .pagination .page-link span,
      html[${txe_THEME_ATTR}='dark'] .pagination .page-link i {
        color: inherit !important;
      }

      /*
       * Argon ships a rule that effectively does:
       *   .data-table .page-item span:hover { background-color: #fff; }
       * The "Next" control uses an inner <span>, so this becomes a white hover blob.
       * Keep layout intact; only neutralize that background in dark mode.
       */
      html[${txe_THEME_ATTR}='dark'] .data-table .page-item.next span,
      html[${txe_THEME_ATTR}='dark'] .data-table .page-item.next span:hover,
      html[${txe_THEME_ATTR}='dark'] .data-table .page-item.previous span,
      html[${txe_THEME_ATTR}='dark'] .data-table .page-item.previous span:hover,
      html[${txe_THEME_ATTR}='dark'] #leads-table_next span,
      html[${txe_THEME_ATTR}='dark'] #leads-table_next span:hover,
      html[${txe_THEME_ATTR}='dark'] #leads-table_previous span,
      html[${txe_THEME_ATTR}='dark'] #leads-table_previous span:hover {
        background-color: transparent !important;
      }

      /* Make Next/Prev hitbox + hover background exactly 50px wide. */
      html[${txe_THEME_ATTR}='dark'] .pagination .page-item.next .page-link,
      html[${txe_THEME_ATTR}='dark'] .pagination .page-item.previous .page-link,
      html[${txe_THEME_ATTR}='dark'] #leads-table_next .page-link,
      html[${txe_THEME_ATTR}='dark'] #leads-table_previous .page-link {
        width: 50px !important;
        box-sizing: border-box !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
      }

      html[${txe_THEME_ATTR}='dark'] .pagination .page-item.first .page-link {
        color: var(--txe-muted) !important;
        width: 50px !important;
      }

      html[${txe_THEME_ATTR}='dark'] .pagination .page-item.disabled .page-link {
        color: var(--txe-muted) !important;
        width: 50px !important;
      }

      html[${txe_THEME_ATTR}='dark'] .pagination .page-item.next:not(.disabled) .page-link {
        color: var(--txe-primary) !important;
        width: 50px !important;
      }

      html[${txe_THEME_ATTR}='dark'] .pagination .page-link:hover {
        background-color: var(--txe-nav-hover) !important;
        color: var(--txe-text) !important;
      }

      /* DataTables/Bootstrap can apply a light hover bg; force dark hover for prev/next. */
      html[${txe_THEME_ATTR}='dark'] .data-table .pagination .page-link:hover,
      html[${txe_THEME_ATTR}='dark'] .dataTables_wrapper .pagination .page-link:hover,
      html[${txe_THEME_ATTR}='dark'] #leads-table_wrapper .pagination .page-link:hover,
      html[${txe_THEME_ATTR}='dark'] #leads-table_next .page-link:hover,
      html[${txe_THEME_ATTR}='dark'] #leads-table_previous .page-link:hover {
        background-color: var(--txe-nav-hover) !important;
        border-color: transparent !important;
        color: var(--txe-text) !important;
        width: 50px !important;
      }

      html[${txe_THEME_ATTR}='dark'] #leads-table_next .page-link:hover {
        color: var(--txe-primary) !important;
      }

      /* Some themes draw hover/focus via shadows/pseudo elements; neutralize for pager links. */
      html[${txe_THEME_ATTR}='dark'] #leads-table_next .page-link:hover,
      html[${txe_THEME_ATTR}='dark'] #leads-table_next .page-link:focus,
      html[${txe_THEME_ATTR}='dark'] #leads-table_next .page-link:active,
      html[${txe_THEME_ATTR}='dark'] #leads-table_previous .page-link:hover,
      html[${txe_THEME_ATTR}='dark'] #leads-table_previous .page-link:focus,
      html[${txe_THEME_ATTR}='dark'] #leads-table_previous .page-link:active {
        background: var(--txe-nav-hover) !important;
        background-image: none !important;
        box-shadow: none !important;
        outline: none !important;
        filter: none !important;
      }

      html[${txe_THEME_ATTR}='dark'] #leads-table_next .page-link::before,
      html[${txe_THEME_ATTR}='dark'] #leads-table_next .page-link::after,
      html[${txe_THEME_ATTR}='dark'] #leads-table_previous .page-link::before,
      html[${txe_THEME_ATTR}='dark'] #leads-table_previous .page-link::after {
        content: none !important;
      }

      html[${txe_THEME_ATTR}='dark'] .dataTables_wrapper .dataTables_info,
      html[${txe_THEME_ATTR}='dark'] .dataTables_wrapper .dataTables_length,
      html[${txe_THEME_ATTR}='dark'] .dataTables_wrapper .dataTables_filter {
        color: var(--txe-muted) !important;
      }

      html[${txe_THEME_ATTR}='dark'] .dataTables_wrapper .dataTables_length select,
      html[${txe_THEME_ATTR}='dark'] .dataTables_wrapper .dataTables_filter input {
        background-color: var(--txe-surface-2) !important;
        color: var(--txe-text) !important;
        border: 1px solid var(--txe-border) !important;
        box-shadow: none !important;
      }

      html[${txe_THEME_ATTR}='dark'] .close,
      html[${txe_THEME_ATTR}='dark'] .btn-close {
        color: var(--txe-muted) !important;
        text-shadow: none !important;
        opacity: 0.9 !important;
      }

      html[${txe_THEME_ATTR}='dark'] .form-control,
      html[${txe_THEME_ATTR}='dark'] input,
      html[${txe_THEME_ATTR}='dark'] select,
      html[${txe_THEME_ATTR}='dark'] textarea,
      html[${txe_THEME_ATTR}='dark'] .input-group-text {
        background-color: var(--txe-surface-2) !important;
        color: var(--txe-text) !important;
        border-color: var(--txe-border) !important;
      }

      html[${txe_THEME_ATTR}='dark'] textarea.form-control {
        background-color: var(--txe-surface-2) !important;
      }

      /* Argon/Bootstrap alerts + toasts (and other notification UIs). */
      html[${txe_THEME_ATTR}='dark'] .alert,
      html[${txe_THEME_ATTR}='dark'] .toast,
      html[${txe_THEME_ATTR}='dark'] .toast-header,
      html[${txe_THEME_ATTR}='dark'] .toast-body {
        background-color: var(--txe-surface-2) !important;
        color: var(--txe-text) !important;
        border-color: var(--txe-border) !important;
      }

      html[${txe_THEME_ATTR}='dark'] .alert a {
        color: var(--txe-green) !important;
      }

      /* SweetAlert2 (inline styles in the dashboard are white by default). */
      html[${txe_THEME_ATTR}='dark'] .swal2-container {
        color: var(--txe-text) !important;
      }

      html[${txe_THEME_ATTR}='dark'] .swal2-popup,
      html[${txe_THEME_ATTR}='dark'] .swal2-modal,
      html[${txe_THEME_ATTR}='dark'] .swal2-toast {
        background: var(--txe-surface-2) !important;
        color: var(--txe-text) !important;
        border: 1px solid var(--txe-border) !important;
        box-shadow: 0 10px 28px rgba(0, 0, 0, 0.55) !important;
      }

      /* Leads list: session search UI uses inline light styles. */
      html[${txe_THEME_ATTR}='dark'] #session-search {
        background-color: var(--txe-surface-2) !important;
        border: 1px solid var(--txe-border) !important;
        box-shadow: none !important;
      }

      html[${txe_THEME_ATTR}='dark'] #session-search svg {
        color: var(--txe-muted) !important;
        fill: currentColor !important;
      }

      html[${txe_THEME_ATTR}='dark'] #new_search,
      html[${txe_THEME_ATTR}='dark'] #search_client,
      html[${txe_THEME_ATTR}='dark'] #search_staff_members {
        background-color: var(--txe-surface-2) !important;
        color: var(--txe-text) !important;
        border-color: var(--txe-border) !important;
      }

      /* Expanded search UI wrapper (prevents an outer white box when expanding). */
      html[${txe_THEME_ATTR}='dark'] .search-container,
      html[${txe_THEME_ATTR}='dark'] .search-container.active,
      html[${txe_THEME_ATTR}='dark'] .search-container.open,
      html[${txe_THEME_ATTR}='dark'] .search-container:focus-within {
        background-color: var(--txe-surface-2) !important;
        border: 1px solid var(--txe-border) !important;
        border-radius: var(--txe-radius) !important;
        box-shadow: none !important;
        color: var(--txe-text) !important;
      }

      html[${txe_THEME_ATTR}='dark'] .search-container .search-icon,
      html[${txe_THEME_ATTR}='dark'] .search-container .cancel-icon {
        color: var(--txe-muted) !important;
      }

      html[${txe_THEME_ATTR}='dark'] .search-container .search-icon svg,
      html[${txe_THEME_ATTR}='dark'] .search-container .cancel-icon svg {
        color: currentColor !important;
        fill: currentColor !important;
      }

      html[${txe_THEME_ATTR}='dark'] .search-container .search-icon svg path,
      html[${txe_THEME_ATTR}='dark'] .search-container .cancel-icon svg path {
        fill: currentColor !important;
      }

      /* If the expanded search uses a dropdown/menu for results, keep it dark too. */
      html[${txe_THEME_ATTR}='dark'] .search-container .dropdown-menu {
        background-color: var(--txe-surface) !important;
        border: 1px solid var(--txe-border) !important;
        box-shadow: 0 18px 40px rgba(0, 0, 0, 0.45) !important;
      }

      html[${txe_THEME_ATTR}='dark'] #new_search::placeholder,
      html[${txe_THEME_ATTR}='dark'] #search_client::placeholder,
      html[${txe_THEME_ATTR}='dark'] #search_staff_members::placeholder {
        color: rgba(231, 231, 235, 0.55) !important;
      }

      /* Comments list (list-group items are white in Argon by default). */
      html[${txe_THEME_ATTR}='dark'] .list-group-item {
        background-color: var(--txe-surface-2) !important;
        color: var(--txe-text) !important;
        border-color: var(--txe-border) !important;
      }

      html[${txe_THEME_ATTR}='dark'] .list-group-item-action:hover,
      html[${txe_THEME_ATTR}='dark'] .list-group-item-action:focus {
        background-color: rgba(255, 255, 255, 0.06) !important;
        color: var(--txe-text) !important;
      }

      html[${txe_THEME_ATTR}='dark'] .list-group-item small {
        color: var(--txe-muted) !important;
      }

      html[${txe_THEME_ATTR}='dark'] .swal2-title,
      html[${txe_THEME_ATTR}='dark'] .swal2-html-container,
      html[${txe_THEME_ATTR}='dark'] .swal2-content,
      html[${txe_THEME_ATTR}='dark'] .swal2-footer {
        color: var(--txe-text) !important;
      }

      html[${txe_THEME_ATTR}='dark'] .swal2-close {
        color: var(--txe-muted) !important;
      }

      html[${txe_THEME_ATTR}='dark'] .swal2-input,
      html[${txe_THEME_ATTR}='dark'] .swal2-textarea,
      html[${txe_THEME_ATTR}='dark'] .swal2-select {
        background: var(--txe-surface) !important;
        color: var(--txe-text) !important;
        border: 1px solid var(--txe-border) !important;
        box-shadow: none !important;
      }

      html[${txe_THEME_ATTR}='dark'] .btn-primary,
      html[${txe_THEME_ATTR}='dark'] .badge-primary,
      html[${txe_THEME_ATTR}='dark'] .bg-primary {
        background-color: var(--txe-primary) !important;
        border-color: var(--txe-primary) !important;
        color: #fff !important;
      }

      html[${txe_THEME_ATTR}='dark'] .btn-primary:hover,
      html[${txe_THEME_ATTR}='dark'] .btn-primary:focus {
        background-color: var(--txe-primary-2) !important;
        border-color: var(--txe-primary-2) !important;
      }

      html[${txe_THEME_ATTR}='dark'] .btn-danger,
      html[${txe_THEME_ATTR}='dark'] .badge-danger,
      html[${txe_THEME_ATTR}='dark'] .bg-danger {
        background-color: var(--txe-red) !important;
        border-color: var(--txe-red) !important;
        color: var(--txe-bg) !important;
      }

      html[${txe_THEME_ATTR}='dark'] .btn-danger:hover,
      html[${txe_THEME_ATTR}='dark'] .btn-danger:focus {
        background-color: var(--txe-red-2) !important;
        border-color: var(--txe-red-2) !important;
      }

      /* Dark-mode active nav items (avoid white backgrounds). */
      html[${txe_THEME_ATTR}='dark'] .navbar-nav .nav-link.active,
      html[${txe_THEME_ATTR}='dark'] .navbar-nav .active > .nav-link,
      html[${txe_THEME_ATTR}='dark'] .nav-pills .nav-link.active,
      html[${txe_THEME_ATTR}='dark'] .nav-pills .show > .nav-link {
        color: var(--txe-text) !important;
        background-color: rgba(255, 255, 255, 0.06) !important;
        border-radius: 8px;
      }

      html[${txe_THEME_ATTR}='dark'] .navbar-top .navbar-nav .nav-link,
      html[${txe_THEME_ATTR}='dark'] .navbar-top .navbar-nav .nav-link i {
        color: var(--txe-text) !important;
      }

      /* Profile dropdown/name text sometimes stays dark. */
      html[${txe_THEME_ATTR}='dark'] .navbar-top .nav-link .media-body,
      html[${txe_THEME_ATTR}='dark'] .navbar-top .nav-link .media-body span,
      html[${txe_THEME_ATTR}='dark'] .navbar-top .dropdown-menu,
      html[${txe_THEME_ATTR}='dark'] .navbar-top .dropdown-menu .dropdown-item {
        color: var(--txe-text) !important;
      }

      html[${txe_THEME_ATTR}='dark'] .navbar-top .dropdown-menu * {
        color: inherit;
      }

      html[${txe_THEME_ATTR}='dark'] .nav-item.dropdown h1,
      .nav-item.dropdown,
      #selectAccount,
      #selectStaff {
        color: var(--txe-text) !important;
      }

      html[${txe_THEME_ATTR}='dark'] .card-footer {
        background-color: var(--txe-surface-2) !important;
      }

      html[${txe_THEME_ATTR}='dark'] .navbar-top .dropdown-menu .text-muted,
      html[${txe_THEME_ATTR}='dark'] .navbar-top .dropdown-menu small,
      html[${txe_THEME_ATTR}='dark'] .navbar-top .dropdown-menu .small {
        color: var(--txe-muted) !important;
      }

      /* Applicants filters: remove light borders/shadows and recolor counters/icons. */
      html[${txe_THEME_ATTR}='dark'] .applicants-filters {
        border: none !important;
        box-shadow: none !important;
      }

      /* Argon uses a solid purple background for the selected filter; keep it subtle on dark. */
      html[${txe_THEME_ATTR}='dark'] .selectedFilterBackground {
        background-color: rgba(167, 139, 250, 0.14) !important;
        background-color: color-mix(in srgb, var(--txe-purple) 18%, transparent) !important;
      }

      html[${txe_THEME_ATTR}='dark'] #completedCounter,
      html[${txe_THEME_ATTR}='dark'] #seenCounter {
        color: var(--txe-purple) !important;
      }

      /* Confirmed filter sometimes renders smaller than the other tiles; normalize sizing. */
      html[${txe_THEME_ATTR}='dark'] #confirmedFilter {
        font-size: 1rem !important;
      }

      html[${txe_THEME_ATTR}='dark'] #confirmedFilter .filter-titles {
        font-size: 0.875rem !important;
        font-weight: 600 !important;
      }

      html[${txe_THEME_ATTR}='dark'] #confirmedFilter > div > svg {
        width: 39px !important;
        height: 38px !important;
      }

      html[${txe_THEME_ATTR}='dark'] #confirmedCounter {
        font-size: 1rem !important;
        font-weight: 600 !important;
      }

      /* The filter icons are inline SVG with light rect backgrounds; retint them in dark mode. */
      html[${txe_THEME_ATTR}='dark'] .applicants-filters svg rect {
        fill: rgba(255, 255, 255, 0.08) !important;
      }

      /* Replace Argon's dark-purple accents inside inline SVGs with the theme purple token. */
      html[${txe_THEME_ATTR}='dark'] svg [fill="#311B92"],
      html[${txe_THEME_ATTR}='dark'] svg [fill="#673AB7"],
      html[${txe_THEME_ATTR}='dark'] svg [fill="#512DA8"],
      html[${txe_THEME_ATTR}='dark'] svg [fill="#5E35B1"],
      html[${txe_THEME_ATTR}='dark'] svg [fill="#4527A0"],
      html[${txe_THEME_ATTR}='dark'] svg [fill="#311b92"],
      html[${txe_THEME_ATTR}='dark'] svg [fill="#673ab7"],
      html[${txe_THEME_ATTR}='dark'] svg [fill="#512da8"],
      html[${txe_THEME_ATTR}='dark'] svg [fill="#5e35b1"],
      html[${txe_THEME_ATTR}='dark'] svg [fill="#4527a0"] {
        fill: var(--txe-purple) !important;
      }

      /* Also catch inline styles that hardcode Argon purple for text/backgrounds. */
      html[${txe_THEME_ATTR}='dark'] [style*="color: #673AB7"],
      html[${txe_THEME_ATTR}='dark'] [style*="color:#673AB7"],
      html[${txe_THEME_ATTR}='dark'] [style*="color: #311B92"],
      html[${txe_THEME_ATTR}='dark'] [style*="color:#311B92"],
      html[${txe_THEME_ATTR}='dark'] [style*="color: #512DA8"],
      html[${txe_THEME_ATTR}='dark'] [style*="color:#32325d"],
      html[${txe_THEME_ATTR}='dark'] [style*="color:#512DA8"] {
        color: var(--txe-purple) !important;
      }

      /* Applicants filters separator line defaults to black; retint it for dark mode. */
      html[${txe_THEME_ATTR}='dark'] .applicants-filters line[stroke="black"],
      html[${txe_THEME_ATTR}='dark'] .applicants-filters line[stroke="#000"],
      html[${txe_THEME_ATTR}='dark'] .applicants-filters line[stroke="#000000"] {
        stroke: rgba(255, 255, 255, 0.20) !important;
        opacity: 1 !important;
      }

      html[${txe_THEME_ATTR}='dark'] .applicants-filters svg g[filter] {
        filter: none !important;
      }

      /* Spacers/dividers across the app (hr and similar). */
      html[${txe_THEME_ATTR}='dark'] hr {
        border-color: var(--txe-border) !important;
        opacity: 1 !important;
      }

      /* DataTables sometimes uses its own header/footer borders. */
      html[${txe_THEME_ATTR}='dark'] table.dataTable thead th,
      html[${txe_THEME_ATTR}='dark'] table.dataTable thead td,
      html[${txe_THEME_ATTR}='dark'] table.dataTable tfoot th,
      html[${txe_THEME_ATTR}='dark'] table.dataTable tfoot td {
        border-color: var(--txe-border) !important;
      }

      /* FullCalendar: override its default CSS vars (it ships white defaults). */
      html[${txe_THEME_ATTR}='dark'] {
        --fc-page-bg-color: var(--txe-surface-2);
        --fc-neutral-bg-color: rgba(255, 255, 255, 0.04);
        --fc-neutral-text-color: var(--txe-muted);
        --fc-border-color: var(--txe-border);

        --fc-button-text-color: var(--txe-text);
        --fc-button-bg-color: var(--txe-surface);
        --fc-button-border-color: transparent;
        --fc-button-hover-bg-color: var(--txe-surface-2);
        --fc-button-hover-border-color: transparent;
        --fc-button-active-bg-color: var(--txe-surface-2);
        --fc-button-active-border-color: transparent;

        --fc-event-bg-color: var(--txe-primary);
        --fc-event-border-color: var(--txe-primary);
        --fc-event-text-color: var(--txe-text);
        --fc-today-bg-color: rgba(61, 123, 255, 0.10);
      }

      html[${txe_THEME_ATTR}='dark'] .fc,
      html[${txe_THEME_ATTR}='dark'] .fc-theme-standard,
      html[${txe_THEME_ATTR}='dark'] .fc .fc-scrollgrid-section-sticky > * {
        background-color: var(--txe-surface-2) !important;
      }

      /* DateRangePicker (daterangepicker) dark mode. */
      html[${txe_THEME_ATTR}='dark'] .daterangepicker {
        background-color: var(--txe-surface-2) !important;
        border: 1px solid var(--txe-border) !important;
        color: var(--txe-text) !important;
        box-shadow: 0 18px 40px rgba(0, 0, 0, 0.45) !important;
      }

      html[${txe_THEME_ATTR}='dark'] .daterangepicker:before,
      html[${txe_THEME_ATTR}='dark'] .daterangepicker:after {
        border-bottom-color: var(--txe-surface-2) !important;
      }

      html[${txe_THEME_ATTR}='dark'] .daterangepicker .drp-calendar,
      html[${txe_THEME_ATTR}='dark'] .daterangepicker .calendar-table {
        background-color: transparent !important;
        border-color: transparent !important;
      }

      html[${txe_THEME_ATTR}='dark'] .daterangepicker .calendar-table table {
        color: var(--txe-text) !important;
      }

      html[${txe_THEME_ATTR}='dark'] .daterangepicker th,
      html[${txe_THEME_ATTR}='dark'] .daterangepicker td {
        color: var(--txe-text) !important;
        border-color: transparent !important;
        background-color: transparent !important;
      }

      /* Some builds paint available day cells white; force them transparent in dark mode. */
      html[${txe_THEME_ATTR}='dark'] .daterangepicker td.available,
      html[${txe_THEME_ATTR}='dark'] .daterangepicker td.available:hover {
        background-color: transparent !important;
      }

      html[${txe_THEME_ATTR}='dark'] .daterangepicker td.off,
      html[${txe_THEME_ATTR}='dark'] .daterangepicker td.off.in-range,
      html[${txe_THEME_ATTR}='dark'] .daterangepicker td.off.start-date,
      html[${txe_THEME_ATTR}='dark'] .daterangepicker td.off.end-date,
      html[${txe_THEME_ATTR}='dark'] .daterangepicker td.disabled,
      html[${txe_THEME_ATTR}='dark'] .daterangepicker option.disabled {
        color: rgba(219, 228, 243, 0.40) !important;
      }

      html[${txe_THEME_ATTR}='dark'] .daterangepicker td.available:hover,
      html[${txe_THEME_ATTR}='dark'] .daterangepicker th.available:hover {
        background-color: rgba(255, 255, 255, 0.06) !important;
      }

      html[${txe_THEME_ATTR}='dark'] .daterangepicker td.in-range {
        background-color: rgba(61, 123, 255, 0.14) !important;
        color: var(--txe-text) !important;
      }

      html[${txe_THEME_ATTR}='dark'] .daterangepicker td.active,
      html[${txe_THEME_ATTR}='dark'] .daterangepicker td.active:hover,
      html[${txe_THEME_ATTR}='dark'] .daterangepicker td.start-date,
      html[${txe_THEME_ATTR}='dark'] .daterangepicker td.end-date {
        background-color: var(--txe-primary) !important;
        color: #ffffff !important;
      }

      html[${txe_THEME_ATTR}='dark'] .daterangepicker .drp-buttons {
        border-top: 1px solid var(--txe-border) !important;
        background-color: var(--txe-surface) !important;
      }

      html[${txe_THEME_ATTR}='dark'] .daterangepicker .drp-selected {
        color: var(--txe-muted) !important;
      }

      html[${txe_THEME_ATTR}='dark'] .daterangepicker .calendar-time select,
      html[${txe_THEME_ATTR}='dark'] .daterangepicker select.hourselect,
      html[${txe_THEME_ATTR}='dark'] .daterangepicker select.minuteselect,
      html[${txe_THEME_ATTR}='dark'] .daterangepicker select.ampmselect {
        background-color: var(--txe-surface-2) !important;
        border: 1px solid var(--txe-border) !important;
        color: var(--txe-text) !important;
      }

      html[${txe_THEME_ATTR}='dark'] .daterangepicker .ranges {
        background-color: transparent !important;
      }

      html[${txe_THEME_ATTR}='dark'] .fc,
      html[${txe_THEME_ATTR}='dark'] .fc .fc-toolbar-title,
      html[${txe_THEME_ATTR}='dark'] .fc a {
        color: var(--txe-text) !important;
      }

      html[${txe_THEME_ATTR}='dark'] .fc .fc-button {
        box-shadow: none !important;
      }

      html[${txe_THEME_ATTR}='dark'] .fc .fc-daygrid-day-number,
      html[${txe_THEME_ATTR}='dark'] .fc .fc-col-header-cell-cushion {
        color: var(--txe-muted) !important;
      }

      /* FullCalendar day cells can still render white frames in some themes. */
      html[${txe_THEME_ATTR}='dark'] .fc .fc-scrollgrid,
      html[${txe_THEME_ATTR}='dark'] .fc .fc-scrollgrid-section > *,
      html[${txe_THEME_ATTR}='dark'] .fc .fc-daygrid-day-frame {
        background-color: var(--txe-surface-2) !important;
        border-color: var(--txe-border) !important;
      }

      html[${txe_THEME_ATTR}='dark'] .fc .fc-daygrid-day.fc-day-today .fc-daygrid-day-frame {
        background-color: rgba(61, 123, 255, 0.10) !important;
      }

      /* User-menu icon button (replaces username text in dark mode). */
      html[${txe_THEME_ATTR}='dark'] .txe-user-menu-btn {
        width: 34px;
        height: 34px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 999px;
        background: rgba(176, 172, 172, 0.08);
        border: 1px solid var(--txe-border);
      }

      html[${txe_THEME_ATTR}='dark'] .txe-user-menu-btn:hover {
        background: rgba(255, 255, 255, 0.12);
      }

      html[${txe_THEME_ATTR}='dark'] .txe-user-menu-btn svg {
        width: 16px;
        height: 16px;
        fill: rgb(140 146 155);
        opacity: 0.92;
      }

      html[${txe_THEME_ATTR}='dark'] .text-primary {
        color: var(--txe-primary) !important;
      }

      html[${txe_THEME_ATTR}='dark'] a {
        color: var(--txe-primary) !important;
      }
    `;
    document.documentElement.appendChild(style);
  }

  const LEGACY_PURPLE_HEX = '#32325d';
  const LEGACY_PURPLE_REPLACER_STYLE_ID = 'txe-legacy-purple-replacements-style';
  let legacyPurpleReplacerInstalled = false;
  let legacyPurpleReplacerScheduled = false;

  function prefixSelectorForDarkMode(selector) {
    const sel = String(selector || '').trim();
    if (!sel) return '';
    const scope = `html[${txe_THEME_ATTR}='dark']`;
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

          const decls = styleText.replace(/#32325d\b/gi, 'var(--txe-purple)');
          out += `${prefixedSelectors} { ${decls} }\n`;
          continue;
        }

        
        if (rule.type === 4) {
          const inner = buildLegacyPurpleOverrideCssFromRules(rule.cssRules);
          if (inner && inner.trim()) {
            const cond = String(rule.conditionText || '').trim();
            out += `@media ${cond} {\n${inner}}\n`;
          }
          continue;
        }

        
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

    
    css += `html[${txe_THEME_ATTR}='dark'] [style*="${LEGACY_PURPLE_HEX}" i] { color: var(--txe-purple) !important; }\n`;
    css += `html[${txe_THEME_ATTR}='dark'] [style*="background:${LEGACY_PURPLE_HEX}" i],\n`;
    css += `html[${txe_THEME_ATTR}='dark'] [style*="background-color:${LEGACY_PURPLE_HEX}" i] { background-color: var(--txe-purple) !important; }\n`;
    css += `html[${txe_THEME_ATTR}='dark'] [style*="border-color:${LEGACY_PURPLE_HEX}" i] { border-color: var(--txe-purple) !important; }\n`;
    css += `html[${txe_THEME_ATTR}='dark'] [fill="${LEGACY_PURPLE_HEX}"],\n`;
    css += `html[${txe_THEME_ATTR}='dark'] [fill="${LEGACY_PURPLE_HEX.toUpperCase()}"],\n`;
    css += `html[${txe_THEME_ATTR}='dark'] [stroke="${LEGACY_PURPLE_HEX}"],\n`;
    css += `html[${txe_THEME_ATTR}='dark'] [stroke="${LEGACY_PURPLE_HEX.toUpperCase()}"] { fill: var(--txe-purple) !important; stroke: var(--txe-purple) !important; }\n`;

    
    const sheets = Array.from(document.styleSheets || []);
    for (const sheet of sheets) {
      try {
        const rules = sheet && sheet.cssRules ? sheet.cssRules : null;
        if (!rules || !rules.length) continue;
        css += buildLegacyPurpleOverrideCssFromRules(rules);
      } catch {
        
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
    
    if ((document.documentElement.getAttribute(txe_THEME_ATTR) || getStoredTheme()) !== 'dark') return;

    const nav = document.querySelector('nav.navbar-top');
    if (!nav) return;

    const toggle = nav.querySelector(
      'li.nav-item.dropdown a.nav-link[data-toggle="dropdown"], li.nav-item.dropdown a.nav-link[aria-haspopup="true"]'
    );
    if (!toggle) return;
    if (toggle.getAttribute(txe_USER_ICONIZED_ATTR) === '1') return;

    const iconWrap = document.createElement('span');
    iconWrap.className = 'txe-user-menu-btn';
    iconWrap.setAttribute('aria-hidden', 'true');
    iconWrap.innerHTML = `
      <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
        <path d="M12 12c2.76 0 5-2.24 5-5S14.76 2 12 2 7 4.24 7 7s2.24 5 5 5zm0 2c-4.42 0-8 2.24-8 5v1h16v-1c0-2.76-3.58-5-8-5z" />
      </svg>
    `;

    
    const media = toggle.querySelector('.media');
    if (media) {
      while (media.firstChild) media.removeChild(media.firstChild);
      media.appendChild(iconWrap);
    } else {
      toggle.textContent = '';
      toggle.appendChild(iconWrap);
    }

    toggle.setAttribute('aria-label', 'User menu');
    toggle.setAttribute(txe_USER_ICONIZED_ATTR, '1');
  }

  const SIDENAV_FALLBACK_ATTR = 'data-txe-sidenav-fallback';
  const SIDENAV_STATE_KEY = 'txe-sidenav-pinned';

  function readPersistedSidenavPinned() {
    try {
      const v = localStorage.getItem(SIDENAV_STATE_KEY);
      if (v === '1') return true;
      if (v === '0') return false;
    } catch {
    }
    return null;
  }

  function persistSidenavPinned(pinned) {
    try {
      localStorage.setItem(SIDENAV_STATE_KEY, pinned ? '1' : '0');
    } catch {
    }
  }

  function computeSidenavPinnedFromBody() {
    const body = document.body;
    if (!body) return null;
    const pinned = body.classList.contains('g-sidenav-pinned');
    const hidden = body.classList.contains('g-sidenav-hidden');
    if (pinned && !hidden) return true;
    if (hidden && !pinned) return false;
    
    return null;
  }

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
    body.classList.remove('g-sidenav-show');
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

    const applyPersisted = () => {
      const pref = readPersistedSidenavPinned();
      if (pref === null) return;
      if (!document.body) return;
      if (!document.getElementById('sidenav-main')) return;

      
      const current = computeSidenavPinnedFromBody();
      if (current === pref) return;
      if (pref) pinSidenavFallback();
      else unpinSidenavFallback();
    };

    
    setTimeout(applyPersisted, 0);
    window.addEventListener('load', applyPersisted, { once: true });

    document.addEventListener('click', (e) => {
      const el = e.target && e.target.closest ? e.target.closest('[data-action]') : null;
      if (!el) return;

      const action = String(el.getAttribute('data-action') || '').toLowerCase();
      if (action !== 'sidenav-pin' && action !== 'sidenav-unpin') return;

      const before = document.body ? document.body.className : '';
      setTimeout(() => {
        const after = document.body ? document.body.className : '';
        
        if (after === before) {
          if (action === 'sidenav-pin') pinSidenavFallback();
          if (action === 'sidenav-unpin') unpinSidenavFallback();
        }

        const state = computeSidenavPinnedFromBody();
        if (state !== null) persistSidenavPinned(state);
      }, 0);
    });
  }



  function ensureWhiteBrandLogo() {
    
    if ((document.documentElement.getAttribute(txe_THEME_ATTR) || getStoredTheme()) !== 'dark') return;

    const img = document.querySelector('img.navbar-brand-img');
    if (!img) return;
    if (img.getAttribute('data-txe-logo-fast') === '1') return;

    
    
    img.style.filter = 'brightness(0) invert(1)';
    img.setAttribute('data-txe-logo-fast', '1');
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

    
    if (t.startsWith('[') && t.endsWith(']')) {
      t = ws(t.slice(1, -1));
    }

    
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
        
        const leadSpan = row.querySelector('td.sorting_1 span[title]');
        if (leadSpan && leadSpan.getAttribute(LEAD_YEARS_FORMATTED_ATTR) !== '1') {
          const title = leadSpan.getAttribute('title');
          if (title) {
            
            const pretty = beautifyArrayLikeText(title);
            
            leadSpan.removeAttribute('title');
            
            leadSpan.setAttribute('data-txe-years', pretty);
          }
          leadSpan.setAttribute(LEAD_YEARS_FORMATTED_ATTR, '1');
        }

        
        
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

    leadFlagsObserverSuppression++;
    try {

    
    
    const createInlineFlagSvg = (code) => {
      const svgNS = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(svgNS, 'svg');
      svg.setAttribute('width', '18');
      svg.setAttribute('height', '12');
      svg.setAttribute('viewBox', '0 0 18 12');
      svg.setAttribute('aria-hidden', 'true');
      svg.style.display = 'block';

      const stripes =
        code === 'de'
          ? [
              { y: 0, fill: '#000' },
              { y: 4, fill: '#DD0000' },
              { y: 8, fill: '#FFCE00' },
            ]
          : [
              { y: 0, fill: '#AE1C28' },
              { y: 4, fill: '#FFF' },
              { y: 8, fill: '#21468B' },
            ];

      for (const s of stripes) {
        const rect = document.createElementNS(svgNS, 'rect');
        rect.setAttribute('width', '18');
        rect.setAttribute('height', '4');
        rect.setAttribute('y', String(s.y));
        rect.setAttribute('fill', s.fill);
        svg.appendChild(rect);
      }
      return svg;
    };

    const stripLeadingTextMarker = (container) => {
      
      
      try {
        const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
        const first = walker.nextNode();
        if (!first || typeof first.nodeValue !== 'string') return { hadDE: false, hadNL: false };
        const raw = first.nodeValue;
        const m = raw.match(/^\s*(DE|NL)\s+/i);
        if (!m) return { hadDE: false, hadNL: false };
        const code = String(m[1] || '').toLowerCase();
        first.nodeValue = raw.replace(/^\s*(DE|NL)\s+/i, '');
        return { hadDE: code === 'de', hadNL: code === 'nl' };
      } catch {
      }
      return { hadDE: false, hadNL: false };
    };

    const detectCountryFromAttributes = (node) => {
      let hadDE = false;
      let hadNL = false;
      try {
        if (!node || !node.attributes) return { hadDE, hadNL };
        const attrs = Array.from(node.attributes);
        for (const a of attrs) {
          const v = String((a && a.value) || '');
          if (!v) continue;
          if (v.includes('🇩🇪')) hadDE = true;
          if (v.includes('🇳🇱')) hadNL = true;
          if (!hadDE && !hadNL) {
            
            if (/(^|[\s>])DE\s+/i.test(v)) hadDE = true;
            if (/(^|[\s>])NL\s+/i.test(v)) hadNL = true;
          }
          if (hadDE || hadNL) break;
        }
      } catch {
      }
      return { hadDE, hadNL };
    };

    const detectCountryFromInlineSvg = (container) => {
      let hadDE = false;
      let hadNL = false;
      let hasInlineFlag = false;
      if (!container || !container.querySelectorAll) return { hadDE, hadNL, hasInlineFlag };

      const svgs = Array.from(container.querySelectorAll('svg'));
      for (const svg of svgs) {
        try {
          const rects = Array.from(svg.querySelectorAll('rect'));
          if (!rects.length) continue;

          const fills = rects
            .map((r) => String(r.getAttribute('fill') || '').trim().toLowerCase())
            .filter(Boolean);

          const hasDE = fills.includes('#000000') && fills.includes('#dd0000') && fills.includes('#ffce00');
          const hasNL = fills.includes('#ae1c28') && fills.includes('#ffffff') && fills.includes('#21468b');

          if (hasDE || hasNL) {
            hadDE = hadDE || hasDE;
            hadNL = hadNL || hasNL;
            hasInlineFlag = true;

            if (container && container.classList) container.classList.add('txe-inline-flag-wrap');
            svg.classList.add('txe-inline-flag');
            svg.setAttribute('aria-hidden', 'true');
          }
        } catch {
        }
      }

      return { hadDE, hadNL, hasInlineFlag };
    };

    const trimLeadingWhitespaceText = (container) => {
      try {
        const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
        const first = walker.nextNode();
        if (!first || typeof first.nodeValue !== 'string') return;
        first.nodeValue = first.nodeValue.replace(/^\s+/, '');
      } catch {
      }
    };

    const hasCountryMarkerNow = (container, row) => {
      try {
        const text = String((container && container.textContent) || '');
        if (text.includes('🇩🇪') || text.includes('🇳🇱')) return true;
        if (/^\s*(DE|NL)\s+/i.test(text)) return true;
      } catch {
      }

      
      try {
        if (container && container.getAttribute) {
          const t1 = String(container.getAttribute('title') || '');
          const t2 = String(container.getAttribute('data-original-title') || '');
          if (t1.includes('🇩🇪') || t1.includes('🇳🇱') || t2.includes('🇩🇪') || t2.includes('🇳🇱')) return true;
        }
      } catch {
      }

      
      const fromRowAttrs = detectCountryFromAttributes(row);
      return !!fromRowAttrs.hadDE || !!fromRowAttrs.hadNL;
    };

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

          
          try {
            if (leadCellSpan.querySelectorAll) {
              const existing = leadCellSpan.querySelectorAll(`.${LEAD_FLAG_CLASS}`);
              if (existing && existing.length > 1) {
                for (let i = 1; i < existing.length; i++) existing[i].remove();
              }
            }
          } catch {
          }

        
        
          const alreadyHasFlag = !!(leadCellSpan.querySelector && leadCellSpan.querySelector(`.${LEAD_FLAG_CLASS}`));
        const markerStillPresent = hasCountryMarkerNow(leadCellSpan, row);
        if (alreadyHasFlag && !markerStillPresent) {
          leadCellSpan.setAttribute(LEAD_FLAG_REPLACED_ATTR, '1');
          continue;
        }

        
        if (leadCellSpan.getAttribute && leadCellSpan.getAttribute(LEAD_FLAG_REPLACED_ATTR) === '1') {
          if (markerStillPresent) {
            try {
              leadCellSpan.removeAttribute(LEAD_FLAG_REPLACED_ATTR);
            } catch {
            }
          } else {
            continue;
          }
        }

        
        
        let hadDE = false;
        let hadNL = false;

        
        const fromRowAttrs = detectCountryFromAttributes(row);
        hadDE = hadDE || !!fromRowAttrs.hadDE;
        hadNL = hadNL || !!fromRowAttrs.hadNL;

        
        const fromInlineSvg = detectCountryFromInlineSvg(leadCellSpan);
        hadDE = hadDE || !!fromInlineSvg.hadDE;
        hadNL = hadNL || !!fromInlineSvg.hadNL;
        if (fromInlineSvg.hasInlineFlag) {
          try {
            if (leadCellSpan.querySelectorAll) {
              leadCellSpan.querySelectorAll(`.${LEAD_FLAG_CLASS}`).forEach((n) => n.remove());
            }
          } catch {
          }
          leadCellSpan.setAttribute(LEAD_FLAG_REPLACED_ATTR, '1');
          continue;
        }

        
        const fromText = stripCountryEmojiFromTextNodes(leadCellSpan);
        hadDE = hadDE || !!fromText.hadDE;
        hadNL = hadNL || !!fromText.hadNL;

        
        if (fromText.hadDE || fromText.hadNL) trimLeadingWhitespaceText(leadCellSpan);

        
        if (!hadDE && !hadNL) {
          const fromPrefix = stripLeadingTextMarker(leadCellSpan);
          hadDE = hadDE || !!fromPrefix.hadDE;
          hadNL = hadNL || !!fromPrefix.hadNL;
          if (fromPrefix.hadDE || fromPrefix.hadNL) trimLeadingWhitespaceText(leadCellSpan);
        }

        
        const findEmojiAttrNode = () => {
          const candidates = [];
          candidates.push(leadCellSpan);
          try {
            if (leadCellSpan.querySelector) {
              const d = leadCellSpan.querySelector(
                '[title*="🇩🇪"],[title*="🇳🇱"],[data-original-title*="🇩🇪"],[data-original-title*="🇳🇱"]'
              );
              if (d) candidates.push(d);
            }
          } catch {
          }
          for (const n of candidates) {
            if (!n || !n.getAttribute) continue;
            const t1 = String(n.getAttribute('title') || '');
            const t2 = String(n.getAttribute('data-original-title') || '');
            if (t1.includes('🇩🇪') || t1.includes('🇳🇱') || t2.includes('🇩🇪') || t2.includes('🇳🇱')) return n;
          }
          return null;
        };

        const attrNode = findEmojiAttrNode();
        if (attrNode && attrNode.getAttribute) {
          const t1 = String(attrNode.getAttribute('title') || '');
          const t2 = String(attrNode.getAttribute('data-original-title') || '');
          hadDE = hadDE || t1.includes('🇩🇪') || t2.includes('🇩🇪');
          hadNL = hadNL || t1.includes('🇳🇱') || t2.includes('🇳🇱');

          
          try {
            if (t1) attrNode.setAttribute('title', t1.replace(/🇩🇪|🇳🇱/g, ''));
          } catch {
          }
          try {
            if (t2) attrNode.setAttribute('data-original-title', t2.replace(/🇩🇪|🇳🇱/g, ''));
          } catch {
          }
        }

        if (!hadDE && !hadNL) continue;

        
        if (leadCellSpan.removeAttribute) leadCellSpan.removeAttribute('title');

        
        try {
          if (leadCellSpan.querySelectorAll) {
            leadCellSpan.querySelectorAll(`.${LEAD_FLAG_CLASS}`).forEach((n) => n.remove());
          }
        } catch {
        }

        const flag = document.createElement('span');
        flag.className = LEAD_FLAG_CLASS;
        
        flag.style.display = 'inline-block';
        flag.style.width = '18px';
        flag.style.height = '12px';
        flag.style.marginRight = '6px';
        flag.style.verticalAlign = '-2px';
        flag.style.lineHeight = '0';

        const svg = createInlineFlagSvg(hadDE ? 'de' : 'nl');
        flag.appendChild(svg);

        if (hadDE) {
          flag.setAttribute('data-flag', 'de');
          flag.setAttribute('aria-label', 'Germany');
          settxeTooltip(flag, 'Germany');
        } else {
          flag.setAttribute('data-flag', 'nl');
          flag.setAttribute('aria-label', 'Netherlands');
          settxeTooltip(flag, 'Netherlands');
        }
        leadCellSpan.insertBefore(flag, leadCellSpan.firstChild);
        leadCellSpan.setAttribute(LEAD_FLAG_REPLACED_ATTR, '1');
        }
      }
    } finally {
      leadFlagsObserverSuppression = Math.max(0, leadFlagsObserverSuppression - 1);
    }
  }

  function styleInlineLeadFlags(candidateTables) {
    const tables = candidateTables || findCandidateTables();
    if (!tables.length) return;

    const isInlineFlagSvg = (svg) => {
      if (!svg || !svg.querySelectorAll) return false;
      try {
        if (svg.closest && svg.closest(`.${LEAD_FLAG_CLASS}`)) return false;
        const rects = Array.from(svg.querySelectorAll('rect'));
        if (!rects.length) return false;
        const fills = rects
          .map((r) => String(r.getAttribute('fill') || '').trim().toLowerCase())
          .filter(Boolean);
        const hasDE = fills.includes('#000000') && fills.includes('#dd0000') && fills.includes('#ffce00');
        const hasNL = fills.includes('#ae1c28') && fills.includes('#ffffff') && fills.includes('#21468b');
        return hasDE || hasNL;
      } catch {
        return false;
      }
    };

    for (const table of tables) {
      const rows = table.querySelectorAll('tbody tr');
      if (!rows.length) continue;
      for (const row of rows) {
        const leadCellSpan =
          row.querySelector('td.sorting_1 span') ||
          row.querySelector('td.sorting_1') ||
          row.querySelector('td:first-child span') ||
          row.querySelector('td:first-child');
        if (!leadCellSpan || !leadCellSpan.querySelectorAll) continue;

        const svgs = Array.from(leadCellSpan.querySelectorAll('svg'));
        for (const svg of svgs) {
          if (!isInlineFlagSvg(svg)) continue;
          if (svg.getAttribute(INLINE_FLAG_STYLED_ATTR) === '1') continue;
          svg.classList.add('txe-inline-flag');
          svg.setAttribute('aria-hidden', 'true');
          svg.setAttribute(INLINE_FLAG_STYLED_ATTR, '1');
          if (leadCellSpan.classList) leadCellSpan.classList.add('txe-inline-flag-wrap');
        }
      }
    }
  }

  function ensureLeadsFlagsObserver(candidateTables) {
    const tables = candidateTables || findCandidateTables();
    if (!tables.length) return;

    const looksRelevant = (value) => {
      const v = String(value || '');
      if (!v) return false;
      if (v.includes('🇩🇪') || v.includes('🇳🇱')) return true;
      if (/^\s*(DE|NL)\s+/i.test(v)) return true;
      return false;
    };

    for (const table of tables) {
      if (!table || !table.setAttribute) continue;
      if (table.getAttribute(LEAD_FLAGS_OBSERVER_ATTR) === '1') {
        if (table.getAttribute(LEAD_FLAGS_INITIALIZED_ATTR) !== '1') {
          replaceLeadIdCountryEmojiWithFlags([table]);
          table.setAttribute(LEAD_FLAGS_INITIALIZED_ATTR, '1');
        }
        continue;
      }
      if (leadFlagsObserverByTable.has(table)) {
        table.setAttribute(LEAD_FLAGS_OBSERVER_ATTR, '1');
        if (table.getAttribute(LEAD_FLAGS_INITIALIZED_ATTR) !== '1') {
          replaceLeadIdCountryEmojiWithFlags([table]);
          table.setAttribute(LEAD_FLAGS_INITIALIZED_ATTR, '1');
        }
        continue;
      }

      let scheduled = false;
      const mo = new MutationObserver((mutations) => {
        if (leadFlagsObserverSuppression > 0) return;

        let relevant = false;
        for (const m of mutations) {
          if (!m) continue;

          if (m.type === 'characterData') {
            try {
              const data = m.target && typeof m.target.data === 'string' ? m.target.data : m.target && m.target.nodeValue;
              if (looksRelevant(data)) {
                relevant = true;
                break;
              }
            } catch {
            }
          }

          if (m.type === 'attributes') {
            try {
              const name = String(m.attributeName || '');
              const val = m.target && m.target.getAttribute ? m.target.getAttribute(name) : null;
              if (looksRelevant(val)) {
                relevant = true;
                break;
              }
            } catch {
            }
          }

          if (m.type === 'childList') {
            try {
              const nodes = [];
              if (m.addedNodes && m.addedNodes.length) nodes.push(...m.addedNodes);
              if (m.removedNodes && m.removedNodes.length) nodes.push(...m.removedNodes);
              for (const n of nodes) {
                if (!n) continue;
                if (n.nodeType === 3 && looksRelevant(n.nodeValue)) {
                  relevant = true;
                  break;
                }
                if (n.nodeType === 1 && looksRelevant(n.textContent)) {
                  relevant = true;
                  break;
                }
              }
              if (relevant) break;
            } catch {
            }
          }
        }

        if (!relevant) return;
        if (scheduled) return;
        scheduled = true;
        requestAnimationFrame(() => {
          scheduled = false;
          replaceLeadIdCountryEmojiWithFlags([table]);
        });
      });

      try {
        mo.observe(table, {
          subtree: true,
          childList: true,
          characterData: true,
          attributes: true,
          attributeFilter: ['title', 'data-original-title', 'id']
        });
        leadFlagsObserverByTable.set(table, mo);
        table.setAttribute(LEAD_FLAGS_OBSERVER_ATTR, '1');
      } catch {
      }

      if (table.getAttribute(LEAD_FLAGS_INITIALIZED_ATTR) !== '1') {
        replaceLeadIdCountryEmojiWithFlags([table]);
        table.setAttribute(LEAD_FLAGS_INITIALIZED_ATTR, '1');
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

    const leadId = extractLeadIdFromPathname();
    if (!leadId) return;

    const statusEl = findStatusDisplayElement(root);
    if (!statusEl) return;

    if (root.getAttribute(STATUS_TRACKING_ATTR) === '1') return;

    let initialized = false;
    let lastStatus = null;
    let timer = null;

    function getCurrentStatus() {
      const statusSpan = root.querySelector('span.session-status');
      if (statusSpan) {
        const text = extractStatusValueFromText(statusSpan.textContent);
        if (text) return text;
      }
      return extractStatusValueFromText(statusEl.textContent);
    }

    function sendStatus(status) {
      recordLeadStatusUpdate(leadId, status);
      try {
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
          chrome.runtime.sendMessage({
            type: 'TXE_LEAD_STATUS_CHANGED',
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

    initialized = true;
    lastStatus = getCurrentStatus();

    const mo = new MutationObserver(() => scheduleCheck());
    mo.observe(root, { childList: true, subtree: true, characterData: true });

    const handleClick = (e) => {
      const t = e.target;
      if (!t) return;

      const clickedInStatus = !!(
        t.closest && (t.closest('#statusDropdown') || t.closest('[aria-labelledby="statusDropdown"]'))
      );
      if (!clickedInStatus) return;

      const clickedText = extractStatusValueFromText(t.textContent);
      sendStatus(clickedText || getCurrentStatus() || '');

      scheduleCheck();
    };

    root.addEventListener('click', handleClick, true);

    root.setAttribute(STATUS_TRACKING_ATTR, '1');
  }


  function extractCreatedDateFromTimeline() {
    const root = document.querySelector('#edit-session');
    if (!root) return null;

    const timelineCard = findCard(root, 'Timeline');
    if (!timelineCard) return null;

    const body = timelineCard.querySelector(':scope > .card-body') || timelineCard.querySelector('.card-body');
    if (!body) return null;

    
    
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

    
    const patterns = [
      /\b\d{1,2}\.\d{1,2}\.\d{4}\s+\d{1,2}:\d{2}(?::\d{2})?\b/, 
      /\b\d{4}-\d{2}-\d{2}\s+\d{1,2}:\d{2}(?::\d{2})?\b/, 
      /\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?\b/ 
    ];
    for (const re of patterns) {
      const m = rawText.match(re);
      if (m) return m[0];
    }

    
    const cleaned = ws(rawText.replace(/\b(created|created at|lead created)\b\s*:?/gi, ''));
    return cleaned || null;
  }

  function addCreatedDateToLeadTitleLine() {
    const root = document.querySelector('#edit-session');
    if (!root) return;

    const created = extractCreatedDateFromTimeline();
    if (!created) return;

    
    const headerBody = document.querySelector('.header-body');
    if (headerBody) {
      const firstHeaderRow = headerBody.querySelector('.row.align-items-center.py-4');
      if (firstHeaderRow) {
        const h6Candidates = Array.from(firstHeaderRow.querySelectorAll('h6.h2'));
        const leadH6 = h6Candidates.find((h6) => ws(h6.textContent).toLowerCase() === 'lead') || firstHeaderRow.querySelector('h6.h2');
        if (leadH6) {
          
          const container = leadH6.parentElement;
          if (container) container.classList.add(LEAD_HEADER_TITLE_CLASS);

          
          if (container && container.getAttribute(CREATED_DATE_RENDERED_ATTR) !== '1') {
            const createdH6 = document.createElement('h6');
            createdH6.className = `h2 d-inline-block mb-0 ${CREATED_DATE_CLASS}`;
            createdH6.textContent = created;

            
            container.insertBefore(createdH6, leadH6.nextSibling);
            container.setAttribute(CREATED_DATE_RENDERED_ATTR, '1');
          }
          return;
        }
      }
    }

    
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
    if (header && header.classList) header.classList.add('txe-motiv-col');

    const rows = Array.from(table.querySelectorAll('tbody tr'));
    for (const row of rows) {
      const cells = Array.from(row.querySelectorAll('td'));
      const cell = cells[motivIdx];
      if (cell && cell.classList) cell.classList.add('txe-motiv-col');
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

      
      const onkeydown = link.getAttribute('onkeydown');
      if (onkeydown) btn.setAttribute('onkeydown', onkeydown);
      const originalOnclick = link.getAttribute('onclick');
      if (originalOnclick) btn.setAttribute('onclick', originalOnclick);

      
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
      
      try {
        sidebar.style.setProperty('background', 'var(--txe-surface)', 'important');
      } catch {
      }

      try {
        const header = sidebar.querySelector('.card-header');
        if (header) header.style.setProperty('background', 'var(--txe-surface)', 'important');
      } catch {
      }

      try {
        const footer = sidebar.querySelector('.card-footer');
        if (footer) footer.style.setProperty('background', 'var(--txe-surface)', 'important');
      } catch {
      }
    }

    if (!table) return;
    applyPrecalcsTableColumnTweaks(table);
    replacePrecalcsEyeWithOpenButton();
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

  
  
  const COMMON_CALLING_CODES = [
    
    '40', 
    '49', 
    '31', 

    
    '33', 
    '39', 
    '34', 
    '44', 
    '41', 
    '43', 
    '32', 
    '45', 
    '46', 
    '47', 
    '48', 
    '30', 
    '351', 
    '353', 
    '352', 
    '36', 
    '359', 
    '420', 
    '421', 
    '385', 
    '386', 
    '381', 
    '387', 
    '382', 
    '389', 
    '355', 
    '90', 

    
    '373', 
    '7', 
    '61', 
    '64', 
    '358', 
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

    
    if (national.startsWith('0')) {
      tryAdd(`+${callingCode}${national.replace(/^0+/, '')}`);
    }

    
    for (const cc of COMMON_CALLING_CODES) {
      if (cc === callingCode) continue;
      tryAdd(`+${cc}${national}`);

      if (national.startsWith('0')) {
        tryAdd(`+${cc}${national.replace(/^0+/, '')}`);
      }
    }

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

          
          if (!parsed.isValid()) {
            errors.push(`Wrong prefix: +${cc} doesn't match these digits`);
            suggestions.push(...getPrefixSuggestions(parsed));
          }

          
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

    
    const target = (() => {
      if (!el || !el.querySelector) return el;
      if (el.tagName && String(el.tagName).toLowerCase() === 'input') return el;
      return (
        el.querySelector('input[type="tel"], input[name*="phone" i], input[id*="phone" i], a[href^="tel"], a[href*="tel" i]') ||
        el
      );
    })();

    
    target.classList.remove('border', 'border-danger', 'rounded', 'px-1', 'txe-bad-phone');
    try {
      target.removeAttribute(txe_BAD_PHONE_TOOLTIP_TEXT_ATTR);
    } catch {
    }

    if (!validation.ok) {
      target.classList.add('border', 'border-danger', 'rounded', 'px-1', 'txe-bad-phone');

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

      const msg = parts.filter(Boolean).join('\n');
      try {
        target.setAttribute(txe_BAD_PHONE_TOOLTIP_TEXT_ATTR, msg);
      } catch {
      }
    }

    return target;
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

    const nextBad = new Set();

    for (const { el, getValue } of targets) {
      const raw = getValue();
      const validation = validatePhone(raw);
      const decorated = setPhoneDecoration(el, validation);
      if (decorated && !validation.ok) nextBad.add(decorated);
    }

    badPhoneEls = nextBad;
    if (activeBadPhoneEl && !badPhoneEls.has(activeBadPhoneEl)) {
      activeBadPhoneEl = null;
      hideBadPhoneTooltip();
    }
    if (badPhoneEls.size) ensureBadPhoneTooltipListeners();
  }

  function addCountryRow() {
    
    const nativeCountrySpan = document.querySelector('#sessionObject_session_status, #edit-session span.session-status');
    if (!nativeCountrySpan) return;

    const text = String(nativeCountrySpan.textContent || '');
    if (!/country:/i.test(text)) return;

    
    if (nativeCountrySpan.getAttribute('data-txe-country-enhanced') === '1') return;
    nativeCountrySpan.setAttribute('data-txe-country-enhanced', '1');

    
    let enhanced = text;
    enhanced = enhanced.replace(/\bDE\b/g, 'Germany');
    enhanced = enhanced.replace(/\bNL\b/g, 'Netherlands');

    if (enhanced !== text) {
      nativeCountrySpan.innerHTML = enhanced.replace(
        /(Country:)\s*(\w+)/i,
        '<b>$1</b> $2'
      );
    }
  }

  const TARGET_SORT_KEYS = new Set(['utm_source', 'last_step']);
  const TARGET_TITLES = new Set(['utm source', 'last step change']);

  function isStepHeaderCell(cell) {
    if (!cell) return false;
    const dataSort = ws(cell.getAttribute('data-sort') || '').toLowerCase();
    const titleAttr = ws(cell.getAttribute('title') || '').toLowerCase();
    const text = ws(cell.textContent).toLowerCase();
    return dataSort === 'step' || titleAttr === 'step' || text === 'step';
  }

  function headerCellMatches(cell) {
    if (isStepHeaderCell(cell)) return false;

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
    let bestRow = null;
    let bestScore = -1;

    for (const row of headerRows) {
      const cells = Array.from(row.querySelectorAll('th, td'));
      if (!cells.length) continue;

      let score = 0;
      for (const cell of cells) {
        const dataSort = ws(cell.getAttribute('data-sort') || '').toLowerCase();
        const titleAttr = ws(cell.getAttribute('title') || '').toLowerCase();
        const text = ws(cell.textContent).toLowerCase();

        if (dataSort) score += 2;
        if (titleAttr) score += 1;
        if (text) score += 1;
      }

      if (score > bestScore) {
        bestScore = score;
        bestRow = row;
      }
    }

    return bestRow;
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
    const indicesSet = new Set(indicesToRemove);
    const headerRows = Array.from(table.querySelectorAll('thead tr'));
    for (const hr of headerRows) {
      const cells = Array.from(hr.querySelectorAll('th, td'));
      for (let idx = 0; idx < cells.length; idx++) {
        if (indicesSet.has(idx)) {
          cells[idx].classList.add(HIDDEN_COL_CLASS);
          try {
            cells[idx].style.display = 'none';
          } catch {
          }
        } else {
          cells[idx].classList.remove(HIDDEN_COL_CLASS);
          try {
            cells[idx].style.display = '';
          } catch {
          }
        }
      }
    }

    const bodyRows = Array.from(table.querySelectorAll('tbody tr'));
    for (const row of bodyRows) {
      const cells = Array.from(row.querySelectorAll('td, th'));
      for (let idx = 0; idx < cells.length; idx++) {
        if (indicesSet.has(idx)) {
          cells[idx].classList.add(HIDDEN_COL_CLASS);
          try {
            cells[idx].style.display = 'none';
          } catch {
          }
        } else {
          cells[idx].classList.remove(HIDDEN_COL_CLASS);
          try {
            cells[idx].style.display = '';
          } catch {
          }
        }
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
      const wrapper = baseTable.closest('.dataTables_wrapper') || baseTable.parentElement;
      const relatedTables = new Set([baseTable]);
      if (wrapper) {
        for (const t of Array.from(wrapper.querySelectorAll('table'))) {
          relatedTables.add(t);
        }
      }

      for (const t of relatedTables) {
        hideColumnsBasedOnAttributes(t);
      }
    }
  }

  function hideColumnsBasedOnAttributes(table) {
    const headerRow = getHeaderRow(table);
    if (!headerRow) return;

    const headerCells = Array.from(headerRow.querySelectorAll('th, td'));
    const indicesToHide = new Set();
    const indicesToShow = new Set();

    for (let i = 0; i < headerCells.length; i++) {
      const cell = headerCells[i];
      if (isStepHeaderCell(cell)) {
        indicesToShow.add(i);
        if (ws(cell.getAttribute('data-sort') || '').toLowerCase() !== 'step') {
          cell.setAttribute('data-sort', 'step');
        }
        cell.classList.remove(HIDDEN_COL_CLASS);
        continue;
      }
      if (headerCellMatches(cell)) indicesToHide.add(i);
    }

    for (const hr of Array.from(table.querySelectorAll('thead tr'))) {
      const headerCellsInRow = Array.from(hr.querySelectorAll('th, td'));
      for (let idx = 0; idx < headerCellsInRow.length; idx++) {
        if (indicesToShow.has(idx)) {
          headerCellsInRow[idx].classList.remove(HIDDEN_COL_CLASS);
          continue;
        }
        if (indicesToHide.has(idx)) {
          headerCellsInRow[idx].classList.add(HIDDEN_COL_CLASS);
        } else {
          headerCellsInRow[idx].classList.remove(HIDDEN_COL_CLASS);
        }
      }
    }

    for (const bodyRow of Array.from(table.querySelectorAll('tbody tr'))) {
      const bodyCells = Array.from(bodyRow.querySelectorAll('td, th'));

      for (let idx = 0; idx < bodyCells.length; idx++) {
        const bodyCell = bodyCells[idx];

        if (indicesToShow.has(idx)) {
          bodyCell.classList.remove(HIDDEN_COL_CLASS);
          continue;
        }
        if (indicesToHide.has(idx)) {
          bodyCell.classList.add(HIDDEN_COL_CLASS);
        } else {
          bodyCell.classList.remove(HIDDEN_COL_CLASS);
        }
      }
    }
  }

  function isYearsHeaderCell(cell) {
    if (!cell) return false;
    const text = ws(cell.textContent).toLowerCase();
    const dataSort = ws(cell.getAttribute('data-sort') || '').toLowerCase();
    const titleAttr = ws(cell.getAttribute('title') || '').toLowerCase();
    const ariaLabel = ws(cell.getAttribute('aria-label') || '').toLowerCase();
    return text === 'years' || text === 'year' || dataSort === 'years' || titleAttr === 'years' || ariaLabel === 'years';
  }

  function isActionHeaderCell(cell) {
    if (!cell) return false;
    const text = ws(cell.textContent).toLowerCase();
    const dataSort = ws(cell.getAttribute('data-sort') || '').toLowerCase();
    const titleAttr = ws(cell.getAttribute('title') || '').toLowerCase();
    const ariaLabel = ws(cell.getAttribute('aria-label') || '').toLowerCase();
    return text === 'action' || text === 'actions' || dataSort === 'action' || titleAttr === 'action' || ariaLabel === 'action' || ariaLabel === 'actions';
  }

  function findColumnIndexByHeader(table, predicate) {
    if (!table || typeof predicate !== 'function') return -1;
    const headerRow = getHeaderRow(table);
    if (!headerRow) return -1;

    const headerCells = Array.from(headerRow.querySelectorAll('th, td'));
    for (let i = 0; i < headerCells.length; i++) {
      if (predicate(headerCells[i])) return i;
    }
    return -1;
  }

  function moveColumnCells(rows, fromIdx, toIdx) {
    for (const row of rows) {
      const cells = Array.from(row.querySelectorAll('th, td'));
      if (!cells.length) continue;
      if (fromIdx < 0 || fromIdx >= cells.length) continue;

      let targetIdx = Math.max(0, Math.min(toIdx, cells.length));
      if (fromIdx < targetIdx) targetIdx--;

      const cell = cells[fromIdx];
      if (!cell || !cell.parentElement) continue;

      const parent = cell.parentElement;
      parent.removeChild(cell);

      const refreshed = Array.from(row.querySelectorAll('th, td'));
      if (targetIdx >= 0 && targetIdx < refreshed.length) {
        parent.insertBefore(cell, refreshed[targetIdx]);
      } else {
        parent.appendChild(cell);
      }
    }
  }

  function moveColumnWithinTable(table, fromIdx, toIdx) {
    if (!table) return;
    if (fromIdx === toIdx) return;

    const headerRows = Array.from(table.querySelectorAll('thead tr'));
    const bodyRows = Array.from(table.querySelectorAll('tbody tr'));
    const footerRows = Array.from(table.querySelectorAll('tfoot tr'));

    moveColumnCells(headerRows, fromIdx, toIdx);
    moveColumnCells(bodyRows, fromIdx, toIdx);
    moveColumnCells(footerRows, fromIdx, toIdx);
  }

  function findActionCellIndexInRow(row) {
    if (!row) return -1;
    const cells = Array.from(row.querySelectorAll('td, th'));
    if (!cells.length) return -1;

    const selectors = [
      `button[${OPEN_BTN_ATTR}="1"]`,
      'a[href*="/leads/"].btn',
      'button[onclick*="leads"]'
    ];

    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i];
      try {
        if (cell.querySelector && selectors.some((sel) => cell.querySelector(sel))) return i;
      } catch {
      }
    }

    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i];
      try {
        const candidate = cell.querySelector && cell.querySelector('button, a.btn, a');
        if (!candidate) continue;
        const text = ws(candidate.textContent).toLowerCase();
        if (text === 'open' || text === 'opened') return i;
      } catch {
      }
    }
    return -1;
  }

  function moveActionCellsToEnd(table) {
    if (!table) return;
    const rows = Array.from(table.querySelectorAll('tbody tr'));
    if (!rows.length) return;

    for (const row of rows) {
      const cells = Array.from(row.querySelectorAll('td, th'));
      if (!cells.length) continue;
      const actionIdx = findActionCellIndexInRow(row);
      if (actionIdx < 0 || actionIdx === cells.length - 1) continue;

      const cell = cells[actionIdx];
      if (!cell || !cell.parentElement) continue;
      const parent = cell.parentElement;
      parent.removeChild(cell);
      parent.appendChild(cell);
    }
  }

  function getActionCellIndexFromRow(row) {
    if (!row) return -1;
    const cells = Array.from(row.querySelectorAll('td, th'));
    if (!cells.length) return -1;
    return findActionCellIndexInRow(row);
  }

  function rowNeedsActionMove(row) {
    if (!row) return false;
    const cells = Array.from(row.querySelectorAll('td, th'));
    if (!cells.length) return false;
    const actionIdx = getActionCellIndexFromRow(row);
    return actionIdx >= 0 && actionIdx !== cells.length - 1;
  }

  function moveActionColumnAfterYears(candidateTables) {
    const tables = candidateTables || findCandidateTables();
    if (!tables.length) return;

    for (const baseTable of tables) {
      if (!baseTable) continue;
      const hasMovedAttr = baseTable.getAttribute(ACTION_COLUMN_MOVED_ATTR) === ACTION_COLUMN_MOVED_VERSION;
      const firstRow = baseTable.querySelector('tbody tr');
      const needsActionFix = firstRow ? rowNeedsActionMove(firstRow) : false;
      if (hasMovedAttr && !needsActionFix) continue;

      const wrapper = baseTable.closest('.dataTables_wrapper') || baseTable.parentElement;
      const relatedTables = new Set([baseTable]);
      if (wrapper) {
        for (const t of Array.from(wrapper.querySelectorAll('table'))) relatedTables.add(t);
      }

      for (const t of relatedTables) {
        const headerRow = getHeaderRow(t);
        if (headerRow) {
          const headerCells = Array.from(headerRow.querySelectorAll('th, td'));
          if (headerCells.length) {
            const actionIdx = headerCells.findIndex(isActionHeaderCell);
            const yearsIdx = headerCells.findIndex(isYearsHeaderCell);

            if (actionIdx >= 0 && yearsIdx >= 0) {
              const targetIdx = headerCells.length;
              if (actionIdx !== headerCells.length - 1) {
                moveColumnWithinTable(t, actionIdx, targetIdx);
                statusColumnIndexCache.delete(t);
              } else {
                moveActionCellsToEnd(t);
              }
              continue;
            }
          }
        }

        moveActionCellsToEnd(t);
      }

      baseTable.setAttribute(ACTION_COLUMN_MOVED_ATTR, ACTION_COLUMN_MOVED_VERSION);
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

          
          applyKnownStatusesToVisibleRows();
        });
      }
    } catch {
    }
  }

  function enhanceNativeOpenButtons(candidateTables) {
    loadOpenedLeadIdsOnce();

    const tables = candidateTables || findCandidateTables();
    if (!tables.length) return;

    for (const table of tables) {
      
      const tds = table.querySelectorAll(`tbody td.text-center:not([${OPEN_BUTTON_REPLACED_ATTR}="1"])`);
      for (const td of tds) {
        
        const btn = td.querySelector('a[href*="/leads/"].btn, button[onclick*="leads"]');
        if (!btn) continue;

        
        let href = btn.getAttribute('href');
        if (!href) {
          const onclick = btn.getAttribute('onclick') || '';
          const match = onclick.match(/\/leads\/\d+/);
          if (match) href = match[0];
        }
        if (!href || !looksLikeLeadDetailsHref(href)) continue;

        const leadId = extractLeadIdFromHref(href);
        if (!leadId) continue;

        
        btn.setAttribute(OPEN_BTN_ATTR, '1');
        btn.setAttribute(OPEN_BTN_LEAD_ID_ATTR, leadId);

        
        if (openedLeadIds.has(String(leadId))) {
          setOpenedButtonUI(btn);
        }

        
        const originalHref = href;
        btn.addEventListener(
          'click',
          (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (leadId) markLeadAsOpened(leadId, btn);
            window.open(originalHref, '_blank');
          },
          true
        );

        td.setAttribute(OPEN_BUTTON_REPLACED_ATTR, '1');
      }
    }
  }

  function applyAll() {
    if (!hostWhitelisted) return;

    if (!domReady) {
      if (!domReadyListenerAttached) {
        domReadyListenerAttached = true;
        document.addEventListener('DOMContentLoaded', () => {
          domReady = true;
          applyAll();
        }, { once: true, passive: true });
      }
      return;
    }

    if (!stylesAndThemeApplied) {
      stylesAndThemeApplied = true;
      ensureStyles();
      const storedTheme = getStoredTheme();
      applyTheme(storedTheme);
      loadStoredThemeOnce().then((v) => {
        if (v === 'dark' || v === 'light') applyTheme(v);
      });
      deferNonCritical(() => {
        ensureLegacyPurpleReplacements();
        ensureThemeToggle();
        ensureWhiteBrandLogo();
        ensureNavbarUserIcon();
        ensureSidenavToggleFallback();
      });
    }

    if (isPrecalcsListPage()) {
      applyPrecalcsEnhancements();
    }

    if (!isLeadsArea()) return;

    if (isLeadsListPage()) {
      const candidateTables = findCandidateTables();
      moveActionColumnAfterYears(candidateTables);
      hideColumnsInDataTables(candidateTables);
      enhanceNativeOpenButtons(candidateTables);
      ensureLeadsFlagsObserver(candidateTables);
      styleInlineLeadFlags(candidateTables);
      removeLeadIdYearsHoverAndBeautify(candidateTables);
      setupLeadsListLiveStatusUpdates(candidateTables);
      adjustDataTablesSizing();
    }

    if (isLeadDetailsPage()) {
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

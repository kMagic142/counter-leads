(() => {
  const TARGET_TITLE = 'Taxe Dashboard | Leads';
  const ALLOWED_HOSTS = new Set(['dashboard.taxe.ro', 'taxe.amdav.ro']);

  const HIDDEN_COL_CLASS = 'copilot-hidden-dt-col';
  const OPEN_BUTTON_REPLACED_ATTR = 'data-copilot-open-replaced';
  const STYLE_ID = 'copilot-taxe-leads-tweaks-style';
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

  const SUSPICIOUS_CALLING_CODES = [
    { code: '234', label: 'Nigeria' },
    { code: '880', label: 'Bangladesh' },
    { code: '91', label: 'India' },
  ].sort((a, b) => b.code.length - a.code.length);

  function ws(s) {
    return String(s || '').replace(/\s+/g, ' ').trim();
  }

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .${HIDDEN_COL_CLASS} { display: none !important; }

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
    `;
    document.documentElement.appendChild(style);
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
          flag.title = 'Germany';
          flag.setAttribute('aria-label', 'Germany');
        } else {
          flag.setAttribute('data-flag', 'nl');
          flag.title = 'Netherlands';
          flag.setAttribute('aria-label', 'Netherlands');
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

  function findSuspiciousCallingCode(digitsOnly) {
    if (!digitsOnly) return null;
    for (const entry of SUSPICIOUS_CALLING_CODES) {
      if (digitsOnly.startsWith(entry.code)) return entry;
    }
    return null;
  }

  function validatePhone(raw) {
    const { original, cleaned, digitsOnly } = normalizePhone(raw);
    const e164 = `+${digitsOnly}`;
    const errors = [];

    if (!original) {
      return { ok: false, errors: ['Phone number is empty'], cleaned, e164 };
    }

    if (!digitsOnly) {
      return { ok: false, errors: ['Phone number contains no digits'], cleaned, e164 };
    }

    if (digitsOnly.length < 8) errors.push('Phone number is too short');
    if (digitsOnly.length > 15) errors.push('Phone number is too long');

    if (!/^\+[1-9]\d{7,14}$/.test(e164)) {
      errors.push('Invalid international format');
    }

    const suspicious = findSuspiciousCallingCode(digitsOnly);
    if (suspicious) {
      errors.push(`Suspicious country prefix (+${suspicious.code} ${suspicious.label})`);
    }

    return { ok: errors.length === 0, errors, cleaned, e164 };
  }

  function setPhoneDecoration(el, validation) {
    if (!el) return;

    el.classList.remove('border', 'border-danger', 'rounded', 'px-1');
    el.removeAttribute('title');

    if (!validation.ok) {
      el.classList.add('border', 'border-danger', 'rounded', 'px-1');
      el.setAttribute('title', validation.errors.join(' | '));
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
    if (!isLeadsArea()) return;
    ensureStyles();

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
    if (!isLeadsArea()) return;
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

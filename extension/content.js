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
  const OPEN_BTN_ATTR = 'data-copilot-open-btn';
  const OPEN_BTN_LEAD_ID_ATTR = 'data-copilot-open-btn-lead-id';
  const MAX_OPENED_LEADS = 5000;

  let openedLeadIds = new Set();
  let openedLeadIdsLoadPromise = null;

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
        filter: brightness(1.25) saturate(0.9);
        opacity: 0.85;
      }

      #leads-table_wrapper button.${OPENED_BTN_CLASS}:hover,
      .dataTables_wrapper button.${OPENED_BTN_CLASS}:hover {
        filter: none;
        opacity: 1;
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
    `;
    document.documentElement.appendChild(style);
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

    if (btn && btn.classList) {
      btn.classList.add(OPENED_BTN_CLASS);
    }
  }

  function refreshOpenButtonsOpenedState() {
    const btns = Array.from(document.querySelectorAll(`button[${OPEN_BTN_ATTR}="1"]`));
    for (const btn of btns) {
      const leadId = btn.getAttribute(OPEN_BTN_LEAD_ID_ATTR);
      if (leadId && openedLeadIds.has(String(leadId))) {
        btn.classList.add(OPENED_BTN_CLASS);
      }
    }
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

  function hideColumnsInDataTables() {
    const candidateTables = findCandidateTables();
    if (!candidateTables.length) return;

    for (const baseTable of candidateTables) {
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

  function replaceEyeWithOpenButton() {
    loadOpenedLeadIdsOnce();

    const candidateTables = findCandidateTables();
    if (!candidateTables.length) return;

    for (const table of candidateTables) {
      const tds = Array.from(table.querySelectorAll('tbody td.text-center'));
      for (const td of tds) {
        if (td.getAttribute(OPEN_BUTTON_REPLACED_ATTR) === '1') continue;

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
          btn.classList.add(OPENED_BTN_CLASS);
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
      hideColumnsInDataTables();
      replaceEyeWithOpenButton();
      adjustDataTablesSizing();
    }

    if (isLeadDetailsPage()) {
      // Visiting the details page counts as "opened".
      loadOpenedLeadIdsOnce();
      const leadId = extractLeadIdFromPathname();
      if (leadId) markLeadAsOpened(leadId);

      inlineCards();
      pairLeadDetails();
      ensureStatusLabel();
      addCountryRow();
      validatePhones();
      setupTimelineToggle();
    }
  }

  applyAll();

  let scheduled = false;
  const observer = new MutationObserver(() => {
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

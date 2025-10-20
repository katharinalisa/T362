window.addEventListener('load', () => {
  const table = document.getElementById('epicTable');
  const tbody = table?.querySelector('tbody');
  const rowTmpl = document.getElementById('epicRowTemplate');

  const yearsEl = document.getElementById('yearsPeriod');
  const addBtn  = document.getElementById('addRowBtn');
  const clearBtn= document.getElementById('clearAllBtn');


  // === Progress helper (localStorage) ===
  function markStepComplete(stepKey) {
    let completed = JSON.parse(localStorage.getItem("completedSteps") || "[]");
    if (!completed.includes(stepKey)) {
      completed.push(stepKey);
      localStorage.setItem("completedSteps", JSON.stringify(completed));
    }
  }
  const saveBtn = document.getElementById('saveEpicBtn');
  const backBtn = document.getElementById('backBtn');
  const loadBtn = document.getElementById('loadBtn');
  const saveAndNextBtn = document.getElementById('saveAndNextBtn');

  const grandTotalEl = document.getElementById('grandTotal');

  if (!tbody || !rowTmpl) return;

  const AUD = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'AUD', minimumFractionDigits: 0 });
  const num = (v) => {
    const n = parseFloat(String(v ?? '').replace(/[^\d.-]/g, ''));
    return Number.isFinite(n) ? n : 0;
  };
  const setCurr = (el, val) => el.textContent = AUD.format(val || 0);

  // Helper: detect blank/placeholder frequency
  const isBlankFreq = (el) => {
    if (!el) return true;
    const v = String(el.value || '').trim().toLowerCase();
    return !v || v.startsWith('-- select');
  };

  function addRow(prefill = {}) {
    const frag = rowTmpl.content.cloneNode(true);
    const row  = frag.querySelector('tr.epic-row');
    if (prefill.id) row.dataset.id = prefill.id;

    row.querySelector('.item').value      = prefill.item ?? '';
    row.querySelector('.amount').value    = prefill.amount ?? '';
    row.querySelector('.freq').value      = prefill.frequency ?? 'Once only';
    row.querySelector('.include').checked = prefill.include !== false;

    tbody.appendChild(frag);
  }

  function clearAll() {
    tbody.innerHTML = '';
    addRow();
    recalcAll();
  }

  function rowMultiplier(freq, years) {
    const yrs = Number.isFinite(years) ? years : num(years);
    const y = Math.max(0, Math.floor(yrs));
    const f = String(freq || '').trim().toLowerCase();

    if (!f || f.startsWith('-- select')) return 0; // no selection -> 0×
    if (f.startsWith('once')) return 1;
    if (f.includes('every second')) return Math.floor(y / 2);
    if (f.includes('every year')) return y;

    return 0; // unknown -> 0×
  }

  function recalcRow(row) {
    const amtEl = row.querySelector('.amount');
    const rawAmt = (amtEl && Number.isFinite(amtEl.valueAsNumber)) ? amtEl.valueAsNumber : num(amtEl?.value);
    const freq = row.querySelector('.freq')?.value;
    const inc  = !!row.querySelector('.include')?.checked;
    const mult = rowMultiplier(freq, yearsEl ? yearsEl.value : 0);
    const total = inc ? (rawAmt * mult) : 0;
    const safeTotal = Number.isFinite(total) ? total : 0;
    setCurr(row.querySelector('.total'), safeTotal);
    return safeTotal;
  }

  function recalcAll() {
    let sum = 0;
    tbody.querySelectorAll('tr.epic-row').forEach(row => {
      const val = recalcRow(row);
      sum += Number.isFinite(val) ? val : 0;
    });
    setCurr(grandTotalEl, sum);
  }

  // Events
  tbody.addEventListener('input', (e) => {
    if (!e.target) return;
    const t = e.target;
    const cls = t.classList;

    // While typing amount: cap to 2 decimals and auto-assign frequency if blank
    if (cls.contains('amount')) {
      const val = String(t.value || '');
      if (val.includes('.')) {
        const [w, d=''] = val.split('.');
        if (d.length > 2) t.value = `${w}.${d.slice(0,2)}`;
      }
      const row = t.closest('tr.epic-row');
      const freqEl = row?.querySelector('.freq');
      if (isBlankFreq(freqEl) && Number.isFinite(t.valueAsNumber)) {
        freqEl.value = 'Once only';
      }
    }

    if (cls.contains('item') || cls.contains('amount') || cls.contains('freq') || cls.contains('include')) {
      recalcAll();
    }
    if (t.tagName === 'SELECT') recalcAll(); // some browsers don't fire input for selects
  });
  tbody.addEventListener('change', (e) => {
    if (!e.target) return;
    const cls = e.target.classList;
    if (cls.contains('freq') || cls.contains('include')) recalcAll();
  });
  // Normalise number formatting on blur (2dp)
  tbody.addEventListener('blur', (e) => {
    const t = e.target;
    if (!t) return;
    if (t.classList.contains('amount')) {
      const n = Number.isFinite(t.valueAsNumber) ? t.valueAsNumber : num(t.value);
      if (Number.isFinite(n)) t.value = n.toFixed(2);
      recalcAll();
    }
  }, true);
  tbody.addEventListener('click', (e) => {
    const btn = e.target.closest('.remove-row');
    if (!btn) return;
    const row = btn.closest('tr.epic-row');
    if (row) row.remove();
    // Keep at least one row visible
    if (!tbody.querySelector('tr.epic-row')) addRow();
    recalcAll();
  });

  yearsEl.addEventListener('input', recalcAll);
  yearsEl.addEventListener('change', recalcAll);
  yearsEl.addEventListener('blur', () => {
    let y = Math.floor(num(yearsEl.value));
    if (!Number.isFinite(y) || y < 1) y = 1;
    yearsEl.value = y;
    recalcAll();
  });

  addBtn?.addEventListener('click', () => { addRow(); recalcAll(); });
  clearBtn?.addEventListener('click', clearAll);

  function collectItems() {
    return [...tbody.querySelectorAll('tr.epic-row')].map(row => ({
      item: row.querySelector('.item')?.value?.trim() || '',
      amount: num(row.querySelector('.amount')?.value),
      frequency: row.querySelector('.freq')?.value || 'Once only',
      include: !!row.querySelector('.include')?.checked,
    }));
  }

  // DB I/O
  async function saveAll({ redirectAfter = false, nextUrl = null } = {}) {
    const items = collectItems();
    const settings = { years: Math.max(1, Math.floor(num(yearsEl.value))) };

    const primaryUrl = table?.dataset?.saveUrl || '/save-epic';
    const fallbackUrl = window.location?.pathname || '/epic';

    try {
      let res = await fetch(primaryUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings, items })
      });

      if (res.status === 401) {
        alert('Please log in to save.');
        window.location.href = '/login';
        return;
      }
      if (res.status === 404 && primaryUrl !== fallbackUrl) {
        res = await fetch(fallbackUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ settings, items })
        });
      }
      if (!res.ok) {
        let msg = '';
        try { msg = await res.text(); } catch {}
        alert(`Save failed. (HTTP ${res.status}) ${msg || ''}`.trim());
        return;
      }

      const data = await res.json();
      if (redirectAfter) {
        const target = nextUrl || data?.redirect;
        if (target) { window.location.href = target; return; }
      }
      alert(data?.message || 'Saved.');
    } catch (err) {
      alert(`Save failed. ${err?.message ? '(' + err.message + ')' : ''}`);
    }
  }


  // Back button
  backBtn?.addEventListener('click', () => history.back());

  // Save (no navigation)
  saveBtn?.addEventListener('click', async () => {
    const original = saveBtn.textContent;
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';
    try {
      await saveAll({ redirectAfter: false });
      markStepComplete('epic');
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = original;
    }
  });

  // Load
  loadBtn?.addEventListener('click', async () => {
    const original = loadBtn.textContent;
    loadBtn.disabled = true;
    loadBtn.textContent = 'Loading…';
    try {
      await loadAll();
    } finally {
      loadBtn.disabled = false;
      loadBtn.textContent = original;
    }
  });

  // Save & Next (redirect if backend provides redirect)
  saveAndNextBtn?.addEventListener('click', async () => {
    const original = saveAndNextBtn.textContent;
    saveAndNextBtn.disabled = true;
    saveAndNextBtn.textContent = 'Saving…';
    try {
      const nextUrl = saveAndNextBtn.dataset?.nextUrl || null;
      await saveAll({ redirectAfter: true, nextUrl });
      markStepComplete('epic');
    } finally {
      saveAndNextBtn.disabled = false;
      saveAndNextBtn.textContent = original;
    }
  });

  function initFromPrefill() {
    const pre = (window && Array.isArray(window.epicPrefill)) ? window.epicPrefill : null;
    const preYears = (window && typeof window.epicYears === 'number') ? window.epicYears : null;

    // If prefill is missing OR an empty array, treat as no prefill so defaults can load.
    if (!pre || pre.length === 0) {
      if (preYears != null && yearsEl) yearsEl.value = preYears;
      return false;
    }
    tbody.innerHTML = '';
    if (preYears != null && yearsEl) yearsEl.value = preYears;
    pre.forEach(addRow);
    if (!tbody.children.length) clearAll();
    recalcAll();
    return true;
  }

  function showDefaultEpicItems() {
    const DEFAULT_EPIC_ITEMS = [
      '3-month sabbatical',
      'Caravan trip around Australia',
      'Renovate kitchen',
      'Round-the-world cruise',
      'Family reunion overseas',
      'New car purchase',
      'Home renovations',
      'Major medical expenses',
      'Pay off outstanding debts',
      'Epic holiday/travel'
    ];
    tbody.innerHTML = '';
    DEFAULT_EPIC_ITEMS.forEach(label => addRow({ item: label, frequency: 'Once only', include: true }));
    recalcAll();
  }

  if (!initFromPrefill()) {
    showDefaultEpicItems(); // Display default list for user on first load
  }

  recalcAll();
});

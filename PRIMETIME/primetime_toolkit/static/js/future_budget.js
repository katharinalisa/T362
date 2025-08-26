// static/js/future_budget.js
(() => {
  // ===== DOM =====
  const table = document.getElementById('futureBudgetTable');
  const tbody = table?.querySelector('tbody');
  const rowTemplate = document.getElementById('futureRowTemplate');

  const addRowBtn  = document.getElementById('addRowBtn');
  const clearBtn   = document.getElementById('clearAllBtn');
  const saveBtn    = document.getElementById('saveBtn');
  const loadBtn    = document.getElementById('loadBtn');

  const elTotalYears   = document.getElementById('totalYears');
  const elLifetimeTotal= document.getElementById('lifetimeTotal');

  if (!tbody || !rowTemplate) return;

  // ===== Constants =====
  const PHASE_AGE = {
    'set-up': '45–50',
    'lifestyling': '50–60',
    'part-timing': '60–65',
    'epic retirement': '65–75',
    'passive retirement/ageing': '75–85',
    'frailty': '85–95',
  };

  const AUD = new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });

  // ===== Utils =====
  const parseNum = (v) => {
    const n = parseFloat(String(v ?? '').replace(/[^\d.-]/g, ''));
    return Number.isFinite(n) ? n : 0;
  };

  const setCurrency = (el, amount) => { el.textContent = AUD.format(amount || 0); };

  // ===== Row helpers =====
  function addRow(prefill = {}) {
    const frag = rowTemplate.content.cloneNode(true);
    const row  = frag.querySelector('tr.future-row');

    if (prefill.id) row.dataset.id = prefill.id;
    if (prefill.phase)     row.querySelector('.phase').value      = prefill.phase;
    if (prefill.age_range) row.querySelector('.age-range').value  = prefill.age_range;
    if (prefill.years!=null)    row.querySelector('.years').value    = prefill.years;
    if (prefill.baseline!=null) row.querySelector('.baseline').value = prefill.baseline;
    if (prefill.oneoff!=null)   row.querySelector('.oneoff').value   = prefill.oneoff;
    if (prefill.epic!=null)     row.querySelector('.epic').value     = prefill.epic;

    tbody.appendChild(frag);
  }

  function prefillSix() {
    [
      { phase: 'Set-up',                 age_range: '45–50' },
      { phase: 'Lifestyling',            age_range: '50–60' },
      { phase: 'Part-timing',            age_range: '60–65' },
      { phase: 'Epic retirement',        age_range: '65–75' },
      { phase: 'Passive retirement/ageing', age_range: '75–85' },
      { phase: 'Frailty',                age_range: '85–95' },
    ].forEach(addRow);
  }

  function clearAll() {
    tbody.innerHTML = '';
    prefillSix();
    recalcAll();
  }

  // ===== Calculations =====
  function recalcRow(row) {
    const baseline = parseNum(row.querySelector('.baseline')?.value);
    const oneoff   = parseNum(row.querySelector('.oneoff')?.value);
    const epic     = parseNum(row.querySelector('.epic')?.value);
    const annual   = baseline + oneoff + epic;
    setCurrency(row.querySelector('.annual'), annual);
    return annual;
  }

  function recalcAll() {
    let yearsTotal = 0;
    let lifetime   = 0;

    tbody.querySelectorAll('tr.future-row').forEach((row) => {
      const years  = parseNum(row.querySelector('.years')?.value);
      const annual = recalcRow(row);
      yearsTotal += years;
      lifetime   += years * annual;
    });

    elTotalYears.textContent = yearsTotal || 0;
    setCurrency(elLifetimeTotal, lifetime);
  }

  // ===== Events (delegate to tbody) =====
  function onTbodyInput(e) {
    const t = e.target;
    if (!t) return;

    if (t.classList.contains('phase')) {
      const key = (t.value || '').trim().toLowerCase();
      const row = t.closest('tr.future-row');
      if (row) row.querySelector('.age-range').value = PHASE_AGE[key] || '';
    }

    if (
      t.classList.contains('phase')     ||
      t.classList.contains('years')     ||
      t.classList.contains('baseline')  ||
      t.classList.contains('oneoff')    ||
      t.classList.contains('epic')
    ) recalcAll();
  }

  function onTbodyClick(e) {
    const btn = e.target.closest('.remove-row');
    if (!btn) return;
    const row = btn.closest('tr.future-row');
    if (row) row.remove();
    if (tbody.children.length === 0) prefillSix();
    recalcAll();
  }

  // ===== DB I/O =====
  async function saveAll() {
    const items = [...tbody.querySelectorAll('tr.future-row')].map(row => ({
      id: row.dataset.id || null,
      phase:     row.querySelector('.phase')?.value?.trim()      || '',
      age_range: row.querySelector('.age-range')?.value?.trim()  || '',
      years:     parseNum(row.querySelector('.years')?.value),
      baseline:  parseNum(row.querySelector('.baseline')?.value),
      oneoff:    parseNum(row.querySelector('.oneoff')?.value),
      epic:      parseNum(row.querySelector('.epic')?.value),
    }));

    try {
      const res = await fetch('/api/future_budget/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items })
      });
      if (!res.ok) throw new Error('Save failed');
      alert('Saved.');
    } catch (err) {
      console.error(err);
      alert('Could not save. Check server logs.');
    }
  }

  async function loadAll() {
    try {
      const res = await fetch('/api/future_budget');
      if (!res.ok) throw new Error('Load failed');
      const rows = await res.json();
      tbody.innerHTML = '';
      if (!rows.length) { prefillSix(); recalcAll(); return; }
      rows.forEach(addRow);
      recalcAll();
    } catch (err) {
      console.warn('Falling back to defaults:', err);
      clearAll();
    }
  }

  // ===== Wire buttons & init =====
  addRowBtn?.addEventListener('click', () => { addRow(); recalcAll(); });
  clearBtn ?.addEventListener('click', clearAll);
  saveBtn  ?.addEventListener('click', () => { void saveAll(); });
  loadBtn  ?.addEventListener('click', () => { void loadAll(); });

  tbody.addEventListener('input',  onTbodyInput);
  tbody.addEventListener('change', onTbodyInput);
  tbody.addEventListener('click',  onTbodyClick);

  // Init on DOM ready (no top-level await needed)
  document.addEventListener('DOMContentLoaded', () => {
    loadAll(); // if API empty/unavailable, we fallback inside loadAll()
  });
})();

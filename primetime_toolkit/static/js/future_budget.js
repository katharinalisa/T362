(() => {
  // ===== DOM =====
  const table = document.getElementById('futureBudgetTable');
  const tbody = table?.querySelector('tbody');
  const rowTemplate = document.getElementById('futureRowTemplate');
  const addRowBtn = document.getElementById('addRowBtn');
  const clearAllBtn = document.getElementById('clearAllBtn');
  const saveAndNextBtn = document.getElementById('saveAndNextBtn');
  const saveBtn = document.getElementById('saveFutureBudgetBtn');

  const totalYearsEl = document.getElementById('totalYears');
  const lifetimeTotalEl = document.getElementById('lifetimeTotal');

  if (!table || !tbody || !rowTemplate) return; // safety

  // ===== Utils =====
  const AUD = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 });
  const parseNum = (v) => {
    const n = parseFloat(String(v ?? '').replace(/[^\d.-]/g, ''));
    return Number.isFinite(n) ? n : 0;
  };
  const setCurrency = (el, n) => { if (el) el.textContent = AUD.format(n || 0); };

  // Optional hint when phase changes (edit to taste)
  const PHASE_AGE_HINT = {
    'Set-up': '25–35',
    'Lifestyling': '35–50',
    'Part-timing': '50–60',
    'Epic retirement': '60–70',
    'Passive retirement/ageing': '70–80',
    'Frailty': '80+'
  };

  // ===== Rows =====
  function addRow(prefill = {}) {
    const frag = rowTemplate.content.cloneNode(true);
    const row  = frag.querySelector('tr.future-row');

    // Expected classes in the template:
    // .phase .age_range .years .baseline .oneoff .epic  and a cell .annual
    row.querySelector('.phase').value      = prefill.phase ?? '';
    row.querySelector('.age_range').value  = prefill.age_range ?? '';
    row.querySelector('.years').value      = prefill.years_in_phase ?? prefill.years ?? '';
    row.querySelector('.baseline').value   = prefill.baseline_cost ?? prefill.baseline ?? '';
    row.querySelector('.oneoff').value     = prefill.oneoff_costs ?? prefill.oneoff ?? '';
    row.querySelector('.epic').value       = prefill.epic_experiences ?? prefill.epic ?? '';

    tbody.appendChild(frag);
  }

  function clearAll() {
    tbody.innerHTML = '';
    addRow();
    recalcAll();
  }

  // ===== Calculations =====
  function annualForRow(row) {
    const baseline = parseNum(row.querySelector('.baseline')?.value);
    const oneoff   = parseNum(row.querySelector('.oneoff')?.value);
    const epic     = parseNum(row.querySelector('.epic')?.value);
    return baseline + oneoff + epic;
  }

  function recalcAll() {
    let yearsTotal = 0;
    let lifetimeTotal = 0;

    tbody.querySelectorAll('tr.future-row').forEach(row => {
      const annual = annualForRow(row);
      setCurrency(row.querySelector('.annual'), annual);

      const years = parseNum(row.querySelector('.years')?.value);
      yearsTotal += years;
      lifetimeTotal += annual * years;
    });

    if (totalYearsEl) totalYearsEl.textContent = `${yearsTotal}`;
    setCurrency(lifetimeTotalEl, lifetimeTotal);
  }

  // ===== Gather payload =====
  function collectRows() {
    return Array.from(tbody.querySelectorAll('tr.future-row')).map(row => {
      const baseline = parseNum(row.querySelector('.baseline')?.value);
      const oneoff   = parseNum(row.querySelector('.oneoff')?.value);
      const epic     = parseNum(row.querySelector('.epic')?.value);
      const annual   = baseline + oneoff + epic;

      return {
        phase: row.querySelector('.phase')?.value?.trim() || '',
        age_range: row.querySelector('.age_range')?.value?.trim() || '',
        years_in_phase: parseNum(row.querySelector('.years')?.value),
        baseline_cost: baseline,
        oneoff_costs: oneoff,
        epic_experiences: epic,
        total_annual_budget: annual
      };
    });
  }

  // ===== Events =====
  function onTbodyInput(e) {
    const t = e.target;
    if (!t) return;

    if (t.classList.contains('phase')) {
      const row = t.closest('tr.future-row');
      const age = row?.querySelector('.age_range');
      if (age && !age.value) {
        age.value = PHASE_AGE_HINT[t.value?.trim()] || '';
      }
    }

    if (
      t.classList.contains('phase') ||
      t.classList.contains('age_range') ||
      t.classList.contains('years') ||
      t.classList.contains('baseline') ||
      t.classList.contains('oneoff') ||
      t.classList.contains('epic')
    ) {
      recalcAll();
    }
  }

  function onTbodyClick(e) {
    const btn = e.target.closest('.remove-row');
    if (!btn) return;
    const row = btn.closest('tr.future-row');
    if (row) row.remove();
    if (!tbody.querySelector('tr.future-row')) addRow();
    recalcAll();
  }

  addRowBtn?.addEventListener('click', () => { addRow(); recalcAll(); });
  clearAllBtn?.addEventListener('click', clearAll);
  tbody.addEventListener('input', onTbodyInput);
  tbody.addEventListener('change', onTbodyInput);
  tbody.addEventListener('click', onTbodyClick);

  // ===== Save helpers =====
  async function saveAll() {
    const budgets = collectRows();
    try {
      const res = await fetch('/save-future-budget', {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({ budgets })
      });
      if (res.status === 401) {
        alert('Please log in to save your Future Budget.');
        window.location.href = '/login';
        return null;
      }
      if (!res.ok) throw new Error();
      return await res.json(); // { message, redirect? }
    } catch {
      alert('Error saving Future Budget.');
      return null;
    }
  }

  // Save & Next: redirects only if backend provides `redirect`
  saveAndNextBtn?.addEventListener('click', async () => {
    const original = saveAndNextBtn.textContent;
    saveAndNextBtn.disabled = true;
    saveAndNextBtn.textContent = 'Saving…';
    try {
      const data = await saveAll();
      if (data?.redirect) {
        window.location.href = data.redirect; // e.g., /epic or next step
      } else if (data) {
        alert(data.message || 'Future Budget saved!');
      }
    } finally {
      saveAndNextBtn.disabled = false;
      saveAndNextBtn.textContent = original;
    }
  });

  // Top Save button: save without navigation
  saveBtn?.addEventListener('click', async () => {
    const original = saveBtn.textContent;
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';
    try {
      const data = await saveAll();
      if (data && !data.redirect) {
        alert(data.message || 'Future Budget saved!');
      }
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = original;
    }
  });

  // ===== Init (prefill like assets/subscriptions) =====
  tbody.innerHTML = '';
  if (Array.isArray(window.futureBudgetPrefill) && window.futureBudgetPrefill.length > 0) {
    window.futureBudgetPrefill.forEach(addRow);
  } else {
    addRow();
  }
  recalcAll();
})();
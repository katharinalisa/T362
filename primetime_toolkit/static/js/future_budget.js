(() => {
  // Elements
  const table   = document.getElementById('futureBudgetTable');
  const tbody   = table?.querySelector('tbody');
  const rowTpl  = document.getElementById('futureRowTemplate');

  const addBtn      = document.getElementById('addRowBtn');
  const clearBtn    = document.getElementById('clearAllBtn');
  const saveBtn     = document.getElementById('saveAndNextBtn');

  const totalYearsEl   = document.getElementById('totalYears');
  const lifetimeTotalEl= document.getElementById('lifetimeTotal');

  if (!table || !tbody || !rowTpl) return;

  // Helpers
  const AUD = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'AUD', minimumFractionDigits: 0 });
  const parseNum = (v) => {
    const n = parseFloat(String(v ?? '').replace(/[^\d.-]/g, ''));
    return Number.isFinite(n) ? n : 0;
  };

  // Optional phase → example age range mapping (only used to auto-fill read-only field when phase changes)
  const PHASE_AGE_HINT = {
    'Set-up': '25–35',
    'Lifestyling': '35–50',
    'Part-timing': '50–60',
    'Epic retirement': '60–70',
    'Passive retirement/ageing': '70–80',
    'Frailty': '80+'
  };

  // ----- Row ops -----
  function addRow(prefill = {}) {
    const frag = rowTpl.content.cloneNode(true);
    const row  = frag.querySelector('tr.future-row');

    if (prefill.id) row.dataset.id = prefill.id;

    const phaseEl    = row.querySelector('.phase');
    const ageEl      = row.querySelector('.age-range');
    const yearsEl    = row.querySelector('.years');
    const baseEl     = row.querySelector('.baseline');
    const oneoffEl   = row.querySelector('.oneoff');
    const epicEl     = row.querySelector('.epic');

    phaseEl.value  = prefill.phase ?? '';
    // If API provided age_range use it; else leave blank until user picks a phase
    ageEl.value    = prefill.age_range ?? '';
    yearsEl.value  = prefill.years ?? '';
    baseEl.value   = prefill.baseline ?? '';
    oneoffEl.value = prefill.oneoff ?? '';
    epicEl.value   = prefill.epic ?? '';

    tbody.appendChild(frag);
  }

  function clearAll() {
    tbody.innerHTML = '';
    // ✅ Always keep one blank starter row
    addRow();
    recalcAll();
  }

  // ----- Calculations -----
  function annualFromRow(row) {
    const baseline = parseNum(row.querySelector('.baseline')?.value);
    const oneoff   = parseNum(row.querySelector('.oneoff')?.value);
    const epic     = parseNum(row.querySelector('.epic')?.value);
    return baseline + oneoff + epic;
  }

  function recalcRow(row) {
    const annual = annualFromRow(row);
    row.querySelector('.annual').textContent = AUD.format(annual);
    return annual;
  }

  function recalcAll() {
    let sumYears = 0;
    let lifetime = 0;

    tbody.querySelectorAll('tr.future-row').forEach(row => {
      const annual = recalcRow(row);
      const years  = parseNum(row.querySelector('.years')?.value);
      sumYears += years;
      lifetime += annual * years;
    });

    totalYearsEl.textContent    = `${sumYears}`;
    lifetimeTotalEl.textContent = AUD.format(lifetime);
  }

  // ----- Events -----
  // Delegate inputs for recalculation
  tbody.addEventListener('input', (e) => {
    const t = e.target;
    if (!t) return;

    // Auto-fill Age range when phase changes (optional hint only)
    if (t.classList.contains('phase')) {
      const row = t.closest('tr.future-row');
      const ageEl = row?.querySelector('.age-range');
      if (ageEl) {
        const hint = PHASE_AGE_HINT[t.value?.trim()] || '';
        // only set hint if user hasn't typed anything (read-only field anyway)
        ageEl.value = hint;
      }
    }

    if (
      t.classList.contains('phase') ||
      t.classList.contains('years') ||
      t.classList.contains('baseline') ||
      t.classList.contains('oneoff') ||
      t.classList.contains('epic')
    ) {
      recalcAll();
    }
  });

  // Remove row
  tbody.addEventListener('click', (e) => {
    const btn = e.target.closest('.remove-row');
    if (!btn) return;
    const row = btn.closest('tr.future-row');
    row?.remove();
    if (!tbody.querySelectorAll('tr.future-row').length) {
      clearAll(); // keep one starter row minimum
    } else {
      recalcAll();
    }
  });

  // Header buttons
  addBtn?.addEventListener('click', () => { addRow(); recalcAll(); });
  clearBtn?.addEventListener('click', clearAll);

  // ----- DB I/O -----
  async function saveAll() {
    const items = [...tbody.querySelectorAll('tr.future-row')].map(row => ({
      id: row.dataset.id || null,
      phase: row.querySelector('.phase')?.value?.trim() || '',
      age_range: row.querySelector('.age-range')?.value?.trim() || '',
      years: parseNum(row.querySelector('.years')?.value),
      baseline: parseNum(row.querySelector('.baseline')?.value),
      oneoff: parseNum(row.querySelector('.oneoff')?.value),
      epic: parseNum(row.querySelector('.epic')?.value),
      // computed for convenience (API may ignore)
      annual_total: annualFromRow(row)
    }));

    try {
      const res = await fetch('/api/future_budget/bulk', {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({ items })
      });
      if (!res.ok) throw new Error();
      alert('Saved.');
    } catch {
      alert('Save failed. Check server logs.');
    }
  }

  async function loadAll() {
    try {
      const res = await fetch('/api/future_budget');
      if (!res.ok) throw new Error();
      const rows = await res.json();

      tbody.innerHTML = '';
      if (!rows.length) {
        clearAll(); // ✅ one starter row if DB empty
        return;
      }
      rows.forEach(addRow);
      recalcAll();
    } catch {
      clearAll();
    }
  }

  saveBtn?.addEventListener('click', () => { void saveAll(); });

  // ----- Init -----
  document.addEventListener('DOMContentLoaded', loadAll);
})();

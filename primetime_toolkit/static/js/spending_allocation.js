(() => {
  const tbody  = document.querySelector('#saTable tbody');
  const rowTpl = document.getElementById('saRowTemplate');

  const addBtn   = document.getElementById('addRowBtn');
  const clearBtn = document.getElementById('clearAllBtn');
  const loadBtn  = document.getElementById('loadBtn');
  const saveBtn  = document.getElementById('saveBtn');
  const refreshBudgetBtn = document.getElementById('refreshBudgetBtn');

  if (!tbody || !rowTpl) return;

  const AUD = new Intl.NumberFormat(undefined, { style:'currency', currency:'AUD', minimumFractionDigits:0 });
  const toNum = v => {
    const n = parseFloat(String(v ?? '').replace(/[^\d.-]/g,''));
    return Number.isFinite(n) ? n : 0;
  };

  // Cache of phase -> budgeted annual from Future Budget
  let budgetMap = {};
  const normPhase = p => (p || '').trim().toLowerCase();

  async function pullBudget() {
    try {
      const res = await fetch('/api/future_budget');
      if (!res.ok) throw new Error();
      const rows = await res.json();
      budgetMap = {};
      rows.forEach(r => {
        const annual = (r.baseline || 0) + (r.oneoff || 0) + (r.epic || 0) || r.annual || 0;
        budgetMap[normPhase(r.phase)] = annual;
      });
    } catch {
      budgetMap = {};
    } finally {
      recalcAll(); // refresh displayed budgets either way
    }
  }

  function addRow(prefill = {}) {
    const frag = rowTpl.content.cloneNode(true);
    const row  = frag.querySelector('tr.sa-row');

    if (prefill.id) row.dataset.id = prefill.id;
    row.querySelector('.phase').value       = prefill.phase ?? '';
    row.querySelector('.col-base').value    = prefill.cost_base ?? '';
    row.querySelector('.col-life').value    = prefill.cost_life ?? '';
    row.querySelector('.col-save').value    = prefill.cost_save ?? '';
    row.querySelector('.col-health').value  = prefill.cost_health ?? '';
    row.querySelector('.col-other').value   = prefill.cost_other ?? '';

    tbody.appendChild(frag);
  }

  function clearAll() {
    tbody.innerHTML = '';
    // ✅ Just one blank starter row
    addRow();
    recalcAll();
  }

  function recalcRow(row) {
    const base   = toNum(row.querySelector('.col-base')?.value);
    const life   = toNum(row.querySelector('.col-life')?.value);
    const save   = toNum(row.querySelector('.col-save')?.value);
    const health = toNum(row.querySelector('.col-health')?.value);
    const other  = toNum(row.querySelector('.col-other')?.value);

    const total  = base + life + save + health + other;

    const phase  = row.querySelector('.phase')?.value || '';
    const budget = budgetMap[normPhase(phase)] || 0;

    const surplus = budget - total;

    row.querySelector('.total').textContent  = AUD.format(total);
    row.querySelector('.budget').textContent = AUD.format(budget);

    const surplusEl = row.querySelector('.surplus');
    surplusEl.textContent = AUD.format(surplus);
    surplusEl.style.color = surplus >= 0 ? '#198754' : '#dc3545';

    return { total, budget, surplus };
  }

  function recalcAll() {
    tbody.querySelectorAll('tr.sa-row').forEach(recalcRow);
  }

  // events
  tbody.addEventListener('input', (e) => {
    const c = e.target?.classList || {};
    if (c.contains('phase') || c.contains('col-base') || c.contains('col-life') ||
        c.contains('col-save') || c.contains('col-health') || c.contains('col-other')) {
      recalcAll();
    }
  });

  tbody.addEventListener('click', (e) => {
    const btn = e.target.closest('.remove-row');
    if (!btn) return;
    const row = btn.closest('tr.sa-row');
    row?.remove();
    // Keep at least one row visible
    if (!tbody.querySelector('tr.sa-row')) addRow();
    recalcAll();
  });

  addBtn?.addEventListener('click', () => { addRow(); recalcAll(); });
  clearBtn?.addEventListener('click', clearAll);
  refreshBudgetBtn?.addEventListener('click', () => { void pullBudget(); });

  // ---- API I/O ----
  async function saveAll() {
    const items = [...tbody.querySelectorAll('tr.sa-row')].map(row => ({
      id: row.dataset.id || null,
      phase: row.querySelector('.phase')?.value?.trim() || '',
      cost_base:   toNum(row.querySelector('.col-base')?.value),
      cost_life:   toNum(row.querySelector('.col-life')?.value),
      cost_save:   toNum(row.querySelector('.col-save')?.value),
      cost_health: toNum(row.querySelector('.col-health')?.value),
      cost_other:  toNum(row.querySelector('.col-other')?.value),
    }));
    try {
      const res = await fetch('/api/spending_allocation/bulk', {
        method: 'POST', headers: { 'Content-Type':'application/json' },
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
      const res = await fetch('/api/spending_allocation');
      if (!res.ok) throw new Error();
      const rows = await res.json();
      tbody.innerHTML = '';
      if (!rows.length) { clearAll(); return; }
      rows.forEach(addRow);
      recalcAll();
    } catch {
      clearAll();
    }
  }

  saveBtn?.addEventListener('click', () => { void saveAll(); });
  loadBtn?.addEventListener('click', () => { void loadAll(); });

  // init: load data then budget
  document.addEventListener('DOMContentLoaded', async () => {
    await loadAll();     // ensures at least 1 starter row if DB empty
    await pullBudget();  // then overlay budgets
  });
})();

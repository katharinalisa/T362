(() => {
  const table = document.getElementById('saTable');
  const tbody = table?.querySelector('tbody');
  const rowTpl = document.getElementById('saRowTemplate');

  const addBtn   = document.getElementById('addRowBtn');
  const clearBtn = document.getElementById('clearAllBtn');
  const loadBtn  = document.getElementById('loadBtn');
  const saveBtn  = document.getElementById('saveSpendingBtn');

  // === Progress helper (localStorage) ===
  function markStepComplete(stepKey) {
    let completed = JSON.parse(localStorage.getItem("completedSteps") || "[]");
    if (!completed.includes(stepKey)) {
      completed.push(stepKey);
      localStorage.setItem("completedSteps", JSON.stringify(completed));
    }
  }

  const saveAndNextBtn  = document.getElementById('saveAndNextBtn');
  const refreshBudgetBtn = document.getElementById('refreshBudgetBtn');

  if (!tbody || !rowTpl) return;

  const AUD = new Intl.NumberFormat(undefined, { style:'currency', currency:'AUD', minimumFractionDigits:0 });
  const toNum = v => {
    const n = parseFloat(String(v ?? '').replace(/[^\d.-]/g,''));
    return Number.isFinite(n) ? n : 0;
  };

  let budgetMap = {};
  const normPhase = p => (p || '').trim().toLowerCase();



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

  // Build data object
  function getRows() {
    return Array.from(tbody.querySelectorAll('tr.sa-row')).map(row => ({
      id: row.dataset.id || null,
      phase: row.querySelector('.phase')?.value?.trim() || '',
      cost_base:   toNum(row.querySelector('.col-base')?.value),
      cost_life:   toNum(row.querySelector('.col-life')?.value),
      cost_save:   toNum(row.querySelector('.col-save')?.value),
      cost_health: toNum(row.querySelector('.col-health')?.value),
      cost_other:  toNum(row.querySelector('.col-other')?.value),
    }));
  }

  // --- Save to backend like Assets.js ---
  async function saveAll() {
    const allocations = getRows();
    try {
      const res = await fetch('/save-spending', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allocations })
      });
      if (res.status === 401) {
        alert('Please log in to save your spending allocation.');
        window.location.href = '/login';
        return null;
      }
      if (!res.ok) throw new Error();
      return await res.json(); // { message, redirect }
    } catch {
      alert('Error saving spending allocation.');
      return null;
    }
  }

  // --- Events ---
  saveBtn?.addEventListener('click', async () => {
    const original = saveBtn.textContent;
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';
    try {
      const data = await saveAll();
      if (data) { markStepComplete('super'); }
      if (data) { markStepComplete('spending_allocation'); }
      if (data && !data.redirect) {
        alert(data.message || 'Spending allocation saved!');
      }
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = original;
    }
  });

  saveAndNextBtn?.addEventListener('click', async () => {
    const original = saveAndNextBtn.textContent;
    saveAndNextBtn.disabled = true;
    saveAndNextBtn.textContent = 'Saving…';
    try {
      const data = await saveAll();
      if (data) { markStepComplete('super'); }
      if (data) { markStepComplete('spending_allocation'); }
      if (data?.redirect) {
        window.location.href = data.redirect; // should be /super_projection
      } else if (data) {
        alert(data.message || 'Spending allocation saved!');
      }
    } finally {
      saveAndNextBtn.disabled = false;
      saveAndNextBtn.textContent = original;
    }
  });

  addBtn?.addEventListener('click', () => { addRow(); recalcAll(); });
  clearBtn?.addEventListener('click', clearAll);
  refreshBudgetBtn?.addEventListener('click', () => { void pullBudget(); });

  tbody.addEventListener('input', (e) => {
    const c = e.target?.classList || {};
    if (c.contains('phase') || c.contains('col-base') || c.contains('col-life') ||
        c.contains('col-save') || c.contains('col-health') || c.contains('col-other')) {
      recalcAll();
    }
  });

  tbody.addEventListener('click', (e) => {
    const btn = e.target.closest('.remove-row');
    if (btn) {
      const row = btn.closest('tr.sa-row');
      row?.remove();
      if (!tbody.querySelector('tr.sa-row')) addRow();
      recalcAll();
    }
  });

  // Init
  document.addEventListener('DOMContentLoaded', async () => {
    tbody.innerHTML = '';
    if (window.spendingPrefill && Array.isArray(window.spendingPrefill) && window.spendingPrefill.length > 0) {
      window.spendingPrefill.forEach(addRow);
    } else {
      addRow();
    }
    await pullBudget();
  });
})();
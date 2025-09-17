// (() => {
//   const tbody = document.querySelector('#incomeTable tbody');
//   const rowTpl = document.getElementById('incomeRowTemplate');

//   const addBtn   = document.getElementById('addRowBtn');
//   const clearBtn = document.getElementById('clearAllBtn');
//   const saveBtn  = document.getElementById('saveAndNextBtn');

//   const totalAnnualEl = document.getElementById('totalAnnualIncome');
//   const totalWeeklyEl = document.getElementById('totalWeeklyIncome');

//   if (!tbody || !rowTpl) return;

//   const AUD = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'AUD', minimumFractionDigits: 0 });
//   const parseNum = (v) => {
//     const n = parseFloat(String(v ?? '').replace(/[^\d.-]/g, ''));
//     return Number.isFinite(n) ? n : 0;
//   };

//   // Conversion factors to annual
//   const FACTOR_ANNUAL = { weekly: 52, fortnightly: 26, monthly: 12, quarterly: 4, annually: 1 };

//   function addRow(prefill = {}) {
//     const frag = rowTpl.content.cloneNode(true);
//     const row  = frag.querySelector('tr.income-row');

//     if (prefill.id) row.dataset.id = prefill.id;
//     row.querySelector('.source').value   = prefill.source   ?? '';
//     row.querySelector('.amount').value   = prefill.amount   ?? '';
//     row.querySelector('.frequency').value = prefill.frequency ?? 'monthly';
//     row.querySelector('.notes').value    = prefill.notes    ?? '';
//     row.querySelector('.include-toggle').checked = prefill.include !== false;

//     tbody.appendChild(frag);
//   }

//   function clearAll() {
//     tbody.innerHTML = '';
//     // ✅ Always leave one starter row
//     addRow();
//     recalcAll();
//   }

//   function annualFromRow(row) {
//     const amt  = parseNum(row.querySelector('.amount')?.value);
//     const freq = String(row.querySelector('.frequency')?.value || '').toLowerCase();
//     const factor = FACTOR_ANNUAL[freq] ?? 0;
//     return amt * factor;
//   }

//   function recalcRow(row) {
//     const include = !!row.querySelector('.include-toggle')?.checked;
//     const annual  = include ? annualFromRow(row) : 0;
//     const weekly  = annual / 52;

//     row.querySelector('.annual').value = AUD.format(annual);
//     row.querySelector('.weekly').value = AUD.format(weekly);
//     return { annual, weekly };
//   }

//   function recalcAll() {
//     let sumAnnual = 0;
//     let sumWeekly = 0;
//     tbody.querySelectorAll('tr.income-row').forEach(row => {
//       const { annual, weekly } = recalcRow(row);
//       sumAnnual += annual;
//       sumWeekly += weekly;
//     });
//     totalAnnualEl.textContent = AUD.format(sumAnnual);
//     totalWeeklyEl.textContent = AUD.format(sumWeekly);
//   }

//   // Delegated events
//   tbody.addEventListener('input', (e) => {
//     if (e.target.classList.contains('source') || e.target.classList.contains('amount') || e.target.classList.contains('notes')) {
//       recalcAll();
//     }
//   });

//   tbody.addEventListener('change', (e) => {
//     if (e.target.classList.contains('frequency') || e.target.classList.contains('include-toggle')) {
//       recalcAll();
//     }
//   });

//   tbody.addEventListener('click', (e) => {
//     const btn = e.target.closest('.remove-row');
//     if (btn) {
//       btn.closest('tr.income-row')?.remove();
//       if (!tbody.querySelectorAll('tr.income-row').length) {
//         clearAll(); // ✅ ensure table never goes fully empty
//       } else {
//         recalcAll();
//       }
//     }
//   });

//   addBtn?.addEventListener('click', () => { addRow(); recalcAll(); });
//   clearBtn?.addEventListener('click', clearAll);

//   // ---- DB I/O ----
//   async function saveAll() {
//     const items = [...tbody.querySelectorAll('tr.income-row')].map(row => ({
//       id: row.dataset.id || null,
//       source: row.querySelector('.source')?.value?.trim() || '',
//       amount: parseNum(row.querySelector('.amount')?.value),
//       frequency: row.querySelector('.frequency')?.value || 'monthly',
//       notes: row.querySelector('.notes')?.value?.trim() || '',
//       include: !!row.querySelector('.include-toggle')?.checked,
//     }));
//     try {
//       const res = await fetch('/api/income/bulk', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({ items })
//       });
//       if (!res.ok) throw new Error();
//       alert('Saved.');
//     } catch {
//       alert('Save failed. Check server logs.');
//     }
//   }

//   async function loadAll() {
//     try {
//       const res = await fetch('/api/income');
//       if (!res.ok) throw new Error();
//       const rows = await res.json();
//       tbody.innerHTML = '';
//       if (!rows.length) { 
//         clearAll(); 
//         return;
//       }
//       rows.forEach(addRow);
//       recalcAll();
//     } catch {
//       clearAll();
//     }
//   }

//   saveBtn?.addEventListener('click', () => { void saveAll(); });

//   // Init
//   document.addEventListener('DOMContentLoaded', loadAll);
// })();
(() => {
  // ===== DOM =====
  const table = document.getElementById('incomeTable');
  const tbody = table?.querySelector('tbody');
  const rowTemplate = document.getElementById('incomeRowTemplate');
  const addRowBtn = document.getElementById('addRowBtn');
  const clearAllBtn = document.getElementById('clearAllBtn');
  const saveAndNextBtn = document.getElementById('saveAndNextBtn');

  if (!table || !tbody || !rowTemplate) return;

  // ===== Utils =====
  const parseAmount = (v) => {
    const n = parseFloat(String(v ?? '').replace(/[^\d.-]/g, ''));
    return Number.isFinite(n) ? n : 0;
  };

  // ===== Rows =====
  function addRow(prefill = {}) {
    const frag = rowTemplate.content.cloneNode(true);
    const row = frag.querySelector('tr.income-row');

    row.querySelector('.source').value = prefill.source || '';
    row.querySelector('.amount').value = (prefill.amount ?? '') === null ? '' : prefill.amount ?? '';
    row.querySelector('.frequency').value = prefill.frequency || '';
    row.querySelector('.notes').value = prefill.notes || '';
    row.querySelector('.include-toggle').checked = prefill.include !== false;

    tbody.appendChild(frag);
  }

  function clearAll() {
    tbody.innerHTML = '';
    addRow(); // keep one empty row
  }

  function getRows() {
    return Array.from(tbody.querySelectorAll('tr.income-row')).map(row => ({
      source: row.querySelector('.source')?.value || '',
      amount: parseAmount(row.querySelector('.amount')?.value),
      frequency: row.querySelector('.frequency')?.value || '',
      notes: row.querySelector('.notes')?.value || '',
      include: row.querySelector('.include-toggle')?.checked || false
    }));
  }

  // ===== Events =====
  addRowBtn?.addEventListener('click', () => addRow());
  clearAllBtn?.addEventListener('click', clearAll);

  tbody.addEventListener('click', (e) => {
    const btn = e.target.closest('.remove-row');
    if (!btn) return;
    const row = btn.closest('tr.income-row');
    if (row) row.remove();
  });

  // ===== Save & Next =====
  saveAndNextBtn?.addEventListener('click', () => {
    const incomes = getRows();

    fetch('/save-income', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ incomes })
    })
      .then(res => {
        if (res.status === 401) {
          alert('Please log in to save your income.');
          window.location.href = '/login';
          return;
        }
        return res.json();
      })
      .then(data => {
        if (data?.redirect) {
          window.location.href = data.redirect; // -> /expenses
        } else {
          alert(data?.message || 'Income saved!');
        }
      })
      .catch(() => alert('Error saving income.'));
  });

  // ===== Init =====
  tbody.innerHTML = '';
  if (window.incomePrefill && Array.isArray(window.incomePrefill) && window.incomePrefill.length > 0) {
    window.incomePrefill.forEach(addRow);
  } else {
    addRow();
  }
})();

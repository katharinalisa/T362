(() => {
  // ===== DOM =====
  const table = document.getElementById('expenseTable');
  const tbody = table?.querySelector('tbody');
  const rowTemplate = document.getElementById('expenseRowTemplate');
  const addRowBtn = document.getElementById('addRowBtn');
  const clearAllBtn = document.getElementById('clearAllBtn');
  const saveAndNextBtn = document.getElementById('saveAndNextBtn');

  const elEssential = document.getElementById('totalEssential');
  const elDiscretionary = document.getElementById('totalDiscretionary');
  const elOneOff = document.getElementById('totalOneOff');
  const elAnnual = document.getElementById('totalAnnual');

  if (!table || !tbody || !rowTemplate) return;

  // ===== Helpers =====
  const PERIODS_PER_YEAR = {
    weekly: 52,
    fortnightly: 26,
    monthly: 12,
    quarterly: 4,
    annually: 1,
    'one-off': 1,
  };

  const fmt = new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });

  const parseNum = (v) => {
    if (v == null) return 0;
    const n = parseFloat(String(v).replace(/[^\d.-]/g, ''));
    return Number.isFinite(n) ? n : 0;
  };

  const setCurrency = (el, amount) => { el.textContent = fmt.format(amount || 0); };

  function perYear(freq) {
    if (!freq) return 0;
    const key = String(freq).trim().toLowerCase();
    return PERIODS_PER_YEAR[key] ?? 0;
  }

  // ===== Row management =====
  function addRow(prefill = {}) {
    const frag = rowTemplate.content.cloneNode(true);
    const row = frag.querySelector('tr.expense-row');

    row.querySelector('.category').value = prefill.category || '';
    row.querySelector('.item').value = prefill.item || '';
    row.querySelector('.amount').value = prefill.amount ?? '';
    row.querySelector('.frequency').value = prefill.frequency || 'monthly';
    row.querySelector('.type').value = prefill.type || 'Essential';

    tbody.appendChild(frag);
  }

  function clearAll() {
    tbody.innerHTML = '';
    addRow();
    recalcAll();
  }

  // ===== Calculations =====
  function recalcRow(row) {
    const amount = parseNum(row.querySelector('.amount')?.value);
    const freq = row.querySelector('.frequency')?.value;
    const annual = amount * perYear(freq);
    const weekly = annual / 52;
    setCurrency(row.querySelector('.annual'), annual);
    setCurrency(row.querySelector('.weekly'), weekly);
    return { annual, weekly };
  }

  function recalcAll() {
    let essential = 0, discretionary = 0, oneOff = 0;
    tbody.querySelectorAll('tr.expense-row').forEach((row) => {
      const type = (row.querySelector('.type')?.value || 'Essential').trim().toLowerCase();
      const freq = (row.querySelector('.frequency')?.value || '').trim().toLowerCase();
      const { annual } = recalcRow(row);
      if (!annual) return;
      if (freq === 'one-off') {
        oneOff += annual;
      } else if (type === 'discretionary') {
        discretionary += annual;
      } else {
        essential += annual;
      }
    });
    setCurrency(elEssential, essential);
    setCurrency(elDiscretionary, discretionary);
    setCurrency(elOneOff, oneOff);
    setCurrency(elAnnual, essential + discretionary + oneOff);
  }

  // ===== Data extract =====
  function getRows() {
    return Array.from(tbody.querySelectorAll('tr.expense-row')).map(row => ({
      category: row.querySelector('.category')?.value || '',
      item: row.querySelector('.item')?.value || '',
      amount: parseNum(row.querySelector('.amount')?.value),
      frequency: row.querySelector('.frequency')?.value || 'monthly',
      type: row.querySelector('.type')?.value || 'Essential'
    }));
  }

  // ===== Events =====
  tbody.addEventListener('input', recalcAll);
  tbody.addEventListener('change', recalcAll);
  tbody.addEventListener('click', (e) => {
    const btn = e.target.closest('.remove-row');
    if (btn) {
      const row = btn.closest('tr.expense-row');
      if (row) row.remove();
      if (tbody.children.length === 0) addRow();
      recalcAll();
    }
  });

  addRowBtn?.addEventListener('click', () => { addRow(); recalcAll(); });
  clearAllBtn?.addEventListener('click', clearAll);

  saveAndNextBtn?.addEventListener('click', () => {
    const expenses = getRows();
    fetch('/save-expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expenses })
    })
      .then(res => res.json())
      .then(data => {
        if (data?.redirect) {
          window.location.href = data.redirect;
        } else {
          alert(data?.message || 'Expenses saved!');
        }
      })
      .catch(() => alert('Error saving expenses.'));
  });

  // ===== Init =====
  tbody.innerHTML = '';
  if (window.expensesPrefill && Array.isArray(window.expensesPrefill) && window.expensesPrefill.length > 0) {
    window.expensesPrefill.forEach(addRow);
  } else {
    addRow();
  }
  recalcAll();
})();
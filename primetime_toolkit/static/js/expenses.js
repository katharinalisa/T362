(() => {
  // ===== DOM =====
  const table = document.getElementById('expenseTable');
  const tbody = table?.querySelector('tbody');
  const rowTemplate = document.getElementById('expenseRowTemplate');
  const addRowBtn = document.getElementById('addRowBtn');
  const clearAllBtn = document.getElementById('clearAllBtn');

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
    'one-off': 1,        // occurs once in the year
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

    if (prefill.category) row.querySelector('.category').value = prefill.category;
    if (prefill.item) row.querySelector('.item').value = prefill.item;
    if (prefill.amount != null) row.querySelector('.amount').value = prefill.amount;
    if (prefill.frequency) row.querySelector('.frequency').value = prefill.frequency;
    if (prefill.type) row.querySelector('.type').value = prefill.type;

    tbody.appendChild(frag);
  }

  function clearAll() {
    tbody.innerHTML = '';
    addRow();     // keep one blank row
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
    let essential = 0;
    let discretionary = 0;
    let oneOff = 0;

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

  // ===== Events =====
  function onTbodyChange(e) {
    const t = e.target;
    if (!t) return;

    if (
      t.classList.contains('amount') ||
      t.classList.contains('frequency') ||
      t.classList.contains('type') ||
      t.classList.contains('item') ||
      t.classList.contains('category')
    ) {
      recalcAll();
    }
  }

  function onTbodyClick(e) {
    const btn = e.target.closest('.remove-row');
    if (btn) {
      const row = btn.closest('tr.expense-row');
      if (row) row.remove();
      if (tbody.children.length === 0) addRow(); // keep at least one row
      recalcAll();
    }
  }

  addRowBtn?.addEventListener('click', () => { addRow(); recalcAll(); });
  clearAllBtn?.addEventListener('click', clearAll);

  tbody.addEventListener('input', onTbodyChange);
  tbody.addEventListener('change', onTbodyChange);
  tbody.addEventListener('click', onTbodyClick);

  // ===== Init =====
  tbody.innerHTML = '';
  addRow();        // one blank row to start
  recalcAll();
})();

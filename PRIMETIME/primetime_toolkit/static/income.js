(() => {
  // ===== DOM =====
  const table = document.getElementById('incomeTable');
  const tbody = table?.querySelector('tbody');
  const rowTemplate = document.getElementById('incomeRowTemplate');
  const addRowBtn = document.getElementById('addRowBtn');
  const clearAllBtn = document.getElementById('clearAllBtn');

  const elTotalAnnual = document.getElementById('totalAnnualIncome');
  const elTotalWeekly = document.getElementById('totalWeeklyIncome');

  if (!table || !tbody || !rowTemplate) return;

  // ===== Helpers =====
  const PERIODS_PER_YEAR = {
    weekly: 52,
    fortnightly: 26,
    monthly: 12,
    quarterly: 4,
    annually: 1
  };

  const fmt = new Intl.NumberFormat(undefined, {
    style: 'currency', currency: 'AUD', minimumFractionDigits: 0, maximumFractionDigits: 0
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
    const row = frag.querySelector('tr.income-row');

    if (prefill.source) row.querySelector('.source').value = prefill.source;
    if (prefill.amount != null) row.querySelector('.amount').value = prefill.amount;
    if (prefill.frequency) row.querySelector('.frequency').value = prefill.frequency;
    if (prefill.include !== undefined) row.querySelector('.include-toggle').checked = !!prefill.include;

    tbody.appendChild(frag);
  }

  function clearAll() {
    tbody.innerHTML = '';
    addRow();        // leave one blank line
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
    let totalAnnual = 0;
    let totalWeekly = 0;

    tbody.querySelectorAll('tr.income-row').forEach((row) => {
      const include = row.querySelector('.include-toggle')?.checked;
      const { annual, weekly } = recalcRow(row);
      if (include) {
        totalAnnual += annual;
        totalWeekly += weekly;
      }
    });

    setCurrency(elTotalAnnual, totalAnnual);
    setCurrency(elTotalWeekly, totalWeekly);
  }

  // ===== Events =====
  function onTbodyChange(e) {
    const t = e.target;
    if (!t) return;
    if (
      t.classList.contains('amount') ||
      t.classList.contains('frequency') ||
      t.classList.contains('include-toggle')
    ) {
      recalcAll();
    }
  }

  function onTbodyClick(e) {
    const btn = e.target.closest('.remove-row');
    if (btn) {
      const row = btn.closest('tr.income-row');
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

  // ===== Init: start with one blank row =====
  tbody.innerHTML = '';
  addRow();
  recalcAll();
})();

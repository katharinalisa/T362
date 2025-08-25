// static/js/liabilities.js
(() => {
  const table = document.getElementById('liabilityTable');
  const tbody = table?.querySelector('tbody');
  const rowTemplate = document.getElementById('liabilityRowTemplate');
  const addRowBtn = document.getElementById('addRowBtn');
  const clearAllBtn = document.getElementById('clearAllBtn');

  const elTotalLiabilities = document.getElementById('totalLiabilities');
  const elTotalAnnualOutgoings = document.getElementById('totalAnnualOutgoings');

  if (!table || !tbody || !rowTemplate) return;

  const LIABILITY_TYPES = new Set([
    'mortgage','investment loan','personal loan','car loan/lease','credit card','other loan',
  ]);

  const fmt = new Intl.NumberFormat(undefined, {
    style: 'currency', currency: 'AUD', minimumFractionDigits: 0, maximumFractionDigits: 0
  });
  const parseNum = v => {
    const n = parseFloat(String(v ?? '').replace(/[^\d.-]/g, ''));
    return Number.isFinite(n) ? n : 0;
  };
  const setCurrency = (el, amount) => { el.textContent = fmt.format(amount || 0); };

  function addRow(prefill = {}) {
    const frag = rowTemplate.content.cloneNode(true);
    const row = frag.querySelector('tr.liability-row');
    if (prefill.type) row.querySelector('.type').value = prefill.type;
    if (prefill.description) row.querySelector('.description').value = prefill.description;
    if (prefill.balance != null) row.querySelector('.balance').value = prefill.balance;
    if (prefill.rate != null) row.querySelector('.rate').value = prefill.rate;
    if (prefill.term != null) row.querySelector('.term').value = prefill.term;
    if (prefill.monthly != null) row.querySelector('.monthly').value = prefill.monthly;
    if (prefill.include !== undefined) row.querySelector('.include-toggle').checked = !!prefill.include;
    tbody.appendChild(frag);
  }

  function clearAll() {
    tbody.innerHTML = '';
    addRow();            // keep a single blank row after clearing
    recalcTotals();
  }

  function recalcTotals() {
    let totalLiabilities = 0;
    let totalAnnualOutgoings = 0;

    tbody.querySelectorAll('tr.liability-row').forEach(row => {
      const include = row.querySelector('.include-toggle')?.checked;
      if (!include) return;

      const typeStr = (row.querySelector('.type')?.value || '').trim().toLowerCase();
      const balance = parseNum(row.querySelector('.balance')?.value);
      const monthly = parseNum(row.querySelector('.monthly')?.value);

      totalAnnualOutgoings += monthly * 12;
      if (LIABILITY_TYPES.has(typeStr)) totalLiabilities += balance;
    });

    setCurrency(elTotalLiabilities, totalLiabilities);
    setCurrency(elTotalAnnualOutgoings, totalAnnualOutgoings);
  }

  function handleTbodyChange(e) {
    const t = e.target;
    if (!t) return;
    if (t.classList.contains('type') || t.classList.contains('balance') ||
        t.classList.contains('monthly') || t.classList.contains('rate') ||
        t.classList.contains('term') || t.classList.contains('include-toggle')) {
      recalcTotals();
    }
  }
  function handleTbodyClick(e) {
    const btn = e.target.closest('.remove-row');
    if (btn) {
      const row = btn.closest('tr.liability-row');
      if (row) row.remove();
      if (tbody.children.length === 0) addRow(); // never leave the table empty
      recalcTotals();
    }
  }

  addRowBtn?.addEventListener('click', () => { addRow(); recalcTotals(); });
  clearAllBtn?.addEventListener('click', clearAll);
  tbody.addEventListener('input', handleTbodyChange);
  tbody.addEventListener('change', handleTbodyChange);
  tbody.addEventListener('click', handleTbodyClick);

  // --- INIT: start with exactly ONE blank row (no prefilled rows) ---
  tbody.innerHTML = '';
  addRow();
  recalcTotals();
})();

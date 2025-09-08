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
    'Mortgage', 'Credit Card', 'Personal Loan', 'Car Loan', 'Student Loan', 'Tax Payable', 'Other'
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
    if (prefill.category) row.querySelector('.category').value = prefill.category;
    if (prefill.name) row.querySelector('.name').value = prefill.name;
    if (prefill.amount != null) row.querySelector('.amount').value = prefill.amount;
    if (prefill.type) row.querySelector('.type').value = prefill.type;
    if (prefill.monthly != null) row.querySelector('.monthly').value = prefill.monthly;
    if (prefill.notes) row.querySelector('.notes').value = prefill.notes;
    tbody.appendChild(frag);
  }

// prefill from database
  tbody.innerHTML = '';
  if (window.liabilitiesPrefill && Array.isArray(window.liabilitiesPrefill) && window.liabilitiesPrefill.length > 0) {
    window.liabilitiesPrefill.forEach(row => addRow(row));
  } else {
    addRow();
  }
  recalcTotals();


  function recalcTotals() {
    let totalLiabilities = 0;
    let totalAnnualOutgoings = 0;

    tbody.querySelectorAll('tr.liability-row').forEach(row => {
      const include = row.querySelector('.include-toggle')?.checked;
      if (!include) return;

      const typeStr = (row.querySelector('.type')?.value || '').trim().toLowerCase();
      const amount = parseNum(row.querySelector('.amount')?.value);
      const monthly = parseNum(row.querySelector('.monthly')?.value);

      totalAnnualOutgoings += monthly * 12;
      if (LIABILITY_TYPES.has(row.querySelector('.type')?.value)) totalLiabilities += amount;
    });

    setCurrency(elTotalLiabilities, totalLiabilities);
    //setCurrency(elTotalAnnualOutgoings, totalAnnualOutgoings);
  }

  function handleTbodyChange(e) {
    const t = e.target;
    if (!t) return;
    if (
      t.classList.contains('type') ||
      t.classList.contains('amount') ||
      t.classList.contains('monthly') ||
      t.classList.contains('include-toggle')
    ) {
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
  function clearAll() {
    tbody.innerHTML = '';
    addRow();
    recalcTotals();
  }
  addRowBtn?.addEventListener('click', () => { addRow(); recalcTotals(); });
  clearAllBtn?.addEventListener('click', clearAll);
  tbody.addEventListener('input', handleTbodyChange);
  tbody.addEventListener('change', handleTbodyChange);
  tbody.addEventListener('click', handleTbodyClick);



  const saveAndNextBtn = document.getElementById('saveAndNextBtn');

  function getLiabilityRows() {
    return Array.from(tbody.querySelectorAll('tr.liability-row')).map(row => ({
      category: row.querySelector('.category')?.value || '',
      name: row.querySelector('.name')?.value || '', 
      amount: parseNum(row.querySelector('.amount')?.value),
      type: row.querySelector('.type')?.value || '',
      monthly: parseNum(row.querySelector('.monthly')?.value),
      notes: row.querySelector('.notes')?.value || ''
    }));
  }

  saveAndNextBtn?.addEventListener('click', () => {
    const liabilities = getLiabilityRows();
    fetch('/save-liabilities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ liabilities })
    })
    .then(res => {
      if (res.status === 401) {
        alert('Please log in to save your liabilities.');
        window.location.href = '/login';
        return;
      }
      return res.json();
    })
    .then(data => {
      if (data?.redirect) {
        window.location.href = data.redirect;
      } else {
        alert(data?.message || 'Liabilities saved!');
      }
    })
    .catch(() => alert('Error saving liabilities.'));
  });


})();

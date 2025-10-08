// static/js/liabilities.js
(() => {
  const table = document.getElementById('liabilityTable');
  const tbody = table?.querySelector('tbody');
  const rowTemplate = document.getElementById('liabilityRowTemplate');
  const addRowBtn = document.getElementById('addRowBtn');
  const clearAllBtn = document.getElementById('clearAllBtn');
  const saveBtn = document.getElementById('saveLiabilitiesBtn');

  const elTotalLiabilities =
    document.getElementById('totalLiabilities') ||
    document.querySelector('[data-role="total-liabilities"], #total-liabilities, .total-liabilities, [data-total="liabilities"]');
  const elTotalAnnualOutgoings =
    document.getElementById('totalAnnualOutgoings') ||
    document.querySelector('[data-role="total-annual"], #total-annual, .total-annual, [data-total="annual"]');

  if (!table || !tbody || !rowTemplate) return;

  const LIABILITY_TYPES = new Set([
    'Mortgage', 'Credit Card', 'Personal Loan', 'Car Loan', 'Student Loan', 'Tax Payable', 'Other'
  ]);

  const fmt = new Intl.NumberFormat(undefined, {
    style: 'currency', currency: 'AUD', minimumFractionDigits: 2, maximumFractionDigits: 2
  });
  const parseNum = v => {
    const n = parseFloat(String(v ?? '').replace(/[^\d.-]/g, ''));
    return Number.isFinite(n) ? n : 0;
  };
  const to2 = (v) => {
    const n = parseNum(v);
    return Number.isFinite(n) ? Number(n.toFixed(2)) : 0;
  };
  const setCurrency = (el, amount) => {
    if (!el) return;
    el.textContent = fmt.format(amount || 0);
  };

  function addRow(prefill = {}) {
    const frag = rowTemplate.content.cloneNode(true);
    const row = frag.querySelector('tr.liability-row');
    if (prefill.category) row.querySelector('.category').value = prefill.category;
    if (prefill.name) row.querySelector('.name').value = prefill.name;
    if (prefill.amount != null) row.querySelector('.amount').value = to2(prefill.amount).toFixed(2);
    if (prefill.type) row.querySelector('.type').value = prefill.type;
    if (prefill.monthly != null) row.querySelector('.monthly').value = to2(prefill.monthly).toFixed(2);
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
  // Ensure all numeric inputs display as 2dp on load
  tbody.querySelectorAll('.amount, .monthly').forEach(inp => {
    const n = parseNum(inp.value);
    inp.value = Number.isFinite(n) ? n.toFixed(2) : '';
  });
  recalcTotals();

  // Initialize per-row derived cells on load
  tbody.querySelectorAll('tr.liability-row').forEach(updateDerived);

  function recalcTotals() {
    let totalLiabilities = 0;
    let totalAnnualOutgoings = 0;

    tbody.querySelectorAll('tr.liability-row').forEach(row => {
      const includeEl = row.querySelector('.include-toggle, .include, input[type="checkbox"].include-toggle, input[type="checkbox"].include');
      const include = includeEl ? includeEl.checked : true;
      if (!include) return;

      const rawType = (row.querySelector('.type')?.value || '').trim();
      const typeStr = rawType.toLowerCase();
      const amount = parseNum(row.querySelector('.amount')?.value);
      const monthly = parseNum(row.querySelector('.monthly')?.value);

      totalAnnualOutgoings += monthly * 12;
      if (LIABILITY_TYPES.has(rawType) || LIABILITY_TYPES.has(typeStr.charAt(0).toUpperCase() + typeStr.slice(1)) || LIABILITY_TYPES.has(typeStr)) {
        totalLiabilities += amount;
      }
    });

    setCurrency(elTotalLiabilities, totalLiabilities);
    setCurrency(elTotalAnnualOutgoings, totalAnnualOutgoings);
  }

  function updateDerived(row){
    if (!row) return;
    const includeEl = row.querySelector('.include-toggle, .include, input[type="checkbox"].include-toggle, input[type="checkbox"].include');
    const include = includeEl ? includeEl.checked : true;
    const amount = parseNum(row.querySelector('.amount')?.value);
    const monthly = parseNum(row.querySelector('.monthly')?.value);

    // Balance / Remaining display (if the column exists)
    const balCell = row.querySelector('.balance, .remaining');
    if (balCell) setCurrency(balCell, include ? amount : 0);

    // Years to repay (simple heuristic: amount / (monthly * 12))
    const yearsCell = row.querySelector('.years, .years-to-repay, [data-role="years"]');
    if (yearsCell) {
      if (include && amount > 0 && monthly > 0) {
        const years = amount / (monthly * 12);
        yearsCell.textContent = years.toFixed(2);
        yearsCell.title = `${(years * 12).toFixed(0)} months`;
      } else {
        yearsCell.textContent = '';
        yearsCell.removeAttribute('title');
      }
    }

    // Annual outgoings (if a per-row cell exists)
    const annualCell = row.querySelector('.annual, .annual-outgoing');
    if (annualCell) setCurrency(annualCell, include ? (monthly * 12) : 0);
  }

  function handleTbodyChange(e) {
    const t = e.target;
    if (!t) return;
    if (
      t.classList.contains('type') ||
      t.classList.contains('amount') ||
      t.classList.contains('monthly') ||
      t.classList.contains('include-toggle') ||
      t.classList.contains('include')
    ) {
      const row = t.closest('tr.liability-row');
      if (row) updateDerived(row);
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

  // Handle changes and limit inputs to 2 decimal places
  tbody.addEventListener('input', (e) => {
    const t = e.target;
    if (!t) return;

    // Limit numeric inputs to 2 decimal places (do not pad zeros while typing)
    if (t.classList.contains('amount') || t.classList.contains('monthly')) {
      let val = String(t.value).replace(/[^0-9.]/g, '');
      // if multiple dots typed, keep the first
      const firstDot = val.indexOf('.');
      if (firstDot !== -1) {
        val = val.slice(0, firstDot + 1) + val.slice(firstDot + 1).replace(/\./g, '');
      }
      if (val.includes('.')) {
        const [whole, decimal] = val.split('.');
        val = `${whole}.${(decimal || '').slice(0, 2)}`;
      }
      t.value = val;
    }

    // Update derived cells for this row (balance, years, annual) when editing amount/monthly
    if (t.classList.contains('amount') || t.classList.contains('monthly')) {
      const row = t.closest('tr.liability-row');
      if (row) updateDerived(row);
    }

    // Recalculate totals dynamically
    if (
      t.classList.contains('type') ||
      t.classList.contains('amount') ||
      t.classList.contains('monthly') ||
      t.classList.contains('include-toggle') ||
      t.classList.contains('include')
    ) {
      recalcTotals();
    }
  });

  // When user leaves a numeric input, format to exactly 2 decimal places
  tbody.addEventListener('blur', (e) => {
    const t = e.target;
    if (!t) return;

    if (t.classList.contains('amount') || t.classList.contains('monthly')) {
      const n = parseNum(t.value);
      t.value = Number.isFinite(n) ? n.toFixed(2) : '';
      const row = t.closest('tr.liability-row');
      if (row) updateDerived(row);
      recalcTotals();
    }
  }, true);

  tbody.addEventListener('change', handleTbodyChange);
  
  tbody.addEventListener('click', handleTbodyClick);


  function getLiabilityRows() {
    return Array.from(tbody.querySelectorAll('tr.liability-row')).map(row => ({
      category: row.querySelector('.category')?.value || '',
      name: row.querySelector('.name')?.value || '', 
      amount: to2(row.querySelector('.amount')?.value),
      type: row.querySelector('.type')?.value || '',
      monthly: to2(row.querySelector('.monthly')?.value),
      notes: row.querySelector('.notes')?.value || ''
    }));
  }

  async function saveAll() {
    const liabilities = getLiabilityRows();
    try {
      const res = await fetch('/save-liabilities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ liabilities })
      });
      if (res.status === 401) {
        alert('Please log in to save your liabilities.');
        window.location.href = '/login';
        return null;
      }
      if (!res.ok) throw new Error();
      return await res.json(); // { message, redirect? }
    } catch {
      alert('Error saving liabilities.');
      return null;
    }
  }

  // === Progress helper (localStorage) ===
  function markStepComplete(stepKey) {
    let completed = JSON.parse(localStorage.getItem("completedSteps") || "[]");
    if (!completed.includes(stepKey)) {
      completed.push(stepKey);
      localStorage.setItem("completedSteps", JSON.stringify(completed));
    }
  }

  const saveAndNextBtn = document.getElementById('saveAndNextBtn');

  saveAndNextBtn?.addEventListener('click', async () => {
    const original = saveAndNextBtn.textContent;
    saveAndNextBtn.disabled = true;
    saveAndNextBtn.textContent = 'Saving…';
    try {
      const data = await saveAll();
      // Auto-apply progress: mark Liabilities step complete on successful save
      if (data) { markStepComplete('liabilities'); }
      if (data?.redirect) {
        window.location.href = data.redirect;
      } else if (data) {
        alert(data.message || 'Liabilities saved!');
      }
    } finally {
      saveAndNextBtn.disabled = false;
      saveAndNextBtn.textContent = original;
    }
  });

  saveBtn?.addEventListener('click', async () => {
    const original = saveBtn.textContent;
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';
    try {
      const data = await saveAll();
      if (data) { markStepComplete('liabilities'); }
      if (data && !data.redirect) {
        alert(data.message || 'Liabilities saved!');
      }
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = original;
    }
  });


})();

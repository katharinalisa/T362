(() => {
  // ====== DOM ======
  const table = document.getElementById('assetTable');
  const tbody = table?.querySelector('tbody');
  const rowTemplate = document.getElementById('assetRowTemplate');
  const addRowBtn = document.getElementById('addRowBtn');
  const clearAllBtn = document.getElementById('clearAllBtn');

  const elTotalAssets = document.getElementById('totalAssets');
  const elTotalHome = document.getElementById('totalHome');
  const elTotalSuper = document.getElementById('totalSuper');
  const elTotalExcl = document.getElementById('totalExclHomeSuper');
  const elTotalAnnualDrawdown = document.getElementById('totalAnnualDrawdown'); // optional

  if (!table || !tbody || !rowTemplate) return; // safe guard

  // ====== Utils ======
  const fmt = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'AUD', maximumFractionDigits: 2 });
  const fmt2 = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'AUD', minimumFractionDigits: 2, maximumFractionDigits: 2 });

  function parseAmount(value) {
    if (value == null) return 0;
    // Remove commas, spaces, $ etc.
    const cleaned = String(value).replace(/[^\d.-]/g, '');
    const n = parseFloat(cleaned);
    return Number.isFinite(n) ? n : 0;
  }

  function setCurrency(el, amount) {
    el.textContent = fmt2.format(amount || 0);
  }

  // ====== Row management ======
  function addRow(prefill = {}) {
    const frag = rowTemplate.content.cloneNode(true);
    const row = frag.querySelector('tr.asset-row');

    // Prefill if provided
    if (prefill.category) row.querySelector('.category').value = prefill.category;
    if (prefill.description) row.querySelector('.description').value = prefill.description;
    if (prefill.amount != null) {
      const amtEl = row.querySelector('.amount');
      const n = parseAmount(prefill.amount);
      amtEl.value = Number.isFinite(n) ? n.toFixed(2) : '0.00';
    }
    if (prefill.owner) row.querySelector('.owner').value = prefill.owner;
    if (prefill.include !== undefined) row.querySelector('.include-toggle').checked = !!prefill.include;

    // Optional drawdown fields
    const ddSelect = row.querySelector('.drawdown-select');
    const ddAmt = row.querySelector('.drawdown-amount');
    if (ddSelect) ddSelect.value = prefill.drawdown || (prefill.drawdown === 0 ? 'none' : 'none');
    if (ddAmt) {
      const ndd = parseAmount(prefill.drawdown_amount);
      ddAmt.value = Number.isFinite(ndd) ? ndd.toFixed(2) : '';
    }

    tbody.appendChild(frag);
  }

  function clearAll() {
    tbody.innerHTML = '';
    addRow();
    recalcTotals();
  }

  // ====== Calculations ======
  function recalcTotals() {
    let total = 0;
    let totalHome = 0;
    let totalSuper = 0;
    let totalAnnualDrawdown = 0;

    const rows = tbody.querySelectorAll('tr.asset-row');
    rows.forEach((row) => {
      const category = row.querySelector('.category')?.value?.trim() || '';
      const amount = parseAmount(row.querySelector('.amount')?.value);
      const include = row.querySelector('.include-toggle')?.checked;

      if (!include) return;

      total += amount;

  
      if (category.toLowerCase() === 'home') totalHome += amount;
      if (category.toLowerCase() === 'superannuation') totalSuper += amount;

      // Optional drawdown per-row (annualised)
      const ddSelect = row.querySelector('.drawdown-select');
      const ddAmtEl = row.querySelector('.drawdown-amount');
      if (ddSelect && ddAmtEl) {
        const ddMode = (ddSelect.value || 'none').toLowerCase();
        const ddVal = parseAmount(ddAmtEl.value);
        let multiplier = 0;
        if (ddMode === 'monthly') multiplier = 12;
        else if (ddMode === 'quarterly') multiplier = 4;
        else if (ddMode === 'annual') multiplier = 1;
        // 'none' or unknown => 0
        totalAnnualDrawdown += ddVal * multiplier;
      }
    });

    setCurrency(elTotalAssets, total);
    setCurrency(elTotalHome, totalHome);
    setCurrency(elTotalSuper, totalSuper);
    setCurrency(elTotalExcl, Math.max(total - totalHome - totalSuper, 0));
    if (elTotalAnnualDrawdown) setCurrency(elTotalAnnualDrawdown, totalAnnualDrawdown);
  }

  // ====== Event delegation ======
  function onTbodyInput(e) {
    const t = e.target;
    if (!t) return;

    // Recalc on any relevant change
    if (
      t.classList.contains('amount') ||
      t.classList.contains('category') ||
      t.classList.contains('include-toggle') ||
      t.classList.contains('drawdown-amount') ||
      t.classList.contains('drawdown-select')
    ) {
      recalcTotals();
    }
  }


  const saveBtn = document.getElementById('saveAssetsBtn');

  function getAssetRows() {
    return Array.from(tbody.querySelectorAll('tr.asset-row')).map(row => ({
      category: row.querySelector('.category')?.value || '',
      description: row.querySelector('.description')?.value || '',
      amount: parseAmount(row.querySelector('.amount')?.value),
      owner: row.querySelector('.owner')?.value || '',
      include: row.querySelector('.include-toggle')?.checked || false,
      drawdown: row.querySelector('.drawdown-select')?.value || 'none',
      drawdown_amount: parseAmount(row.querySelector('.drawdown-amount')?.value)
    }));
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

  async function saveAll() {
    const assets = getAssetRows();
    try {
      const res = await fetch('/save-assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assets })
      });
      if (res.status === 401) {
        alert('Please log in to save your assets.');
        window.location.href = '/login';
        return null;
      }
      const data = await res.json();
      return data;
    } catch (e) {
      alert('Error saving assets.');
      return null;
    }
  }

  saveAndNextBtn?.addEventListener('click', async () => {
    const original = saveAndNextBtn.textContent;
    saveAndNextBtn.disabled = true;
    saveAndNextBtn.textContent = 'Saving…';
    const data = await saveAll();
    saveAndNextBtn.disabled = false;
    saveAndNextBtn.textContent = original;
    if (!data) return;

    markStepComplete('assets');
    if (data?.redirect) {
      window.location.href = data.redirect;
    } else {
      alert(data?.message || 'Assets saved!');
    }
  });

  saveBtn?.addEventListener('click', async () => {
    const original = saveBtn.textContent;
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';
    const data = await saveAll();
    saveBtn.disabled = false;
    saveBtn.textContent = original;
    if (!data) return;
    alert(data?.message || 'Assets saved!');
    if (data?.redirect) {
      window.location.href = data.redirect;
    }
  });



  function onTbodyClick(e) {
    const btn = e.target.closest('.remove-row');
    if (btn) {
      const row = btn.closest('tr.asset-row');
      if (row) row.remove();
      if (tbody.querySelectorAll('tr.asset-row').length === 0) {
        addRow();
      }
      recalcTotals();
    }
  }

  function onTbodyBlur(e) {
    const t = e.target;
    if (!t) return;
    if (t.classList.contains('amount') || t.classList.contains('drawdown-amount')) {
      const n = parseAmount(t.value);
      t.value = (t.value === '' && t.classList.contains('drawdown-amount')) ? '' : (Number.isFinite(n) ? n.toFixed(2) : '0.00');
    }
  }

  // ====== Hook up top buttons ======
  addRowBtn?.addEventListener('click', () => {
    addRow();
    recalcTotals();
  });

  clearAllBtn?.addEventListener('click', clearAll);

  // Delegated events
  tbody.addEventListener('input', (e) => {
    const t = e.target;
    if (!t) return;

    // Limit .amount and .drawdown-amount inputs to 2 decimal places
    if (t.classList.contains('amount') || t.classList.contains('drawdown-amount')) {
      const val = t.value;
      if (val.includes('.')) {
        const [whole, decimal] = val.split('.');
        if (decimal.length > 2) {
          t.value = `${whole}.${decimal.slice(0, 2)}`;
        }
      }
    }

    // Recalculate when relevant inputs change
    if (
      t.classList.contains('amount') ||
      t.classList.contains('category') ||
      t.classList.contains('include-toggle') ||
      t.classList.contains('drawdown-amount') ||
      t.classList.contains('drawdown-select')
    ) {
      recalcTotals();
    }
  });
  tbody.addEventListener('change', onTbodyInput);
  tbody.addEventListener('click', onTbodyClick);
  tbody.addEventListener('blur', onTbodyBlur, true);

  // ====== Init ======
  tbody.innerHTML = '';
  const defaultAssets = [
    { category: 'Home', include: true },
    { category: 'Superannuation', include: true },
    { category: 'Investments', include: true },
    { category: 'Rental property', include: true },
    { category: 'Cash & Savings', include: true },
    { category: 'Lifestyle assets', include: true },
    { category: 'Other asset ', include: true }
  ];

  if (window.assetsPrefill && Array.isArray(window.assetsPrefill) && window.assetsPrefill.length > 0) {
    window.assetsPrefill.forEach(row => addRow(row));
  } else {
    defaultAssets.forEach(row => addRow(row));
  }
  tbody.querySelectorAll('tr.asset-row .amount').forEach(input => {
    if (!input.value) input.value = '0.00';
  });
  tbody.querySelectorAll('tr.asset-row .drawdown-amount').forEach(input => {
    if (input.value === '0.00') input.value = '';
  });
  recalcTotals();
})();
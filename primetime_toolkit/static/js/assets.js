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

  if (!table || !tbody || !rowTemplate) return; // safe guard

  // ====== Utils ======
  const fmt = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 });
  const fmt2 = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'AUD', minimumFractionDigits: 0, maximumFractionDigits: 0 });

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
    if (prefill.amount != null) row.querySelector('.amount').value = prefill.amount;
    if (prefill.owner) row.querySelector('.owner').value = prefill.owner;
    if (prefill.include !== undefined) row.querySelector('.include-toggle').checked = !!prefill.include;

    tbody.appendChild(frag);
  }

  function clearAll() {
    tbody.innerHTML = '';
    recalcTotals();
  }

  // ====== Calculations ======
  function recalcTotals() {
    let total = 0;
    let totalHome = 0;
    let totalSuper = 0;

    const rows = tbody.querySelectorAll('tr.asset-row');
    rows.forEach((row) => {
      const category = row.querySelector('.category')?.value?.trim() || '';
      const amount = parseAmount(row.querySelector('.amount')?.value);
      const include = row.querySelector('.include-toggle')?.checked;

      if (!include) return;

      total += amount;

      // Exact category matches to mirror the workbook
      if (category.toLowerCase() === 'home') totalHome += amount;
      if (category.toLowerCase() === 'superannuation') totalSuper += amount;
    });

    setCurrency(elTotalAssets, total);
    setCurrency(elTotalHome, totalHome);
    setCurrency(elTotalSuper, totalSuper);
    setCurrency(elTotalExcl, Math.max(total - totalHome - totalSuper, 0));
  }

  // ====== Event delegation ======
  function onTbodyInput(e) {
    const t = e.target;
    if (!t) return;

    // Recalc on any relevant change
    if (
      t.classList.contains('amount') ||
      t.classList.contains('category') ||
      t.classList.contains('include-toggle')
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
      include: row.querySelector('.include-toggle')?.checked || false
    }));
  }

  const saveAndNextBtn = document.getElementById('saveAndNextBtn');

  saveAndNextBtn?.addEventListener('click', () => {
    const assets = getAssetRows();
    fetch('/save-assets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assets })
    })
    .then(res => {
      if (res.status === 401) {
        alert('Please log in to save your assets.');
        window.location.href = '/login';
        return;
      }
      return res.json();
    })
    .then(data => {
      if (data?.redirect) {
        // Redirect to the next calculator page, e.g., liabilities
        window.location.href = '/liabilities';
      }
    })
    .catch(() => alert('Error saving assets.'));
  });



  function onTbodyClick(e) {
    const btn = e.target.closest('.remove-row');
    if (btn) {
      const row = btn.closest('tr.asset-row');
      if (row) row.remove();
      recalcTotals();
    }
  }

  // Optional: format on blur (keep inputs numeric while editing)
  function onTbodyBlur(e) {
    const t = e.target;
    if (t && t.classList.contains('amount')) {
      // Keep raw number in input (so users can keep editing) — but you can format if desired.
      // Example if you want to auto-format with commas:
      // const n = parseAmount(t.value);
      // t.value = n ? n.toFixed(2) : '';
    }
  }

  // ====== Hook up top buttons ======
  addRowBtn?.addEventListener('click', () => {
    addRow();
    recalcTotals();
  });

  clearAllBtn?.addEventListener('click', clearAll);

  // Delegated events
  tbody.addEventListener('input', onTbodyInput);
  tbody.addEventListener('change', onTbodyInput);
  tbody.addEventListener('click', onTbodyClick);
  tbody.addEventListener('blur', onTbodyBlur, true);

  // ====== Init ======
  tbody.innerHTML = '';
  if (window.assetsPrefill && Array.isArray(window.assetsPrefill) && window.assetsPrefill.length > 0) {
    window.assetsPrefill.forEach(row => addRow(row));
  } else {
    addRow();
  }
  recalcTotals();
})();
document.addEventListener('DOMContentLoaded', () => {
  // ===== DOM =====
  const table = document.getElementById('expenseTable');
  const tbody = table?.querySelector('tbody');
  const rowTemplate = document.getElementById('expenseRowTemplate');
  const addRowBtn = document.getElementById('addRowBtn');
  const clearAllBtn = document.getElementById('clearAllBtn');

  // === Progress helper (localStorage) ===
  function markStepComplete(stepKey) {
    let completed = JSON.parse(localStorage.getItem("completedSteps") || "[]");
    if (!completed.includes(stepKey)) {
      completed.push(stepKey);
      localStorage.setItem("completedSteps", JSON.stringify(completed));
    }
  }

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

  // Map of Category -> Item options used to populate the Item <select>
  const ITEM_OPTIONS = {
    'Housing': [
      'Building and contents insurance',
      'Council rates',
      'Water charges',
      'Home improvements',
      'Repairs & maintenance'
    ],
    'Utilities': [
      'Electricity & gas bills',
      'Body corp fees (or similar)',
      'Rent (deducting rent assistance)'
    ],
    'Fresh food': [
      'Supermarket',
      'Butcher/Fruit shop',
      'Other food'
    ],
    'Internet & phones': [
      'Internet and mobile phone bundle',
      'Internet',
      'Mobile phone'
    ],
    'Household goods & services': [
      'Household cleaning and cleaning supplies',
      'Cosmetics & personal care items',
      'Hairdresser & barber costs',
      'Digital media',
      'Computer, printer & software',
      'Household appliances, air conditioners and smart phones',
      'Other household expenses'
    ],
    'Clothing & footwear': [
      'Clothing and footwear'
    ],
    'Transport': [
      'Car registration',
      'Car insurance',
      'Fuel and other operating costs',
      'Servicing & maintenance',
      'Public transport costs',
      'Tolls'
    ],
    'Personal health': [
      'Health insurance',
      'Chemist',
      'Doctors co-payment and out of pocket expenses',
      'Vitamins & over the counter medicines',
      'Exercise & fitness'
    ],
    'Entertainment & Leisure': [
      'Membership to clubs',
      'TV',
      'Streaming services',
      'Alcohol/charity donations',
      'Cinema, theatre, sports or day trips',
      'Lunches and dinners out',
      'Domestic vacations',
      'International vacations',
      'Take-away foods, coffees etc.'
    ],
    'Other insurances': [
      'Life insurance (not held in Super)',
      'TPD (not held in Super)',
      'Trauma insurance (not held in Super)',
      'Pet insurance'
    ],
    'Work related': [
      'Professional memberships & other subscriptions',
      'Work-related expenses'
    ],
    'Family & friends': [
      'Gifts (Christmas and birthdays)',
      'Other family expenses'
    ]
  };

  // Case-insensitive, trim-aware key resolver
  function resolveCategoryKey(cat) {
    if (!cat) return '';
    const needle = String(cat).trim().toLowerCase();
    // Exact match first
    if (Object.prototype.hasOwnProperty.call(ITEM_OPTIONS, cat)) return cat;
    // Fallback: case-insensitive over known keys
    for (const key of Object.keys(ITEM_OPTIONS)) {
      if (key.toLowerCase() === needle) return key;
    }
    return '';
  }

  // Populate an Item <select> based on category; preserve prefilled value when possible
  function populateItemOptions(itemSelect, category, prefillValue = '') {
    if (!itemSelect) return;
    const key = resolveCategoryKey(category);

    // Clear and add placeholder
    itemSelect.innerHTML = '';
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.disabled = true;
    placeholder.selected = true;
    placeholder.textContent = '-- Select item --';
    itemSelect.appendChild(placeholder);

    const opts = key ? ITEM_OPTIONS[key] : [];
    opts.forEach(label => {
      const opt = document.createElement('option');
      opt.value = label;
      opt.textContent = label;
      itemSelect.appendChild(opt);
    });

    // If we have a prefill value not in the list, preserve it
    if (prefillValue && !opts.includes(prefillValue)) {
      const opt = document.createElement('option');
      opt.value = prefillValue;
      opt.textContent = prefillValue;
      itemSelect.appendChild(opt);
    }

    // Always default to the placeholder first
    itemSelect.value = '';
  }

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

    // Accept multiple possible keys from older saves:
    // Category: category | type_group | group
    // Item: item | description | name
    const rawCategory = prefill.category ?? prefill.type_group ?? prefill.group ?? '';
    const rawItem = prefill.item ?? prefill.description ?? prefill.name ?? '';

    row.querySelector('.category').value = rawCategory || '';
    const itemSel = row.querySelector('.item');
    populateItemOptions(itemSel, rawCategory, rawItem);

    // Amount: pad to 2dp if provided, otherwise leave blank
    const amtEl = row.querySelector('.amount');
    if (prefill.amount != null && prefill.amount !== '') {
      const n = parseNum(prefill.amount);
      amtEl.value = Number.isFinite(n) ? n.toFixed(2) : '';
    } else {
      amtEl.value = '';
    }

    // Frequency: only set if provided; otherwise keep template default
    if (prefill.frequency) {
      row.querySelector('.frequency').value = prefill.frequency;
    }

    // Type: default to 'Essential' unless provided
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
  tbody.addEventListener('input', (e) => {
    const t = e.target;
    if (t && t.classList.contains('amount')) {
      const val = t.value;
      if (val.includes('.')) {
        const [whole, dec] = val.split('.');
        if (dec.length > 2) t.value = `${whole}.${dec.slice(0, 2)}`;
      }
    }
    // If user is typing in the category, update the item options live.
    if (t && t.classList.contains('category')) {
      const row = t.closest('tr.expense-row');
      const itemSel = row?.querySelector('.item');
      const newCat = resolveCategoryKey(t.value);
      const opts = newCat ? ITEM_OPTIONS[newCat] : [];
      const keep = opts.includes(itemSel?.value) ? itemSel.value : '';
      populateItemOptions(itemSel, newCat, keep);
    }
    recalcAll();
  });
  tbody.addEventListener('change', (e) => {
    const t = e.target;
    if (t && t.classList.contains('category')) {
      const row = t.closest('tr.expense-row');
      const itemSel = row?.querySelector('.item');
      const newCat = resolveCategoryKey(t.value);
      const opts = newCat ? ITEM_OPTIONS[newCat] : [];
      const keep = opts.includes(itemSel?.value) ? itemSel.value : '';
      populateItemOptions(itemSel, newCat, keep);
    }
    recalcAll();
  });
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
        // Auto-apply progress: mark Expenses step complete on successful save
        markStepComplete('expenses');
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

  // Determine if we have usable prefill (at least one row with category/item-like keys)
  const hasValidPrefill = Array.isArray(window.expensesPrefill) &&
    window.expensesPrefill.some(r => r && (r.category || r.type_group || r.group || r.item || r.description || r.name));

  const defaultExpenses = [
    { category: 'Housing', item: 'Building and contents insurance' },
    { category: 'Utilities', item: 'Electricity & gas bills' },
    { category: 'Fresh food', item: 'Supermarket' },
    { category: 'Internet & phones', item: 'Internet and mobile phone bundle' },
    { category: 'Household goods & services', item: 'Household cleaning and cleaning supplies' },
    { category: 'Clothing & footwear', item: 'Clothing and footwear' },
    { category: 'Transport', item: 'Car registration' },
    { category: 'Personal health', item: 'Health insurance' },
    { category: 'Entertainment & Leisure', item: 'Membership to clubs' },
    { category: 'Other insurances', item: 'Life insurance (not held in Super)' },
    { category: 'Work related', item: 'Professional memberships & other subscriptions' },
    { category: 'Family & friends', item: 'Gifts (Christmas and birthdays)' }
  ];

  if (hasValidPrefill) {
    window.expensesPrefill.forEach(addRow);
  } else {
    defaultExpenses.forEach(addRow);
  }

  // Guard populate on init to preserve prefilled items that are valid for their categories
  tbody.querySelectorAll('tr.expense-row').forEach(row => {
    const catKey = resolveCategoryKey(row.querySelector('.category')?.value || '');
    const itemSel = row.querySelector('.item');
    const current = itemSel?.value || '';
    const opts = catKey ? ITEM_OPTIONS[catKey] : [];
    const keep = opts.includes(current) ? current : '';
    populateItemOptions(itemSel, catKey, keep);
  });

  // Format any prefilled amounts to 2 decimals
  tbody.querySelectorAll('.amount').forEach(inp => {
    const n = parseNum(inp.value);
    if (Number.isFinite(n) && String(inp.value).trim() !== '') {
      inp.value = n.toFixed(2);
    }
  });

  recalcAll();
});
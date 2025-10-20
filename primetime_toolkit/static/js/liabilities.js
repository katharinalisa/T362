// static/js/liabilities.js
(() => {
  document.addEventListener('DOMContentLoaded', () => {
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

    const LIABILITY_CATEGORIES = new Set([
      'Mortgage', 'Credit Card', 'Personal Loan', 'Car Loan', 'Student Loan', 'Tax Payable', 'Other',
      // also accept lowercase and dashed variants from UI
      'Investment loan', 'Car loan/lease', 'Other loan', 'Long-term savings/investment', 'Extra savings into super', 'Emergency savings'
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

    function setCategory(selectEl, value) {
      if (!selectEl) return;
      if (!value) { selectEl.value = ''; return; }
      // Try direct set first
      selectEl.value = value;
      if (selectEl.value === value) return;
      // Fallback: match by case-insensitive text
      const target = String(value).trim().toLowerCase();
      const opts = Array.from(selectEl.options || []);
      const match = opts.find(o => String(o.value || o.text).trim().toLowerCase() === target);
      if (match) {
        selectEl.value = match.value || match.text;
        return;
      }
      // Last resort: normalise hyphens and slashes/spaces
      const norm = target.replace(/[-/]+/g, ' ').replace(/\s+/g, ' ').trim();
      const match2 = opts.find(o => String(o.value || o.text).trim().toLowerCase().replace(/[-/]+/g, ' ').replace(/\s+/g, ' ').trim() === norm);
      if (match2) {
        selectEl.value = match2.value || match2.text;
      }
    }

    function addRow(prefill = {}) {
      const frag = rowTemplate.content.cloneNode(true);
      const row = frag.querySelector('tr.liability-row');
      const catSelect = row.querySelector('.category');
      if (prefill && Object.prototype.hasOwnProperty.call(prefill, 'category')) {
        setCategory(catSelect, prefill.category);
      } else if (catSelect) {
        catSelect.value = '';
      }
      if (prefill.name) row.querySelector('.name').value = prefill.name;
      if (prefill.amount != null) row.querySelector('.amount').value = to2(prefill.amount).toFixed(2);
      if (prefill.monthly != null) row.querySelector('.monthly').value = to2(prefill.monthly).toFixed(2);
      if (prefill.notes) row.querySelector('.notes').value = prefill.notes;
      tbody.appendChild(frag);
    }

    // Prefill from database; otherwise seed with default list for users
    tbody.innerHTML = '';
    const hasUsefulPrefill =
      Array.isArray(window.liabilitiesPrefill) &&
      window.liabilitiesPrefill.some(r => r && (r.category || r.name || r.amount || r.monthly || r.notes));
    if (hasUsefulPrefill) {
      window.liabilitiesPrefill.forEach(row => addRow(row));
    } else {
      const defaultTypes = [
        'Mortgage',
        'Investment loan',
        'Personal loan',
        'Car loan/lease',
        'Credit card',
        'Other loan',
        'Long-term savings/investment',
        'Extra savings into super',
        'Emergency savings'
      ];
      defaultTypes.forEach(type => addRow({ category: type }));
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

        const rawCat = (row.querySelector('.category')?.value || '').trim();
        const catStr = rawCat.toLowerCase();
        const amount = parseNum(row.querySelector('.amount')?.value);
        const monthly = parseNum(row.querySelector('.monthly')?.value);

        totalAnnualOutgoings += monthly * 12;
        if (LIABILITY_CATEGORIES.has(rawCat) || LIABILITY_CATEGORIES.has(catStr.charAt(0).toUpperCase() + catStr.slice(1)) || LIABILITY_CATEGORIES.has(catStr)) {
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
        t.classList.contains('category') ||
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
        t.classList.contains('category') ||
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
      return Array.from(tbody.querySelectorAll('tr.liability-row')).map(row => {
        const category = row.querySelector('.category')?.value || '';
        const name = row.querySelector('.name')?.value || '';
        const amount = to2(row.querySelector('.amount')?.value);
        const monthly = to2(row.querySelector('.monthly')?.value);
        const notes = row.querySelector('.notes')?.value || '';
        return {
          // keep existing keys for frontend usage
          category,
          name,
          amount,
          monthly,
          notes,
          // add API-compat key expected by backend
          type: category
        };
      });
    }

    async function saveAll() {
      const liabilities = getLiabilityRows();

      // Prefer table data attribute; fallback to legacy endpoint
      const primaryUrl = table?.dataset?.saveUrl || '/save-liabilities';
      const fallbackUrl = window.location?.pathname || '/liabilities';

      try {
        let res = await fetch(primaryUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ liabilities })
        });

        if (res.status === 401) {
          alert('Please log in to save your liabilities.');
          window.location.href = '/login';
          return null;
        }

        // If the configured URL is wrong, retry the current page path
        if (res.status === 404 && primaryUrl !== fallbackUrl) {
          res = await fetch(fallbackUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ liabilities })
          });
        }

        if (!res.ok) {
          let msg = '';
          try { msg = await res.text(); } catch {}
          alert(`Error saving liabilities. (HTTP ${res.status}) ${msg || ''}`.trim());
          return null;
        }

        return await res.json(); // { message, redirect? }
      } catch (err) {
        alert(`Error saving liabilities. ${err?.message ? '(' + err.message + ')' : ''}`);
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
      const nextUrl = saveAndNextBtn.dataset?.nextUrl || '';
      saveAndNextBtn.disabled = true;
      saveAndNextBtn.textContent = 'Saving…';
      try {
        const data = await saveAll();
        if (data) { markStepComplete('liabilities'); }
        const target = (data && data.redirect) ? data.redirect : nextUrl;
        if (target) {
          window.location.href = target;
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
        if (data?.redirect) {
          window.location.href = data.redirect;
        } else if (data) {
          alert(data.message || 'Liabilities saved!');
        }
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = original;
      }
    });
  });
})();

(() => {
  const table = document.getElementById('debtTable');
  const tbody = table?.querySelector('tbody');
  const rowTpl = document.getElementById('rowTpl');

  const addRowBtn = document.getElementById('addRowBtn');
  const clearAllBtn = document.getElementById('clearAllBtn');
  const saveBtn = document.getElementById('saveDebtBtn');

  // === Progress helper (localStorage) ===
  function markStepComplete(stepKey) {
    let completed = JSON.parse(localStorage.getItem("completedSteps") || "[]");
    if (!completed.includes(stepKey)) {
      completed.push(stepKey);
      localStorage.setItem("completedSteps", JSON.stringify(completed));
    }
  }

  const saveAndNextBtn = document.getElementById('saveAndNextBtn');

  if (!table || !tbody) return; // allow page to work even if no row template is present

  // ===== Helpers =====
  const toNum = v => {
    const n = parseFloat(String(v ?? '').replace(/[^\d.-]/g, ''));
    return Number.isFinite(n) ? n : 0;
  };

  // Currency formatter (AU dollars by default)
  const currencyFmt = new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 2
  });

  function formatCurrencyInput(el){
    if (!el) return;
    const n = toNum(el.value);
    el.value = n ? currencyFmt.format(n) : '';
  }
  function unformatCurrencyInput(el){
    if (!el) return;
    const n = toNum(el.value);
    el.value = n ? String(n) : '';
  }

  function monthsToPayoff(P, annualRatePct, M) {
    const i = (annualRatePct / 100) / 12;
    if (P <= 0 || M <= 0) return null;
    if (i === 0) return Math.ceil(P / M);
    if (M <= P * i) return Infinity;
    const n = -Math.log(1 - i * P / M) / Math.log(1 + i);
    return Number.isFinite(n) ? Math.ceil(n) : Infinity;
  }

  function recalcRow(row) {
    const P = toNum(row.querySelector('.principal, [name="principal"], .amount, [name="amount"], [data-role="principal"]')?.value);
    const r = toNum(row.querySelector('.rate, [name="rate"], .annual-rate, [name="interest"], [name="annual_rate"], [data-role="rate"]')?.value);
    const M = toNum(row.querySelector('.payment, [name="payment"], .monthly, [name="monthly"], [name="monthly_payment"], [data-role="payment"]')?.value);

    const months = monthsToPayoff(P, r, M);
    const cell = row.querySelector('.years, .years-to-repay, [data-role="years"]');
    if (!cell) return; // nothing to render into

    if (months === null) {
      cell.textContent = '-';
    } else if (months === Infinity) {
      cell.textContent = '—';
      cell.title = 'Payment too small to ever repay';
    } else {
      const years = months / 12;
      cell.textContent = years.toFixed(2);
      const tipP = currencyFmt.format(P);
      const tipM = currencyFmt.format(M);
      cell.title = `${months} months (P: ${tipP}, M: ${tipM})`;
    }
  }

  function recalcAll() {
    tbody.querySelectorAll('tr.debt-row').forEach(recalcRow);
  }

  function getRows() {
    return Array.from(tbody.querySelectorAll('tr.debt-row')).map(row => ({
      name: row.querySelector('.name')?.value || '',
      principal: toNum(row.querySelector('.principal')?.value),
      rate: toNum(row.querySelector('.rate')?.value),
      payment: toNum(row.querySelector('.payment')?.value),
    }));
  }

  // ===== Save logic =====
  async function saveAll() {
    const debts = getRows();
    try {
      const res = await fetch('/save-debt_paydown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ debts })
      });
      if (res.status === 401) {
        alert('Please log in to save your debt paydown.');
        window.location.href = '/login';
        return null;
      }
      if (!res.ok) throw new Error();
      return await res.json(); // { message, redirect? }
    } catch {
      alert('Error saving debt paydown.');
      return null;
    }
  }

  // ===== Events =====
  addRowBtn?.addEventListener('click', () => {
    if (!rowTpl) return; // no template available on this page
    const frag = rowTpl.content.cloneNode(true);
    tbody.appendChild(frag);
    recalcAll();
  });

  clearAllBtn?.addEventListener('click', () => {
    tbody.innerHTML = '';
    if (rowTpl) {
      const frag = rowTpl.content.cloneNode(true);
      tbody.appendChild(frag);
    }
    recalcAll();
  });

  saveBtn?.addEventListener('click', async () => {
    const original = saveBtn.textContent;
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';
    try {
      const data = await saveAll();
      if (data) { markStepComplete('debt_paydown'); }
      if (data && !data.redirect) {
        alert(data.message || 'Debts saved!');
      }
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = original;
    }
  });

  saveAndNextBtn?.addEventListener('click', async () => {
    const btn = saveAndNextBtn;
    const original = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Saving…';

    let nextUrl = '/enough_calculator';
    try {
      const data = await saveAll();
      if (data) { markStepComplete('debt_paydown'); }
      if (data && data.redirect) {
        nextUrl = data.redirect;
      }
    } catch (e) {
      console.error('Save failed, continuing to next step', e);
    } finally {
      btn.disabled = false;
      btn.textContent = original;
      window.location.href = nextUrl;
    }
  });

  const principalSel = '.principal, [name="principal"], .amount, [name="amount"], [data-role="principal"]';
  const rateSel = '.rate, [name="rate"], .annual-rate, [name="interest"], [name="annual_rate"], [data-role="rate"]';
  const paymentSel = '.payment, [name="payment"], .monthly, [name="monthly"], [name="monthly_payment"], [data-role="payment"]';
  const calcSel = `${principalSel}, ${rateSel}, ${paymentSel}`;

  // Live recalculation as user types
  tbody.addEventListener('input', (e) => {
    // Limit inputs to 2 decimal places
    if (e.target.matches(principalSel) || e.target.matches(rateSel) || e.target.matches(paymentSel)) {
      const val = e.target.value;
      if (val.includes('.')) {
        const [whole, decimal] = val.split('.');
        if (decimal.length > 2) {
          e.target.value = `${whole}.${decimal.slice(0, 2)}`;
        }
      }
    }
    if (e.target.matches(principalSel) || e.target.matches(rateSel) || e.target.matches(paymentSel)) {
      const row = e.target.closest('tr.debt-row');
      if (row) recalcRow(row);
    }
  });

  tbody.addEventListener('change', handleRecalcEvent);

  // Allow typing plain numbers; format only on blur
  tbody.addEventListener('focus', (e) => {
    if (e.target.matches(principalSel) || e.target.matches(paymentSel)) {
      e.target.dataset.raw = toNum(e.target.value) || '';
      e.target.value = e.target.dataset.raw;
    }
  }, true);

  tbody.addEventListener('blur', (e) => {
    if (e.target.matches(principalSel) || e.target.matches(paymentSel)) {
      const n = toNum(e.target.value);
      e.target.value = n ? currencyFmt.format(n) : '';
      const row = e.target.closest('tr.debt-row');
      if (row) recalcRow(row);
    }
  }, true);

  // Handle row deletion via the first-column × button
  tbody.addEventListener('click', (e) => {
    const delBtn = e.target.closest('.delete-row');
    if (!delBtn) return;
    const row = delBtn.closest('tr.debt-row');
    if (row) {
      row.remove();
      recalcAll();
    }
  });

  // ===== Init =====
  recalcAll();
})();
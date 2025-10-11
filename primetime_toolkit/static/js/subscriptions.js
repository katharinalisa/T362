(() => {
  // ====== DOM ======
  const table = document.getElementById('subsTable');
  const tbody = table?.querySelector('tbody');
  const rowTemplate = document.getElementById('subsRowTemplate');
  const addRowBtn = document.getElementById('addRowBtn');
  const clearAllBtn = document.getElementById('clearAllBtn');
  const elTotalSubs = document.getElementById('totalSubsAmount');

  // === Progress helper (localStorage) ===
  function markStepComplete(stepKey) {
    let completed = JSON.parse(localStorage.getItem("completedSteps") || "[]");
    if (!completed.includes(stepKey)) {
      completed.push(stepKey);
      localStorage.setItem("completedSteps", JSON.stringify(completed));
    }
  }
  const saveBtn = document.getElementById('saveSubscriptionsBtn');
  const saveAndNextBtn = document.getElementById('saveAndNextBtn');

  if (!table || !tbody || !rowTemplate) return; // safety

  // ====== Utils ======
  const AUD0 = new Intl.NumberFormat(undefined, {
    style: 'currency', currency: 'AUD',
    minimumFractionDigits: 0, maximumFractionDigits: 0
  });

  const PERIODS_PER_YEAR = {
    weekly: 52,
    fortnightly: 26,
    monthly: 12,
    quarterly: 4,
    annually: 1
  };

  function parseAmount(v) {
    if (v == null) return 0;
    const n = parseFloat(String(v).replace(/[^\d.-]/g, ''));
    return Number.isFinite(n) ? n : 0;
  }
  const normFreq = f => String(f || '').trim().toLowerCase();

  function setCurrency(el, amount) {
    if (!el) return;
    el.textContent = AUD0.format(amount || 0);
  }

  // ====== Row management ======
function addRow(prefill = {}) {
  const frag = rowTemplate.content.cloneNode(true);
  const row = frag.querySelector('tr.subs-row');

  const serviceEl = row.querySelector('.service');
  if (prefill.name && serviceEl) {
    serviceEl.value = prefill.name;
  }

  const providerEl = row.querySelector('.provider');
  if (prefill.provider && providerEl) {
    providerEl.value = prefill.provider;
  }

  const amountEl = row.querySelector('.amount');
  if (amountEl && prefill.amount != null) {
    amountEl.value = prefill.amount;
  }

  const freqEl = row.querySelector('.freq');
  if (freqEl && prefill.frequency) {
    freqEl.value = normFreq(prefill.frequency) || 'monthly';
  }

  const includeEl = row.querySelector('.include');
  if (includeEl && prefill.include !== undefined) {
    includeEl.checked = !!prefill.include;
  }

  const annualCell = row.querySelector('.annual');
  if (annualCell && prefill.annual_amount != null) {
    setCurrency(annualCell, prefill.annual_amount);
  }

  tbody.appendChild(frag);
}



  function clearAll() {
    tbody.innerHTML = '';
    addRow();
    recalcTotals();
  }

  // ====== Calculations ======
  function annualForRow(row) {
    const include = row.querySelector('.include')?.checked;
    if (!include) return 0;
    const amt = parseAmount(row.querySelector('.amount')?.value);
    const f = normFreq(row.querySelector('.freq')?.value || 'monthly');
    return amt * (PERIODS_PER_YEAR[f] ?? 0);
  }


  function recalcTotals() {
    let total = 0;
    tbody.querySelectorAll('tr.subs-row').forEach(row => {
      const annual = annualForRow(row);
      const annualCell = row.querySelector('.annual');
      if (annualCell) setCurrency(annualCell, annual);
      total += annual;
    });
    setCurrency(elTotalSubs, total);
  }

  // ====== Gather payload ======
  function getSubsRows() {
    return Array.from(tbody.querySelectorAll('tr.subs-row')).map(row => {
      const name = row.querySelector('.service')?.value?.trim() || '';
      const provider = row.querySelector('.provider')?.value?.trim() || '';
      const amount = parseAmount(row.querySelector('.amount')?.value);
      const frequency = normFreq(row.querySelector('.frequency')?.value || 'monthly');
      const include = !!row.querySelector('.include-toggle')?.checked;
      const annual_amount = include ? amount * (PERIODS_PER_YEAR[frequency] ?? 0) : 0;

      return { name, provider, amount, frequency, notes: '', include, annual_amount };
    });
  }

  // ====== Events ======
  // Input/change re-calc (like assets.js)
  function onTbodyInput(e) {
    const t = e.target;
    if (!t) return;
    if (
      t.classList.contains('amount') ||
      t.classList.contains('frequency') ||
      t.classList.contains('include-toggle') ||
      t.classList.contains('service') ||
      t.classList.contains('provider')
    ) {
      recalcTotals();
    }
  }

  function setCurrency(el, amount) {
    if (!el) return;
    el.textContent = AUD0.format(amount || 0);
  }

  function onTbodyClick(e) {
    const btn = e.target.closest('.remove-row');
    if (!btn) return;
    const row = btn.closest('tr.subs-row');
    if (row) row.remove();
    if (!tbody.querySelector('tr.subs-row')) addRow();
    recalcTotals();
  }

  addRowBtn?.addEventListener('click', () => { addRow(); recalcTotals(); });
  clearAllBtn?.addEventListener('click', clearAll);
  tbody.addEventListener('input', onTbodyInput);
  tbody.addEventListener('change', onTbodyInput);
  tbody.addEventListener('click', onTbodyClick);

  // ====== Save helper ======
  async function saveAll() {
    const subscriptions = getSubsRows();
    try {
      const res = await fetch('/save-subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscriptions })
      });
      if (res.status === 401) {
        alert('Please log in to save your subscriptions.');
        window.location.href = '/login';
        return null;
      }
      if (!res.ok) throw new Error();
      return await res.json(); // { message, redirect? }
    } catch {
      alert('Error saving subscriptions.');
      return null;
    }
  }

  saveAndNextBtn?.addEventListener('click', async () => {
    const original = saveAndNextBtn.textContent;
    saveAndNextBtn.disabled = true;
    saveAndNextBtn.textContent = 'Saving…';
    try {
      const data = await saveAll();
      if (data) { markStepComplete('subscriptions'); }
      if (data?.redirect) {
        window.location.href = data.redirect; // e.g., /future_budget or next step
      } else if (data) {
        alert(data.message || 'Subscriptions saved!');
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
      if (data) { markStepComplete('subscriptions'); }
      if (data && !data.redirect) {
        alert(data.message || 'Subscriptions saved!');
      }
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = original;
    }
  });

  tbody.addEventListener('input', onTbodyInput);
  tbody.addEventListener('change', onTbodyInput);


  // ====== Init ======
  tbody.innerHTML = '';
  if (Array.isArray(window.subscriptionsPrefill) && window.subscriptionsPrefill.length > 0) {
    window.subscriptionsPrefill.forEach(row => addRow(row));
  } else {
    addRow();
  }
  recalcTotals();
})();
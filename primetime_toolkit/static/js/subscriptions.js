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

  // Accept multiple possible keys for service name
  const serviceEl = row.querySelector('.service');
  const otherEl = row.querySelector('.service-other');
  const rawName = prefill.name ?? prefill.service ?? '';
  if (serviceEl && rawName) {
    const opts = Array.from(serviceEl.options).map(o => o.value);
    if (opts.includes(rawName)) {
      serviceEl.value = rawName;
      if (otherEl) {
        if (rawName === 'Other subscription') {
          // If prefill selects "Other subscription", show the input so user can type
          otherEl.classList.remove('d-none');
          otherEl.value = otherEl.value || '';
        } else {
          otherEl.classList.add('d-none');
          otherEl.value = '';
        }
      }
    } else {
      // Unknown service -> select "Other subscription" and show text input with the name
      if (opts.includes('Other subscription')) {
        serviceEl.value = 'Other subscription';
        if (otherEl) { otherEl.classList.remove('d-none'); otherEl.value = rawName; }
      } else {
        // Fallback: keep select placeholder and at least fill text
        if (otherEl) { otherEl.classList.remove('d-none'); otherEl.value = rawName; }
      }
    }
  }

  const providerEl = row.querySelector('.provider');
  if (providerEl && (prefill.provider ?? '') !== '') {
    providerEl.value = prefill.provider;
  }

  const amountEl = row.querySelector('.amount');
  if (amountEl) {
    if (prefill.amount != null && prefill.amount !== '') {
      const n = parseAmount(prefill.amount);
      amountEl.value = Number.isFinite(n) ? n.toFixed(2) : '';
    } else {
      amountEl.value = '';
    }
  }

  const freqEl = row.querySelector('.freq');
  if (freqEl) {
    if (prefill.frequency) {
      freqEl.value = normFreq(prefill.frequency) || 'monthly';
    } else {
      // keep template default if present; else set monthly
      if (!freqEl.value) freqEl.value = 'monthly';
    }
  }

  const includeEl = row.querySelector('.include');
  if (includeEl) {
    if (prefill.include !== undefined) {
      includeEl.checked = !!prefill.include;
    } else {
      includeEl.checked = true; // default on
    }
  }

  // Show prefilled annual if provided
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
    const amt = parseAmount(row.querySelector('.amount')?.value);
    const freq = normFreq(row.querySelector('.freq')?.value || 'monthly');
    const include = row.querySelector('.include')?.checked;

    const annual = amt * (PERIODS_PER_YEAR[freq] ?? 0);

    // ✅ Always show the row's annual value
    const annualCell = row.querySelector('.annual');
    if (annualCell) setCurrency(annualCell, annual);

    // ✅ Only include in total if toggle is checked
    if (include) {
      total += annual;
    }
  });

  setCurrency(elTotalSubs, total);
}


  // ====== Gather payload ======
  function getSubsRows() {
    return Array.from(tbody.querySelectorAll('tr.subs-row')).map(row => {
      const sel = row.querySelector('.service')?.value?.trim() || '';
      const other = row.querySelector('.service-other')?.value?.trim() || '';
      const name = (sel === 'Other subscription' && other) ? other : (sel || other);
      const provider = row.querySelector('.provider')?.value?.trim() || '';
      const amount = parseAmount(row.querySelector('.amount')?.value);
      const frequency = normFreq(row.querySelector('.freq')?.value || 'monthly');
      const include = !!row.querySelector('.include')?.checked;

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
      t.classList.contains('freq') ||
      t.classList.contains('include') ||
      t.classList.contains('service') ||
      t.classList.contains('service-other') ||
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
  // As the user types a custom service name, reflect it in the select
  tbody.addEventListener('input', (e) => {
    const t = e.target;
    if (!t) return;

    if (t.classList.contains('service-other')) {
      const row = t.closest('tr.subs-row');
      const serviceEl = row?.querySelector('.service');
      if (!serviceEl) return;

      const txt = t.value.trim();

      // Remove any extra custom options (keep at most one)
      const customOpts = Array.from(serviceEl.options).filter(o => o.dataset.custom === '1');
      for (let i = 1; i < customOpts.length; i++) {
        customOpts[i].remove();
      }

      if (txt) {
        // Create or update the single custom option
        let opt = customOpts[0];
        if (!opt) {
          opt = document.createElement('option');
          opt.dataset.custom = '1';
          serviceEl.appendChild(opt);
        }
        opt.value = txt;
        opt.textContent = txt;

        // Select the typed custom option (so “Other subscription” is no longer shown)
        serviceEl.value = txt;
      } else {
        // If cleared, remove the custom option and revert to Other/placeholder
        if (customOpts[0]) customOpts[0].remove();
        const hasOther = Array.from(serviceEl.options).some(o => o.value === 'Other subscription');
        serviceEl.value = hasOther ? 'Other subscription' : '';
      }
    }
  });

  // When user finishes typing in "Other", hide the textbox and keep select on the custom value
  tbody.addEventListener('blur', (e) => {
    const t = e.target;
    if (!t) return;
    if (t.classList.contains('service-other')) {
      const txt = t.value.trim();
      const row = t.closest('tr.subs-row');
      const serviceEl = row?.querySelector('.service');
      if (!serviceEl) return;

      // Deduplicate custom options (keep only one)
      const customOpts = Array.from(serviceEl.options).filter(o => o.dataset.custom === '1');
      for (let i = 1; i < customOpts.length; i++) {
        customOpts[i].remove();
      }

      if (txt) {
        let opt = customOpts[0];
        if (!opt) {
          opt = document.createElement('option');
          opt.dataset.custom = '1';
          serviceEl.appendChild(opt);
        }
        opt.value = txt;
        opt.textContent = txt;
        serviceEl.value = txt;

        // Hide the "Other" input now that selection reflects the text
        t.classList.add('d-none');
      } else {
        // No text -> ensure no stray custom option remains
        if (customOpts[0]) customOpts[0].remove();
        const hasOther = Array.from(serviceEl.options).some(o => o.value === 'Other subscription');
        serviceEl.value = hasOther ? 'Other subscription' : '';
        // keep the input visible for user to type
      }
    }
  }, true); // use capture to catch blur events

  tbody.addEventListener('click', onTbodyClick);

  tbody.addEventListener('change', (e) => {
    const t = e.target;
    if (!t) return;
    if (t.classList.contains('service')) {
      const row = t.closest('tr.subs-row');
      const otherEl = row?.querySelector('.service-other');
      if (otherEl) {
        if (t.value === 'Other subscription') {
          otherEl.classList.remove('d-none');
          otherEl.focus();
        } else {
          otherEl.classList.add('d-none');
          otherEl.value = '';
        }
      }
    }
    onTbodyInput(e); // keep totals updated
  });

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


  // ====== Init ======
  tbody.innerHTML = '';

  const hasValidPrefill = Array.isArray(window.subscriptionsPrefill) &&
    window.subscriptionsPrefill.some(r => r && (r.name || r.service));

  const defaultSubscriptions = [
    { name: 'Streaming service (Netflix)', include: true },
    { name: 'Music streaming (Spotify)', include: true },
    { name: 'Cloud storage (iCloud)', include: true },
    { name: 'Gym membership', include: true },
    { name: 'News subscription', include: true },
    { name: 'Magazine subscription', include: true },
    { name: 'Software subscription', include: true },
    { name: 'Video streaming (Stan)', include: true },
    { name: 'Amazon Prime', include: true },
    { name: 'Other subscription', include: true }
  ];

  if (hasValidPrefill) {
    window.subscriptionsPrefill.forEach(row => addRow(row));
  } else {
    defaultSubscriptions.forEach(row => addRow(row));
  }

  recalcTotals();
})();
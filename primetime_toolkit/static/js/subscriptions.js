(() => {
  const tbody = document.querySelector('#subsTable tbody');
  const rowTpl = document.getElementById('subsRowTemplate');

  const addBtn   = document.getElementById('addRowBtn');
  const clearBtn = document.getElementById('clearAllBtn');
  const saveBtn  = document.getElementById('saveBtn');
  const loadBtn  = document.getElementById('loadBtn');

  const totalAnnualEl = document.getElementById('totalAnnual');

  if (!tbody || !rowTpl) return;

  const AUD = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'AUD', minimumFractionDigits: 0 });
  const parseNum = (v) => {
    const n = parseFloat(String(v ?? '').replace(/[^\d.-]/g, ''));
    return Number.isFinite(n) ? n : 0;
  };

  const FACTOR_ANNUAL = { weekly: 52, fortnightly: 26, monthly: 12, quarterly: 4, annually: 1 };

  function addRow(prefill = {}) {
    const frag = rowTpl.content.cloneNode(true);
    const row  = frag.querySelector('tr.subs-row');

    if (prefill.id) row.dataset.id = prefill.id;
    row.querySelector('.service').value   = prefill.service   ?? '';
    row.querySelector('.provider').value  = prefill.provider  ?? '';
    row.querySelector('.amount').value    = prefill.amount_per_period ?? '';
    row.querySelector('.freq').value      = prefill.frequency ?? 'Monthly';
    row.querySelector('.include').checked = prefill.include !== false;

    tbody.appendChild(frag);
  }

  function clearAll() {
    tbody.innerHTML = '';
    // ✅ just one starter row (like Assets)
    addRow({ service: 'Streaming service (Netflix)' });
    recalcAll();
  }

  function annualFromRow(row) {
    const amt  = parseNum(row.querySelector('.amount')?.value);
    const freq = String(row.querySelector('.freq')?.value || '').toLowerCase();
    const factor = FACTOR_ANNUAL[freq] ?? 0;
    return amt * factor;
  }

  function recalcRow(row) {
    const include = !!row.querySelector('.include')?.checked;
    const annual  = include ? annualFromRow(row) : 0;
    row.querySelector('.annual').textContent = AUD.format(annual);
    return annual;
  }

  function recalcAll() {
    let sum = 0;
    tbody.querySelectorAll('tr.subs-row').forEach(row => sum += recalcRow(row));
    totalAnnualEl.textContent = AUD.format(sum);
  }

  // Delegated events
  tbody.addEventListener('input', (e) => {
    const t = e.target;
    if (t && (t.classList.contains('service') || t.classList.contains('provider') || t.classList.contains('amount'))) {
      recalcAll();
    }
  });
  tbody.addEventListener('change', (e) => {
    const t = e.target;
    if (t && (t.classList.contains('freq') || t.classList.contains('include'))) {
      recalcAll();
    }
  });
  tbody.addEventListener('click', (e) => {
    const btn = e.target.closest('.remove-row');
    if (btn) {
      btn.closest('tr.subs-row')?.remove();
      recalcAll();
    }
  });

  addBtn?.addEventListener('click', () => { addRow(); recalcAll(); });
  clearBtn?.addEventListener('click', clearAll);

  // ---- DB I/O ----
  async function saveAll() {
    const items = [...tbody.querySelectorAll('tr.subs-row')].map(row => ({
      id: row.dataset.id || null,
      service:  row.querySelector('.service')?.value?.trim()  || '',
      provider: row.querySelector('.provider')?.value?.trim() || '',
      amount_per_period: parseNum(row.querySelector('.amount')?.value),
      frequency: row.querySelector('.freq')?.value || 'Monthly',
      include: !!row.querySelector('.include')?.checked,
    }));
    try {
      const res = await fetch('/api/subscriptions/bulk', {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({ items })
      });
      if (!res.ok) throw new Error();
      alert('Saved.');
    } catch {
      alert('Save failed. Check server logs.');
    }
  }

  async function loadAll() {
    try {
      const res = await fetch('/api/subscriptions');
      if (!res.ok) throw new Error();
      const rows = await res.json();
      tbody.innerHTML = '';
      if (!rows.length) { 
        clearAll(); 
        return; 
      }
      rows.forEach(addRow);
      recalcAll();
    } catch {
      clearAll();
    }
  }

  saveBtn?.addEventListener('click', () => { void saveAll(); });
  loadBtn?.addEventListener('click', () => { void loadAll(); });

  // Init
  document.addEventListener('DOMContentLoaded', loadAll);
})();

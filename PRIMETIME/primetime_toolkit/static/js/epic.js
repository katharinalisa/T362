(() => {
  const table = document.getElementById('epicTable');
  const tbody = table?.querySelector('tbody');
  const rowTmpl = document.getElementById('epicRowTemplate');

  const yearsEl = document.getElementById('yearsPeriod');
  const addBtn  = document.getElementById('addRowBtn');
  const clearBtn= document.getElementById('clearAllBtn');
  const saveBtn = document.getElementById('saveBtn');
  const loadBtn = document.getElementById('loadBtn');

  const grandTotalEl = document.getElementById('grandTotal');

  if (!tbody || !rowTmpl) return;

  const AUD = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'AUD', minimumFractionDigits: 0 });
  const num = (v) => {
    const n = parseFloat(String(v ?? '').replace(/[^\d.-]/g, ''));
    return Number.isFinite(n) ? n : 0;
  };
  const setCurr = (el, val) => el.textContent = AUD.format(val || 0);

  function addRow(prefill = {}) {
    const frag = rowTmpl.content.cloneNode(true);
    const row  = frag.querySelector('tr.epic-row');
    if (prefill.id) row.dataset.id = prefill.id;

    row.querySelector('.item').value   = prefill.item ?? '';
    row.querySelector('.amount').value = prefill.amount ?? '';
    row.querySelector('.freq').value   = prefill.frequency ?? 'Once only';
    row.querySelector('.include').checked = prefill.include !== false;

    tbody.appendChild(frag);
  }

  function clearAll() {
    tbody.innerHTML = '';
    // Start with a few handy rows
    [
      { item:'3-month sabbatical' },
      { item:'Caravan trip around Australia', frequency:'Every second year' },
      { item:'Renovate kitchen' },
      { item:'Round-the-world cruise' },
    ].forEach(addRow);
    recalcAll();
  }

  function rowMultiplier(freq, years) {
    const y = Math.max(0, Math.floor(num(years)));
    const f = String(freq || '').toLowerCase();
    if (f.startsWith('once')) return 1;
    if (f.includes('every second')) return Math.floor(y / 2);
    return y; // every year
  }

  function recalcRow(row) {
    const amt  = num(row.querySelector('.amount')?.value);
    const freq = row.querySelector('.freq')?.value;
    const inc  = row.querySelector('.include')?.checked;
    const mult = rowMultiplier(freq, yearsEl.value);
    const total = inc ? amt * mult : 0;
    setCurr(row.querySelector('.total'), total);
    return total;
  }

  function recalcAll() {
    let sum = 0;
    tbody.querySelectorAll('tr.epic-row').forEach(row => { sum += recalcRow(row); });
    setCurr(grandTotalEl, sum);
  }

  // Events
  tbody.addEventListener('input', (e) => {
    if (!e.target) return;
    const cls = e.target.classList;
    if (cls.contains('item') || cls.contains('amount') || cls.contains('freq') || cls.contains('include')) {
      recalcAll();
    }
  });
  tbody.addEventListener('change', (e) => {
    if (!e.target) return;
    const cls = e.target.classList;
    if (cls.contains('freq') || cls.contains('include')) recalcAll();
  });
  tbody.addEventListener('click', (e) => {
    const btn = e.target.closest('.remove-row');
    if (!btn) return;
    const row = btn.closest('tr.epic-row');
    if (row) row.remove();
    recalcAll();
  });

  yearsEl.addEventListener('input', recalcAll);
  yearsEl.addEventListener('change', recalcAll);

  addBtn?.addEventListener('click', () => { addRow(); recalcAll(); });
  clearBtn?.addEventListener('click', clearAll);

  // DB I/O
  async function saveAll() {
    const items = [...tbody.querySelectorAll('tr.epic-row')].map(row => ({
      id: row.dataset.id || null,
      item: row.querySelector('.item')?.value?.trim() || '',
      amount: num(row.querySelector('.amount')?.value),
      frequency: row.querySelector('.freq')?.value || 'Once only',
      include: !!row.querySelector('.include')?.checked,
    }));
    const settings = { years: Math.max(1, Math.floor(num(yearsEl.value))) };

    try {
      const res = await fetch('/api/epic_one_off/bulk', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings, items })
      });
      if (!res.ok) throw new Error();
      alert('Saved.');
    } catch {
      alert('Save failed. Check server logs.');
    }
  }

  async function loadAll() {
    try {
      const res = await fetch('/api/epic_one_off');
      if (!res.ok) throw new Error();
      const payload = await res.json();
      yearsEl.value = payload?.settings?.years ?? 10;
      tbody.innerHTML = '';
      (payload?.items ?? []).forEach(addRow);
      if (!tbody.children.length) clearAll();
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

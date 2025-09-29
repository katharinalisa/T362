(() => {
  const table = document.getElementById('debtTable');
  const tbody = table?.querySelector('tbody');
  const rowTpl = document.getElementById('rowTpl');

  const addRowBtn = document.getElementById('addRowBtn');
  const clearAllBtn = document.getElementById('clearAllBtn');
  const saveBtn = document.getElementById('saveDebtBtn');
  const saveAndNextBtn = document.getElementById('saveAndNextBtn');

  if (!table || !tbody || !rowTpl) return;

  // ===== Helpers =====
  const toNum = v => {
    const n = parseFloat(String(v ?? '').replace(/[^\d.-]/g, ''));
    return Number.isFinite(n) ? n : 0;
  };

  function monthsToPayoff(P, annualRatePct, M) {
    const i = (annualRatePct / 100) / 12;
    if (P <= 0 || M <= 0) return null;
    if (i === 0) return Math.ceil(P / M);
    if (M <= P * i) return Infinity;
    const n = -Math.log(1 - i * P / M) / Math.log(1 + i);
    return Number.isFinite(n) ? Math.ceil(n) : Infinity;
  }

  function recalcRow(row) {
    const P = toNum(row.querySelector('.principal')?.value);
    const r = toNum(row.querySelector('.rate')?.value);
    const M = toNum(row.querySelector('.payment')?.value);

    const months = monthsToPayoff(P, r, M);
    const cell = row.querySelector('.years');

    if (months === null) {
      cell.textContent = '-';
    } else if (months === Infinity) {
      cell.textContent = '—';
      cell.title = 'Payment too small to ever repay';
    } else {
      const years = months / 12;
      cell.textContent = years.toFixed(2);
      cell.title = `${months} months`;
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
    const frag = rowTpl.content.cloneNode(true);
    tbody.appendChild(frag);
    recalcAll();
  });

  clearAllBtn?.addEventListener('click', () => {
    tbody.innerHTML = '';
    const frag = rowTpl.content.cloneNode(true);
    tbody.appendChild(frag);
    recalcAll();
  });

  saveBtn?.addEventListener('click', async () => {
    const original = saveBtn.textContent;
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';
    try {
      const data = await saveAll();
      if (data && !data.redirect) {
        alert(data.message || 'Debts saved!');
      }
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = original;
    }
  });

  saveAndNextBtn?.addEventListener('click', async () => {
    const original = saveAndNextBtn.textContent;
    saveAndNextBtn.disabled = true;
    saveAndNextBtn.textContent = 'Saving…';
    try {
      const data = await saveAll();
      if (data?.redirect) {
        window.location.href = data.redirect;
      } else if (data) {
        alert(data.message || 'Debts saved!');
      }
    } finally {
      saveAndNextBtn.disabled = false;
      saveAndNextBtn.textContent = original;
    }
  });

  tbody.addEventListener('input', (e) => {
    if (e.target.matches('.principal, .rate, .payment')) {
      const row = e.target.closest('tr.debt-row');
      if (row) recalcRow(row);
    }
  });

  // ===== Init =====
  recalcAll();
})();
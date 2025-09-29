(() => {
  // ===== DOM =====
  const table = document.getElementById('incomeTable');
  const tbody = table?.querySelector('tbody');
  const rowTemplate = document.getElementById('incomeRowTemplate');
  const addRowBtn = document.getElementById('addRowBtn');
  const clearAllBtn = document.getElementById('clearAllBtn');
  const saveAndNextBtn = document.getElementById('saveAndNextBtn');
  const saveBtn = document.getElementById('saveIncomeBtn');

  if (!table || !tbody || !rowTemplate) return;

  // ===== Utils =====
  const parseAmount = (v) => {
    const n = parseFloat(String(v ?? '').replace(/[^\d.-]/g, ''));
    return Number.isFinite(n) ? n : 0;
  };

  // ===== Rows =====
  function addRow(prefill = {}) {
    const frag = rowTemplate.content.cloneNode(true);
    const row = frag.querySelector('tr.income-row');

    row.querySelector('.source').value = prefill.source || '';
    row.querySelector('.amount').value = (prefill.amount ?? '') === null ? '' : prefill.amount ?? '';
    row.querySelector('.frequency').value = prefill.frequency || '';
    row.querySelector('.notes').value = prefill.notes || '';
    row.querySelector('.include-toggle').checked = prefill.include !== false;

    tbody.appendChild(frag);
  }

  function clearAll() {
    tbody.innerHTML = '';
    addRow(); // keep one empty row
  }

  function getRows() {
    return Array.from(tbody.querySelectorAll('tr.income-row')).map(row => ({
      source: row.querySelector('.source')?.value || '',
      amount: parseAmount(row.querySelector('.amount')?.value),
      frequency: row.querySelector('.frequency')?.value || '',
      notes: row.querySelector('.notes')?.value || '',
      include: row.querySelector('.include-toggle')?.checked || false
    }));
  }

  // ===== Events =====
  addRowBtn?.addEventListener('click', () => addRow());
  clearAllBtn?.addEventListener('click', clearAll);

  tbody.addEventListener('click', (e) => {
    const btn = e.target.closest('.remove-row');
    if (!btn) return;
    const row = btn.closest('tr.income-row');
    if (row) row.remove();
  });

  // ===== Save helper =====
  async function saveAll() {
    const incomes = getRows();
    try {
      const res = await fetch('/save-income', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ incomes })
      });
      if (res.status === 401) {
        alert('Please log in to save your income.');
        window.location.href = '/login';
        return null;
      }
      if (!res.ok) throw new Error();
      return await res.json(); // { message, redirect? }
    } catch {
      alert('Error saving income.');
      return null;
    }
  }

  saveAndNextBtn?.addEventListener('click', async () => {
    const original = saveAndNextBtn.textContent;
    saveAndNextBtn.disabled = true;
    saveAndNextBtn.textContent = 'Saving…';
    try {
      const data = await saveAll();
      if (data?.redirect) {
        window.location.href = data.redirect; // e.g., /expenses or next step
      } else if (data) {
        alert(data.message || 'Income saved!');
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
      if (data && !data.redirect) {
        alert(data.message || 'Income saved!');
      }
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = original;
    }
  });

  // ===== Init =====
  tbody.innerHTML = '';
  if (window.incomePrefill && Array.isArray(window.incomePrefill) && window.incomePrefill.length > 0) {
    window.incomePrefill.forEach(addRow);
  } else {
    addRow();
  }
})();

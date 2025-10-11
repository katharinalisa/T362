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

  const to2 = (v) => {
    const n = parseAmount(v);
    return Number.isFinite(n) ? Number(n.toFixed(2)) : 0;
  };

  function markStepComplete(stepKey) {
    let completed = JSON.parse(localStorage.getItem("completedSteps") || "[]");
    if (!completed.includes(stepKey)) {
      completed.push(stepKey);
      localStorage.setItem("completedSteps", JSON.stringify(completed));
    }
  }

  // ===== Rows =====
  function addRow(prefill = {}) {
    const frag = rowTemplate.content.cloneNode(true);
    const row = frag.querySelector('tr.income-row');

    row.querySelector('.source').value = prefill.source || '';
    row.querySelector('.amount').value = prefill.amount ? to2(prefill.amount).toFixed(2) : '';
    row.querySelector('.frequency').value = prefill.frequency || '';
    row.querySelector('.notes').value = prefill.notes || '';
    row.querySelector('.include-toggle').checked = prefill.include !== false;

    tbody.appendChild(frag);
    updateTotals();
  }

  function clearAll() {
    tbody.innerHTML = '';
    addRow();
    updateTotals();
  }

  function getRows() {
    return Array.from(tbody.querySelectorAll('tr.income-row')).map(row => ({
      source: row.querySelector('.source')?.value || '',
      amount: to2(row.querySelector('.amount')?.value),
      frequency: row.querySelector('.frequency')?.value || '',
      notes: row.querySelector('.notes')?.value || '',
      include: row.querySelector('.include-toggle')?.checked || false
    }));
  }

  function updateTotals() {
    const rows = Array.from(tbody.querySelectorAll('tr.income-row'));
    let annualTotal = 0;
    let weeklyTotal = 0;

    rows.forEach(row => {
      const amount = parseAmount(row.querySelector('.amount')?.value);
      const frequency = row.querySelector('.frequency')?.value.toLowerCase();
      const include = row.querySelector('.include-toggle')?.checked;

      let annual = 0;
      let weekly = 0;

      switch (frequency) {
        case 'weekly':
          weekly = amount;
          annual = amount * 52;
          break;
        case 'fortnightly':
          weekly = amount / 2;
          annual = amount * 26;
          break;
        case 'monthly':
          weekly = amount / 4.33;
          annual = amount * 12;
          break;
        case 'quarterly':
          weekly = amount / 13;
          annual = amount * 4;
          break;
        case 'annually':
          weekly = amount / 52;
          annual = amount;
          break;
      }

      // calculate annual and week
      row.querySelector('.annual').value = annual.toFixed(2);
      row.querySelector('.weekly').value = weekly.toFixed(2);

      if (include) {
        annualTotal += annual;
        weeklyTotal += weekly;
      }
    });

    document.getElementById('totalAnnualIncome').textContent = `$${annualTotal.toFixed(2)}`;
    document.getElementById('totalWeeklyIncome').textContent = `$${weeklyTotal.toFixed(2)}`;
  }

  
  // ===== Events =====
  addRowBtn?.addEventListener('click', () => addRow());
  clearAllBtn?.addEventListener('click', clearAll);

  tbody.addEventListener('click', (e) => {
    const btn = e.target.closest('.remove-row');
    if (btn) {
      const row = btn.closest('tr.income-row');
      if (row) row.remove();
      updateTotals();
    }
  });

  tbody.addEventListener('input', (e) => {
    const t = e.target;
    if (t.classList.contains('amount')) {
      let v = String(t.value).replace(/[^0-9.]/g, '');
      const firstDot = v.indexOf('.');
      if (firstDot !== -1) {
        v = v.slice(0, firstDot + 1) + v.slice(firstDot + 1).replace(/\./g, '');
      }
      if (v.includes('.')) {
        const [whole, decimal = ''] = v.split('.');
        v = `${whole}.${decimal.slice(0, 2)}`;
      }
      t.value = v;
    }
    updateTotals();
  });

  tbody.addEventListener('blur', (e) => {
    const t = e.target;
    if (t.classList.contains('amount')) {
      const n = parseAmount(t.value);
      t.value = Number.isFinite(n) ? n.toFixed(2) : '';
      updateTotals();
    }
  }, true);

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
      return await res.json();
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
      if (data) markStepComplete('income');
      if (data?.redirect) {
        window.location.href = data.redirect;
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
      if (data) markStepComplete('income');
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
  if (window.incomePrefill?.length > 0) {
    window.incomePrefill.forEach(addRow);
  } else {
    addRow();
  }

  tbody.querySelectorAll('.amount').forEach(inp => {
    const n = parseAmount(inp.value);
    inp.value = Number.isFinite(n) ? n.toFixed(2) : '';
  });

  updateTotals();
})();

(() => {
  const tbody  = document.querySelector('#layersTable tbody');
  const rowTpl = document.getElementById('layerRowTemplate');

  const addBtn   = document.getElementById('addRowBtn');
  const clearBtn = document.getElementById('clearAllBtn');
  const saveBtn  = document.getElementById('saveBtn');

  // === Progress helper (localStorage) ===
  function markStepComplete(stepKey) {
    let completed = JSON.parse(localStorage.getItem("completedSteps") || "[]");
    if (!completed.includes(stepKey)) {
      completed.push(stepKey);
      localStorage.setItem("completedSteps", JSON.stringify(completed));
    }
  }

  const saveAndNextBtn = document.getElementById('saveAndNextBtn');

  if (!tbody || !rowTpl) return;

  const toInt = (v) => {
    const n = parseInt(String(v ?? '').replace(/[^\d-]/g, ''), 10);
    return Number.isFinite(n) ? n : 0;
  };
  const toNum = (v) => {
    const n = parseFloat(String(v ?? '').replace(/[^\d.-]/g, ''));
    return Number.isFinite(n) ? n : 0;
  };

  function addRow(prefill = {}) {
    const frag = rowTpl.content.cloneNode(true);
    const row  = frag.querySelector('tr.layer-row');

    if (prefill.id) row.dataset.id = prefill.id;
    row.querySelector('.layer').value  = prefill.layer ?? '';
    row.querySelector('.desc').value   = prefill.description ?? '';
    row.querySelector('.start').value  = prefill.start_age ?? '';
    row.querySelector('.end').value    = prefill.end_age ?? '';
    row.querySelector('.amount').value = prefill.annual_amount ?? '';

    tbody.appendChild(frag);
  }

  function clearAll() {
    tbody.innerHTML = '';
 
    addRow();
  }

  // Remove row and keep one row
  tbody.addEventListener('click', (e) => {
    const btn = e.target.closest('.remove-row');
    if (!btn) return;
    const row = btn.closest('tr.layer-row');
    row?.remove();
    if (!tbody.querySelector('tr.layer-row')) addRow();
  });

  addBtn?.addEventListener('click', () => addRow());
  clearBtn?.addEventListener('click', clearAll);

  // ------- API I/O -------
  async function saveAll() {
    const items = [...tbody.querySelectorAll('tr.layer-row')].map(row => ({
      id: row.dataset.id || null,
      layer: row.querySelector('.layer')?.value?.trim() || '',
      description: row.querySelector('.desc')?.value?.trim() || '',
      start_age: toInt(row.querySelector('.start')?.value),
      end_age:   toInt(row.querySelector('.end')?.value),
      annual_amount: toNum(row.querySelector('.amount')?.value),
    }));

    // simple client-side guard: start <= end
    for (const it of items) {
      if (it.end_age && it.start_age && it.start_age > it.end_age) {
        alert(`"${it.layer || 'Row'}": Start age must be ≤ End age.`);
        return null;
      }
    }
    for (const it of items) {
      if (it.annual_amount < 0) {
        alert(`"${it.layer || 'Row'}": Annual amount must be ≥ 0.`);
        return null;
      }
    }

    try {
      const res = await fetch('/save-income_layers', {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({ items })
      });
      if (res.status === 401) {
        alert('Please log in to save your income layers.');
        window.location.href = '/login';
        return null;
      }
      if (!res.ok) throw new Error();
      const data = await res.json();
      return data; 
    } catch {
      alert('Error saving income layers.');
      return null;
    }
  }


  document.addEventListener('DOMContentLoaded', () => {
    tbody.innerHTML = '';

    const hasPrefill = Array.isArray(window.incomeLayersPrefill) && window.incomeLayersPrefill.length > 0;

    if (hasPrefill) {
      window.incomeLayersPrefill.forEach(addRow);
    } else {
      // Seed default income layers for first-time users
      const DEFAULT_LAYERS = [
        'Employment income',
        'Superannuation pension',
        'Investment income',
        'Age pension',
        'Rental/business income',
        'Other'
      ];
      DEFAULT_LAYERS.forEach(layer => addRow({ layer }));
    }
  });



  saveBtn?.addEventListener('click', async () => {
    const original = saveBtn.textContent;
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';
    try {
      const data = await saveAll();
      if (data) { markStepComplete('income_layers'); }
      if (data && !data.redirect) {
        alert(data.message || 'Income layers saved!');
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
      if (data) { markStepComplete('income_layers'); }
      if (data?.redirect) {
        window.location.href = data.redirect;
      } else if (data) {
        alert(data.message || 'Income layers saved!');
      }
    } finally {
      saveAndNextBtn.disabled = false;
      saveAndNextBtn.textContent = original;
    }
  });

})();

(() => {
  // ===== DOM =====
  const genderEl = document.getElementById('leGender');
  const pctEl = document.getElementById('lePercentile');
  const ageEl = document.getElementById('leAge');
  const expectedEl = document.getElementById('leExpected');
  const remainingEl = document.getElementById('leRemaining');
  const yearEl = document.getElementById('leYear');
  const resetBtn = document.getElementById('leReset');
  const saveAndNextBtn = document.getElementById('saveAndNextBtn');
  const saveBtn = document.getElementById('saveLifeExpectancyBtn'); // Optional extra save button

  if (!genderEl || !pctEl || !ageEl || !expectedEl || !remainingEl || !yearEl) return;

  // ===== Utils =====
  const TABLE = {
    male: {
      '25th percentile': 85,
      '50th percentile': 89,
      '75th percentile': 95,
      '90th percentile': 98,
    },
    female: {
      '25th percentile': 87,
      '50th percentile': 91,
      '75th percentile': 97,
      '90th percentile': 100,
    },
    couple: {
      '25th percentile': 92,
      '50th percentile': 95,
      '75th percentile': 98,
      '90th percentile': 101,
    },
  };

  const nowYear = () => new Date().getFullYear();
  const toNum = v => {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : NaN;
  };
  const setVal = (el, value) => {
    el.textContent = value ?? '—';
    el.classList.toggle('placeholder', value == null || value === '—');
  };

  // ===== Calculation =====
  function compute() {
    const genderKey = (genderEl.value || '').trim().toLowerCase();
    const pctKey = pctEl.value || '';
    const currentAge = toNum(ageEl.value);

    const lookup = TABLE[genderKey]?.[pctKey];
    if (!lookup || !Number.isFinite(currentAge)) {
      setVal(expectedEl, '—');
      setVal(remainingEl, '—');
      setVal(yearEl, '—');
      return;
    }

    const expected = lookup;
    const remaining = Math.max(expected - currentAge, 0);
    const year = nowYear() + Math.round(remaining);

    setVal(expectedEl, String(expected));
    setVal(remainingEl, String(Math.round(remaining)));
    setVal(yearEl, String(year));
  }

  function reset() {
    genderEl.value = '';
    pctEl.value = '';
    ageEl.value = '';
    setVal(expectedEl, '—');
    setVal(remainingEl, '—');
    setVal(yearEl, '—');
  }

  function prefill(data) {
    if (!data) return;
    if (data.gender) genderEl.value = data.gender;
    if (data.percentile) pctEl.value = data.percentile;
    if (data.current_age !== undefined && data.current_age !== null) ageEl.value = data.current_age;
    compute();
  }

  function getEstimateData() {
    return {
      gender: genderEl.value,
      percentile: pctEl.value,
      current_age: toNum(ageEl.value),
      expected_lifespan: expectedEl.textContent,
      years_remaining: remainingEl.textContent,
      estimated_year_of_death: yearEl.textContent
    };
  }

  // ===== Save helper =====
  async function saveAll() {
    const data = getEstimateData();
    if (
      !data.gender ||
      !data.percentile ||
      !Number.isFinite(data.current_age) ||
      data.expected_lifespan === '—'
    ) {
      alert("Please complete all fields before saving.");
      return null;
    }
    try {
      const res = await fetch('/save-lifeexpectancy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (res.status === 401) {
        alert('Please log in to save your estimate.');
        window.location.href = '/login';
        return null;
      }
      if (!res.ok) throw new Error();
      return await res.json();
    } catch {
      alert('Error saving life expectancy estimate.');
      return null;
    }
  }

  // ===== Events =====
  [genderEl, pctEl, ageEl].forEach(el => {
    if (el) {
      el.addEventListener('input', compute);
      el.addEventListener('change', compute);
    }
  });

  resetBtn?.addEventListener('click', reset);

  saveAndNextBtn?.addEventListener('click', async () => {
    const original = saveAndNextBtn.textContent;
    saveAndNextBtn.disabled = true;
    saveAndNextBtn.textContent = 'Saving…';
    try {
      const data = await saveAll();
      if (data?.redirect) {
        window.location.href = data.redirect;
      } else if (data) {
        alert(data.message || 'Life Expectancy estimate saved!');
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
        alert(data.message || 'Life Expectancy estimate saved!');
      }
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = original;
    }
  });

  // ===== Init =====
  if (window.lifeExpectancyPrefill && typeof window.lifeExpectancyPrefill === 'object') {
    prefill(window.lifeExpectancyPrefill);
  } else {
    reset();
  }
})();
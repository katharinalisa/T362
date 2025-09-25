
(() => {
  const genderEl = document.getElementById('leGender');
  const pctEl = document.getElementById('lePercentile');
  const ageEl = document.getElementById('leAge');

  const expectedEl = document.getElementById('leExpected');
  const remainingEl = document.getElementById('leRemaining');
  const yearEl = document.getElementById('leYear');
  const resetBtn = document.getElementById('leReset');
  const saveAndNextBtn = document.getElementById('saveAndNextBtn');

  if (!genderEl || !pctEl || !ageEl || !expectedEl || !remainingEl || !yearEl) return;

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
    el.classList.toggle('placeholder', value == null);
  };

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

  saveAndNextBtn?.addEventListener('click', () => {
    const data = getEstimateData();
    if (!data.gender || !data.percentile || !Number.isFinite(data.current_age) || data.expected_lifespan === '—') {
      alert("Please complete all fields before saving.");
      return;
    }

    fetch('/save-lifeexpectancy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    .then(res => {
      if (res.status === 401) {
        alert('Please log in to save your estimate.');
        window.location.href = '/login';
        return;
      }
      return res.json();
    })
    .then(data => {
      if (data?.redirect) {
        window.location.href = data.redirect;
      } else {
        alert(data?.message || 'Life Expectancy estimate saved!');
      }
    })
    .catch(() => alert('Error saving life expectancy estimate.'));
  });

  [genderEl, pctEl, ageEl].forEach(el => {
    el.addEventListener('input', compute);
    el.addEventListener('change', compute);
  });
  resetBtn?.addEventListener('click', reset);

  reset(); // initialize on load
})();

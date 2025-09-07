(() => {
  // DOM
  const genderEl = document.getElementById('leGender');
  const pctEl = document.getElementById('lePercentile');
  const ageEl = document.getElementById('leAge');

  const expectedEl = document.getElementById('leExpected');
  const remainingEl = document.getElementById('leRemaining');
  const yearEl = document.getElementById('leYear');
  const resetBtn = document.getElementById('leReset');

  if (!genderEl || !pctEl || !ageEl) return;

  // Percentile → expected lifespan (years), by gender
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

  function toNum(v) {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : NaN;
  }

  function setVal(el, value) {
    el.textContent = value ?? '—';
    el.classList.toggle('placeholder', value == null);
  }

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

  // Events
  [genderEl, pctEl, ageEl].forEach((el) => {
    el.addEventListener('input', compute);
    el.addEventListener('change', compute);
  });
  resetBtn?.addEventListener('click', reset);

  // Init
  reset();
})();

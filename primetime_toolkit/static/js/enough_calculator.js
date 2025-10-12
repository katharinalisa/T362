(() => {
  // Elements
  const useFB = document.getElementById('ecUseFB');
  const manualWrap = document.getElementById('ecManualWrap');
  const manualAnnual = document.getElementById('ecManualAnnual');

  const fbAnnualEl = document.getElementById('ecFBAnnual');
  const refreshFB = document.getElementById('ecRefreshFB');

  const realRate = document.getElementById('ecRealRate');
  const years = document.getElementById('ecYears');
  const pension = document.getElementById('ecPension');
  const ptIncome = document.getElementById('ecPTIncome');
  const ptYrs = document.getElementById('ecPTYrs');

  const outShortfall = document.getElementById('ecShortfall');
  const outLumpSimple = document.getElementById('ecLumpSimple');
  const outLumpAnnuity = document.getElementById('ecLumpAnnuity');

  const resetBtn = document.getElementById('ecReset');

  const AUD = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 });
  const num = (v) => {
    const n = parseFloat(String(v ?? '').replace(/[^\d.-]/g, ''));
    return Number.isFinite(n) ? n : 0;
  };
  const setText = (el, val) => { el.textContent = val; el.classList.toggle('placeholder', val === '—'); };

  let fbAverageAnnual = 0;


  function toggleManual() {
    const show = (useFB.value || 'Yes') === 'No';
    manualWrap.style.display = show ? '' : 'none';
  }

  function compute() {
    const useFBSpend = (useFB.value || 'Yes') === 'Yes';
    const annualSpend = useFBSpend ? fbAverageAnnual : num(manualAnnual.value);

    const r = num(realRate.value) / 100;        // real rate as decimal
    const N = Math.max(0, Math.floor(num(years.value)));
    const pensionY = num(pension.value);       // per year
    const ptIncomeY = num(ptIncome.value);
    const ptYears = Math.max(0, num(ptYrs.value));

    // Spread part-time income across retirement years
    const avgPartTimePerYear = N > 0 ? (ptIncomeY * Math.min(ptYears, N)) / N : 0;

    // Adjusted annual shortfall
    let shortfall = Math.max(annualSpend - pensionY - avgPartTimePerYear, 0);

    // Rule-of-thumb
    let lumpSimple;
    if (r > 0) {
      lumpSimple = shortfall / r;
    } else {
      // If r=0, fall back to "shortfall × years"
      lumpSimple = shortfall * N;
    }

    // Annuity PV
    let lumpAnnuity;
    if (r > 0) {
      lumpAnnuity = shortfall * (1 - Math.pow(1 + r, -N)) / r;
    } else {
      lumpAnnuity = shortfall * N;
    }

    // Output
    setText(outShortfall, AUD.format(shortfall));
    setText(outLumpSimple, AUD.format(lumpSimple));
    setText(outLumpAnnuity, AUD.format(lumpAnnuity));
  }

  function resetAll() {
    useFB.value = 'Yes';
    manualAnnual.value = '';
    realRate.value = '3';
    years.value = '25';
    pension.value = '';
    ptIncome.value = '';
    ptYrs.value = '0';
    toggleManual();
    setText(outShortfall, '—');
    setText(outLumpSimple, '—');
    setText(outLumpAnnuity, '—');
    loadFBAnnual();
  }

  // Events
  [useFB, manualAnnual, realRate, years, pension, ptIncome, ptYrs].forEach(el => {
    el.addEventListener('input', compute);
    el.addEventListener('change', compute);
  });
  refreshFB.addEventListener('click', loadFBAnnual);
  resetBtn.addEventListener('click', resetAll);

  // Init
  toggleManual();
  resetAll();
})();

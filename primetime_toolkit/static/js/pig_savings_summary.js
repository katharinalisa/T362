(() => {
  const fmt = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'AUD' });

  function fv({ start=0, monthly=0, rate=12, period=2, unit='years' }) {
    const n = unit === 'months' ? Number(period) : Number(period) * 12;
    const i = Number(rate) / 100 / 12;
    const P = Number(start);
    const PMT = Number(monthly);
    if (!Number.isFinite(n) || n <= 0) return P;
    if (i === 0) return P + PMT * n;
    const g = Math.pow(1 + i, n);
    return (P * g) + PMT * ((g - 1) / i);
  }

  const form = document.getElementById('sumPigForm');
  const out  = document.getElementById('sumPigOut');

  function run() {
    const start   = Number(document.getElementById('sumPigStart')?.value || 0);
    const monthly = Number(document.getElementById('sumPigMonthly')?.value || 0);
    const period  = Number(document.getElementById('sumPigPeriod')?.value || 0);
    const rate    = Number(document.getElementById('sumPigRate')?.value || 0);
    const unit    = document.querySelector('input[name="sumPigUnit"]:checked')?.value || 'years';
    out.textContent = fmt.format(fv({ start, monthly, rate, period, unit }));
  }

  form?.addEventListener('submit', (e) => { e.preventDefault(); run(); });
  form?.addEventListener('input', run);
  run();
})();
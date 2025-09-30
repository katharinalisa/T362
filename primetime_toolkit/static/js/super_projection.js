(function () {
  // --- helpers ---
  const $ = (id) => document.getElementById(id);
  const AUD = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'AUD', minimumFractionDigits: 0 });

  const fields = [
    'sp_start_age','sp_retire_age','sp_end_age','sp_years',
    'sp_opening','sp_return','sp_gross_contrib','sp_contrib_tax',
    'sp_drawdown','sp_inflation'
  ];

  const n = (v) => {
    const x = parseFloat(String(v ?? '').replace(/[^\d.-]/g, ''));
    return Number.isFinite(x) ? x : 0;
  };

  function recomputeYears() {
    const start = n($('sp_start_age').value);
    const end   = n($('sp_end_age').value);
    $('sp_years').value = Math.max(1, Math.floor(end - start + 1));
  }

  // recompute when ages change
  ['sp_start_age','sp_end_age'].forEach(id => {
    $(id)?.addEventListener('input', recomputeYears);
  });

  function readAssumptions() {
    return {
      startAge:        n($('sp_start_age').value),
      retireAge:       n($('sp_retire_age').value),
      endAge:          n($('sp_end_age').value),
      years:           n($('sp_years').value),
      opening:         n($('sp_opening').value),
      netReturnPct:    n($('sp_return').value),
      grossContrib:    n($('sp_gross_contrib').value),
      contribTaxPct:   n($('sp_contrib_tax').value),
      drawdown:        n($('sp_drawdown').value),
      inflationPct:    n($('sp_inflation').value)
    };
  }

  function writeAssumptions(a) {
    if (!a) return;
    $('sp_start_age').value     = a.startAge ?? 50;
    $('sp_retire_age').value    = a.retireAge ?? 60;
    $('sp_end_age').value       = a.endAge ?? 90;
    $('sp_opening').value       = a.opening ?? 200000;
    $('sp_return').value        = a.netReturnPct ?? 5.5;
    $('sp_gross_contrib').value = a.grossContrib ?? 15000;
    $('sp_contrib_tax').value   = a.contribTaxPct ?? 15;
    $('sp_drawdown').value      = a.drawdown ?? 45000;
    $('sp_inflation').value     = a.inflationPct ?? 2.5;
    recomputeYears();
  }

  function project(a) {
    const r  = (a.netReturnPct   / 100);
    const ct = (a.contribTaxPct  / 100);
    const inf= (a.inflationPct   / 100);

    const rows = [];
    let closingPrev = a.opening;

    for (let i = 0; i < a.years; i++) {
      const year = i + 1;
      const age  = a.startAge + i;
      const opening = (i === 0 ? a.opening : closingPrev);

      const grossContrib = age < a.retireAge ? a.grossContrib : 0;
      const contribTax   = grossContrib * ct;
      const netContrib   = grossContrib - contribTax;

      // user-friendly: return on opening balance only
      const netReturn    = opening * r;

      const drawdown     = age >= a.retireAge ? a.drawdown : 0;

      let closing        = opening + netContrib + netReturn - drawdown;
      if (closing < 0) closing = 0;

      const realClosing  = closing / Math.pow(1 + inf, year);

      rows.push({
        year, age,
        opening,
        grossContrib, contribTax, netContrib,
        netReturn, drawdown,
        closing, realClosing
      });

      closingPrev = closing;
    }
    return rows;
  }

  function render(rows) {
    const tbody = $('sp_tbody');
    tbody.innerHTML = rows.map(r => `
      <tr>
        <td>${r.year}</td>
        <td>${r.age}</td>
        <td class="text-end">${AUD.format(r.opening)}</td>
        <td class="text-end">${AUD.format(r.grossContrib)}</td>
        <td class="text-end">${AUD.format(r.contribTax)}</td>
        <td class="text-end">${AUD.format(r.netContrib)}</td>
        <td class="text-end">${AUD.format(r.netReturn)}</td>
        <td class="text-end">${AUD.format(r.drawdown)}</td>
        <td class="text-end fw-semibold">${AUD.format(r.closing)}</td>
        <td class="text-end">${AUD.format(r.realClosing)}</td>
      </tr>
    `).join('');

    if (rows.length) {
      $('sp_end_nominal').textContent = AUD.format(rows[rows.length - 1].closing);
      $('sp_end_real').textContent    = AUD.format(rows[rows.length - 1].realClosing);
    } else {
      $('sp_end_nominal').textContent = '$0';
      $('sp_end_real').textContent    = '$0';
    }
  }

  function calcAndRender() {
    const a = readAssumptions();
    a.years = Math.max(1, Math.floor(a.endAge - a.startAge + 1)); // guard
    $('sp_years').value = a.years;
    const rows = project(a);
    render(rows);
    return rows;
  }

  // CSV export
  function toCSV(rows) {
    const header = [
      'Year','Age','Opening balance','Gross contribution','Contribution tax',
      'Net contribution','Net return','Drawdown','Closing balance','Real closing balance'
    ];
    const lines = [header.join(',')];
    for (const r of rows) {
      lines.push([
        r.year, r.age,
        r.opening, r.grossContrib, r.contribTax,
        r.netContrib, r.netReturn, r.drawdown,
        r.closing, r.realClosing
      ].join(','));
    }
    return lines.join('\n');
  }

  function downloadCSV(rows) {
    const blob = new Blob([toCSV(rows)], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = 'super_projection.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // API
  async function loadAssumptions() {
    try {
      const res = await fetch('/api/super_projection');
      if (!res.ok) throw new Error();
      const data = await res.json();
      writeAssumptions(data || {});
      calcAndRender();
    } catch {
      // fall back to defaults already in the form
      calcAndRender();
    }
  }

  async function saveAssumptions() {
    const btn = $('sp_save');
    const original = btn?.textContent;
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Saving…';
    }

    const a = readAssumptions();
    a.years = Math.max(1, Math.floor(a.endAge - a.startAge + 1));
    try {
      const res = await fetch('/api/super_projection/save', {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify(a)
      });
      if (!res.ok) throw new Error();
      alert('Super Projection saved successfully!');
    } catch {
      alert('Save failed. Check server logs.');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = original;
      }
    }
  }

  // wires
  $('sp_calc')?.addEventListener('click', calcAndRender);
  $('sp_csv')?.addEventListener('click', () => downloadCSV(calcAndRender()));
  $('sp_load')?.addEventListener('click', loadAssumptions);
  $('sp_save')?.addEventListener('click', saveAssumptions);

  // init
  document.addEventListener('DOMContentLoaded', () => {
    recomputeYears();
    loadAssumptions();

    // Wire buttons after DOM is ready
    $('sp_back')?.addEventListener('click', () => {
      window.location.href = '/spending';
    });

    $('sp_and_next')?.addEventListener('click', async () => {
      const btn = $('sp_and_next');
      const original = btn?.textContent;
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Saving…';
      }

      const a = readAssumptions();
      a.years = Math.max(1, Math.floor(a.endAge - a.startAge + 1));
      let ok = false;
      try {
        const res = await fetch('/api/super_projection/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(a)
        });
        ok = res.ok;
        if (!ok) throw new Error();
      } catch (e) {
        alert('Save failed. Redirecting to Debt Paydown anyway.');
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.textContent = original;
        }
        // Always go to Debt Paydown as requested
        window.location.href = '/debt_paydown';
      }
    });
  });
})();

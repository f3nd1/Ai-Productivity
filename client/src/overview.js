// Pure aggregation for the Overview dashboard — no React, so overview.test.mjs
// can verify the sums. Reuses the exact Section C calculators (computeResult) so
// Overview figures can't drift from what each initiative page shows.
import { computeResult } from './calc.js';

const round1 = (n) => Math.round(n * 10) / 10;
const num = (v) => (v === '' || v == null ? NaN : Number(v));
const filled = (v) => v != null && String(v).trim() !== '';

// D14/D15 are trivial arithmetic living inline in SectionD.jsx (not the Section C
// calculator module); mirrored here exactly. adoption% = trained/total*100,
// hours/week = hoursPerWeek * staffAffected.
export function d14Adoption(sd) {
  const t = num(sd?.d14_staff_trained);
  const tot = num(sd?.d14_total_staff);
  return Number.isFinite(t) && Number.isFinite(tot) && tot > 0 ? Math.round((t / tot) * 100) : null;
}
export function d15HoursPerWeek(sd) {
  const h = num(sd?.d15_hours_per_week);
  const s = num(sd?.d15_staff_affected);
  return Number.isFinite(h) && Number.isFinite(s) ? h * s : null;
}

// How many of the 9 form questions have usable content: raw text for B/D,
// a generated answer (final_answers) for C.
export function completeness(initiative, sd) {
  const fa = initiative.final_answers || {};
  const checks = [
    initiative.b8_problem,
    initiative.b9_significance,
    initiative.b10_solution,
    fa.c11,
    fa.c12,
    fa.c13,
    sd?.d14_narrative,
    sd?.d15_narrative,
    sd?.d16_narrative,
  ];
  return checks.filter(filled).length; // out of 9
}

export function computeOverview({ initiatives = [], results = [], sectionDList = [] }) {
  const sdFor = (id) => sectionDList.find((d) => d.initiative_id === id) || null;

  const rows = initiatives.map((init) => {
    const rs = results.filter((r) => r.initiative_id === init.id);
    const counts = { productivity: 0, financial: 0, operational: 0 };
    let monthly = 0;
    let hasFinancial = false;
    const pcts = [];
    for (const r of rs) {
      counts[r.type] = (counts[r.type] || 0) + 1;
      if (r.type === 'financial') {
        const out = computeResult('financial', r.fields || {});
        if (Number.isFinite(out.monthly)) {
          monthly += out.monthly;
          hasFinancial = true;
        }
      } else if (r.type === 'productivity') {
        const out = computeResult('productivity', r.fields || {});
        if (Number.isFinite(out.pct)) pcts.push(out.pct);
      }
    }
    const sd = sdFor(init.id);
    return {
      id: init.id,
      name: init.name || 'Untitled initiative',
      department: init.department || '',
      counts,
      monthly: hasFinancial ? monthly : null,
      avgProductivityPct: pcts.length ? round1(pcts.reduce((a, b) => a + b, 0) / pcts.length) : null,
      d14Adoption: d14Adoption(sd),
      d15Hours: d15HoursPerWeek(sd),
      completeness: completeness(init, sd),
    };
  });

  const byType = { productivity: 0, financial: 0, operational: 0 };
  let totalMonthly = 0;
  let totalAnnual = 0;
  const allPcts = [];
  for (const r of results) {
    byType[r.type] = (byType[r.type] || 0) + 1;
    if (r.type === 'financial') {
      const out = computeResult('financial', r.fields || {});
      if (Number.isFinite(out.monthly)) totalMonthly += out.monthly;
      if (Number.isFinite(out.annual)) totalAnnual += out.annual;
    } else if (r.type === 'productivity') {
      const out = computeResult('productivity', r.fields || {});
      if (Number.isFinite(out.pct)) allPcts.push(out.pct);
    }
  }
  let totalD15Hours = 0;
  for (const sd of sectionDList) {
    const h = d15HoursPerWeek(sd);
    if (h != null) totalD15Hours += h;
  }

  const summary = {
    totalInitiatives: initiatives.length,
    totalResults: results.length,
    byType,
    totalMonthly,
    totalAnnual,
    avgProductivityPct: allPcts.length ? round1(allPcts.reduce((a, b) => a + b, 0) / allPcts.length) : null,
    totalD15Hours,
  };

  return { summary, rows };
}


function csvCell(value) {
  const text = value == null ? '' : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export function overviewRowsToCsv(rows = []) {
  const headers = [
    'Initiative',
    'Department',
    'Productivity Results',
    'Financial Results',
    'Operational Results',
    'Saved Monthly (SGD)',
    'Average Productivity Gain (%)',
    'D14 Adoption (%)',
    'D15 Hours Freed Per Week',
    'Completeness (out of 9)',
  ];

  const lines = [headers.map(csvCell).join(',')];
  for (const row of rows) {
    lines.push(
      [
        row.name,
        row.department || 'Not set',
        row.counts?.productivity ?? 0,
        row.counts?.financial ?? 0,
        row.counts?.operational ?? 0,
        row.monthly,
        row.avgProductivityPct,
        row.d14Adoption,
        row.d15Hours,
        row.completeness,
      ]
        .map(csvCell)
        .join(',')
    );
  }
  return lines.join('\r\n');
}

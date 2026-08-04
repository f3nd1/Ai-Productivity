// Pure aggregation for the Overview dashboard — no React, so overview.test.mjs
// can verify the sums. Reuses the exact Section C calculators (computeResult) so
// Overview figures can't drift from what each initiative page shows.
import { computeResult } from './calc.js';
import { toCsv } from './csv.js';

const round1 = (n) => Math.round(n * 10) / 10;
const num = (v) => (v === '' || v == null ? NaN : Number(v));
const filled = (v) => v != null && String(v).trim() !== '';

// D14/D15 are trivial arithmetic living inline in SectionD.jsx (not the Section C
// calculator module); mirrored here exactly. adoption% = trained/total*100,
// hours/week = hoursPerWeek * staffAffected. Section D is one overall row for
// the whole submission, so these are organisation-wide figures, not per-initiative.
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

// A B/D answer this short is almost certainly a placeholder rather than a real
// answer. It still scores — the question IS answered — but it's flagged so the
// UI can distinguish "backed by evidence" from "text exists but looks thin".
const THIN_WORDS = 20;
const wordCount = (v) => String(v || '').trim().split(/\s+/).filter(Boolean).length;

// Per-question status for one initiative. Statuses that count toward the score:
//   'evidence' — C: at least one linked result of that type. B/D: real prose.
//   'thin'     — B/D: answered, but short enough to be worth a second look.
//   'na'       — C: explicitly declared not applicable to this initiative.
// Statuses that do NOT count:
//   'empty'    — nothing there.
//   'stale'    — C: generated text is stored but the results behind it are gone
//                (or never existed). Text alone is not evidence; this is exactly
//                the case that used to score a free point.
//   'blocked'  — D: the shared Section D is written, but this initiative has no
//                Section C evidence of its own, so it isn't yet contributing to
//                the submission and doesn't inherit the shared answer's credit.
const COUNTS = new Set(['evidence', 'thin', 'na']);

const textStatus = (v) => {
  if (!filled(v)) return 'empty';
  return wordCount(v) < THIN_WORDS ? 'thin' : 'evidence';
};

// `results` is every result (any initiative) or just this initiative's — both
// work, since it filters by initiative_id. `sd` is the ONE overall Section D.
export function completeness(initiative, results = [], sd = null) {
  const own = (results || []).filter((r) => r.initiative_id === initiative.id);
  const na = initiative.not_applicable || {};
  const fa = initiative.final_answers || {};
  const countOf = (type) => own.filter((r) => r.type === type).length;

  // Does this initiative contribute ANY measurable evidence yet? The shared
  // Section D only counts for initiatives that do.
  const hasAnyC = own.length > 0;

  const cStatus = (qid, type) => {
    if (countOf(type) > 0) return 'evidence';
    if (na[qid] === true) return 'na';
    return filled(fa[qid]) ? 'stale' : 'empty';
  };
  const dStatus = (v) => (hasAnyC ? textStatus(v) : filled(v) ? 'blocked' : 'empty');

  const questions = {
    b8: textStatus(initiative.b8_problem),
    b9: textStatus(initiative.b9_significance),
    b10: textStatus(initiative.b10_solution),
    c11: cStatus('c11', 'productivity'),
    c12: cStatus('c12', 'financial'),
    c13: cStatus('c13', 'operational'),
    d14: dStatus(sd?.d14_narrative),
    d15: dStatus(sd?.d15_narrative),
    d16: dStatus(sd?.d16_narrative),
  };

  const values = Object.values(questions);
  return {
    questions,
    hasAnyC,
    resultCount: own.length,
    score: values.filter((s) => COUNTS.has(s)).length, // out of 9
    // Questions carried by prose alone — "answered" but worth revisiting.
    thin: values.filter((s) => s === 'thin').length,
    // Generated C text with no results behind it. Never counts; surfaced so the
    // UI can warn instead of silently dropping the score.
    stale: values.filter((s) => s === 'stale').length,
  };
}

// `sectionD` is the single overall Section D row (or null). Its figures belong
// to the summary, not to any one initiative's row.
export function computeOverview({ initiatives = [], results = [], sectionD = null }) {
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
    const score = completeness(init, rs, sectionD);
    return {
      id: init.id,
      name: init.name || 'Untitled initiative',
      department: init.department || '',
      counts,
      monthly: hasFinancial ? monthly : null,
      avgProductivityPct: pcts.length ? round1(pcts.reduce((a, b) => a + b, 0) / pcts.length) : null,
      completeness: score.score,
      thin: score.thin,
      stale: score.stale,
      updatedAt: init.updated_at || init.created_at || null,
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
  const summary = {
    totalInitiatives: initiatives.length,
    totalResults: results.length,
    byType,
    totalMonthly,
    totalAnnual,
    avgProductivityPct: allPcts.length ? round1(allPcts.reduce((a, b) => a + b, 0) / allPcts.length) : null,
    // Organisation-wide, straight off the single Section D row.
    d14Adoption: d14Adoption(sectionD),
    totalD15Hours: d15HoursPerWeek(sectionD) ?? 0,
  };

  return { summary, rows };
}


// Sortable columns for the Overview table. Kept here (not in the JSX) so the
// comparator is testable — `label` is the only presentational bit.
export const OVERVIEW_COLUMNS = [
  { key: 'name', label: 'Initiative', value: (r) => (r.name || '').toLowerCase(), text: true },
  { key: 'department', label: 'Department', value: (r) => (r.department || '').toLowerCase(), text: true },
  {
    key: 'results',
    label: 'C results',
    value: (r) => r.counts.productivity + r.counts.financial + r.counts.operational,
  },
  { key: 'monthly', label: 'Saved monthly', value: (r) => r.monthly },
  { key: 'productivity', label: 'Productivity', value: (r) => r.avgProductivityPct },
  { key: 'completeness', label: 'Complete', value: (r) => r.completeness },
];

// Missing values (no financial result, no department) always sort last in BOTH
// directions — otherwise "saved monthly, ascending" would lead with a wall of
// blanks and bury the figures the user actually wants to triage.
export function sortOverviewRows(rows, key, dir = 'asc') {
  const col = OVERVIEW_COLUMNS.find((c) => c.key === key);
  if (!col) return rows;
  const sign = dir === 'asc' ? 1 : -1;
  const missing = (v) => v === null || v === undefined || v === '';
  return [...rows].sort((a, b) => {
    const av = col.value(a);
    const bv = col.value(b);
    if (missing(av) || missing(bv)) return missing(av) && missing(bv) ? 0 : missing(av) ? 1 : -1;
    return (col.text ? av.localeCompare(bv) : av - bv) * sign;
  });
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
    'Completeness (out of 9)',
  ];

  return toCsv(
    headers,
    rows.map((row) => [
      row.name,
      row.department || 'Not set',
      row.counts?.productivity ?? 0,
      row.counts?.financial ?? 0,
      row.counts?.operational ?? 0,
      row.monthly,
      row.avgProductivityPct,
      row.completeness,
    ])
  );
}

// node src/overview.test.mjs
import assert from 'node:assert';
import { computeOverview, overviewRowsToCsv, completeness, sortOverviewRows } from './overview.js';

// ============================================================
// completeness — the scoring bug: text alone used to score a point, so an
// initiative with ZERO Section C results could read 9/9 "submission ready".
// ============================================================
const LONG = 'word '.repeat(30).trim(); // comfortably over the thin threshold
const FULL_D = { d14_narrative: LONG, d15_narrative: LONG, d16_narrative: LONG };

// The exact regression: every text field filled (including generated C answers)
// but not one Section C result behind them.
const ghost = {
  id: 'ghost',
  b8_problem: LONG,
  b9_significance: LONG,
  b10_solution: LONG,
  final_answers: { c11: LONG, c12: LONG, c13: LONG },
};
const ghostScore = completeness(ghost, [], FULL_D);
assert.equal(ghostScore.score, 3, 'zero results ⇒ only the three B answers may score');
assert.equal(ghostScore.questions.c11, 'stale'); // generated text, no results
assert.equal(ghostScore.questions.c12, 'stale');
assert.equal(ghostScore.questions.c13, 'stale');
assert.equal(ghostScore.stale, 3);
// Shared Section D must not hand free credit to an initiative with no evidence.
assert.equal(ghostScore.questions.d14, 'blocked');
assert.equal(ghostScore.questions.d15, 'blocked');
assert.equal(ghostScore.questions.d16, 'blocked');
assert.equal(ghostScore.hasAnyC, false);
assert.ok(ghostScore.score < 9, 'a result-less initiative can never read submission-ready');

// One real result unblocks the shared Section D and scores its own C question.
const oneResult = [{ initiative_id: 'ghost', type: 'productivity', fields: {} }];
const withOne = completeness(ghost, oneResult, FULL_D);
assert.equal(withOne.questions.c11, 'evidence');
assert.equal(withOne.questions.c12, 'stale'); // still no financial result
assert.equal(withOne.questions.d14, 'evidence'); // now contributing, so D counts
assert.equal(withOne.score, 3 + 1 + 3); // B×3 + C11 + D×3 = 7

// Explicit "not applicable" scores without needing a result behind it.
const declared = { ...ghost, not_applicable: { c12: true, c13: true } };
assert.equal(completeness(declared, oneResult, FULL_D).score, 9);
assert.equal(completeness(declared, oneResult, FULL_D).questions.c12, 'na');
// ...but N/A alone still can't unblock Section D without real evidence.
const declaredNoResults = completeness(declared, [], FULL_D);
assert.equal(declaredNoResults.questions.d14, 'blocked');
assert.equal(declaredNoResults.score, 5); // B×3 + two N/A; no C evidence, no D

// Thin prose still counts as answered, but is flagged for a second look.
const thin = completeness(
  { id: 't', b8_problem: 'Too slow.', b9_significance: LONG, b10_solution: LONG },
  oneResult.map((r) => ({ ...r, initiative_id: 't' })),
  FULL_D
);
assert.equal(thin.questions.b8, 'thin');
assert.equal(thin.questions.b9, 'evidence');
assert.equal(thin.thin, 1);

// Empty everything scores zero, and results belonging to OTHER initiatives
// must not leak in.
const empty = completeness({ id: 'e' }, oneResult, FULL_D);
assert.equal(empty.score, 0);
assert.equal(empty.resultCount, 0);
assert.equal(empty.questions.b8, 'empty');


const initiatives = [
  { id: 'A', name: 'Alpha', department: 'Quality Assurance', b8_problem: 'x', b9_significance: 'y', b10_solution: '', final_answers: { c11: 'gen' } },
  { id: 'B', name: 'Beta', department: 'Academic', b8_problem: 'x', b9_significance: '', b10_solution: '', final_answers: {} },
];
const results = [
  // A: financial time-based 10h*$30*4.33 = 1299/mo, 15588/yr; productivity 100→130 = 30%
  { initiative_id: 'A', type: 'financial', fields: { timeBased: true, hoursPerWeek: 10, rate: 30 } },
  { initiative_id: 'A', type: 'productivity', fields: { before: 100, after: 130, direction: 'higher' } },
  // B: financial direct $1000/mo, 12000/yr; productivity 50→75 = 50%; one operational
  { initiative_id: 'B', type: 'financial', fields: { timeBased: false, directMonthly: 1000 } },
  { initiative_id: 'B', type: 'productivity', fields: { before: 50, after: 75, direction: 'higher' } },
  { initiative_id: 'B', type: 'operational', fields: { before: 85, after: 98, unit: '%' } },
];
// ONE overall Section D for the whole submission (not per initiative).
const sectionD = {
  d14_narrative: 'trained',
  d14_staff_trained: 8,
  d14_total_staff: 10,
  d15_narrative: 'freed',
  d15_hours_per_week: 5,
  d15_staff_affected: 4,
  d16_narrative: 'ready',
};

const { summary, rows } = computeOverview({ initiatives, results, sectionD });

// --- summary (manually summed) ---
assert.equal(summary.totalInitiatives, 2);
assert.equal(summary.totalResults, 5);
assert.deepEqual(summary.byType, { productivity: 2, financial: 2, operational: 1 });
assert.equal(summary.totalMonthly, 1299 + 1000); // 2299
assert.equal(summary.totalAnnual, 15588 + 12000); // 27588
assert.equal(summary.avgProductivityPct, 40); // (30 + 50)/2
// Section D figures are organisation-wide now: one adoption %, one hours total.
assert.equal(summary.d14Adoption, 80); // 8/10
assert.equal(summary.totalD15Hours, 20); // 5*4 — counted once, not per initiative

// --- row A ---
const a = rows.find((r) => r.id === 'A');
assert.equal(a.department, 'Quality Assurance');
assert.deepEqual(a.counts, { productivity: 1, financial: 1, operational: 0 });
assert.equal(a.monthly, 1299);
assert.equal(a.avgProductivityPct, 30);
// D figures are no longer per-initiative.
assert.equal(a.d14Adoption, undefined);
assert.equal(a.d15Hours, undefined);
// b8 + b9 (thin but answered) + c11 & c12 (real results) + the 3 shared D
// answers, which count because A has evidence. b10 blank, c13 has no result.
assert.equal(a.completeness, 7);

// --- row B ---
const b = rows.find((r) => r.id === 'B');
assert.equal(b.department, 'Academic');
assert.deepEqual(b.counts, { productivity: 1, financial: 1, operational: 1 });
assert.equal(b.monthly, 1000);
assert.equal(b.avgProductivityPct, 50);
// b8 + all three C questions (B has one result of each type) + 3 shared D.
assert.equal(b.completeness, 7);

// No Section D saved yet → summary D figures degrade to null/0, rows still work.
const bare = computeOverview({ initiatives, results, sectionD: null });
assert.equal(bare.summary.d14Adoption, null);
assert.equal(bare.summary.totalD15Hours, 0);
// No Section D ⇒ D14-16 empty, so B keeps b8 + its three evidence-backed C questions.
assert.equal(bare.rows.find((r) => r.id === 'B').completeness, 4);

// --- Overview table sorting ---
const sortRows = [
  { id: 'x', name: 'Beta', department: 'Academic', counts: { productivity: 1, financial: 0, operational: 0 }, monthly: 500, avgProductivityPct: null, completeness: 4 },
  { id: 'y', name: 'alpha', department: '', counts: { productivity: 0, financial: 0, operational: 0 }, monthly: null, avgProductivityPct: 30, completeness: 9 },
  { id: 'z', name: 'Gamma', department: 'Finance', counts: { productivity: 2, financial: 1, operational: 0 }, monthly: 2000, avgProductivityPct: 10, completeness: 1 },
];
const ids = (rows) => rows.map((r) => r.id).join('');
// Name sort is case-insensitive, so "alpha" leads "Beta".
assert.equal(ids(sortOverviewRows(sortRows, 'name', 'asc')), 'yxz');
assert.equal(ids(sortOverviewRows(sortRows, 'name', 'desc')), 'zxy');
// Triage use case: least complete first.
assert.equal(ids(sortOverviewRows(sortRows, 'completeness', 'asc')), 'zxy');
assert.equal(ids(sortOverviewRows(sortRows, 'results', 'desc')), 'zxy');
// Missing values sort last in BOTH directions, never leading the table.
assert.equal(ids(sortOverviewRows(sortRows, 'monthly', 'asc')), 'xzy'); // 500, 2000, then null
assert.equal(ids(sortOverviewRows(sortRows, 'monthly', 'desc')), 'zxy'); // 2000, 500, then null
assert.equal(ids(sortOverviewRows(sortRows, 'productivity', 'asc')), 'zyx'); // 10, 30, then null
assert.equal(ids(sortOverviewRows(sortRows, 'department', 'asc')), 'xzy'); // Academic, Finance, then blank
// Unknown key is a no-op rather than a crash, and the input is never mutated.
assert.equal(ids(sortOverviewRows(sortRows, 'nope', 'asc')), 'xyz');
assert.equal(ids(sortRows), 'xyz');

// --- CSV export ---
const csv = overviewRowsToCsv([
  {
    name: 'Alpha, "Pilot"',
    department: 'Quality Assurance',
    counts: { productivity: 1, financial: 2, operational: 3 },
    monthly: 1299,
    avgProductivityPct: 30,
    completeness: 6,
  },
]);
assert.ok(csv.includes('"Initiative","Department"'));
assert.ok(csv.includes('"Alpha, ""Pilot"""'));
assert.ok(csv.includes('"Quality Assurance"'));
assert.ok(csv.includes('"1299"'));

console.log('overview.test.mjs: all assertions passed');

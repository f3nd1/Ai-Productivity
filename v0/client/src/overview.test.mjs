// node src/overview.test.mjs
import assert from 'node:assert';
import { computeOverview } from './overview.js';

const initiatives = [
  { id: 'A', name: 'Alpha', b8_problem: 'x', b9_significance: 'y', b10_solution: '', final_answers: { c11: 'gen' } },
  { id: 'B', name: 'Beta', b8_problem: 'x', b9_significance: '', b10_solution: '', final_answers: {} },
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
const sectionDList = [
  { initiative_id: 'A', d14_narrative: 'trained', d14_staff_trained: 8, d14_total_staff: 10, d15_narrative: 'freed', d15_hours_per_week: 5, d15_staff_affected: 4, d16_narrative: 'ready' },
  { initiative_id: 'B', d15_hours_per_week: 2, d15_staff_affected: 3 },
];

const { summary, rows } = computeOverview({ initiatives, results, sectionDList });

// --- summary (manually summed) ---
assert.equal(summary.totalInitiatives, 2);
assert.equal(summary.totalResults, 5);
assert.deepEqual(summary.byType, { productivity: 2, financial: 2, operational: 1 });
assert.equal(summary.totalMonthly, 1299 + 1000); // 2299
assert.equal(summary.totalAnnual, 15588 + 12000); // 27588
assert.equal(summary.avgProductivityPct, 40); // (30 + 50)/2
assert.equal(summary.totalD15Hours, 20 + 6); // 5*4 + 2*3 = 26

// --- row A ---
const a = rows.find((r) => r.id === 'A');
assert.deepEqual(a.counts, { productivity: 1, financial: 1, operational: 0 });
assert.equal(a.monthly, 1299);
assert.equal(a.avgProductivityPct, 30);
assert.equal(a.d14Adoption, 80); // 8/10
assert.equal(a.d15Hours, 20); // 5*4
assert.equal(a.completeness, 6); // b8, b9, c11, d14 narrative, d15 narrative, d16

// --- row B ---
const b = rows.find((r) => r.id === 'B');
assert.deepEqual(b.counts, { productivity: 1, financial: 1, operational: 1 });
assert.equal(b.monthly, 1000);
assert.equal(b.avgProductivityPct, 50);
assert.equal(b.d14Adoption, null); // no staff numbers
assert.equal(b.d15Hours, 6); // 2*3
assert.equal(b.completeness, 1); // b8 only

console.log('overview.test.mjs: all assertions passed');

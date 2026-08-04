// node src/figures.test.mjs
import assert from 'node:assert';
import {
  buildFigureRows,
  sortFigureRows,
  filterFigureRows,
  figureRowsToCsv,
  FIGURE_COLUMNS,
} from './figures.js';
import { computeResult } from './calc.js';

const initiatives = [
  { id: 'a', initiative_code: 'INIT-01', name: 'Admissions triage' },
  { id: 'b', initiative_code: 'INIT-02', name: '' }, // untitled
];

const results = [
  // Productivity: 40 -> 12, lower is better => 70% reduction
  { id: 'r1', initiative_id: 'a', type: 'productivity', fields: { metric: 'drafting time', before: 40, after: 12, direction: 'lower' } },
  // Financial: 10h * $30 * 4.33 = $1299/mo, $15588/yr, cost 4000
  { id: 'r2', initiative_id: 'a', type: 'financial', fields: { timeBased: true, hoursPerWeek: 10, rate: 30, costCategory: 'Labour cost', oneTimeCost: 4000 } },
  // Operational with "%" unit => point change
  { id: 'r3', initiative_id: 'b', type: 'operational', fields: { metric: 'first-contact resolution', before: 82, after: 95, unit: '%' } },
  // Operational with a non-% unit => percentage change
  { id: 'r4', initiative_id: 'b', type: 'operational', fields: { metric: 'queue length', before: 50, after: 30, unit: 'count' } },
];

const rows = buildFigureRows({ initiatives, results });
assert.equal(rows.length, 4, 'one row per result, not per initiative');

// --- Productivity row: its group populated, the others null ---
const p = rows[0];
assert.equal(p.code, 'INIT-01');
assert.equal(p.initiative, 'Admissions triage');
assert.equal(p.typeLabel, 'Productivity');
assert.equal(p.metric, 'drafting time');
assert.equal(p.prodBefore, 40);
assert.equal(p.prodAfter, 12);
assert.equal(p.prodPct, 70);
assert.equal(p.finMonthly, null);
assert.equal(p.finRoi, null);
assert.equal(p.opBefore, null);

// --- Financial row: cost category used as the metric, ROI + payback present ---
const f = rows[1];
assert.equal(f.metric, 'Labour cost', 'financial rows show cost category');
assert.equal(f.finMonthly, 1299);
assert.equal(f.finAnnual, 15588);
assert.equal(f.finRoi, 289.7); // (15588-4000)/4000*100
assert.equal(f.finPayback, 3.1); // 4000/1299
assert.equal(f.prodBefore, null);
assert.equal(f.opChange, null);

// --- Operational rows: points vs percent ---
const opPoints = rows[2];
assert.equal(opPoints.code, 'INIT-02');
assert.equal(opPoints.initiative, 'Untitled initiative');
assert.equal(opPoints.opBefore, 82);
assert.equal(opPoints.opAfter, 95);
assert.equal(opPoints.opChange, 13);
assert.equal(opPoints.opChangeLabel, '+13 points');
const opPct = rows[3];
assert.equal(opPct.opChange, -40); // (30-50)/50*100
assert.equal(opPct.opChangeLabel, '-40%');

// --- Figures must equal the calculator exactly, never a re-derivation ---
assert.equal(rows[0].prodPct, computeResult('productivity', results[0].fields).pct);
assert.equal(rows[1].finMonthly, computeResult('financial', results[1].fields).monthly);
assert.equal(rows[1].finRoi, computeResult('financial', results[1].fields).roi);

// --- A result whose initiative is missing still renders ---
const orphan = buildFigureRows({ initiatives: [], results: [results[0]] })[0];
assert.equal(orphan.code, '—');
assert.equal(orphan.initiative, 'Untitled initiative');

// --- Incomplete result: no crash, nulls throughout ---
const sparse = buildFigureRows({ initiatives, results: [{ id: 'x', initiative_id: 'a', type: 'productivity', fields: {} }] })[0];
assert.equal(sparse.prodBefore, null);
assert.equal(sparse.prodPct, null);
assert.equal(sparse.metric, '—');

// --- Sorting ---
const ids = (rs) => rs.map((r) => r.id).join(',');
assert.equal(ids(sortFigureRows(rows, 'code', 'asc')), 'r1,r2,r3,r4');
assert.equal(ids(sortFigureRows(rows, 'code', 'desc')), 'r3,r4,r1,r2');
assert.equal(ids(sortFigureRows(rows, 'type', 'asc')), 'r2,r3,r4,r1'); // Financial, Operational, Productivity
// Numeric column: only financial rows have a value, so the rest sort last
// regardless of direction.
assert.equal(ids(sortFigureRows(rows, 'finMonthly', 'asc')), 'r2,r1,r3,r4');
assert.equal(ids(sortFigureRows(rows, 'finMonthly', 'desc')), 'r2,r1,r3,r4');
// Operational change sorts numerically, so -40 precedes +13.
assert.equal(ids(sortFigureRows(rows, 'opChange', 'asc')), 'r4,r3,r1,r2');
// Unknown key is a no-op and never mutates the input.
assert.equal(ids(sortFigureRows(rows, 'nope', 'asc')), 'r1,r2,r3,r4');
assert.equal(ids(rows), 'r1,r2,r3,r4');

// --- Filtering ---
assert.equal(filterFigureRows(rows, { initiativeId: 'a' }).length, 2);
assert.equal(filterFigureRows(rows, { type: 'operational' }).length, 2);
assert.equal(filterFigureRows(rows, { initiativeId: 'b', type: 'operational' }).length, 2);
assert.equal(filterFigureRows(rows, { initiativeId: 'a', type: 'operational' }).length, 0);
assert.equal(filterFigureRows(rows, {}).length, 4);

// --- CSV ---
const csv = figureRowsToCsv(rows);
const lines = csv.split('\r\n');
assert.equal(lines.length, 5); // header + 4 rows
assert.ok(lines[0].includes('"Initiative ID"'));
assert.ok(lines[0].includes('"Productivity — % Change"'), 'grouped columns are disambiguated in the header');
assert.ok(lines[0].includes('"Financial — ROI %"'));
assert.equal(lines[0].split(',').length, FIGURE_COLUMNS.length);
assert.equal(lines[1].split(',').length, FIGURE_COLUMNS.length, 'every row has the full column count');
assert.ok(lines[1].startsWith('"INIT-01","Admissions triage","Productivity","drafting time","40","12","70","–"'));
assert.ok(lines[2].includes('"1299","15588","289.7","3.1"'));
// A name containing a comma and quotes must not break the row.
const tricky = figureRowsToCsv(
  buildFigureRows({
    initiatives: [{ id: 'a', initiative_code: 'INIT-01', name: 'Alpha, "Pilot"' }],
    results: [results[0]],
  })
);
assert.ok(tricky.includes('"Alpha, ""Pilot"""'));
assert.equal(tricky.split('\r\n')[1].split('","').length, FIGURE_COLUMNS.length);

console.log('figures.test.mjs: all assertions passed');

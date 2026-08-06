// node src/quickfill.test.mjs
import assert from 'node:assert';
import {
  normalizeQuickFill,
  proposalToFields,
  wouldOverwriteB,
  applyBFields,
  toNumberOrNull,
} from './quickfill.js';
import { computeResult } from './calc.js';

// --- toNumberOrNull: blanks must never become 0, which would be invented ---
assert.equal(toNumberOrNull(40), 40);
assert.equal(toNumberOrNull('40'), 40);
assert.equal(toNumberOrNull(' 1,299 '), 1299);
assert.equal(toNumberOrNull('$1,299'), 1299);
assert.equal(toNumberOrNull('70%'), 70);
assert.equal(toNumberOrNull(''), null);
assert.equal(toNumberOrNull(null), null);
assert.equal(toNumberOrNull(undefined), null);
assert.equal(toNumberOrNull('about twenty'), null, 'unparseable text is null, not 0');
assert.equal(toNumberOrNull(NaN), null);
assert.equal(toNumberOrNull({}), null);
assert.equal(toNumberOrNull(0), 0, 'a genuine zero is kept');

// --- normalizeQuickFill: a well-formed reply passes through ---
const good = normalizeQuickFill({
  b8: '  Manual drafting took 40 minutes per record.  ',
  b9: 'The backlog reached three weeks.',
  b10: null,
  results: [
    { type: 'productivity', metricOrCategory: 'drafting time', before: 40, after: 12, unit: 'minutes', note: 'Officers now review.' },
    { type: 'financial', metricOrCategory: 'Labour cost', before: null, after: null, unit: null, note: 'Freed analyst time.' },
  ],
});
assert.equal(good.b8, 'Manual drafting took 40 minutes per record.', 'trimmed');
assert.equal(good.b10, null, 'an unstated field stays null rather than becoming ""');
assert.equal(good.results.length, 2);
assert.deepEqual(good.results[0], {
  type: 'productivity', metricOrCategory: 'drafting time', before: 40, after: 12, unit: 'minutes', note: 'Officers now review.',
});

// --- Junk from the model is dropped, not surfaced ---
const junk = normalizeQuickFill({
  b8: 42, // wrong type
  results: [
    null,
    'not an object',
    {}, // nothing measurable
    { type: 'productivity', metricOrCategory: '', before: null, after: null, unit: '', note: '' }, // empty
    { type: 'nonsense', metricOrCategory: 'x', before: '5', after: '3', unit: 'h', note: '' }, // bad type
    { type: 'operational', metricOrCategory: 'resolution rate', before: 82, after: 95, unit: '%', note: '' },
  ],
});
assert.equal(junk.b8, null, 'a non-string b8 becomes null');
assert.equal(junk.results.length, 2, 'empty and unusable proposals are dropped');
assert.equal(junk.results[0].type, 'productivity', 'an unknown type falls back rather than crashing');
assert.equal(junk.results[0].before, 5, 'numeric strings coerce');
assert.equal(junk.results[1].metricOrCategory, 'resolution rate');
// Totally malformed input must not throw.
assert.deepEqual(normalizeQuickFill(null), { b8: null, b9: null, b10: null, results: [] });
assert.deepEqual(normalizeQuickFill({ results: 'nope' }).results, []);
assert.deepEqual(normalizeQuickFill('a string').results, []);

// --- proposalToFields: shapes match what the calculators consume ---
const prodDown = proposalToFields({ type: 'productivity', metricOrCategory: 'drafting time', before: 40, after: 12, unit: 'minutes', note: 'n' });
assert.equal(prodDown.metric, 'drafting time');
assert.equal(prodDown.direction, 'lower', 'a fall in the metric reads as a reduction, not an error');
// The calculator accepts it cleanly — no "unexpected direction" warning.
const outDown = computeResult('productivity', prodDown);
assert.equal(outDown.warning, null);
assert.equal(outDown.pct, 70);

const prodUp = proposalToFields({ type: 'productivity', metricOrCategory: 'throughput', before: 100, after: 130, unit: '', note: '' });
assert.equal(prodUp.direction, 'higher');
assert.equal(computeResult('productivity', prodUp).warning, null);

// Missing numbers leave direction unset rather than guessed.
const prodPartial = proposalToFields({ type: 'productivity', metricOrCategory: 'speed', before: null, after: null, unit: '', note: 'faster' });
assert.equal(prodPartial.direction, undefined);
assert.equal(prodPartial.before, '');

// Financial: no money figure is fabricated — the user completes the basis.
const fin = proposalToFields({ type: 'financial', metricOrCategory: 'Labour cost', before: 5000, after: 3000, unit: '$', note: 'n' });
assert.equal(fin.costCategory, 'Labour cost');
assert.equal(fin.directMonthly, undefined, 'no invented monthly saving');
assert.equal(fin.hoursPerWeek, undefined);
assert.equal(computeResult('financial', fin).monthly, undefined, 'shows no figure until the user fills it in');

const op = proposalToFields({ type: 'operational', metricOrCategory: 'resolution rate', before: 82, after: 95, unit: '%', note: '' });
assert.equal(op.metric, 'resolution rate');
assert.equal(op.unit, '%');
assert.equal(computeResult('operational', op).pointChange, 13);

// --- Overwrite detection ---
const existing = { b8_problem: 'already written', b9_significance: '', b10_solution: '' };
assert.equal(wouldOverwriteB(existing, { b8: 'new', b9: null, b10: null }), true);
assert.equal(wouldOverwriteB(existing, { b8: null, b9: 'new', b10: null }), false, 'no clash when the existing field is empty');
assert.equal(wouldOverwriteB({}, { b8: 'new', b9: 'new', b10: 'new' }), false, 'nothing to overwrite on a blank page');
assert.equal(wouldOverwriteB(existing, { b8: '   ', b9: null, b10: null }), false, 'whitespace is not a replacement');

// --- applyBFields: blanks never wipe existing text ---
const applied = applyBFields(
  { b8_problem: 'keep me', b9_significance: 'also keep', b10_solution: '' },
  { b8: null, b9: 'replaced', b10: '  new solution  ' }
);
assert.equal(applied.b8_problem, 'keep me', 'a null extraction leaves the field alone');
assert.equal(applied.b9_significance, 'replaced');
assert.equal(applied.b10_solution, 'new solution', 'trimmed on the way in');

console.log('quickfill.test.mjs: all assertions passed');

// node src/quickfill.test.mjs
import assert from 'node:assert';
import {
  normalizeQuickFill,
  proposalToFields,
  wouldOverwriteInfo,
  overwrittenFields,
  applyInfoFields,
  toNumberOrNull,
  clearEstimate,
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
assert.equal(good.results[0].metricOrCategory, 'drafting time');
assert.equal(good.results[0].before, 40);
assert.equal(good.results[0].after, 12);
assert.deepEqual(good.results[0].estimated, { before: false, after: false, monthlySaving: false });

// ============================================================
// Estimated flags — figures derived from a vague hint ("roughly halved").
// The model's claim is validated, never trusted as given.
// ============================================================
const est = normalizeQuickFill({
  results: [
    // Both figures derived from "cut review time roughly in half".
    { type: 'productivity', metricOrCategory: 'review time', before: 40, after: 20, unit: 'minutes', note: 'n',
      estimated: { before: true, after: true } },
    // Claims an estimate on a field it left null — meaningless, must be dropped,
    // or the review would show an amber "Estimated" badge on an empty box.
    { type: 'productivity', metricOrCategory: 'accuracy', before: null, after: null, unit: '', note: 'better',
      estimated: { before: true, after: true } },
    // A stated monthly saving, flagged as estimated.
    { type: 'financial', metricOrCategory: 'Labour cost', monthlySaving: 2000, note: 'about two grand a month',
      estimated: { monthlySaving: true } },
  ],
});
assert.deepEqual(est.results[0].estimated, { before: true, after: true, monthlySaving: false });
assert.deepEqual(
  est.results[1].estimated,
  { before: false, after: false, monthlySaving: false },
  'an estimate flag on a null field is dropped, not trusted'
);
assert.equal(est.results[2].monthlySaving, 2000);
assert.equal(est.results[2].estimated.monthlySaving, true);

// Malformed flag payloads can't crash or fabricate.
const flagJunk = normalizeQuickFill({
  results: [
    { type: 'productivity', metricOrCategory: 'm', before: 10, after: 5, note: 'n', estimated: 'yes' },
    { type: 'productivity', metricOrCategory: 'm', before: 10, after: 5, note: 'n', estimated: null },
    { type: 'productivity', metricOrCategory: 'm', before: 10, after: null, note: 'n', estimated: true },
  ],
});
assert.deepEqual(flagJunk.results[0].estimated, { before: false, after: false, monthlySaving: false }, 'a string flag is ignored');
assert.deepEqual(flagJunk.results[1].estimated, { before: false, after: false, monthlySaving: false });
// A bare `true` is honoured, but still only for fields that actually hold a value.
assert.deepEqual(flagJunk.results[2].estimated, { before: true, after: false, monthlySaving: false });

// A result carrying only a monthly saving is still usable evidence.
const moneyOnly = normalizeQuickFill({
  results: [{ type: 'financial', metricOrCategory: '', monthlySaving: 500, note: '' }],
});
assert.equal(moneyOnly.results.length, 1);

// --- clearEstimate: an edited value stops being the model's estimate ---
const flagged = { before: 40, after: 20, estimated: { before: true, after: true, monthlySaving: false } };
assert.deepEqual(clearEstimate(flagged, 'before').estimated, { before: false, after: true, monthlySaving: false });
assert.equal(clearEstimate(flagged, 'after').estimated.before, true, 'clearing one flag leaves the other');
// Clearing an already-clear flag is a no-op that returns the same object.
const clean2 = { before: 1, estimated: { before: false, after: false, monthlySaving: false } };
assert.equal(clearEstimate(clean2, 'before'), clean2);
assert.doesNotThrow(() => clearEstimate({}, 'before'), 'missing estimated object is safe');

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
assert.deepEqual(normalizeQuickFill(null), { names: [], b8: null, b9: null, b10: null, results: [] });
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

// Financial with NO stated saving: still no money figure invented.
const fin = proposalToFields({ type: 'financial', metricOrCategory: 'Labour cost', monthlySaving: null, note: 'n' });
assert.equal(fin.costCategory, 'Labour cost');
assert.equal(fin.directMonthly, undefined, 'no invented monthly saving');
assert.equal(fin.hoursPerWeek, undefined);
assert.equal(computeResult('financial', fin).monthly, undefined, 'shows no figure until the user fills it in');

// Financial WITH a stated saving: carried through and computes.
const finPaid = proposalToFields({ type: 'financial', metricOrCategory: 'Labour cost', monthlySaving: 2000, note: 'n' });
assert.equal(finPaid.directMonthly, 2000);
assert.equal(finPaid.timeBased, false);
assert.equal(computeResult('financial', finPaid).monthly, 2000);
assert.equal(computeResult('financial', finPaid).annual, 24000);

const op = proposalToFields({ type: 'operational', metricOrCategory: 'resolution rate', before: 82, after: 95, unit: '%', note: '' });
assert.equal(op.metric, 'resolution rate');
assert.equal(op.unit, '%');
assert.equal(computeResult('operational', op).pointChange, 13);

// --- Overwrite detection (name included) ---
const existing = { name: 'My initiative', b8_problem: 'already written', b9_significance: '', b10_solution: '' };
assert.equal(wouldOverwriteInfo(existing, { b8: 'new', b9: null, b10: null }), true);
assert.equal(wouldOverwriteInfo(existing, { b8: null, b9: 'new', b10: null }), false, 'no clash when the existing field is empty');
assert.equal(wouldOverwriteInfo({}, { name: 'n', b8: 'new', b9: 'new', b10: 'new' }), false, 'nothing to overwrite on a blank page');
assert.equal(wouldOverwriteInfo(existing, { b8: '   ', b9: null, b10: null }), false, 'whitespace is not a replacement');
assert.equal(wouldOverwriteInfo(existing, { name: 'New title' }), true, 'replacing the name counts as an overwrite');
// The warning names exactly what is at risk, not everything Quick Fill can touch.
assert.deepEqual(overwrittenFields(existing, { name: 'New title', b8: 'new', b9: 'new' }), ['initiative name', 'B8']);
assert.deepEqual(overwrittenFields(existing, { b9: 'new' }), [], 'B9 was empty, so nothing is lost');

// --- applyInfoFields: blanks never wipe existing text ---
const applied = applyInfoFields(
  { name: 'keep name', b8_problem: 'keep me', b9_significance: 'also keep', b10_solution: '' },
  { name: null, b8: null, b9: 'replaced', b10: '  new solution  ' }
);
assert.equal(applied.name, 'keep name', 'a null name leaves the title alone');
assert.equal(applied.b8_problem, 'keep me', 'a null extraction leaves the field alone');
assert.equal(applied.b9_significance, 'replaced');
assert.equal(applied.b10_solution, 'new solution', 'trimmed on the way in');
assert.equal(applyInfoFields({}, { name: '  AI triage  ' }).name, 'AI triage', 'name is applied and trimmed');

// --- Names are a list of title options, not prose ---
const named = normalizeQuickFill({
  names: ['  AI admissions triage  ', 'Line one\nline two', 'AI triage [add: which department]'],
});
assert.deepEqual(named.names, ['AI admissions triage', 'Line one line two', 'AI triage'],
  'trimmed, newlines collapsed, placeholders stripped');
// Blanks, duplicates and placeholder-only titles never reach the review as chips.
assert.deepEqual(
  normalizeQuickFill({ names: ['Alpha', 'alpha', '  ', '[add: the name]', null, 42, 'Beta'] }).names,
  ['Alpha', 'Beta'],
  'duplicates (case-insensitive), blanks and junk are dropped'
);
assert.equal(normalizeQuickFill({ names: ['x'.repeat(200)] }).names[0].length, 80, 'over-long titles are capped');
assert.deepEqual(normalizeQuickFill({}).names, []);
// A bare string is the older single-name shape, so it becomes a one-item list.
assert.deepEqual(normalizeQuickFill({ names: 'Solo title' }).names, ['Solo title']);
// At most four suggestions, however many the model returns.
assert.equal(normalizeQuickFill({ names: ['a', 'b', 'c', 'd', 'e', 'f'] }).names.length, 4);
// An older single-string reply shape still works.
assert.deepEqual(normalizeQuickFill({ name: 'Solo title' }).names, ['Solo title']);

console.log('quickfill.test.mjs: all assertions passed');

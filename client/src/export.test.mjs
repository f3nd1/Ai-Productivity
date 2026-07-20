// node src/export.test.mjs
import assert from 'node:assert';
import {
  resultsFor,
  buildFinding,
  buildRootCause,
  buildActionTaken,
  buildGeneralNotes,
  financialManDayRateDefault,
  hasFinancialResult,
  productivityBeforeAfter,
  formatCopyAll,
  copyToClipboard,
} from './export.js';

const initiative = {
  id: 'i1',
  b8_problem: 'Manual QA took 20 hours weekly.',
  b9_significance: 'Lost $5,000 monthly due to overstocking.',
  b10_solution: 'Deployed an ML classifier for QA triage.',
};

const results = [
  { initiative_id: 'i1', type: 'productivity', fields: { metric: 'process speed', before: 100, after: 130, direction: 'higher', note: 'Team noticed faster turnaround.' } },
  { initiative_id: 'i1', type: 'financial', fields: { timeBased: true, hoursPerWeek: 10, rate: 30, costCategory: 'labour', note: 'Freed up analyst time.' } },
  { initiative_id: 'i2', type: 'operational', fields: { metric: 'accuracy', before: 85, after: 98, unit: '%', note: 'Should not appear for i1.' } },
];

const sectionD = {
  d14_narrative: 'Trained 8 of 10 staff over 4 weeks.',
  d15_narrative: 'Freed up 20 hours per week for the team.',
  d16_narrative: 'Built internal AI expertise.',
};

const linked = resultsFor('i1', results);
assert.equal(linked.length, 2);

assert.equal(
  buildFinding(initiative),
  'Manual QA took 20 hours weekly.\n\nLost $5,000 monthly due to overstocking.'
);

const rootCause = buildRootCause(initiative, linked);
assert.ok(rootCause.startsWith('Deployed an ML classifier for QA triage.'));
assert.ok(rootCause.includes('[Productivity] Team noticed faster turnaround.'));
assert.ok(rootCause.includes('[Financial] Freed up analyst time.'));
assert.ok(!rootCause.includes('Should not appear'));

assert.equal(
  buildActionTaken(sectionD),
  'Trained 8 of 10 staff over 4 weeks.\n\nFreed up 20 hours per week for the team.'
);

const generalNotes = buildGeneralNotes(sectionD, linked);
// Auto-phrase sentences lead.
assert.ok(generalNotes.startsWith('Improved process speed by 30%'));
assert.ok(generalNotes.includes('Saved $1,299 monthly in labour'));
// D16 now included as a labeled line (was the reported gap).
assert.ok(generalNotes.includes('D16 Future Readiness: Built internal AI expertise.'));
// Section D numeric labels present only when set (staff numbers not set here → absent).
assert.ok(!generalNotes.includes('Staff Trained:'));
// Per-result labeled blocks: productivity + financial.
assert.ok(generalNotes.includes('Result Type: Productivity'));
assert.ok(generalNotes.includes('Metric Name: process speed'));
assert.ok(generalNotes.includes('Before Value: 100'));
assert.ok(generalNotes.includes('Direction: Higher is better'));
assert.ok(generalNotes.includes('Result Type: Financial'));
assert.ok(generalNotes.includes('Metric Name: labour')); // costCategory for financial
assert.ok(generalNotes.includes('Saving Type: Time-based saving'));
assert.ok(generalNotes.includes('Cost Rate ($/hour): 30'));
// Financial has no Unit / Direction lines.
assert.ok(!/Result Type: Financial[\s\S]*?Direction:/.test(generalNotes));

assert.equal(hasFinancialResult(linked), true);
assert.equal(hasFinancialResult(resultsFor('i3', results)), false);
assert.equal(financialManDayRateDefault(linked), 240); // 30 * 8
assert.equal(financialManDayRateDefault(resultsFor('i3', results)), '');

// productivityBeforeAfter: the productivity result here has no unit → time-like → autofill.
let ba = productivityBeforeAfter(linked);
assert.equal(ba.before, 100);
assert.equal(ba.after, 130);
assert.equal(ba.autofilled, true);
// A "%" unit is clearly non-time → blank.
ba = productivityBeforeAfter([{ type: 'productivity', fields: { before: 85, after: 98, unit: '%' } }]);
assert.equal(ba.before, '');
assert.equal(ba.autofilled, false);
// No productivity result → blank.
ba = productivityBeforeAfter([{ type: 'financial', fields: { rate: 30 } }]);
assert.equal(ba.autofilled, false);
// A time unit → autofill.
ba = productivityBeforeAfter([{ type: 'productivity', fields: { before: 10, after: 6, unit: 'minutes' } }]);
assert.equal(ba.before, 10);
assert.equal(ba.after, 6);
assert.equal(ba.autofilled, true);

// copy-all: with numbers section
const withNumbers = formatCopyAll(
  { finding: 'F', rootCause: 'R', actionTaken: 'A', generalNotes: 'G' },
  { beforeTime: 5, afterTime: 2, manDayRate: 240, cyclePerMonth: '' }
);
assert.ok(withNumbers.includes('Finding:\nF'));
assert.ok(withNumbers.includes('Before Time (Man-Day): 5'));
assert.ok(withNumbers.includes('After Time (Man-Day): 2'));
assert.ok(withNumbers.includes('Man-Day Rate (SGD): 240'));
assert.ok(withNumbers.includes('Cycle per Month: '));

// copy-all: without numbers section (no financial result on this initiative)
const noNumbers = formatCopyAll({ finding: 'F', rootCause: 'R', actionTaken: 'A', generalNotes: 'G' }, null);
assert.ok(!noNumbers.includes('Man-Day Rate'));

// clipboard mock
let captured = null;
Object.defineProperty(globalThis, 'navigator', {
  value: { clipboard: { writeText: (t) => { captured = t; return Promise.resolve(); } } },
  configurable: true,
});
await copyToClipboard('hello clipboard');
assert.equal(captured, 'hello clipboard');

console.log('export.test.mjs: all assertions passed');

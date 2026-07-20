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
assert.ok(generalNotes.startsWith('Built internal AI expertise.'));
assert.ok(generalNotes.includes('Improved process speed by 30%'));
assert.ok(generalNotes.includes('Saved $1,299 monthly in labour'));

assert.equal(hasFinancialResult(linked), true);
assert.equal(hasFinancialResult(resultsFor('i3', results)), false);
assert.equal(financialManDayRateDefault(linked), 240); // 30 * 8
assert.equal(financialManDayRateDefault(resultsFor('i3', results)), '');

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

// node src/evidence.test.mjs
import assert from 'node:assert';
import { hasEvidence, assembleEvidence } from './evidence.js';

const initiative = { b8_problem: 'Manual QA took 20 hours weekly.', b9_significance: '', b10_solution: '' };
const results = [
  { type: 'productivity', fields: { metric: 'speed', before: 100, after: 130, direction: 'higher', note: 'Faster.' } },
];
const sectionD = { d14_narrative: '', d14_staff_trained: 8, d14_total_staff: 10, d16_narrative: 'Ready.' };

// B fields
assert.equal(hasEvidence('b8', { initiative, results, sectionD }), true);
assert.equal(hasEvidence('b9', { initiative, results, sectionD }), false);
assert.equal(hasEvidence('b10', { initiative, results, sectionD }), false);

// C types: only productivity present
assert.equal(hasEvidence('c11', { initiative, results, sectionD }), true);
assert.equal(hasEvidence('c12', { initiative, results, sectionD }), false);
assert.equal(hasEvidence('c13', { initiative, results, sectionD }), false); // the reported bug: no operational → no gen

// D: d14 has numbers (no narrative) → true; d15 empty → false; d16 narrative → true
assert.equal(hasEvidence('d14', { initiative, results, sectionD }), true);
assert.equal(hasEvidence('d15', { initiative, results, sectionD }), false);
assert.equal(hasEvidence('d16', { initiative, results, sectionD }), true);

// assembleEvidence
assert.equal(assembleEvidence('b8', { initiative, results, sectionD }), 'Manual QA took 20 hours weekly.');
const c11 = assembleEvidence('c11', { initiative, results, sectionD });
assert.ok(c11.includes('Improved speed by 30%'));
assert.ok(c11.includes('Note: Faster.'));
assert.equal(assembleEvidence('c13', { initiative, results, sectionD }), ''); // no operational → empty
assert.ok(assembleEvidence('d14', { initiative, results, sectionD }).includes('80% adoption'));
assert.equal(assembleEvidence('d16', { initiative, results, sectionD }), 'Ready.');

console.log('evidence.test.mjs: all assertions passed');

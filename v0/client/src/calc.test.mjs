// Minimal self-check: node src/calc.test.mjs
import assert from 'node:assert';
import { productivity, financial, operational } from './calc.js';

// Productivity: higher-is-better improvement
let p = productivity({ metric: 'process speed', before: 100, after: 130, direction: 'higher' });
assert.equal(p.metrics[0].value, '30%');
assert.equal(p.sentence, 'Improved process speed by 30%');
assert.equal(p.warning, null);

// Productivity: lower-is-better reduction
p = productivity({ metric: 'errors', before: 40, after: 30, direction: 'lower' });
assert.equal(p.sentence, 'Reduced errors by 25%');

// Productivity: wrong direction warns, no sentence
p = productivity({ metric: 'x', before: 10, after: 20, direction: 'lower' });
assert.match(p.warning, /unexpected direction/);
assert.equal(p.sentence, '');

// Financial: time-based 10h * $30 * 4.33 = $1299/mo, $15,588/yr
let fin = financial({ timeBased: true, hoursPerWeek: 10, rate: 30 });
assert.equal(fin.metrics[0].value, '$1,299');
assert.equal(fin.metrics[1].value, '$15,588');

// Financial: ROI with cost
fin = financial({ timeBased: false, directMonthly: 1000, oneTimeCost: 6000, costCategory: 'labour' });
// annual 12000, roi=(12000-6000)/6000*100=100, payback=6000/1000=6
assert.ok(fin.sentence.includes('ROI of 100%'));
assert.ok(fin.metrics.some((m) => m.value === '6 months'));

// Operational: percentage unit
let op = operational({ metric: 'Inventory accuracy', before: 85, after: 98, unit: '%' });
assert.equal(op.sentence, 'Inventory accuracy improved from 85% to 98%');
assert.ok(op.metrics[0].value.includes('+13'));

// Operational: minutes → faster phrase
op = operational({ metric: 'Handling time', before: 10, after: 6, unit: 'minutes' });
assert.ok(op.sentence.includes('40% faster'));

console.log('calc.test.mjs: all assertions passed');

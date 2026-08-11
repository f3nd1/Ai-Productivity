// Pure calculators for Section C result types. Each returns:
//   { metrics: [{label, value}], warning: string|null, sentence: string }
// Used by the Section C cards for the live preview AND by the Final tab to
// assemble evidence for the OpenAI draft.

const num = (v) => (v === '' || v === null || v === undefined ? NaN : Number(v));
const round1 = (n) => Math.round(n * 10) / 10;
const money = (n) =>
  '$' + (Math.round(n * 100) / 100).toLocaleString('en-GB', { maximumFractionDigits: 2 });

export function productivity(f) {
  const before = num(f.before);
  const after = num(f.after);
  const metric = (f.metric || 'the metric').trim();
  // Lower is the default: most productivity metrics recorded here are times and
  // error counts, where the improvement is a fall. Results saved without an
  // explicit direction therefore read as reductions.
  const dir = f.direction || 'lower'; // 'higher' | 'lower'
  const out = { metrics: [], warning: null, sentence: '' };
  if (!Number.isFinite(before) || !Number.isFinite(after)) return out;
  if (before === 0) {
    out.warning = 'before value cannot be zero (division by zero).';
    return out;
  }
  const pct = round1((Math.abs(after - before) / before) * 100);
  out.pct = pct; // raw number for aggregation (Overview); same value shown below
  let label; // 'improvement' | 'reduction'
  if (dir === 'lower') {
    if (after < before) label = 'reduction';
    else out.warning = 'unexpected direction — after value is not lower than before';
  } else {
    if (after > before) label = 'improvement';
    else out.warning = 'unexpected direction — after value is not higher than before';
  }
  out.label = label || null;
  out.metrics.push({ label: 'Change', value: `${pct}%` });
  if (label) {
    const verb = label === 'improvement' ? 'Improved' : 'Reduced';
    out.sentence = `${verb} ${metric} by ${pct}%`;
  }
  return out;
}

export function financial(f) {
  const timeBased = f.timeBased !== false && f.timeBased !== 'false'; // default true
  const out = { metrics: [], warning: null, sentence: '' };
  let monthly;
  if (timeBased) {
    const hrs = num(f.hoursPerWeek);
    const rate = num(f.rate);
    if (!Number.isFinite(hrs) || !Number.isFinite(rate)) return out;
    monthly = hrs * rate * 4.33;
  } else {
    monthly = num(f.directMonthly);
    if (!Number.isFinite(monthly)) return out;
  }
  const annual = monthly * 12;
  out.monthly = monthly; // raw numbers for aggregation (Overview); same values shown below
  out.annual = annual;
  out.metrics.push({ label: 'Monthly saving', value: money(monthly) });
  out.metrics.push({ label: 'Annual saving', value: money(annual) });

  const cost = num(f.oneTimeCost);
  let roi = null;
  let payback = null;
  if (Number.isFinite(cost) && cost > 0) {
    roi = round1(((annual - cost) / cost) * 100);
    payback = round1(monthly !== 0 ? cost / monthly : NaN);
    out.metrics.push({ label: 'ROI (first year)', value: `${roi}%` });
    out.metrics.push({ label: 'Payback', value: Number.isFinite(payback) ? `${payback} months` : '—' });
  }
  // Raw numbers for aggregation (Figures Table); identical values to the
  // formatted metrics above — exposed, not recomputed.
  out.roi = roi;
  out.paybackMonths = Number.isFinite(payback) ? payback : null;
  // Prefer ROI sentence if a cost was entered, else the saving sentence.
  const cat = (f.costCategory || 'labour costs').trim();
  if (roi !== null) out.sentence = `Achieved ROI of ${roi}% in first year`;
  else out.sentence = `Saved ${money(monthly)} monthly in ${cat}`;
  return out;
}

export function operational(f) {
  const before = num(f.before);
  const after = num(f.after);
  const metric = (f.metric || 'the metric').trim();
  const unitSel = f.unit || '%';
  const unit = unitSel === 'other' ? (f.otherUnit || '').trim() : unitSel;
  const out = { metrics: [], warning: null, sentence: '' };
  if (!Number.isFinite(before) || !Number.isFinite(after)) return out;
  const delta = after - before;

  if (unitSel === '%') {
    out.pointChange = round1(delta); // raw number for the Figures Table
    out.metrics.push({ label: 'Point change', value: `${delta >= 0 ? '+' : ''}${round1(delta)} points` });
    out.sentence = `${metric} improved from ${before}% to ${after}%`;
    return out;
  }

  if (before === 0) {
    out.warning = 'before value cannot be zero (division by zero).';
    return out;
  }
  const pct = round1((delta / before) * 100);
  out.pct = pct; // raw number for the Figures Table
  const u = unit || '';
  out.metrics.push({ label: 'Change', value: `${pct}%` });
  let sentence = `${metric} improved from ${before}${u} to ${after}${u}, a ${pct}% change`;
  // Time-implying unit → "X% faster/slower" phrase.
  if (unitSel === 'minutes' || /min|hour|sec|time/i.test(u)) {
    const speed = round1((Math.abs(delta) / before) * 100);
    sentence += ` (${speed}% ${delta < 0 ? 'faster' : 'slower'})`;
  }
  out.sentence = sentence;
  return out;
}

export function computeResult(type, fields) {
  if (type === 'productivity') return productivity(fields);
  if (type === 'financial') return financial(fields);
  if (type === 'operational') return operational(fields);
  return { metrics: [], warning: null, sentence: '' };
}

// Pure normalisation for Quick Fill — no React, so quickfill.test.mjs can verify
// it. The model returns JSON, but nothing about its *shape* is guaranteed, so
// every field is coerced and anything unusable is dropped rather than passed
// through to the review screen.
//
// The no-invention rule is enforced here as well as in the prompt: a proposed
// result with no measurable content is discarded instead of being shown as an
// empty row the user might accept without noticing.

const RESULT_TYPES = ['productivity', 'financial', 'operational'];

// '' / null / undefined / non-numeric all become null — never 0, which would be
// a fabricated figure.
export function toNumberOrNull(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const cleaned = String(v).trim().replace(/[$,%\s]/g, '').replace(/,/g, '');
  if (cleaned === '') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

const text = (v) => (typeof v === 'string' ? v.trim() : '') || '';
const textOrNull = (v) => text(v) || null;

// A proposal earns a place in the review only if it carries something
// measurable: a figure, or a named metric with a note explaining it.
// Otherwise it's noise the model produced to fill out the response.
function isUsable(r) {
  return (
    r.before !== null ||
    r.after !== null ||
    r.monthlySaving !== null ||
    (r.metricOrCategory !== '' && r.note !== '')
  );
}

// Quantitative fields that can carry an "estimated from a vague hint" flag.
export const ESTIMABLE_FIELDS = ['before', 'after', 'monthlySaving'];

// The model's own `estimated` claims are never taken at face value. A flag only
// survives if the field it refers to actually holds a number — otherwise the
// model is asserting it estimated something it left blank, which is meaningless
// and would render an amber "Estimated" badge against an empty box.
function normalizeEstimated(rawFlags, values) {
  // Tolerate a bare `true` at result level; it still can't invent anything,
  // because every flag below is gated on the value being present.
  const all = rawFlags === true;
  const src = rawFlags && typeof rawFlags === 'object' ? rawFlags : {};
  const out = {};
  for (const key of ESTIMABLE_FIELDS) {
    out[key] = values[key] !== null && (all || src[key] === true);
  }
  return out;
}

export function normalizeQuickFill(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const list = Array.isArray(src.results) ? src.results : [];

  const results = list
    .map((r) => (r && typeof r === 'object' ? r : {}))
    .map((r) => {
      const values = {
        before: toNumberOrNull(r.before),
        after: toNumberOrNull(r.after),
        monthlySaving: toNumberOrNull(r.monthlySaving),
      };
      return {
        type: RESULT_TYPES.includes(r.type) ? r.type : 'productivity',
        metricOrCategory: text(r.metricOrCategory),
        ...values,
        unit: text(r.unit),
        note: text(r.note),
        estimated: normalizeEstimated(r.estimated, values),
      };
    })
    .filter(isUsable);

  return {
    b8: textOrNull(src.b8),
    b9: textOrNull(src.b9),
    b10: textOrNull(src.b10),
    results,
  };
}

// Editing a value in the review makes it the user's number, not the model's
// estimate, so the flag is cleared. Only ever clears — reviewing can't promote
// something to "estimated".
export function clearEstimate(item, field) {
  if (!item.estimated?.[field]) return item;
  return { ...item, estimated: { ...item.estimated, [field]: false } };
}

// Map one reviewed proposal onto the `fields` shape the Section C calculators
// expect. A financial result only gets a money figure when the note actually
// gave one (monthlySaving); with no figure it arrives as a category and note
// for the user to complete, rather than with a fabricated saving.
export function proposalToFields(p) {
  const base = { note: p.note || '' };
  if (p.type === 'financial') {
    const fields = { ...base, costCategory: p.metricOrCategory || '' };
    if (p.monthlySaving !== null && p.monthlySaving !== undefined && p.monthlySaving !== '') {
      fields.timeBased = false; // a stated monthly figure, not an hours × rate basis
      fields.directMonthly = p.monthlySaving;
    }
    return fields;
  }
  const fields = {
    ...base,
    metric: p.metricOrCategory || '',
    unit: p.unit || '',
    before: p.before ?? '',
    after: p.after ?? '',
  };
  if (p.type === 'productivity') {
    // Read the direction off the stated numbers rather than defaulting to
    // 'higher', which would flag a genuine reduction as an error. This is
    // mechanical from the figures given, not an assumption about intent, and
    // the user can flip it on the card.
    if (fields.before !== '' && fields.after !== '' && p.after !== null && p.before !== null) {
      fields.direction = p.after < p.before ? 'lower' : 'higher';
    }
  }
  return fields;
}

// Does applying overwrite B narrative the user already wrote?
export function wouldOverwriteB(info, reviewed) {
  const filled = (v) => typeof v === 'string' && v.trim() !== '';
  return (
    (filled(info?.b8_problem) && filled(reviewed.b8)) ||
    (filled(info?.b9_significance) && filled(reviewed.b9)) ||
    (filled(info?.b10_solution) && filled(reviewed.b10))
  );
}

// Only non-empty B fields are applied, so a field the model left blank never
// wipes text the user already has.
export function applyBFields(info, reviewed) {
  const next = { ...info };
  if (reviewed.b8?.trim()) next.b8_problem = reviewed.b8.trim();
  if (reviewed.b9?.trim()) next.b9_significance = reviewed.b9.trim();
  if (reviewed.b10?.trim()) next.b10_solution = reviewed.b10.trim();
  return next;
}

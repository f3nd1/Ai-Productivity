// Pure helpers for the Export tab (ERPNext Quality Action Resolution copy blocks).
// No React, no DOM assumptions beyond navigator.clipboard — kept separate so
// export.test.mjs can exercise the text-building logic and the clipboard call
// without booting a browser.
import { computeResult } from './calc.js';

const TYPE_LABEL = { productivity: 'Productivity', financial: 'Financial', operational: 'Operational' };

const join2 = (a, b) => [a, b].map((s) => (s || '').trim()).filter(Boolean).join('\n\n');

export function resultsFor(initiativeId, results) {
  return results.filter((r) => r.initiative_id === initiativeId);
}

// a) Finding: B8 then B9, blank line between.
export function buildFinding(initiative) {
  return join2(initiative.b8_problem, initiative.b9_significance);
}

// b) Root Cause & Resolution is the one field with no plain-text source: it's an
// analysis of why the problem occurred and what should be done about it, which
// only "Generate with AI" can produce. It starts empty rather than being seeded
// with text copied from another field.

// c) Action Taken: what was actually done for THIS initiative — the solution
// (B10) followed by each linked result's qualitative note, tagged by type.
// Deliberately not Section D: that's one shared organisation-wide answer, so
// using it here gave every initiative an identical Action Taken.
export function buildActionTaken(initiative, linkedResults = []) {
  const notes = linkedResults
    .map((r) => (r.fields?.note || '').trim())
    .map((n, i) => (n ? `[${TYPE_LABEL[linkedResults[i].type]}] ${n}` : null))
    .filter(Boolean);
  return join2(initiative?.b10_solution, notes.join('\n'));
}

// One "Label: value" line, or null when the value is blank/unset (so callers
// can filter blanks out rather than printing "Label: ").
function line(label, value) {
  if (value === '' || value === null || value === undefined) return null;
  const s = String(value).trim();
  return s ? `${label}: ${s}` : null;
}

const DIRECTION_LABEL = { higher: 'Higher is better', lower: 'Lower is better' };

// Labeled "Label: value" lines for one Section C result, skipping unset fields.
function resultLabelLines(result) {
  const f = result.fields || {};
  const type = result.type;
  const unit = f.unit === 'other' ? f.otherUnit : f.unit;
  const lines = [
    line('Result Type', TYPE_LABEL[type]),
    // Metric name, or Cost Category for Financial results.
    line('Metric Name', type === 'financial' ? f.costCategory : f.metric),
    type !== 'financial' ? line('Unit', unit) : null,
    line('Before Value', f.before),
    line('After Value', f.after),
    type === 'productivity' ? line('Direction', DIRECTION_LABEL[f.direction] || f.direction) : null,
    type === 'financial'
      ? line('Saving Type', f.timeBased === false ? 'Direct $ saving/month' : 'Time-based saving')
      : null,
    type === 'financial' && f.timeBased !== false ? line('Hours Saved per Week', f.hoursPerWeek) : null,
    type === 'financial' && f.timeBased !== false ? line('Cost Rate ($/hour)', f.rate) : null,
    type === 'financial' ? line('One-Time/Setup Cost', f.oneTimeCost) : null,
  ].filter(Boolean);
  return lines.join('\n');
}

// d) General Notes: the calculated auto-phrase sentences, then every raw field
// of THIS initiative not already captured elsewhere, as "Label: value" lines.
// Section D is excluded throughout — it is one shared answer for the whole
// submission, so its figures aren't this initiative's evidence.
export function buildGeneralNotes(linkedResults = [], initiative = null) {
  const sentences = linkedResults
    .map((r) => computeResult(r.type, r.fields || {}).sentence)
    .filter(Boolean)
    .join('\n');

  const initiativeLines = [line('Department', initiative?.department)].filter(Boolean).join('\n');
  const resultBlocks = linkedResults.map(resultLabelLines).filter(Boolean);

  // Sentences first, then the initiative's own labels, then each result block —
  // blank line between every section for readability.
  return [sentences, initiativeLines, ...resultBlocks].filter(Boolean).join('\n\n');
}

// Man-Day Rate (SGD) auto-fill: first linked Financial result with a cost rate, × 8.
export function financialManDayRateDefault(linkedResults) {
  const withRate = linkedResults.find((r) => r.type === 'financial' && Number.isFinite(Number(r.fields?.rate)));
  return withRate ? Number(withRate.fields.rate) * 8 : '';
}

export function hasFinancialResult(linkedResults) {
  return linkedResults.some((r) => r.type === 'financial');
}

// Units that clearly are NOT time, so before/after can't be read as man-days.
const NON_TIME_UNIT = /%|percent|\bcount\b|error/i;
function isTimeLikeUnit(unit) {
  const u = (unit || '').trim();
  if (!u) return true; // empty/ambiguous → allow fill (editable; user adjusts)
  return !NON_TIME_UNIT.test(u);
}

// Before/After Time (Man-Day) auto-fill from a Productivity result with numeric
// before/after and a time-like unit. Returns { before, after, autofilled }.
// Blank when there's no such result or its unit clearly isn't a time unit.
export function productivityBeforeAfter(linkedResults) {
  const p = linkedResults.find(
    (r) =>
      r.type === 'productivity' &&
      Number.isFinite(Number(r.fields?.before)) &&
      Number.isFinite(Number(r.fields?.after)) &&
      r.fields?.before !== '' &&
      r.fields?.after !== ''
  );
  if (!p || !isTimeLikeUnit(p.fields.unit)) return { before: '', after: '', autofilled: false };
  return { before: Number(p.fields.before), after: Number(p.fields.after), autofilled: true };
}

// "Copy all as text" block. `numbers` is omitted entirely when the Initiative
// has no linked Financial result (the numbers section isn't rendered for it).
export function formatCopyAll({ finding, rootCause, actionTaken, generalNotes }, numbers) {
  let text =
    `Finding:\n${finding}\n\n` +
    `Root Cause & Resolution:\n${rootCause}\n\n` +
    `Action Taken:\n${actionTaken}\n\n` +
    `General Notes:\n${generalNotes}`;
  if (numbers) {
    const v = (x) => (x === '' || x === null || x === undefined ? '' : x);
    text +=
      `\n\n` +
      `Before Time (Man-Day): ${v(numbers.beforeTime)}\n` +
      `After Time (Man-Day): ${v(numbers.afterTime)}\n` +
      `Man-Day Rate (SGD): ${v(numbers.manDayRate)}\n` +
      `Cycle per Month: ${v(numbers.cyclePerMonth)}`;
  }
  return text;
}

export function copyToClipboard(text) {
  return navigator.clipboard.writeText(text);
}

// ---------- Print document ----------

const printMoney = (n) =>
  Number.isFinite(n) ? '$' + (Math.round(n * 100) / 100).toLocaleString('en-GB', { maximumFractionDigits: 2 }) : '—';
const orDash = (v) => (v === '' || v === null || v === undefined ? '—' : String(v));
// Legacy rows stored the literal 'other' plus a separate otherUnit; newer rows
// store the resolved text directly in `unit`.
export const resolvedUnit = (f) => (f.unit === 'other' ? f.otherUnit || '' : f.unit || '');

// Section C results as a real table for the print document. Financial results
// have no before/after pair, so they get their own columns rather than being
// forced into a shape that would misrepresent them.
export function printResultRows(type, results) {
  if (type === 'financial') {
    return {
      columns: ['Cost category', 'Basis', 'Monthly saving', 'Annual saving'],
      rows: results.map((r) => {
        const f = r.fields || {};
        const out = computeResult('financial', f);
        const basis =
          f.timeBased === false
            ? 'Direct monthly saving'
            : `${orDash(f.hoursPerWeek)} hours/week at ${f.rate == null || f.rate === '' ? '—' : printMoney(Number(f.rate))}/hour`;
        return [orDash(f.costCategory), basis, printMoney(out.monthly), printMoney(out.annual)];
      }),
    };
  }
  // Productivity and operational both measure a metric moving before → after.
  return {
    columns: ['Metric', 'Before', 'After', 'Change'],
    rows: results.map((r) => {
      const f = r.fields || {};
      const out = computeResult(type, f);
      const unit = resolvedUnit(f);
      const withUnit = (v) => (v === '' || v == null ? '—' : `${v}${unit}`);
      return [orDash(f.metric), withUnit(f.before), withUnit(f.after), out.metrics[0]?.value || '—'];
    }),
  };
}

// The four export text fields for one initiative: whatever was saved, else the
// assembled-from-data build. One helper so the Export card, the print document
// and a multi-initiative print all show the same thing.
export function exportFieldsFor(initiative, linkedResults = [], saved = null) {
  const has = (k) => typeof saved?.[k] === 'string' && saved[k].trim() !== '';
  return {
    finding: has('finding') ? saved.finding : buildFinding(initiative),
    // Root Cause & Resolution has no plain-text source — it's an analysis.
    rootCause: has('rootCause') ? saved.rootCause : '',
    actionTaken: has('actionTaken') ? saved.actionTaken : buildActionTaken(initiative, linkedResults),
    generalNotes: has('generalNotes') ? saved.generalNotes : buildGeneralNotes(linkedResults, initiative),
  };
}

// Was anything actually saved for this initiative's export block?
export function hasSavedExport(saved) {
  return Boolean(
    saved && ['finding', 'rootCause', 'actionTaken', 'generalNotes'].some((k) => (saved[k] || '').trim())
  );
}

// ---------- AI "Generate with AI" for the export block ----------

// Everything the model is allowed to draw on for one initiative: its B fields
// and every linked Section C result (already rendered as labelled lines + the
// calculated sentence). Assembled here rather than server-side so the model
// only ever sees data the app actually holds. Section D is excluded — the
// export describes one initiative, and Section D is shared by all of them.
export function buildExportEvidence(initiative, linkedResults) {
  const b = [
    line('Initiative', initiative?.name),
    line('Department', initiative?.department),
    line('B8 Business Problem', initiative?.b8_problem),
    line('B9 Problem Significance', initiative?.b9_significance),
    line('B10 Solution Effectiveness', initiative?.b10_solution),
  ].filter(Boolean).join('\n');

  const results = linkedResults
    .map((r, i) => {
      const sentence = computeResult(r.type, r.fields || {}).sentence;
      const note = (r.fields?.note || '').trim();
      return [
        `Result ${i + 1}`,
        resultLabelLines(r),
        sentence ? line('Calculated', sentence) : null,
        note ? line('Qualitative Note', note) : null,
      ].filter(Boolean).join('\n');
    })
    .filter(Boolean)
    .join('\n\n');

  return [b, results ? `Section C measurable results:\n\n${results}` : '']
    .filter(Boolean)
    .join('\n\n');
}

// Field labels as the export prompt asks the model to emit them, in order.
const EXPORT_FIELDS = [
  { key: 'finding', label: 'Finding' },
  { key: 'rootCause', label: 'Root Cause & Resolution' },
  { key: 'actionTaken', label: 'Action Taken' },
  { key: 'generalNotes', label: 'General Notes' },
];

// Split the model's labelled reply into the four export fields. Tolerates the
// usual formatting drift — markdown bold/heading marks, "&" written as "and",
// a label on its own line or followed inline by its text. A field the model
// omitted comes back as '' so the caller can leave the existing text alone
// rather than blanking it.
export function parseExportDraft(text) {
  const src = String(text || '');
  const marks = '[*#\\s]*'; // markdown bold/heading noise around a label
  // Locate every label first, then slice between them — so a label appearing
  // inside a field's prose can't truncate the field before it.
  const hits = [];
  for (const { key, label } of EXPORT_FIELDS) {
    const pattern = label.replace(/&/g, '(?:&|and)').replace(/ /g, '\\s+');
    const re = new RegExp(`^${marks}${pattern}${marks}:${marks}`, 'im');
    const m = re.exec(src);
    if (m) hits.push({ key, start: m.index, end: m.index + m[0].length });
  }
  hits.sort((a, b) => a.start - b.start);

  const out = { finding: '', rootCause: '', actionTaken: '', generalNotes: '' };
  hits.forEach((hit, i) => {
    const stop = i + 1 < hits.length ? hits[i + 1].start : src.length;
    out[hit.key] = src.slice(hit.end, stop).trim();
  });
  return out;
}

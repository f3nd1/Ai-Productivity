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

// b) Root Cause & Resolution: B10, then each linked result's note prefixed with its type tag.
export function buildRootCause(initiative, linkedResults) {
  const notes = linkedResults
    .map((r) => (r.fields?.note || '').trim())
    .map((n, i) => (n ? `[${TYPE_LABEL[linkedResults[i].type]}] ${n}` : null))
    .filter(Boolean);
  return join2(initiative.b10_solution, notes.join('\n'));
}

// c) Action Taken: shared Section D — D14 narrative then D15 narrative.
export function buildActionTaken(sectionD) {
  if (!sectionD) return '';
  return join2(sectionD.d14_narrative, sectionD.d15_narrative);
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
// not already captured elsewhere in the export, as "Label: value" lines
// (Section D fields incl. D16, then one block per linked Section C result).
export function buildGeneralNotes(sectionD, linkedResults) {
  const sentences = linkedResults
    .map((r) => computeResult(r.type, r.fields || {}).sentence)
    .filter(Boolean)
    .join('\n');

  const d = sectionD || {};
  const sectionDLines = [
    line('D16 Future Readiness', d.d16_narrative),
    line('Staff Trained', d.d14_staff_trained),
    line('Total Staff', d.d14_total_staff),
    line('Training Duration (weeks)', d.d14_training_weeks),
    line('Hours Freed per Week', d.d15_hours_per_week),
    line('Staff Affected', d.d15_staff_affected),
  ].filter(Boolean).join('\n');

  const resultBlocks = linkedResults.map(resultLabelLines).filter(Boolean);

  // Sentences first, then Section D labels, then each result block — blank line
  // between every section for readability.
  return [sentences, sectionDLines, ...resultBlocks].filter(Boolean).join('\n\n');
}

// Man-Day Rate (SGD) auto-fill: first linked Financial result with a cost rate, × 8.
export function financialManDayRateDefault(linkedResults) {
  const withRate = linkedResults.find((r) => r.type === 'financial' && Number.isFinite(Number(r.fields?.rate)));
  return withRate ? Number(withRate.fields.rate) * 8 : '';
}

export function hasFinancialResult(linkedResults) {
  return linkedResults.some((r) => r.type === 'financial');
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

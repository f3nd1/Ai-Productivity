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

// d) General Notes: D16 narrative, then each linked result's calculated auto-phrase, one per line.
export function buildGeneralNotes(sectionD, linkedResults) {
  const sentences = linkedResults
    .map((r) => computeResult(r.type, r.fields || {}).sentence)
    .filter(Boolean);
  return join2(sectionD?.d16_narrative, sentences.join('\n'));
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

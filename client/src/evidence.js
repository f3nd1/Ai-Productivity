// Evidence rules for the 9 final-submission questions — pure, no React, so
// evidence.test.mjs can exercise them. Used by the per-initiative page to gate
// generation (front-end guard so the AI never invents content with no basis)
// and to assemble the evidence text sent to the draft endpoint.
import { computeResult } from './calc.js';

export const ORDER = ['b8', 'b9', 'b10', 'c11', 'c12', 'c13', 'd14', 'd15', 'd16'];
// Only C11/C12/C13 have a persisted generated answer; B/D raw fields are their
// own answers. This is the exact set written to final_answers.
export const C_ORDER = ['c11', 'c12', 'c13'];
const TYPE_FOR = { c11: 'productivity', c12: 'financial', c13: 'operational' };
const B_FIELD = { b8: 'b8_problem', b9: 'b9_significance', b10: 'b10_solution' };

// The final_answers payload: only C keys that have a value. Skips undefined/null
// (never-touched) keys and any stale B/D keys from older data.
export function pickCAnswers(answers) {
  const out = {};
  for (const qid of C_ORDER) if (answers && answers[qid] != null) out[qid] = answers[qid];
  return out;
}

const filled = (v) => v !== null && v !== undefined && String(v).trim() !== '';

// Does this question have real evidence to generate from?
export function hasEvidence(qid, { initiative, results, sectionD }) {
  if (qid in B_FIELD) return filled(initiative?.[B_FIELD[qid]]);
  if (qid in TYPE_FOR) return (results || []).some((r) => r.type === TYPE_FOR[qid]);
  const d = sectionD || {};
  if (qid === 'd14')
    return filled(d.d14_narrative) || filled(d.d14_staff_trained) || filled(d.d14_total_staff) || filled(d.d14_training_weeks);
  if (qid === 'd15') return filled(d.d15_narrative) || filled(d.d15_hours_per_week) || filled(d.d15_staff_affected);
  if (qid === 'd16') return filled(d.d16_narrative);
  return false;
}

export const EVIDENCE_HINT = {
  b8: 'Add the B8 narrative first.',
  b9: 'Add the B9 narrative first.',
  b10: 'Add the B10 narrative first.',
  c11: 'Add a Productivity result first.',
  c12: 'Add a Financial result first.',
  c13: 'Add an Operational result first.',
  d14: 'Add D14 details first.',
  d15: 'Add D15 details first.',
  d16: 'Add D16 narrative first.',
};

// Raw evidence text the backend weaves into a paragraph. Scoped to one initiative.
export function assembleEvidence(qid, { initiative, results, sectionD }) {
  if (qid in B_FIELD) return (initiative?.[B_FIELD[qid]] || '').trim();

  if (qid in TYPE_FOR) {
    const type = TYPE_FOR[qid];
    return (results || [])
      .filter((r) => r.type === type)
      .map((r) => {
        const out = computeResult(type, r.fields || {});
        const bits = [];
        if (out.sentence) bits.push(out.sentence);
        if (out.metrics.length) bits.push(out.metrics.map((m) => `${m.label}: ${m.value}`).join(', '));
        if (r.fields?.note) bits.push(`Note: ${r.fields.note}`);
        return bits.join('. ');
      })
      .filter(Boolean)
      .join('\n\n');
  }

  const d = sectionD || {};
  if (qid === 'd14') {
    const lines = [];
    if (d.d14_narrative) lines.push(d.d14_narrative.trim());
    if (d.d14_staff_trained != null && d.d14_total_staff)
      lines.push(
        `Figures: ${d.d14_staff_trained} of ${d.d14_total_staff} staff trained (${Math.round(
          (d.d14_staff_trained / d.d14_total_staff) * 100
        )}% adoption)${d.d14_training_weeks ? ` over ${d.d14_training_weeks} weeks` : ''}.`
      );
    return lines.join('\n\n');
  }
  if (qid === 'd15') {
    const lines = [];
    if (d.d15_narrative) lines.push(d.d15_narrative.trim());
    if (d.d15_hours_per_week != null && d.d15_staff_affected != null) {
      const perWeek = d.d15_hours_per_week * d.d15_staff_affected;
      lines.push(
        `Figures: ${perWeek} hours freed per week (${Math.round(perWeek * 4.33 * 10) / 10} per month) across ${d.d15_staff_affected} staff.`
      );
    }
    return lines.join('\n\n');
  }
  if (qid === 'd16') return (d.d16_narrative || '').trim();
  return '';
}

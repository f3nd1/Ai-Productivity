import { useState } from 'react';
import { api } from '../api.js';
import { Q } from '../questions.js';
import { computeResult } from '../calc.js';
import { Btn } from '../ui.jsx';

const ORDER = ['b8', 'b9', 'b10', 'c11', 'c12', 'c13', 'd14', 'd15', 'd16'];
const TYPE_FOR = { c11: 'productivity', c12: 'financial', c13: 'operational' };
const B_FIELD = { b8: 'b8_problem', b9: 'b9_significance', b10: 'b10_solution' };

// Assemble the raw evidence text the backend weaves into a paragraph.
function assembleEvidence(qid, { initiatives, results, sectionD }) {
  const nameOf = (id) => initiatives.find((i) => i.id === id)?.name || 'an initiative';

  if (qid in B_FIELD) {
    const field = B_FIELD[qid];
    const parts = initiatives
      .filter((i) => (i[field] || '').trim())
      .map((i) => `Initiative "${i.name || 'Untitled'}": ${i[field].trim()}`);
    return parts.join('\n\n');
  }

  if (qid in TYPE_FOR) {
    const type = TYPE_FOR[qid];
    const parts = results
      .filter((r) => r.type === type)
      .map((r) => {
        const out = computeResult(type, r.fields || {});
        const bits = [];
        if (out.sentence) bits.push(out.sentence);
        if (out.metrics.length) bits.push(out.metrics.map((m) => `${m.label}: ${m.value}`).join(', '));
        if (r.fields?.note) bits.push(`Note: ${r.fields.note}`);
        return `From initiative "${nameOf(r.initiative_id)}": ${bits.join('. ')}`;
      });
    return parts.join('\n\n');
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

function wordCount(t) {
  return (t || '').trim().split(/\s+/).filter(Boolean).length;
}

export default function FinalSubmission({ initiatives, results, sectionD }) {
  const [drafts, setDrafts] = useState({});
  const [busy, setBusy] = useState({});
  const [err, setErr] = useState({});
  const [copied, setCopied] = useState(null);
  const [allBusy, setAllBusy] = useState(false);

  const data = { initiatives, results, sectionD };

  async function generate(qid) {
    setBusy((b) => ({ ...b, [qid]: true }));
    setErr((e) => ({ ...e, [qid]: null }));
    try {
      const evidence = assembleEvidence(qid, data);
      const { text } = await api.draft(qid, evidence);
      setDrafts((d) => ({ ...d, [qid]: text }));
    } catch (e) {
      setErr((er) => ({ ...er, [qid]: e.message }));
    } finally {
      setBusy((b) => ({ ...b, [qid]: false }));
    }
  }

  async function generateAll() {
    setAllBusy(true);
    for (const qid of ORDER) await generate(qid); // sequential — kinder to rate limits
    setAllBusy(false);
  }

  async function copy(qid) {
    try {
      await navigator.clipboard.writeText(drafts[qid] || '');
      setCopied(qid);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      setCopied(null);
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800">Final submission — form-ready answers</h2>
        <Btn variant="primary" onClick={generateAll} disabled={allBusy}>
          {allBusy ? 'Generating…' : 'Generate all'}
        </Btn>
      </div>
      <p className="mb-4 text-sm text-slate-500">
        Each answer is drafted from your evidence. Edit freely; the 300-word cap is the real form limit.
      </p>

      <div className="space-y-5">
        {ORDER.map((qid) => {
          const text = drafts[qid] || '';
          const wc = wordCount(text);
          const over = wc > 300;
          return (
            <section key={qid} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-medium text-slate-800">{Q[qid].label}</h3>
                <div className="flex items-center gap-2">
                  <Btn onClick={() => generate(qid)} disabled={busy[qid]}>
                    {busy[qid] ? 'Generating…' : text ? 'Regenerate' : 'Generate'}
                  </Btn>
                  <Btn onClick={() => copy(qid)} disabled={!text}>
                    {copied === qid ? 'Copied' : 'Copy'}
                  </Btn>
                </div>
              </div>
              <textarea
                rows={5}
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                value={text}
                onChange={(e) => setDrafts((d) => ({ ...d, [qid]: e.target.value }))}
                placeholder="Not generated yet."
              />
              <div className="mt-1 flex items-center justify-between">
                <span className={`text-xs ${over ? 'font-semibold text-red-600' : 'text-slate-500'}`}>
                  {wc} / 300 words{over ? ' — over limit' : ''}
                </span>
                {err[qid] && <span className="text-xs text-red-600">{err[qid]}</span>}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

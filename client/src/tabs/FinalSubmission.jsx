import { useState } from 'react';
import { Q } from '../questions.js';
import { ORDER, EVIDENCE_HINT } from '../evidence.js';
import { Btn } from '../ui.jsx';

function wordCount(t) {
  return (t || '').trim().split(/\s+/).filter(Boolean).length;
}

// Display + per-question Generate. Generation/answers state is owned by the
// page (so answers persist and "Generate all" can live in the top bar).
// `evidenceHas(qid)` gates each Generate button.
export default function FinalSubmission({ answers, setAnswers, generate, genBusy, genErr, evidenceHas }) {
  const [copied, setCopied] = useState(null);
  const drafts = answers || {};

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
      <h2 className="mb-1 text-lg font-semibold text-slate-800">Final submission — form-ready answers</h2>
      <p className="mb-4 text-sm text-slate-500">
        Each answer is drafted from this initiative's evidence. A question can only be generated once it
        has evidence. Edit freely; the 300-word cap is the real form limit.
      </p>

      <div className="space-y-5">
        {ORDER.map((qid) => {
          const text = drafts[qid] || '';
          const wc = wordCount(text);
          const over = wc > 300;
          const hasEv = evidenceHas(qid);
          return (
            <section key={qid} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-medium text-slate-800">{Q[qid].label}</h3>
                <div className="flex items-center gap-2">
                  {!hasEv && <span className="text-xs italic text-slate-400">{EVIDENCE_HINT[qid]}</span>}
                  <Btn onClick={() => generate(qid)} disabled={genBusy[qid] || !hasEv}>
                    {genBusy[qid] ? 'Generating…' : text ? 'Regenerate' : 'Generate'}
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
                onChange={(e) => setAnswers((d) => ({ ...d, [qid]: e.target.value }))}
                placeholder="Not generated yet."
              />
              <div className="mt-1 flex items-center justify-between">
                <span className={`text-xs ${over ? 'font-semibold text-red-600' : 'text-slate-500'}`}>
                  {wc} / 300 words{over ? ' — over limit' : ''}
                </span>
                {genErr[qid] && <span className="text-xs text-red-600">{genErr[qid]}</span>}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

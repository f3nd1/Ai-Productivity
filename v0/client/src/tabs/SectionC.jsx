import { computeResult } from '../calc.js';
import { Q } from '../questions.js';
import { EVIDENCE_HINT } from '../evidence.js';
import { useTightenButton, useTightenRegister } from '../tighten.jsx';
import { Btn, TextInput, WordCountCopy } from '../ui.jsx';

const TYPE_TAG = {
  productivity: 'bg-blue-100 text-blue-700',
  financial: 'bg-green-100 text-green-700',
  operational: 'bg-purple-100 text-purple-700',
};
const TYPE_LABEL = {
  productivity: 'Productivity (C11)',
  financial: 'Financial (C12)',
  operational: 'Operational (C13)',
};

function Num({ label, value, onChange, ...rest }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        type="number"
        className="mt-1 w-full rounded border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        {...rest}
      />
    </label>
  );
}

function Note({ value, onChange, tightenId }) {
  const { tighten, busy } = useTightenButton(value, onChange);
  useTightenRegister(tightenId, tightenId, value, onChange); // order = tightenId (100+; sits between B and D)
  return (
    <label className="block">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-700">Qualitative note</span>
        <Btn variant="ghost" onClick={tighten} disabled={busy || !value?.trim()}>
          {busy ? 'Tightening…' : 'Tighten with AI'}
        </Btn>
      </div>
      <textarea
        rows={2}
        className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

// Field editors per type. `f` = fields object, `set(key, value)` updates it.
function TypeFields({ type, f, set, tightenId }) {
  if (type === 'productivity') {
    return (
      <div className="grid grid-cols-2 gap-3">
        <TextInput label="Metric name" value={f.metric || ''} onChange={(e) => set('metric', e.target.value)} />
        <TextInput label="Unit" value={f.unit || ''} onChange={(e) => set('unit', e.target.value)} />
        <Num label="Before value" value={f.before} onChange={(v) => set('before', v)} />
        <Num label="After value" value={f.after} onChange={(v) => set('after', v)} />
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Direction</span>
          <select
            className="mt-1 w-full rounded border border-slate-300 px-3 py-1.5 text-sm"
            value={f.direction || 'higher'}
            onChange={(e) => set('direction', e.target.value)}
          >
            <option value="higher">Higher is better</option>
            <option value="lower">Lower is better</option>
          </select>
        </label>
        <div className="col-span-2">
          <Note value={f.note} onChange={(v) => set('note', v)} tightenId={tightenId} />
        </div>
      </div>
    );
  }

  if (type === 'financial') {
    const timeBased = f.timeBased !== false;
    return (
      <div className="grid grid-cols-2 gap-3">
        <TextInput label="Cost category" value={f.costCategory || ''} onChange={(e) => set('costCategory', e.target.value)} />
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Saving type</span>
          <select
            className="mt-1 w-full rounded border border-slate-300 px-3 py-1.5 text-sm"
            value={timeBased ? 'time' : 'direct'}
            onChange={(e) => set('timeBased', e.target.value === 'time')}
          >
            <option value="time">Time-based saving</option>
            <option value="direct">Direct $ saving/month</option>
          </select>
        </label>
        {timeBased ? (
          <>
            <Num label="Hours saved per week" value={f.hoursPerWeek} onChange={(v) => set('hoursPerWeek', v)} />
            <Num label="Cost rate ($/hour)" value={f.rate} onChange={(v) => set('rate', v)} />
          </>
        ) : (
          <Num label="Direct $ saved per month" value={f.directMonthly} onChange={(v) => set('directMonthly', v)} />
        )}
        <Num label="One-time/setup AI cost (optional)" value={f.oneTimeCost} onChange={(v) => set('oneTimeCost', v)} />
        <div className="col-span-2">
          <Note value={f.note} onChange={(v) => set('note', v)} tightenId={tightenId} />
        </div>
      </div>
    );
  }

  // operational
  const unit = f.unit || '%';
  return (
    <div className="grid grid-cols-2 gap-3">
      <TextInput label="Metric name" value={f.metric || ''} onChange={(e) => set('metric', e.target.value)} />
      <label className="block">
        <span className="text-sm font-medium text-slate-700">Unit</span>
        <select
          className="mt-1 w-full rounded border border-slate-300 px-3 py-1.5 text-sm"
          value={unit}
          onChange={(e) => set('unit', e.target.value)}
        >
          <option value="%">%</option>
          <option value="minutes">minutes</option>
          <option value="count">count</option>
          <option value="other">other</option>
        </select>
      </label>
      <Num label="Before rate" value={f.before} onChange={(v) => set('before', v)} />
      <Num label="After rate" value={f.after} onChange={(v) => set('after', v)} />
      {unit === 'other' && (
        <TextInput label="Custom unit" value={f.otherUnit || ''} onChange={(e) => set('otherUnit', e.target.value)} />
      )}
      <div className="col-span-2">
        <Note value={f.note} onChange={(v) => set('note', v)} tightenId={tightenId} />
      </div>
    </div>
  );
}

function CalcOutput({ type, fields }) {
  const out = computeResult(type, fields);
  if (out.metrics.length === 0 && !out.sentence && !out.warning) return null;
  return (
    <div className="mt-3 rounded border border-slate-200 bg-slate-50 p-3">
      {out.warning && (
        <p className="mb-2 rounded bg-amber-100 px-2 py-1 text-xs text-amber-800">⚠ {out.warning}</p>
      )}
      {out.metrics.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {out.metrics.map((m, idx) => (
            <div key={idx} className="rounded border border-slate-200 bg-white px-3 py-2">
              <div className="text-[10px] uppercase tracking-wide text-slate-500">{m.label}</div>
              <div className="text-lg font-semibold text-slate-800">{m.value}</div>
            </div>
          ))}
        </div>
      )}
      {out.sentence && <p className="mt-2 text-sm font-medium text-slate-700">{out.sentence}</p>}
    </div>
  );
}

// Fully controlled: edits flow up via onChange so the page-level Save persists
// them. Delete stays a distinct per-card action (handled by the parent).
function ResultCard({ result, onChange, onDelete, tightenId }) {
  const type = result.type || 'productivity';
  const fields = result.fields || {};
  const setType = (t) => onChange({ ...result, type: t });
  const set = (k, v) => onChange({ ...result, fields: { ...fields, [k]: v } });

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className={`rounded px-2 py-0.5 text-xs font-medium ${TYPE_TAG[type]}`}>{TYPE_LABEL[type]}</span>
        <div className="ml-auto">
          <Btn variant="danger" onClick={onDelete}>
            Delete
          </Btn>
        </div>
      </div>

      <label className="block max-w-xs">
        <span className="text-sm font-medium text-slate-700">Type</span>
        <select
          className="mt-1 w-full rounded border border-slate-300 px-3 py-1.5 text-sm"
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          <option value="productivity">Productivity</option>
          <option value="financial">Financial</option>
          <option value="operational">Operational</option>
        </select>
      </label>

      <div className="mt-3">
        <TypeFields type={type} f={fields} set={set} tightenId={tightenId} />
      </div>

      <CalcOutput type={type} fields={fields} />
    </div>
  );
}

// The synthesized C answer box that sits directly under its result group.
// C11/C12/C13 genuinely synthesise multiple results, so they keep a Generate
// step (evidence-gated) — unlike the B/D fields whose raw text is the answer.
function CAnswerBox({ qid, value, onChange, onGenerate, busy, err, hasEvidence }) {
  return (
    <div className="mt-3 rounded-lg border border-slate-300 bg-slate-50 p-4">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="font-medium text-slate-800">{Q[qid].label}</h4>
        <div className="flex items-center gap-2">
          {!hasEvidence && <span className="text-xs italic text-slate-400">{EVIDENCE_HINT[qid]}</span>}
          <Btn onClick={onGenerate} disabled={busy || !hasEvidence}>
            {busy ? 'Generating…' : value ? 'Regenerate' : 'Generate'}
          </Btn>
        </div>
      </div>
      <textarea
        rows={5}
        className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Not generated yet."
      />
      <WordCountCopy text={value} />
      {err && <p className="mt-1 text-xs text-red-600">{err}</p>}
    </div>
  );
}

const GROUPS = [
  { type: 'productivity', qid: 'c11' },
  { type: 'financial', qid: 'c12' },
  { type: 'operational', qid: 'c13' },
];

// `results` is the page's editable working list for this initiative; edits and
// add/delete flow up to the page. Results are grouped by type, and each group's
// synthesized C answer box sits directly beneath its cards.
export default function SectionC({
  results,
  onChange,
  onAdd,
  onDelete,
  answers,
  setAnswers,
  generate,
  genBusy,
  genErr,
  evidenceHas,
}) {
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800">Section C — measurable results</h2>
        <Btn variant="primary" onClick={onAdd}>
          Add result
        </Btn>
      </div>

      {results.length === 0 && <p className="mb-4 text-sm text-slate-500">No results yet.</p>}

      <div className="space-y-8">
        {GROUPS.map(({ type, qid }) => {
          // Keep each card's original index so edit/delete/tighten stay correct.
          const items = results.map((r, idx) => ({ r, idx })).filter(({ r }) => (r.type || 'productivity') === type);
          return (
            <div key={type}>
              <div className="grid gap-4">
                {items.map(({ r, idx }) => (
                  <ResultCard
                    key={r._key || r.id}
                    result={r}
                    onChange={(next) => onChange(idx, next)}
                    onDelete={() => onDelete(idx)}
                    tightenId={100 + idx}
                  />
                ))}
              </div>
              <CAnswerBox
                qid={qid}
                value={answers[qid]}
                onChange={(v) => setAnswers((a) => ({ ...a, [qid]: v }))}
                onGenerate={() => generate(qid)}
                busy={genBusy[qid]}
                err={genErr[qid]}
                hasEvidence={evidenceHas(qid)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

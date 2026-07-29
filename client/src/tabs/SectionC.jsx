import { computeResult } from '../calc.js';
import { Q } from '../questions.js';
import { EVIDENCE_HINT } from '../evidence.js';
import { useTightenButton, useTightenRegister } from '../tighten.jsx';
import { Btn, TextInput, WordCountCopy } from '../ui.jsx';

// Fixed, always-visible sub-sections. A result's type comes from the group it
// was added under, so cards no longer carry a type picker.
const GROUPS = [
  {
    type: 'productivity',
    qid: 'c11',
    title: 'C11, productivity gains',
    blurb: 'Speed, accuracy or throughput improvements, measured before and after.',
    addLabel: 'Add Productivity result',
    tone: 'bg-blue-50 text-blue-700 ring-blue-100',
  },
  {
    type: 'financial',
    qid: 'c12',
    title: 'C12, financial impact',
    blurb: 'Cost savings and ROI, either time-based or a direct monthly figure.',
    addLabel: 'Add Financial result',
    tone: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  },
  {
    type: 'operational',
    qid: 'c13',
    title: 'C13, operational benefits',
    blurb: 'Service, process or quality rates that moved after the AI rollout.',
    addLabel: 'Add Operational result',
    tone: 'bg-violet-50 text-violet-700 ring-violet-100',
  },
];

function Num({ label, value, onChange, ...rest }) {
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      <input
        type="number"
        className="field-control"
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
        <span className="field-label">Qualitative note</span>
        <Btn variant="ghost" onClick={tighten} disabled={busy || !value?.trim()}>
          {busy ? 'Tightening…' : 'Tighten with AI'}
        </Btn>
      </div>
      <textarea
        rows={2}
        className="field-control"
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
      <div className="grid gap-3 sm:grid-cols-2">
        <TextInput label="Metric name" value={f.metric || ''} onChange={(e) => set('metric', e.target.value)} />
        <TextInput label="Unit" value={f.unit || ''} onChange={(e) => set('unit', e.target.value)} />
        <Num label="Before value" value={f.before} onChange={(v) => set('before', v)} />
        <Num label="After value" value={f.after} onChange={(v) => set('after', v)} />
        <label className="block">
          <span className="field-label">Direction</span>
          <select
            className="field-control"
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
      <div className="grid gap-3 sm:grid-cols-2">
        <TextInput label="Cost category" value={f.costCategory || ''} onChange={(e) => set('costCategory', e.target.value)} />
        <label className="block">
          <span className="field-label">Saving type</span>
          <select
            className="field-control"
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
    <div className="grid gap-3 sm:grid-cols-2">
      <TextInput label="Metric name" value={f.metric || ''} onChange={(e) => set('metric', e.target.value)} />
      <label className="block">
        <span className="field-label">Unit</span>
        <select
          className="field-control"
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
    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
      {out.warning && (
        <p className="mb-2 rounded bg-amber-100 px-2 py-1 text-xs text-amber-800">⚠ {out.warning}</p>
      )}
      {out.metrics.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {out.metrics.map((m, idx) => (
          <div key={idx} className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 shadow-sm">
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
// Type is fixed by the sub-section the card lives in — no picker.
function ResultCard({ result, index, onChange, onDelete, tightenId }) {
  const type = result.type || 'productivity';
  const fields = result.fields || {};
  const set = (k, v) => onChange({ ...result, fields: { ...fields, [k]: v } });

  return (
    <div className="app-card p-5 sm:p-6">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
          Result {index}
        </span>
        <div className="ml-auto">
          <Btn variant="danger" onClick={onDelete}>
            Delete
          </Btn>
        </div>
      </div>

      <TypeFields type={type} f={fields} set={set} tightenId={tightenId} />

      <CalcOutput type={type} fields={fields} />
    </div>
  );
}

// The synthesized C answer box that sits directly under its result group.
// C11/C12/C13 genuinely synthesise multiple results, so they keep a Generate
// step (evidence-gated) — unlike the B/D fields whose raw text is the answer.
function CAnswerBox({ qid, value, onChange, onGenerate, busy, err, hasEvidence }) {
  return (
    <div className="mt-4 rounded-2xl border border-indigo-100 bg-indigo-50/50 p-5">
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
        className="field-control mt-0 min-h-36"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Not generated yet."
      />
      <WordCountCopy text={value} />
      {err && <p className="mt-1 text-xs text-red-600">{err}</p>}
    </div>
  );
}

// `results` is the page's editable working list for this initiative; edits and
// add/delete flow up to the page. The three sub-sections are always visible in
// C11 → C12 → C13 order, each with its own add button, its own filtered cards,
// and its synthesized C answer box directly beneath them.
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
      <div className="mb-4">
        <p className="eyebrow">Measured outcomes</p>
        <h2 className="section-title mt-1">Section C, measurable results</h2>
      </div>

      <div className="space-y-8">
        {GROUPS.map(({ type, qid, title, blurb, addLabel, tone }) => {
          // Keep each card's original index so edit/delete/tighten stay correct.
          const items = results.map((r, idx) => ({ r, idx })).filter(({ r }) => (r.type || 'productivity') === type);
          return (
            <section key={type} className="rounded-3xl border border-slate-200/80 bg-white/50 p-4 sm:p-5">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] ring-1 ${tone}`}>
                    {items.length} result{items.length === 1 ? '' : 's'}
                  </span>
                  <h3 className="mt-2 text-lg font-semibold tracking-tight text-slate-950">{title}</h3>
                  <p className="mt-1 text-sm text-slate-500">{blurb}</p>
                </div>
                <Btn variant="primary" onClick={() => onAdd(type)}>
                  {addLabel}
                </Btn>
              </div>

              {items.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-6 text-center text-sm text-slate-500">
                  No results yet. Add one to build the evidence for this question.
                </p>
              ) : (
                <div className="grid gap-4">
                  {items.map(({ r, idx }, n) => (
                    <ResultCard
                      key={r._key || r.id}
                      result={r}
                      index={n + 1}
                      onChange={(next) => onChange(idx, next)}
                      onDelete={() => onDelete(idx)}
                      tightenId={100 + idx}
                    />
                  ))}
                </div>
              )}

              <CAnswerBox
                qid={qid}
                value={answers[qid]}
                onChange={(v) => setAnswers((a) => ({ ...a, [qid]: v }))}
                onGenerate={() => generate(qid)}
                busy={genBusy[qid]}
                err={genErr[qid]}
                hasEvidence={evidenceHas(qid)}
              />
            </section>
          );
        })}
      </div>
    </div>
  );
}

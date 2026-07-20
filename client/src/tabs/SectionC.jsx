import { useMemo, useState } from 'react';
import { api } from '../api.js';
import { computeResult } from '../calc.js';
import { resultsFor } from '../export.js';
import { Btn, TextInput } from '../ui.jsx';

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

function Note({ value, onChange }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">Qualitative note</span>
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
function TypeFields({ type, f, set }) {
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
          <Note value={f.note} onChange={(v) => set('note', v)} />
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
          <Note value={f.note} onChange={(v) => set('note', v)} />
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
        <Note value={f.note} onChange={(v) => set('note', v)} />
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

// `initiativeId` is fixed for the lifetime of this card — the page it lives
// on is already scoped to one initiative, so there's no cross-initiative
// dropdown to show or reassign here.
function ResultCard({ result, initiativeId, reload, isNew, onCancelNew }) {
  const [type, setType] = useState(result.type || 'productivity');
  const [fields, setFields] = useState(result.fields || {});
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const set = (k, v) => setFields((f) => ({ ...f, [k]: v }));

  async function save() {
    setSaving(true);
    setErr(null);
    const body = { initiative_id: initiativeId, type, fields, note: fields.note || '' };
    try {
      if (isNew) await api.createResult(body);
      else await api.updateResult(result.id, body);
      await reload();
      if (isNew) onCancelNew();
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function del() {
    if (!confirm('Delete this result?')) return;
    try {
      await api.deleteResult(result.id);
      await reload();
    } catch (e) {
      alert(e.message);
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className={`rounded px-2 py-0.5 text-xs font-medium ${TYPE_TAG[type]}`}>
          {TYPE_LABEL[type]}
        </span>
        <div className="ml-auto flex gap-2">
          <Btn variant="primary" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : isNew ? 'Save result' : 'Save changes'}
          </Btn>
          {isNew ? (
            <Btn onClick={onCancelNew}>Cancel</Btn>
          ) : (
            <Btn variant="danger" onClick={del}>
              Delete
            </Btn>
          )}
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
        <TypeFields type={type} f={fields} set={set} />
      </div>

      <CalcOutput type={type} fields={fields} />
      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
    </div>
  );
}

export default function SectionC({ initiativeId, results, reload }) {
  const [adding, setAdding] = useState(false);
  const shown = useMemo(() => resultsFor(initiativeId, results), [initiativeId, results]);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800">Section C — measurable results</h2>
        <Btn variant="primary" onClick={() => setAdding(true)} disabled={adding}>
          Add result
        </Btn>
      </div>

      <div className="grid gap-4">
        {adding && (
          <ResultCard
            result={{ type: 'productivity', fields: {} }}
            initiativeId={initiativeId}
            reload={reload}
            isNew
            onCancelNew={() => setAdding(false)}
          />
        )}
        {shown.map((r) => (
          <ResultCard key={r.id} result={r} initiativeId={initiativeId} reload={reload} />
        ))}
        {!adding && shown.length === 0 && <p className="text-sm text-slate-500">No results yet.</p>}
      </div>
    </div>
  );
}

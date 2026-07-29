import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { Q } from '../questions.js';
import { Btn, NarrativeField } from '../ui.jsx';

const num = (v) => (v === '' || v == null ? NaN : Number(v));
const numOrNull = (v) => {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
};

function body(d) {
  return {
    d14_narrative: d.d14_narrative || null,
    d14_staff_trained: numOrNull(d.d14_staff_trained),
    d14_total_staff: numOrNull(d.d14_total_staff),
    d14_training_weeks: numOrNull(d.d14_training_weeks),
    d15_narrative: d.d15_narrative || null,
    d15_hours_per_week: numOrNull(d.d15_hours_per_week),
    d15_staff_affected: numOrNull(d.d15_staff_affected),
    d16_narrative: d.d16_narrative || null,
  };
}

function CalcInputs({ children }) {
  return <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>;
}
function NumIn({ label, value, onChange }) {
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      <input
        type="number"
        className="field-control"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function Suggested({ sentence, onInsert }) {
  if (!sentence) return null;
  return (
    <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4">
      <p className="flex-1 text-sm text-slate-700">Suggested: {sentence}</p>
      <Btn onClick={onInsert}>Insert</Btn>
    </div>
  );
}

// Section D is the closing section of the whole submission: ONE overall set of
// D14/D15/D16 covering adoption, process change and future readiness across
// every initiative, not scoped to any single one. It owns its own state and
// Save because it is a top-level page rather than part of the initiative page.
export default function SectionD({ sectionD, reload }) {
  const [d, setD] = useState(sectionD || {});
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null);
  const [err, setErr] = useState(null);
  const autosaveTimer = useRef(null);
  const savingRef = useRef(false);
  const stateRef = useRef();
  stateRef.current = d;

  // Seed once from the loaded row — not on every reload, which would clobber
  // in-progress edits (the same rule the initiative page follows).
  const seeded = useRef(Boolean(sectionD));
  useEffect(() => {
    if (!seeded.current && sectionD) {
      seeded.current = true;
      setD(sectionD);
    }
  }, [sectionD]);

  const set = (k) => (v) => setD((s) => ({ ...s, [k]: v }));

  async function persist(explicit) {
    if (savingRef.current) return;
    savingRef.current = true;
    if (explicit) {
      setSaving(true);
      setErr(null);
    }
    try {
      await api.saveSectionD(body(stateRef.current));
      await reload();
      if (explicit) {
        setSaveMsg('Saved');
        setTimeout(() => setSaveMsg(null), 2500);
      }
    } catch (e) {
      setErr(e.message);
    } finally {
      savingRef.current = false;
      if (explicit) setSaving(false);
    }
  }

  function scheduleAutosave() {
    clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => persist(false), 800);
  }
  useEffect(() => () => clearTimeout(autosaveTimer.current), []);

  // D14 calc
  const trained = num(d.d14_staff_trained);
  const total = num(d.d14_total_staff);
  const weeks = num(d.d14_training_weeks);
  const adoptionPct =
    Number.isFinite(trained) && Number.isFinite(total) && total > 0
      ? Math.round((trained / total) * 100)
      : null;
  const d14Sentence =
    adoptionPct != null && Number.isFinite(weeks)
      ? `Trained ${trained} staff over ${weeks} weeks, ${adoptionPct}% adoption`
      : '';

  // D15 calc
  const hpw = num(d.d15_hours_per_week);
  const staff = num(d.d15_staff_affected);
  const perWeek = Number.isFinite(hpw) && Number.isFinite(staff) ? hpw * staff : null;
  const perMonth = perWeek != null ? Math.round(perWeek * 4.33 * 10) / 10 : null;
  const d15Sentence =
    perWeek != null
      ? `Freed up ${perWeek} hours per week (${perMonth} hours per month) across ${staff} staff`
      : '';

  const insert = (key, sentence) => () =>
    setD((s) => {
      const cur = (s[key] || '').trim();
      return { ...s, [key]: cur ? `${cur} ${sentence}.` : `${sentence}.` };
    });

  return (
    // onBlur bubbles (focusout) — any field losing focus schedules an autosave.
    <div className="space-y-6" onBlur={scheduleAutosave}>
      <div className="app-card sticky top-3 z-10 flex flex-wrap items-center justify-between gap-3 p-3.5 backdrop-blur-xl">
        <p className="text-sm text-slate-500">
          One overall answer for the whole submission, shared by every initiative.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          {saveMsg && <span className="text-sm font-medium text-green-600">{saveMsg}</span>}
          <Btn variant="primary" onClick={() => persist(true)} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Btn>
        </div>
      </div>

      {err && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{err}</p>}

      <div>
        <p className="eyebrow">People and readiness</p>
        <h2 className="section-title mt-1">Section D, adoption and future readiness</h2>
      </div>

      {/* D14 */}
      <section className="app-card p-5 sm:p-6">
        <NarrativeField q={Q.d14} value={d.d14_narrative} onChange={set('d14_narrative')} />
        <CalcInputs>
          <NumIn label="Staff trained" value={d.d14_staff_trained} onChange={set('d14_staff_trained')} />
          <NumIn label="Total staff" value={d.d14_total_staff} onChange={set('d14_total_staff')} />
          <NumIn label="Training duration (weeks)" value={d.d14_training_weeks} onChange={set('d14_training_weeks')} />
        </CalcInputs>
        {adoptionPct != null && (
          <p className="mt-2 text-sm font-medium text-slate-700">Adoption: {adoptionPct}%</p>
        )}
        <Suggested sentence={d14Sentence} onInsert={insert('d14_narrative', d14Sentence)} />
      </section>

      {/* D15 */}
      <section className="app-card p-5 sm:p-6">
        <NarrativeField q={Q.d15} value={d.d15_narrative} onChange={set('d15_narrative')} />
        <CalcInputs>
          <NumIn label="Hours freed per week" value={d.d15_hours_per_week} onChange={set('d15_hours_per_week')} />
          <NumIn label="Staff affected" value={d.d15_staff_affected} onChange={set('d15_staff_affected')} />
          <div />
        </CalcInputs>
        {perWeek != null && (
          <p className="mt-2 text-sm font-medium text-slate-700">
            {perWeek} hours/week · {perMonth} hours/month
          </p>
        )}
        <Suggested sentence={d15Sentence} onInsert={insert('d15_narrative', d15Sentence)} />
      </section>

      {/* D16 — narrative only */}
      <section className="app-card p-5 sm:p-6">
        <NarrativeField q={Q.d16} value={d.d16_narrative} onChange={set('d16_narrative')} />
      </section>
    </div>
  );
}

import { Q } from '../questions.js';
import { Btn, NarrativeField } from '../ui.jsx';

const num = (v) => (v === '' || v == null ? NaN : Number(v));

function CalcInputs({ children }) {
  return <div className="mt-3 grid grid-cols-3 gap-3">{children}</div>;
}
function NumIn({ label, value, onChange }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        type="number"
        className="mt-1 w-full rounded border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function Suggested({ sentence, onInsert }) {
  if (!sentence) return null;
  return (
    <div className="mt-3 flex items-center gap-3 rounded border border-slate-200 bg-slate-50 p-3">
      <p className="flex-1 text-sm text-slate-700">Suggested: {sentence}</p>
      <Btn onClick={onInsert}>Insert</Btn>
    </div>
  );
}

// Controlled by the page: `d` holds the Section D fields, `setD` updates them.
// No own Save button — the page-level Save persists everything together.
export default function SectionD({ d, setD }) {
  const set = (k) => (v) => setD((s) => ({ ...s, [k]: v }));

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
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-slate-800">Section D</h2>

      {/* D14 */}
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <NarrativeField q={Q.d14} value={d.d14_narrative} onChange={set('d14_narrative')} tightenId={200} tightenOrder={200} />
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
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <NarrativeField q={Q.d15} value={d.d15_narrative} onChange={set('d15_narrative')} tightenId={201} tightenOrder={201} />
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
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <NarrativeField q={Q.d16} value={d.d16_narrative} onChange={set('d16_narrative')} tightenId={202} tightenOrder={202} />
      </section>
    </div>
  );
}

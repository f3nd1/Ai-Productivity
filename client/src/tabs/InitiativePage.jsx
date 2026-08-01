import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api.js';
import { Q } from '../questions.js';
import { resultsFor } from '../export.js';
import { C_ORDER, hasEvidence, assembleEvidence, pickCAnswers } from '../evidence.js';
import { TightenProvider, runTightenAll } from '../tighten.jsx';
import { Btn, TextInput, NarrativeField } from '../ui.jsx';
import SectionC from './SectionC.jsx';
import { ExportCard } from './Export.jsx';
import PrintView from './PrintView.jsx';

export const DEPARTMENTS = [
  'Academic',
  'Admission',
  'Finance',
  'Human Resources',
  'Information Technology',
  'Marketing',
  'Quality Assurance',
  'Sales',
  'Student Support',
];

function DepartmentField({ value, onChange }) {
  const isListed = DEPARTMENTS.includes(value);
  const [customMode, setCustomMode] = useState(Boolean(value && !isListed));

  useEffect(() => {
    if (value && !DEPARTMENTS.includes(value)) setCustomMode(true);
    if (DEPARTMENTS.includes(value)) setCustomMode(false);
  }, [value]);

  function changeSelection(event) {
    const next = event.target.value;
    if (next === '__custom__') {
      setCustomMode(true);
      if (DEPARTMENTS.includes(value)) onChange('');
      return;
    }
    setCustomMode(false);
    onChange(next);
  }

  return (
    <div>
      <label className="block">
        <span className="field-label">Department</span>
        <select
          className="field-control"
          value={customMode ? '__custom__' : value || ''}
          onChange={changeSelection}
        >
          <option value="">Select a department</option>
          {DEPARTMENTS.map((department) => (
            <option key={department} value={department}>
              {department}
            </option>
          ))}
          <option value="__custom__">Other department</option>
        </select>
      </label>

      {customMode && (
        <TextInput
          label="Custom department"
          className="mt-2"
          value={value || ''}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Enter the department name"
        />
      )}
    </div>
  );
}

// Initiative name + B8/B9/B10, controlled by the page.
function InitiativeInfo({ info, setInfo }) {
  const set = (k) => (v) => setInfo((s) => ({ ...s, [k]: v }));
  return (
    <section className="app-card space-y-5 p-5 sm:p-6">
      <div>
        <p className="eyebrow">Foundation</p>
        <h2 className="section-title mt-1">Initiative details</h2>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <TextInput
          label="Initiative name"
          value={info.name || ''}
          onChange={(e) => set('name')(e.target.value)}
          placeholder="e.g. Claude for Quality Action drafting"
        />
        <div>
          <DepartmentField value={info.department || ''} onChange={set('department')} />
          {/* Department is easy to skip silently, so say so where it's set. */}
          {!info.department?.trim() && (
            <p className="mt-1.5 text-xs font-medium text-amber-600">
              Department not set — pick one so this initiative appears under the right department in
              Overview.
            </p>
          )}
        </div>
      </div>
      <NarrativeField q={Q.b8} value={info.b8_problem} onChange={set('b8_problem')} tightenId={1} tightenOrder={1} />
      <NarrativeField q={Q.b9} value={info.b9_significance} onChange={set('b9_significance')} tightenId={2} tightenOrder={2} />
      <NarrativeField q={Q.b10} value={info.b10_solution} onChange={set('b10_solution')} tightenId={3} tightenOrder={3} />
    </section>
  );
}

// `sectionD` is the ONE overall Section D, read-only here — it's edited on its
// own top-level page. This page needs it only as context for the Export block.
export default function InitiativePage({ initiative, results, sectionD, reload, onBack }) {
  const registryRef = useRef(new Map());
  const savingRef = useRef(false);
  const generatingRef = useRef(false);
  const autosaveTimer = useRef(null);
  const keyCounter = useRef(0);

  const [info, setInfo] = useState({
    name: initiative.name || '',
    department: initiative.department || '',
    b8_problem: initiative.b8_problem || '',
    b9_significance: initiative.b9_significance || '',
    b10_solution: initiative.b10_solution || '',
  });
  // Editable working list of this initiative's results (seeded once on mount).
  const [cResults, setCResults] = useState(() =>
    resultsFor(initiative.id, results).map((r) => ({ ...r, _key: `db-${r.id}` }))
  );
  const [answers, setAnswers] = useState({});
  const [notApplicable, setNotApplicable] = useState(initiative.not_applicable || {});
  // Mirrors the Export block's four text fields so the print document renders
  // exactly what's on screen. Mounted only while printing, so the live UI is
  // untouched the rest of the time.
  const [exportFields, setExportFields] = useState({});
  const [printing, setPrinting] = useState(false);

  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null);
  const [err, setErr] = useState(null);
  const [tighten, setTighten] = useState({ done: 0, total: 0 });
  const [genBusy, setGenBusy] = useState({});
  const [genErr, setGenErr] = useState({});
  const [allBusy, setAllBusy] = useState(false);
  const [genSummary, setGenSummary] = useState(null);

  // Load saved final answers on open.
  useEffect(() => {
    api.getFinalAnswers(initiative.id).then((a) => setAnswers(a || {})).catch(() => {});
  }, [initiative.id]);

  // Latest state for the debounced autosave / save mutex (avoids stale closures).
  const stateRef = useRef();
  stateRef.current = { info, cResults, answers, notApplicable };

  const liveInitiative = { ...initiative, ...info };
  const evidenceCtx = { initiative: liveInitiative, results: cResults, sectionD };
  const evidenceHas = (qid) => hasEvidence(qid, evidenceCtx);

  // ---- Section C editing (flows into the page-level save) ----
  const changeResult = (idx, next) => setCResults((list) => list.map((r, i) => (i === idx ? next : r)));
  // Type comes from the Section C sub-section the add button belongs to.
  const addResult = (type) =>
    setCResults((list) => [
      ...list,
      { _key: `new-${(keyCounter.current += 1)}`, initiative_id: initiative.id, type, fields: {} },
    ]);
  const deleteResult = async (idx) => {
    const r = stateRef.current.cResults[idx];
    if (!confirm('Delete this result?')) return;
    setCResults((list) => list.filter((_, i) => i !== idx));
    if (r.id) {
      try {
        await api.deleteResult(r.id);
        await reload();
      } catch (e) {
        setErr(e.message);
      }
    }
  };

  // ---- Single page-level save (explicit button + debounced blur autosave) ----
  async function persist(explicit) {
    const cur = stateRef.current;
    if (!cur.info.b8_problem?.trim()) {
      if (explicit) setErr('B8 business problem is required.');
      return;
    }
    if (savingRef.current) return;
    savingRef.current = true;
    if (explicit) {
      setSaving(true);
      setErr(null);
    }
    try {
      await api.updateInitiative(initiative.id, { ...cur.info, not_applicable: cur.notApplicable || {} });
      await api.saveFinalAnswers(initiative.id, pickCAnswers(cur.answers));
      // Create new results / update existing; collect ids for the created ones.
      const idByKey = {};
      for (const r of cur.cResults) {
        const body = { initiative_id: initiative.id, type: r.type, fields: r.fields || {}, note: r.fields?.note || '' };
        if (r.id) await api.updateResult(r.id, body);
        else {
          const created = await api.createResult(body);
          idByKey[r._key] = created.id;
        }
      }
      // Merge new ids without clobbering any edits made during the await.
      if (Object.keys(idByKey).length) {
        setCResults((list) => list.map((r) => (r.id || !idByKey[r._key] ? r : { ...r, id: idByKey[r._key] })));
      }
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
    // Don't let a blur-triggered autosave run mid-generation — it would persist
    // an empty/partial final_answers and clobber the answers being generated.
    autosaveTimer.current = setTimeout(() => {
      if (generatingRef.current) return;
      persist(false);
    }, 800);
  }
  useEffect(() => () => clearTimeout(autosaveTimer.current), []);

  // Print once the document has actually been laid out, then unmount it when
  // the dialog closes (afterprint also fires on cancel, so it can't get stuck).
  useEffect(() => {
    if (!printing) return undefined;
    const done = () => setPrinting(false);
    window.addEventListener('afterprint', done);
    const frame = requestAnimationFrame(() => window.print());
    return () => {
      window.removeEventListener('afterprint', done);
      cancelAnimationFrame(frame);
    };
  }, [printing]);

  // Persist C answers immediately (independent of the B8-gated whole-page save),
  // so a reload right after generating keeps them. Takes an explicit answers
  // object — callers accumulate the just-generated text rather than reading
  // React state, which may not have re-rendered yet after an await.
  async function persistAnswers(answersObj) {
    try {
      await api.saveFinalAnswers(initiative.id, pickCAnswers(answersObj));
    } catch (e) {
      setErr(`Could not save generated answers: ${e.message}`);
    }
  }

  // ---- Tighten all ----
  async function tightenAll() {
    setSaveMsg(null);
    await runTightenAll(registryRef, (done, total) => setTighten({ done, total }));
    setTighten({ done: 0, total: 0 });
  }

  // ---- Generation (evidence-gated; skips questions with no evidence) ----
  // Returns the generated text (or undefined on error) so callers can persist
  // the accumulated result without waiting on a React re-render.
  async function generate(qid) {
    setGenBusy((b) => ({ ...b, [qid]: true }));
    setGenErr((e) => ({ ...e, [qid]: null }));
    try {
      const { text } = await api.draft(qid, assembleEvidence(qid, evidenceCtx));
      setAnswers((a) => ({ ...a, [qid]: text }));
      return text;
    } catch (e) {
      setGenErr((er) => ({ ...er, [qid]: e.message }));
      return undefined;
    } finally {
      setGenBusy((b) => ({ ...b, [qid]: false }));
    }
  }

  // Per-question Generate button: generate, then persist so it survives a reload
  // even if the user never clicks the page-level Save.
  async function runGenerate(qid) {
    generatingRef.current = true;
    try {
      const text = await generate(qid);
      if (text != null) await persistAnswers({ ...stateRef.current.answers, [qid]: text });
    } finally {
      generatingRef.current = false;
    }
  }

  async function generateCAnswers() {
    setAllBusy(true);
    generatingRef.current = true;
    setGenSummary(null);
    let gen = 0;
    let skip = 0;
    // Accumulate locally — immune to React render timing during the await loop.
    const acc = { ...stateRef.current.answers };
    try {
      for (const qid of C_ORDER) {
        if (!evidenceHas(qid)) {
          skip += 1;
          continue;
        }
        const text = await generate(qid);
        if (text != null) acc[qid] = text;
        gen += 1;
      }
      if (gen > 0) await persistAnswers(acc); // persist the freshly generated answers
    } finally {
      generatingRef.current = false;
      setAllBusy(false);
    }
    setGenSummary(`Generated ${gen} of ${C_ORDER.length} — ${skip} skipped (no evidence yet)`);
    setTimeout(() => setGenSummary(null), 7000);
  }

  const tightening = tighten.total > 0;
  const busy = saving || tightening || allBusy;

  const linkedResults = useMemo(() => cResults, [cResults]);

  return (
    <TightenProvider registryRef={registryRef}>
      {/* onBlur bubbles (focusout) — any field losing focus schedules an autosave. */}
      <div className="space-y-6" onBlur={scheduleAutosave}>
        <div className="app-card sticky top-3 z-10 flex flex-wrap items-center justify-between gap-3 p-3.5 backdrop-blur-xl">
          <Btn variant="ghost" onClick={onBack}>
            ← Back to Initiatives
          </Btn>
          <div className="flex flex-wrap items-center gap-3">
            {genSummary && <span className="text-sm text-slate-500">{genSummary}</span>}
            {tightening && (
              <span className="text-sm text-slate-500">
                Tightening {tighten.done} of {tighten.total}…
              </span>
            )}
            {saveMsg && <span className="text-sm font-medium text-green-600">{saveMsg}</span>}
            <Btn onClick={generateCAnswers} disabled={busy}>
              {allBusy ? 'Generating…' : 'Generate C answers'}
            </Btn>
            <Btn onClick={tightenAll} disabled={busy}>
              Tighten all
            </Btn>
            <Btn onClick={() => setPrinting(true)} disabled={busy || printing}>
              {printing ? 'Preparing…' : 'Print / Export PDF'}
            </Btn>
            <Btn variant="primary" onClick={() => persist(true)} disabled={busy}>
              {saving ? 'Saving…' : 'Save'}
            </Btn>
          </div>
        </div>
        {err && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{err}</p>}

        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            {info.department?.trim() ? (
              <p className="eyebrow">{info.department.trim()}</p>
            ) : (
              <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-amber-700 ring-1 ring-amber-200">
                Department not set
              </span>
            )}
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
              {info.name || 'Untitled initiative'}
            </h1>
          </div>
          <span className="rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-100">
            9 evidence questions
          </span>
        </div>

        <InitiativeInfo info={info} setInfo={setInfo} />

        <SectionC
          results={cResults}
          onChange={changeResult}
          onAdd={addResult}
          onDelete={deleteResult}
          answers={answers}
          setAnswers={setAnswers}
          generate={runGenerate}
          genBusy={genBusy}
          genErr={genErr}
          evidenceHas={evidenceHas}
          notApplicable={notApplicable}
          setNotApplicable={setNotApplicable}
        />

        <section>
          <p className="eyebrow">Transfer</p>
          <h2 className="section-title mb-3 mt-1">Export to ERPNext Quality Action Resolution</h2>
          <ExportCard
            initiative={liveInitiative}
            results={linkedResults}
            sectionD={sectionD}
            onFieldsChange={setExportFields}
          />
        </section>

        {printing && (
          <PrintView
            initiative={liveInitiative}
            results={cResults}
            answers={answers}
            notApplicable={notApplicable}
            sectionD={sectionD}
            exportFields={exportFields}
          />
        )}
      </div>
    </TightenProvider>
  );
}

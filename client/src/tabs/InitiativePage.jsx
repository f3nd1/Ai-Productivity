import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api.js';
import { Q } from '../questions.js';
import { resultsFor } from '../export.js';
import { ORDER, hasEvidence, assembleEvidence } from '../evidence.js';
import { TightenProvider, runTightenAll } from '../tighten.jsx';
import { Btn, TextInput, NarrativeField } from '../ui.jsx';
import SectionC from './SectionC.jsx';
import SectionD from './SectionD.jsx';
import FinalSubmission from './FinalSubmission.jsx';
import { ExportCard } from './Export.jsx';

const numOrNull = (v) => {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
};

function sectionDBody(d) {
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

// Initiative name + B8/B9/B10, controlled by the page.
function InitiativeInfo({ info, setInfo }) {
  const set = (k) => (v) => setInfo((s) => ({ ...s, [k]: v }));
  return (
    <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="text-lg font-semibold text-slate-800">Initiative details</h2>
      <TextInput
        label="Initiative name"
        value={info.name || ''}
        onChange={(e) => set('name')(e.target.value)}
        placeholder="e.g. Claude for Quality Action drafting"
      />
      <NarrativeField q={Q.b8} value={info.b8_problem} onChange={set('b8_problem')} tightenId={1} tightenOrder={1} />
      <NarrativeField q={Q.b9} value={info.b9_significance} onChange={set('b9_significance')} tightenId={2} tightenOrder={2} />
      <NarrativeField q={Q.b10} value={info.b10_solution} onChange={set('b10_solution')} tightenId={3} tightenOrder={3} />
    </section>
  );
}

export default function InitiativePage({ initiative, results, sectionDList, reload, onBack }) {
  const registryRef = useRef(new Map());
  const savingRef = useRef(false);
  const autosaveTimer = useRef(null);
  const keyCounter = useRef(0);

  const [info, setInfo] = useState({
    name: initiative.name || '',
    b8_problem: initiative.b8_problem || '',
    b9_significance: initiative.b9_significance || '',
    b10_solution: initiative.b10_solution || '',
  });
  // Editable working list of this initiative's results (seeded once on mount).
  const [cResults, setCResults] = useState(() =>
    resultsFor(initiative.id, results).map((r) => ({ ...r, _key: `db-${r.id}` }))
  );
  const [dFields, setDFields] = useState(
    () => sectionDList.find((d) => d.initiative_id === initiative.id) || {}
  );
  const [answers, setAnswers] = useState({});

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
  stateRef.current = { info, cResults, dFields, answers };

  const liveInitiative = { ...initiative, ...info };
  const evidenceCtx = { initiative: liveInitiative, results: cResults, sectionD: dFields };
  const evidenceHas = (qid) => hasEvidence(qid, evidenceCtx);

  // ---- Section C editing (flows into the page-level save) ----
  const changeResult = (idx, next) => setCResults((list) => list.map((r, i) => (i === idx ? next : r)));
  const addResult = () =>
    setCResults((list) => [
      ...list,
      { _key: `new-${(keyCounter.current += 1)}`, initiative_id: initiative.id, type: 'productivity', fields: {} },
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
      await api.updateInitiative(initiative.id, cur.info);
      await api.saveSectionD(initiative.id, sectionDBody(cur.dFields));
      await api.saveFinalAnswers(initiative.id, cur.answers);
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
    autosaveTimer.current = setTimeout(() => persist(false), 800);
  }
  useEffect(() => () => clearTimeout(autosaveTimer.current), []);

  // ---- Tighten all ----
  async function tightenAll() {
    setSaveMsg(null);
    await runTightenAll(registryRef, (done, total) => setTighten({ done, total }));
    setTighten({ done: 0, total: 0 });
  }

  // ---- Generation (evidence-gated; skips questions with no evidence) ----
  async function generate(qid) {
    setGenBusy((b) => ({ ...b, [qid]: true }));
    setGenErr((e) => ({ ...e, [qid]: null }));
    try {
      const { text } = await api.draft(qid, assembleEvidence(qid, evidenceCtx));
      setAnswers((a) => ({ ...a, [qid]: text }));
    } catch (e) {
      setGenErr((er) => ({ ...er, [qid]: e.message }));
    } finally {
      setGenBusy((b) => ({ ...b, [qid]: false }));
    }
  }

  async function generateAll() {
    setAllBusy(true);
    setGenSummary(null);
    let gen = 0;
    let skip = 0;
    for (const qid of ORDER) {
      if (!evidenceHas(qid)) {
        skip += 1;
        continue;
      }
      await generate(qid);
      gen += 1;
    }
    setAllBusy(false);
    setGenSummary(`Generated ${gen} of ${ORDER.length} — ${skip} skipped (no evidence yet)`);
    setTimeout(() => setGenSummary(null), 7000);
  }

  const tightening = tighten.total > 0;
  const busy = saving || tightening || allBusy;

  const linkedResults = useMemo(() => cResults, [cResults]);

  return (
    <TightenProvider registryRef={registryRef}>
      {/* onBlur bubbles (focusout) — any field losing focus schedules an autosave. */}
      <div className="space-y-6" onBlur={scheduleAutosave}>
        <div className="flex flex-wrap items-center justify-between gap-3">
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
            <Btn onClick={generateAll} disabled={busy}>
              {allBusy ? 'Generating…' : 'Generate all'}
            </Btn>
            <Btn onClick={tightenAll} disabled={busy}>
              Tighten all
            </Btn>
            <Btn variant="primary" onClick={() => persist(true)} disabled={busy}>
              {saving ? 'Saving…' : 'Save'}
            </Btn>
          </div>
        </div>
        {err && <p className="text-sm text-red-600">{err}</p>}

        <h1 className="text-xl font-semibold text-slate-800">{info.name || 'Untitled initiative'}</h1>

        <InitiativeInfo info={info} setInfo={setInfo} />

        <SectionC results={cResults} onChange={changeResult} onAdd={addResult} onDelete={deleteResult} />

        <SectionD d={dFields} setD={setDFields} />

        <FinalSubmission
          answers={answers}
          setAnswers={setAnswers}
          generate={generate}
          genBusy={genBusy}
          genErr={genErr}
          evidenceHas={evidenceHas}
        />

        <section>
          <h2 className="mb-2 text-lg font-semibold text-slate-800">
            Export — ERPNext Quality Action Resolution
          </h2>
          <ExportCard initiative={liveInitiative} results={linkedResults} sectionD={dFields} />
        </section>
      </div>
    </TightenProvider>
  );
}

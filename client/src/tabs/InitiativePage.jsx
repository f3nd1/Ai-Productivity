import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api.js';
import { Q } from '../questions.js';
import { resultsFor } from '../export.js';
import { TightenProvider, runTightenAll } from '../tighten.jsx';
import { Btn, TextInput, NarrativeField } from '../ui.jsx';
import SectionC from './SectionC.jsx';
import SectionD from './SectionD.jsx';
import FinalSubmission from './FinalSubmission.jsx';
import { ExportCard } from './Export.jsx';

// Initiative name + B8/B9/B10 — controlled by the page so the page-level Save
// can persist them together with the final answers. No own Save button.
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
  const [info, setInfo] = useState({
    name: initiative.name || '',
    b8_problem: initiative.b8_problem || '',
    b9_significance: initiative.b9_significance || '',
    b10_solution: initiative.b10_solution || '',
  });
  const [answers, setAnswers] = useState({}); // qid -> text (Final submission)
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null);
  const [err, setErr] = useState(null);
  const [tighten, setTighten] = useState({ done: 0, total: 0 });

  const linkedResults = useMemo(() => resultsFor(initiative.id, results), [initiative.id, results]);
  const sectionD = useMemo(
    () => sectionDList.find((d) => d.initiative_id === initiative.id) || null,
    [sectionDList, initiative.id]
  );

  // Load saved final answers for this initiative on open.
  useEffect(() => {
    api.getFinalAnswers(initiative.id).then((a) => setAnswers(a || {})).catch(() => {});
  }, [initiative.id]);

  // Generation should use the current (possibly unsaved) B-field edits.
  const liveInitiative = { ...initiative, ...info };

  async function saveAll() {
    if (!info.b8_problem?.trim()) {
      setErr('B8 business problem is required.');
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      await api.updateInitiative(initiative.id, info);
      await api.saveFinalAnswers(initiative.id, answers);
      await reload();
      setSaveMsg('Saved');
      setTimeout(() => setSaveMsg(null), 2500);
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function tightenAll() {
    setSaveMsg(null);
    await runTightenAll(registryRef, (done, total) => setTighten({ done, total }));
    setTighten({ done: 0, total: 0 });
  }

  const tightening = tighten.total > 0;

  return (
    <TightenProvider registryRef={registryRef}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Btn variant="ghost" onClick={onBack}>
            ← Back to Initiatives
          </Btn>
          <div className="flex items-center gap-3">
            {tightening && (
              <span className="text-sm text-slate-500">
                Tightening {tighten.done} of {tighten.total}…
              </span>
            )}
            {saveMsg && <span className="text-sm font-medium text-green-600">{saveMsg}</span>}
            <Btn onClick={tightenAll} disabled={tightening || saving}>
              Tighten all
            </Btn>
            <Btn variant="primary" onClick={saveAll} disabled={saving || tightening}>
              {saving ? 'Saving…' : 'Save'}
            </Btn>
          </div>
        </div>
        {err && <p className="text-sm text-red-600">{err}</p>}

        <h1 className="text-xl font-semibold text-slate-800">{info.name || 'Untitled initiative'}</h1>

        <InitiativeInfo info={info} setInfo={setInfo} />

        <SectionC initiativeId={initiative.id} results={results} reload={reload} />

        <SectionD sectionD={sectionD} initiativeId={initiative.id} reload={reload} />

        <FinalSubmission
          initiatives={[liveInitiative]}
          results={linkedResults}
          sectionD={sectionD}
          answers={answers}
          setAnswers={setAnswers}
        />

        <section>
          <h2 className="mb-2 text-lg font-semibold text-slate-800">
            Export — ERPNext Quality Action Resolution
          </h2>
          <ExportCard initiative={liveInitiative} results={results} sectionD={sectionD} />
        </section>
      </div>
    </TightenProvider>
  );
}

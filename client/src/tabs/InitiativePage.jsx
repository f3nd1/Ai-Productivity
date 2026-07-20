import { useMemo, useState } from 'react';
import { api } from '../api.js';
import { Q } from '../questions.js';
import { resultsFor } from '../export.js';
import { Btn, TextInput, NarrativeField } from '../ui.jsx';
import SectionC from './SectionC.jsx';
import SectionD from './SectionD.jsx';
import FinalSubmission from './FinalSubmission.jsx';
import { ExportCard } from './Export.jsx';

// Initiative name + B8/B9/B10 — same content as the old Initiatives-tab
// modal, but inline on the page with its own explicit Save.
function InitiativeInfo({ initiative, reload }) {
  const [form, setForm] = useState(initiative);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);
  const [savedAt, setSavedAt] = useState(false);
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  async function save() {
    if (!form.b8_problem?.trim()) {
      setErr('B8 business problem is required.');
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      await api.updateInitiative(initiative.id, form);
      await reload();
      setSavedAt(true);
      setTimeout(() => setSavedAt(false), 2000);
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800">Initiative details</h2>
        <div className="flex items-center gap-3">
          {savedAt && <span className="text-sm text-green-600">Saved</span>}
          <Btn variant="primary" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Btn>
        </div>
      </div>
      <TextInput
        label="Initiative name"
        value={form.name || ''}
        onChange={(e) => set('name')(e.target.value)}
        placeholder="e.g. Claude for Quality Action drafting"
      />
      <NarrativeField q={Q.b8} value={form.b8_problem} onChange={set('b8_problem')} />
      <NarrativeField q={Q.b9} value={form.b9_significance} onChange={set('b9_significance')} />
      <NarrativeField q={Q.b10} value={form.b10_solution} onChange={set('b10_solution')} />
      {err && <p className="text-sm text-red-600">{err}</p>}
    </section>
  );
}

export default function InitiativePage({ initiative, results, sectionDList, reload, onBack }) {
  const linkedResults = useMemo(() => resultsFor(initiative.id, results), [initiative.id, results]);
  const sectionD = useMemo(
    () => sectionDList.find((d) => d.initiative_id === initiative.id) || null,
    [sectionDList, initiative.id]
  );

  return (
    <div className="space-y-6">
      <Btn variant="ghost" onClick={onBack}>
        ← Back to Initiatives
      </Btn>
      <h1 className="text-xl font-semibold text-slate-800">{initiative.name || 'Untitled initiative'}</h1>

      <InitiativeInfo initiative={initiative} reload={reload} />

      <SectionC initiativeId={initiative.id} results={results} reload={reload} />

      <SectionD sectionD={sectionD} initiativeId={initiative.id} reload={reload} />

      <FinalSubmission initiatives={[initiative]} results={linkedResults} sectionD={sectionD} />

      <section>
        <h2 className="mb-2 text-lg font-semibold text-slate-800">
          Export — ERPNext Quality Action Resolution
        </h2>
        <ExportCard initiative={initiative} results={results} sectionD={sectionD} />
      </section>
    </div>
  );
}

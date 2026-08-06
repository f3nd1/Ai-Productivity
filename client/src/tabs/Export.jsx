import { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import {
  resultsFor,
  buildFinding,
  buildActionTaken,
  buildGeneralNotes,
  buildExportEvidence,
  parseExportDraft,
  financialManDayRateDefault,
  hasFinancialResult,
  productivityBeforeAfter,
  formatCopyAll,
  copyToClipboard,
} from '../export.js';
import { Btn } from '../ui.jsx';

function CopyBtn({ getText, label = 'Copy' }) {
  const [copied, setCopied] = useState(false);
  return (
    <Btn
      variant="ghost"
      className="!px-2 !py-1 text-xs"
      onClick={async () => {
        await copyToClipboard(getText());
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
    >
      {copied ? 'Copied' : label}
    </Btn>
  );
}

function TextField({ label, value, onChange }) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="field-label">{label}</span>
        <CopyBtn getText={() => value} />
      </div>
      <textarea
        rows={4}
        className="field-control min-h-28"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function NumField({ label, value, onChange, note }) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="field-label">{label}</span>
        <CopyBtn getText={() => String(value ?? '')} />
      </div>
      <input
        type="number"
        className="field-control"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {note && <p className="mt-1 text-xs text-slate-500">{note}</p>}
    </div>
  );
}

// `onFieldsChange` reports the four text fields up so the print document shows
// what's actually on screen — including AI-generated and hand-edited text —
// rather than re-deriving the plain-concatenation defaults.
export function ExportCard({ initiative, results, onFieldsChange }) {
  const linked = useMemo(() => resultsFor(initiative.id, results), [initiative.id, results]);
  const showNumbers = useMemo(() => hasFinancialResult(linked), [linked]);

  // Lazy-initialised from auto-fill rules; stays local so hand edits survive re-renders.
  const [finding, setFinding] = useState(() => buildFinding(initiative));
  // Root Cause & Resolution has no plain-text source — it's an analysis, so it
  // starts empty and "Generate with AI" fills it.
  const [rootCause, setRootCause] = useState('');
  const [actionTaken, setActionTaken] = useState(() => buildActionTaken(initiative, linked));
  const [generalNotes, setGeneralNotes] = useState(() => buildGeneralNotes(linked, initiative));
  const [manDayRate, setManDayRate] = useState(() => financialManDayRateDefault(linked));
  const ba = useMemo(() => productivityBeforeAfter(linked), [linked]);
  const [beforeTime, setBeforeTime] = useState(ba.before);
  const [afterTime, setAfterTime] = useState(ba.after);
  const [cyclePerMonth, setCyclePerMonth] = useState('');
  const [genBusy, setGenBusy] = useState(false);
  const [genErr, setGenErr] = useState(null);
  const [genDone, setGenDone] = useState(false);
  const manualNote = 'Not tracked elsewhere in the app — enter manually before copying.';
  const timeNote = ba.autofilled
    ? 'Auto-filled from the Productivity result — adjust if the unit isn’t man-days.'
    : manualNote;

  useEffect(() => {
    onFieldsChange?.({ finding, rootCause, actionTaken, generalNotes });
  }, [finding, rootCause, actionTaken, generalNotes, onFieldsChange]);

  const copyAll = () =>
    formatCopyAll(
      { finding, rootCause, actionTaken, generalNotes },
      showNumbers ? { beforeTime, afterTime, manDayRate, cyclePerMonth } : null
    );

  // AI-written versions of the four text fields, from this initiative's own B+C
  // evidence. A starting draft, not a locked final — every field stays editable
  // afterwards. Fields the model omits keep their existing text rather than
  // being blanked.
  async function generate() {
    setGenBusy(true);
    setGenErr(null);
    try {
      const { text } = await api.exportDraft(buildExportEvidence(initiative, linked));
      const draft = parseExportDraft(text);
      if (draft.finding) setFinding(draft.finding);
      if (draft.rootCause) setRootCause(draft.rootCause);
      if (draft.actionTaken) setActionTaken(draft.actionTaken);
      if (draft.generalNotes) setGeneralNotes(draft.generalNotes);
      if (!draft.finding && !draft.rootCause && !draft.actionTaken && !draft.generalNotes) {
        setGenErr('The AI reply could not be split into the four fields. Nothing was changed.');
      } else {
        setGenDone(true);
      }
    } catch (e) {
      setGenErr(e.message);
    } finally {
      setGenBusy(false);
    }
  }

  return (
    <div className="app-card p-5 sm:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <h3 className="font-semibold text-slate-950">{initiative.name || 'Untitled initiative'}</h3>
          <p className="mt-1 text-xs font-medium text-slate-500">{initiative.department || 'Department not set'}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Btn onClick={generate} disabled={genBusy}>
            {genBusy ? 'Generating…' : genDone ? 'Regenerate with AI' : 'Generate with AI'}
          </Btn>
          <CopyBtn getText={copyAll} label="Copy all as text" />
        </div>
      </div>

      <p className="mb-4 text-xs leading-5 text-slate-500">
        {genDone
          ? 'AI draft written from this initiative’s B and C evidence. Edit any field before copying.'
          : 'Showing the assembled text from this initiative’s own data. Root Cause & Resolution is an analysis, so it stays empty until you use Generate with AI — which rewrites all four fields. Every field stays editable.'}
      </p>
      {genErr && <p className="mb-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{genErr}</p>}

      <div className="space-y-4">
        <TextField label="Finding" value={finding} onChange={setFinding} />
        <TextField label="Root Cause & Resolution" value={rootCause} onChange={setRootCause} />
        <TextField label="Action Taken" value={actionTaken} onChange={setActionTaken} />
        <TextField label="General Notes" value={generalNotes} onChange={setGeneralNotes} />
      </div>

      {showNumbers && (
        <div className="mt-5 border-t border-slate-200 pt-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <NumField label="Man-Day Rate (SGD)" value={manDayRate} onChange={setManDayRate} />
            <NumField label="Before Time (Man-Day)" value={beforeTime} onChange={setBeforeTime} note={timeNote} />
            <NumField label="After Time (Man-Day)" value={afterTime} onChange={setAfterTime} note={timeNote} />
            <NumField label="Cycle per Month" value={cyclePerMonth} onChange={setCyclePerMonth} note={manualNote} />
          </div>
        </div>
      )}
    </div>
  );
}


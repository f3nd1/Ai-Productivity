import { useMemo, useState } from 'react';
import {
  resultsFor,
  buildFinding,
  buildRootCause,
  buildActionTaken,
  buildGeneralNotes,
  financialManDayRateDefault,
  hasFinancialResult,
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
        <span className="text-sm font-medium text-slate-700">{label}</span>
        <CopyBtn getText={() => value} />
      </div>
      <textarea
        rows={4}
        className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
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
        <span className="text-sm font-medium text-slate-700">{label}</span>
        <CopyBtn getText={() => String(value ?? '')} />
      </div>
      <input
        type="number"
        className="mt-1 w-full rounded border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {note && <p className="mt-1 text-xs text-slate-500">{note}</p>}
    </div>
  );
}

function ExportCard({ initiative, results, sectionD }) {
  const linked = useMemo(() => resultsFor(initiative.id, results), [initiative.id, results]);
  const showNumbers = useMemo(() => hasFinancialResult(linked), [linked]);

  // Lazy-initialised from auto-fill rules; stays local so hand edits survive re-renders.
  const [finding, setFinding] = useState(() => buildFinding(initiative));
  const [rootCause, setRootCause] = useState(() => buildRootCause(initiative, linked));
  const [actionTaken, setActionTaken] = useState(() => buildActionTaken(sectionD));
  const [generalNotes, setGeneralNotes] = useState(() => buildGeneralNotes(sectionD, linked));
  const [manDayRate, setManDayRate] = useState(() => financialManDayRateDefault(linked));
  const [beforeTime, setBeforeTime] = useState('');
  const [afterTime, setAfterTime] = useState('');
  const [cyclePerMonth, setCyclePerMonth] = useState('');

  const copyAll = () =>
    formatCopyAll(
      { finding, rootCause, actionTaken, generalNotes },
      showNumbers ? { beforeTime, afterTime, manDayRate, cyclePerMonth } : null
    );

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-medium text-slate-800">{initiative.name || 'Untitled initiative'}</h3>
        <CopyBtn getText={copyAll} label="Copy all as text" />
      </div>

      <div className="space-y-4">
        <TextField label="Finding" value={finding} onChange={setFinding} />
        <TextField label="Root Cause & Resolution" value={rootCause} onChange={setRootCause} />
        <div>
          <TextField label="Action Taken" value={actionTaken} onChange={setActionTaken} />
          <p className="mt-1 text-xs text-slate-500">
            Shared across all initiatives — edit on the Section D tab if this doesn't fit this specific one.
          </p>
        </div>
        <TextField label="General Notes" value={generalNotes} onChange={setGeneralNotes} />
      </div>

      {showNumbers && (
        <div className="mt-4 border-t border-slate-200 pt-4">
          <div className="grid grid-cols-2 gap-3">
            <NumField label="Man-Day Rate (SGD)" value={manDayRate} onChange={setManDayRate} />
            <NumField
              label="Before Time (Man-Day)"
              value={beforeTime}
              onChange={setBeforeTime}
              note="Not tracked elsewhere in the app — enter manually before copying."
            />
            <NumField
              label="After Time (Man-Day)"
              value={afterTime}
              onChange={setAfterTime}
              note="Not tracked elsewhere in the app — enter manually before copying."
            />
            <NumField
              label="Cycle per Month"
              value={cyclePerMonth}
              onChange={setCyclePerMonth}
              note="Not tracked elsewhere in the app — enter manually before copying."
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default function Export({ initiatives, results, sectionD }) {
  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold text-slate-800">Export — ERPNext Quality Action Resolution</h2>

      {initiatives.length === 0 ? (
        <p className="text-sm text-slate-500">
          No initiatives yet. Add one on the Initiatives tab to generate an export block.
        </p>
      ) : (
        <div className="grid gap-4">
          {initiatives.map((i) => (
            <ExportCard key={i.id} initiative={i} results={results} sectionD={sectionD} />
          ))}
        </div>
      )}
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { Btn, TextInput } from '../ui.jsx';
import { completeness } from '../overview.js';
import { resultsFor, exportFieldsFor } from '../export.js';
import PrintView from './PrintView.jsx';
import { DEPARTMENTS, STATUSES, DEFAULT_STATUS, STATUS_TONE } from './InitiativePage.jsx';

// Below this share of the 9 questions an initiative is flagged in the list —
// post-fix this reflects real evidence, not just text sitting in a field.
const LOW_COMPLETENESS = 0.4;

// Recently updated leads: it's the default, and picking up where you left off
// is the usual reason for opening the list.
const SORTS = {
  updated: 'Recently updated',
  name: 'Name (A–Z)',
  completeDesc: 'Most complete',
  completeAsc: 'Least complete',
};
const DEFAULT_SORT = 'updated';

function Initials({ name }) {
  const letters = (name || 'AI')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();
  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-100 to-sky-100 text-sm font-bold text-indigo-700 ring-1 ring-indigo-200/60">
      {letters || 'AI'}
    </div>
  );
}

// One prompt shared by "Add initiative" and "Duplicate" — naming up front is
// what stops the list filling with indistinguishable "Untitled initiative"s.
function NamePrompt({ title, confirmLabel, initialName, initialDepartment, busy, onCancel, onConfirm }) {
  const [name, setName] = useState(initialName || '');
  const [department, setDepartment] = useState(initialDepartment || '');
  const canSubmit = name.trim().length > 0 && !busy;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <form
        className="app-panel w-full max-w-md bg-white p-6"
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit) onConfirm(name.trim(), department.trim());
        }}
      >
        <p className="eyebrow">New initiative</p>
        <h3 className="section-title mt-1">{title}</h3>

        <div className="mt-5 space-y-4">
          <TextInput
            label="Initiative name"
            value={name}
            autoFocus
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Claude for Quality Action drafting"
          />
          <label className="block">
            <span className="field-label">
              Department <span className="font-normal text-slate-400">(optional)</span>
            </span>
            <select className="field-control" value={department} onChange={(e) => setDepartment(e.target.value)}>
              <option value="">Select a department</option>
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Btn variant="ghost" type="button" onClick={onCancel}>
            Cancel
          </Btn>
          <Btn variant="primary" type="submit" disabled={!canSubmit}>
            {busy ? 'Creating…' : confirmLabel}
          </Btn>
        </div>
        {!name.trim() && (
          <p className="mt-3 text-xs text-slate-400">A name is required — it's how you'll tell initiatives apart.</p>
        )}
      </form>
    </div>
  );
}

export default function Initiatives({ initiatives, results, sectionD, reload, onSelect }) {
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState(null);
  const [prompt, setPrompt] = useState(null); // null | {mode:'new'} | {mode:'duplicate', source}
  const [query, setQuery] = useState('');
  const [department, setDepartment] = useState('all');
  const [status, setStatus] = useState('all');
  const [sort, setSort] = useState(DEFAULT_SORT);
  // Ticked cards. Empty means "no explicit pick", and the button prints
  // everything currently shown instead — so the existing filters double as a
  // coarse selection without needing every box ticked.
  const [picked, setPicked] = useState(() => new Set());
  const [printing, setPrinting] = useState(null); // null | array of print items

  useEffect(() => {
    if (!printing) return undefined;
    const done = () => setPrinting(null);
    window.addEventListener('afterprint', done);
    const frame = requestAnimationFrame(() => window.print());
    return () => {
      window.removeEventListener('afterprint', done);
      cancelAnimationFrame(frame);
    };
  }, [printing]);

  // Score every initiative once, then search/filter/sort over the result.
  const scored = useMemo(
    () =>
      initiatives.map((i) => ({
        i,
        score: completeness(i, results, sectionD),
        resultCount: results.filter((r) => r.initiative_id === i.id).length,
      })),
    [initiatives, results, sectionD]
  );

  const departmentOptions = useMemo(() => {
    const used = initiatives.map((i) => i.department?.trim()).filter(Boolean);
    return Array.from(new Set([...DEPARTMENTS, ...used])).sort();
  }, [initiatives]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = scored.filter(({ i }) => {
      const name = (i.name || 'Untitled initiative').toLowerCase();
      if (q && !name.includes(q)) return false;
      // Rows saved before the status column existed read as the default.
      if (status !== 'all' && (i.status || DEFAULT_STATUS) !== status) return false;
      if (department === 'all') return true;
      if (department === '__unset__') return !i.department?.trim();
      return i.department?.trim() === department;
    });
    const byName = (a, b) =>
      (a.i.name || 'Untitled initiative').localeCompare(b.i.name || 'Untitled initiative');
    const sorters = {
      name: byName,
      completeDesc: (a, b) => b.score.score - a.score.score || byName(a, b),
      completeAsc: (a, b) => a.score.score - b.score.score || byName(a, b),
      // Never-saved rows have no updated_at; fall back to created_at, then last.
      updated: (a, b) =>
        String(b.i.updated_at || b.i.created_at || '').localeCompare(
          String(a.i.updated_at || a.i.created_at || '')
        ) || byName(a, b),
    };
    return [...rows].sort(sorters[sort] || byName);
  }, [scored, query, department, status, sort]);

  const toPrint = picked.size
    ? visible.filter(({ i }) => picked.has(i.id))
    : visible;

  // Everything a document needs comes off the initiative row and the results
  // already loaded — the generated C answers and the saved export text both
  // live in final_answers, so no extra fetch is needed.
  function printItems() {
    return toPrint.map(({ i }) => {
      const linked = resultsFor(i.id, results);
      const { export: savedExport, ...cAnswers } = i.final_answers || {};
      return {
        initiative: i,
        results: linked,
        answers: cAnswers,
        notApplicable: i.not_applicable || {},
        exportFields: exportFieldsFor(i, linked, savedExport),
      };
    });
  }

  const togglePick = (id) =>
    setPicked((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  async function create(name, dept) {
    setCreating(true);
    setErr(null);
    try {
      const source = prompt?.source;
      const created = await api.createInitiative({
        name,
        department: dept,
        // Duplicating carries the B narratives across as a starting point.
        // Section C results are deliberately NOT copied — they're measurements
        // of the original initiative, not of this one.
        b8_problem: source?.b8_problem || '',
        b9_significance: source?.b9_significance || '',
        b10_solution: source?.b10_solution || '',
      });
      setPrompt(null);
      await reload();
      onSelect(created.id);
    } catch (e) {
      setErr(e.message);
    } finally {
      setCreating(false);
    }
  }

  async function del(i, ev) {
    ev.stopPropagation();
    if (!confirm(`Delete initiative "${i.name || 'untitled'}" and its results?`)) return;
    try {
      await api.deleteInitiative(i.id);
      await reload();
    } catch (e) {
      alert(e.message);
    }
  }

  const filtered = visible.length !== initiatives.length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow">Initiative library</p>
          <h2 className="section-title mt-1">Your AI initiatives</h2>
          <p className="muted-copy mt-1">Open an initiative to add evidence, measurable outcomes and adoption details.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {initiatives.length > 0 && (
            <Btn onClick={() => setPrinting(printItems())} disabled={toPrint.length === 0 || Boolean(printing)}>
              {printing
                ? 'Preparing…'
                : picked.size
                  ? `Print ${picked.size} selected`
                  : `Print all ${toPrint.length} shown`}
            </Btn>
          )}
          {picked.size > 0 && (
            <Btn variant="ghost" onClick={() => setPicked(new Set())}>
              Clear selection
            </Btn>
          )}
          <Btn variant="primary" onClick={() => setPrompt({ mode: 'new' })}>
            <span className="mr-1.5 text-lg leading-none">+</span>
            Add initiative
          </Btn>
        </div>
      </div>

      {err && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{err}</p>}

      {initiatives.length > 0 && (
        <div className="app-card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
          <label className="block lg:col-span-2">
            <span className="field-label">Search by name</span>
            <input
              className="field-control"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Start typing an initiative name…"
            />
          </label>
          <label className="block">
            <span className="field-label">Department</span>
            <select className="field-control" value={department} onChange={(e) => setDepartment(e.target.value)}>
              <option value="all">All departments</option>
              <option value="__unset__">Not set</option>
              {departmentOptions.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="field-label">Status</span>
            <select className="field-control" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="all">All statuses</option>
              {STATUSES.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="field-label">Sort by</span>
            <select className="field-control" value={sort} onChange={(e) => setSort(e.target.value)}>
              {Object.entries(SORTS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </label>
          {filtered && (
            <p className="text-xs text-slate-500 sm:col-span-2 lg:col-span-5">
              Showing {visible.length} of {initiatives.length} initiatives.{' '}
              <button
                className="font-semibold text-indigo-600 hover:underline"
                onClick={() => {
                  setQuery('');
                  setDepartment('all');
                  setStatus('all');
                }}
              >
                Clear filters
              </button>
            </p>
          )}
        </div>
      )}

      {initiatives.length === 0 && (
        <div className="app-panel flex min-h-72 flex-col items-center justify-center px-6 py-12 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-2xl text-indigo-600 ring-1 ring-indigo-100">✦</div>
          <h3 className="mt-4 text-lg font-semibold text-slate-900">Start with your first AI initiative</h3>
          <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
            Create one initiative for each AI use case, then record the problem, solution, measurable results and staff adoption evidence.
          </p>
          <Btn className="mt-5" variant="primary" onClick={() => setPrompt({ mode: 'new' })}>
            Create initiative
          </Btn>
        </div>
      )}

      {initiatives.length > 0 && visible.length === 0 && (
        <div className="app-panel px-6 py-12 text-center">
          <h3 className="text-lg font-semibold text-slate-900">No initiatives match</h3>
          <p className="mt-2 text-sm text-slate-500">Try a different name or department.</p>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        {visible.map(({ i, score, resultCount }) => {
          const progress = Math.round((score.score / 9) * 100);
          const low = score.score / 9 < LOW_COMPLETENESS;
          return (
            <article
              key={i.id}
              onClick={() => onSelect(i.id)}
              className={`app-card group cursor-pointer p-5 transition duration-200 hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-100/70 ${
                low ? 'border-amber-200' : ''
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Stops the click reaching the card, which would open it. */}
                <label
                  className="mt-1 flex shrink-0 cursor-pointer items-center"
                  onClick={(e) => e.stopPropagation()}
                  title="Select for printing"
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-400"
                    checked={picked.has(i.id)}
                    onChange={() => togglePick(i.id)}
                  />
                </label>
                <Initials name={i.name} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {i.initiative_code && (
                          <span className="shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-slate-500">
                            {i.initiative_code}
                          </span>
                        )}
                        <h3 className="truncate font-semibold text-slate-950 transition group-hover:text-indigo-700">
                          {i.name || 'Untitled initiative'}
                        </h3>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span
                          className={`rounded-full px-2 py-1 font-semibold ring-1 ${
                            STATUS_TONE[i.status || DEFAULT_STATUS] || STATUS_TONE[DEFAULT_STATUS]
                          }`}
                        >
                          {i.status || DEFAULT_STATUS}
                        </span>
                        <span
                          className={`rounded-full px-2 py-1 font-medium ${
                            i.department?.trim()
                              ? 'bg-slate-100 text-slate-600'
                              : 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
                          }`}
                        >
                          {i.department?.trim() || 'Department not set'}
                        </span>
                        <span>{resultCount} result{resultCount === 1 ? '' : 's'}</span>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Btn
                        className="opacity-70 group-hover:opacity-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPrompt({ mode: 'duplicate', source: i });
                        }}
                      >
                        Duplicate
                      </Btn>
                      <Btn variant="danger" className="opacity-70 group-hover:opacity-100" onClick={(e) => del(i, e)}>
                        Delete
                      </Btn>
                    </div>
                  </div>

                  {low && (
                    <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-200">
                      ⚠ Needs evidence
                      {score.resultCount === 0 && ' — no Section C results yet'}
                    </p>
                  )}

                  {i.b8_problem ? (
                    <p className="mt-4 line-clamp-2 text-sm leading-6 text-slate-600">{i.b8_problem}</p>
                  ) : (
                    <p className="mt-4 text-sm italic text-amber-600">Business problem has not been added yet.</p>
                  )}

                  <div className="mt-5">
                    <div className="mb-2 flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-600">Submission completeness</span>
                      <span className={`font-semibold ${low ? 'text-amber-700' : 'text-slate-800'}`}>
                        {score.score}/9
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full transition-all ${
                          low ? 'bg-amber-400' : 'bg-gradient-to-r from-indigo-500 to-sky-500'
                        }`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    {/* Distinguish evidence-backed answers from prose-only ones. */}
                    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                      <span>{i.b8_problem?.trim() ? 'B8 complete' : 'B8 missing'}</span>
                      {score.thin > 0 && (
                        <span className="text-slate-400">{score.thin} answer{score.thin === 1 ? '' : 's'} look thin</span>
                      )}
                      {score.stale > 0 && (
                        <span className="font-medium text-amber-600">
                          {score.stale} generated answer{score.stale === 1 ? '' : 's'} without evidence
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {printing && <PrintView items={printing} />}

      {prompt && (
        <NamePrompt
          title={prompt.mode === 'duplicate' ? 'Duplicate initiative' : 'Name your initiative'}
          confirmLabel={prompt.mode === 'duplicate' ? 'Duplicate' : 'Create initiative'}
          initialName={prompt.mode === 'duplicate' ? `${prompt.source.name || 'Untitled initiative'} (copy)` : ''}
          initialDepartment={prompt.mode === 'duplicate' ? prompt.source.department : ''}
          busy={creating}
          onCancel={() => setPrompt(null)}
          onConfirm={create}
        />
      )}
    </div>
  );
}

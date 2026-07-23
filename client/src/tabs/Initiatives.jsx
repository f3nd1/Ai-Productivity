import { useState } from 'react';
import { api } from '../api.js';
import { Btn } from '../ui.jsx';
import { completeness } from '../overview.js';

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

export default function Initiatives({ initiatives, results, sectionDList, reload, onSelect }) {
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState(null);

  async function addInitiative() {
    setCreating(true);
    setErr(null);
    try {
      const created = await api.createInitiative({
        name: '',
        department: '',
        b8_problem: '',
        b9_significance: '',
        b10_solution: '',
      });
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

  function details(i) {
    const resultCount = results.filter((r) => r.initiative_id === i.id).length;
    const sectionD = sectionDList.find((row) => row.initiative_id === i.id);
    return {
      resultCount,
      complete: completeness(i, sectionD),
      dComplete: Boolean(sectionD?.d14_narrative?.trim()),
    };
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow">Initiative library</p>
          <h2 className="section-title mt-1">Your AI initiatives</h2>
          <p className="muted-copy mt-1">Open an initiative to add evidence, measurable outcomes and adoption details.</p>
        </div>
        <Btn variant="primary" onClick={addInitiative} disabled={creating}>
          <span className="mr-1.5 text-lg leading-none">+</span>
          {creating ? 'Adding…' : 'Add initiative'}
        </Btn>
      </div>

      {err && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{err}</p>}

      {initiatives.length === 0 && (
        <div className="app-panel flex min-h-72 flex-col items-center justify-center px-6 py-12 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-2xl text-indigo-600 ring-1 ring-indigo-100">✦</div>
          <h3 className="mt-4 text-lg font-semibold text-slate-900">Start with your first AI initiative</h3>
          <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
            Create one initiative for each AI use case, then record the problem, solution, measurable results and staff adoption evidence.
          </p>
          <Btn className="mt-5" variant="primary" onClick={addInitiative} disabled={creating}>
            {creating ? 'Adding…' : 'Create initiative'}
          </Btn>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        {initiatives.map((i) => {
          const meta = details(i);
          const progress = Math.round((meta.complete / 9) * 100);
          return (
            <article
              key={i.id}
              onClick={() => onSelect(i.id)}
              className="app-card group cursor-pointer p-5 transition duration-200 hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-100/70"
            >
              <div className="flex items-start gap-3">
                <Initials name={i.name} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate font-semibold text-slate-950 transition group-hover:text-indigo-700">
                        {i.name || 'Untitled initiative'}
                      </h3>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span className="rounded-full bg-slate-100 px-2 py-1 font-medium text-slate-600">
                          {i.department?.trim() || 'Department not set'}
                        </span>
                        <span>{meta.resultCount} result{meta.resultCount === 1 ? '' : 's'}</span>
                      </div>
                    </div>
                    <Btn variant="danger" className="opacity-70 group-hover:opacity-100" onClick={(e) => del(i, e)}>
                      Delete
                    </Btn>
                  </div>

                  {i.b8_problem ? (
                    <p className="mt-4 line-clamp-2 text-sm leading-6 text-slate-600">{i.b8_problem}</p>
                  ) : (
                    <p className="mt-4 text-sm italic text-amber-600">Business problem has not been added yet.</p>
                  )}

                  <div className="mt-5">
                    <div className="mb-2 flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-600">Submission completeness</span>
                      <span className="font-semibold text-slate-800">{meta.complete}/9</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-sky-500 transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                      <span>{i.b8_problem?.trim() ? 'B8 complete' : 'B8 missing'}</span>
                      <span>{meta.dComplete ? 'Section D started' : 'Section D incomplete'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

import { useState } from 'react';
import { api } from '../api.js';
import { Btn } from '../ui.jsx';

export default function Initiatives({ initiatives, results, sectionDList, reload, onSelect }) {
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState(null);

  // "Add initiative" creates a blank row immediately and opens its page —
  // B8 is required to save the Initiative details section there, not at
  // creation time.
  async function addInitiative() {
    setCreating(true);
    setErr(null);
    try {
      const created = await api.createInitiative({
        name: '',
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

  function summary(i) {
    const count = results.filter((r) => r.initiative_id === i.id).length;
    const d = sectionDList.find((row) => row.initiative_id === i.id);
    const bStatus = i.b8_problem?.trim() ? 'B8 complete' : 'B8 missing';
    const dStatus = d?.d14_narrative?.trim() ? 'Section D complete' : 'Section D incomplete';
    return `${count} result${count === 1 ? '' : 's'} · ${bStatus} · ${dStatus}`;
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800">Initiatives</h2>
        <Btn variant="primary" onClick={addInitiative} disabled={creating}>
          {creating ? 'Adding…' : 'Add initiative'}
        </Btn>
      </div>
      {err && <p className="mb-4 text-sm text-red-600">{err}</p>}

      {initiatives.length === 0 && (
        <p className="text-sm text-slate-500">No initiatives yet. Add your first AI use case.</p>
      )}

      <div className="grid gap-3">
        {initiatives.map((i) => (
          <div
            key={i.id}
            onClick={() => onSelect(i.id)}
            className="cursor-pointer rounded-lg border border-slate-200 bg-white p-4 hover:border-slate-400"
          >
            <div className="flex items-start justify-between">
              <h3 className="font-medium text-slate-800">{i.name || 'Untitled initiative'}</h3>
              <Btn variant="danger" onClick={(e) => del(i, e)}>
                Delete
              </Btn>
            </div>
            <p className="mt-1 text-xs text-slate-500">{summary(i)}</p>
            {i.b8_problem && <p className="mt-2 line-clamp-2 text-sm text-slate-600">{i.b8_problem}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

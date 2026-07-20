import { useState } from 'react';
import { api } from '../api.js';
import { Q } from '../questions.js';
import { Btn, Modal, TextInput, NarrativeField } from '../ui.jsx';

const empty = { name: '', b8_problem: '', b9_significance: '', b10_solution: '' };

export default function Initiatives({ initiatives, reload }) {
  const [editing, setEditing] = useState(null); // form object or null
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const openNew = () => {
    setErr(null);
    setEditing({ ...empty });
  };
  const openEdit = (i) => {
    setErr(null);
    setEditing({ ...i });
  };

  async function save() {
    if (!editing.b8_problem?.trim()) {
      setErr('B8 business problem is required.');
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      if (editing.id) await api.updateInitiative(editing.id, editing);
      else await api.createInitiative(editing);
      setEditing(null);
      await reload();
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function del(i) {
    if (!confirm(`Delete initiative "${i.name || 'untitled'}" and its results?`)) return;
    try {
      await api.deleteInitiative(i.id);
      await reload();
    } catch (e) {
      alert(e.message);
    }
  }

  const set = (k) => (v) => setEditing((e) => ({ ...e, [k]: v }));

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800">Initiatives</h2>
        <Btn variant="primary" onClick={openNew}>
          Add initiative
        </Btn>
      </div>

      {initiatives.length === 0 && (
        <p className="text-sm text-slate-500">No initiatives yet. Add your first AI use case.</p>
      )}

      <div className="grid gap-3">
        {initiatives.map((i) => (
          <div key={i.id} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between">
              <h3 className="font-medium text-slate-800">{i.name || 'Untitled initiative'}</h3>
              <div className="flex gap-2">
                <Btn variant="ghost" onClick={() => openEdit(i)}>
                  Edit
                </Btn>
                <Btn variant="danger" onClick={() => del(i)}>
                  Delete
                </Btn>
              </div>
            </div>
            {i.b8_problem && (
              <p className="mt-2 line-clamp-3 text-sm text-slate-600">{i.b8_problem}</p>
            )}
          </div>
        ))}
      </div>

      {editing && (
        <Modal
          title={editing.id ? 'Edit initiative' : 'Add initiative'}
          onClose={() => setEditing(null)}
        >
          <div className="space-y-4">
            <TextInput
              label="Initiative name"
              value={editing.name}
              onChange={(e) => set('name')(e.target.value)}
              placeholder="e.g. Claude for Quality Action drafting"
            />
            <NarrativeField q={Q.b8} value={editing.b8_problem} onChange={set('b8_problem')} />
            <NarrativeField q={Q.b9} value={editing.b9_significance} onChange={set('b9_significance')} />
            <NarrativeField q={Q.b10} value={editing.b10_solution} onChange={set('b10_solution')} />
            {err && <p className="text-sm text-red-600">{err}</p>}
            <div className="flex justify-end gap-2">
              <Btn onClick={() => setEditing(null)}>Cancel</Btn>
              <Btn variant="primary" onClick={save} disabled={saving}>
                {saving ? 'Saving…' : 'Save initiative'}
              </Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Btn } from '../ui.jsx';

// "2026-07-20T14:30:00+00:00" → { date: "20 July 2026", time: "14:30" }
function fmt(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: iso || '', time: '' };
  const date = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return { date, time };
}

function Entry({ c }) {
  const [open, setOpen] = useState(false);
  const { date, time } = fmt(c.authorDate);
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-slate-500">{date}</p>
          <h3 className="mt-0.5 font-medium text-slate-800">{c.subject}</h3>
        </div>
        <span className="shrink-0 rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
          {c.author}
        </span>
      </div>

      {c.body && (
        <p className="mt-2 whitespace-pre-wrap text-sm text-slate-500">{c.body}</p>
      )}

      <p className="mt-2 text-xs text-slate-400">
        🕑 {time} · {c.shortHash}
      </p>

      {c.files.length > 0 && (
        <div className="mt-2">
          <button
            onClick={() => setOpen((v) => !v)}
            className="text-xs font-medium text-slate-500 hover:text-slate-700"
          >
            {open ? '▾' : '▸'} Files changed ({c.filesChanged})
          </button>
          {open && (
            <ul className="mt-1 space-y-0.5 border-l-2 border-slate-100 pl-3">
              {c.files.map((f) => (
                <li key={f} className="font-mono text-xs text-slate-500">
                  {f}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export default function ChangeLog() {
  const [commits, setCommits] = useState(null);
  const [err, setErr] = useState(null);

  async function load() {
    setErr(null);
    try {
      const { commits } = await api.changelog();
      setCommits(commits || []);
    } catch (e) {
      setErr(e.message);
    }
  }
  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800">Change log</h2>
        <Btn onClick={load}>Refresh</Btn>
      </div>
      <p className="mb-4 text-sm text-slate-500">
        Recent updates to this app, sourced from git history. Use it to confirm an update landed.
      </p>

      {err && (
        <div className="rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          {err}
        </div>
      )}
      {!err && commits === null && <p className="text-sm text-slate-500">Loading…</p>}
      {!err && commits && commits.length === 0 && (
        <p className="text-sm text-slate-500">No commits found in this repository's history yet.</p>
      )}

      {commits && commits.length > 0 && (
        <div className="grid gap-3">
          {commits.map((c) => (
            <Entry key={c.shortHash} c={c} />
          ))}
        </div>
      )}
    </div>
  );
}

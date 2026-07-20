import { useState } from 'react';
import { api } from './api.js';

export function Guidance({ children }) {
  return <p className="mt-1 text-xs text-slate-500">{children}</p>;
}

export function RequiredBadge() {
  return (
    <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-700">
      required
    </span>
  );
}

export function Btn({ children, className = '', variant = 'default', ...props }) {
  const styles = {
    default: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-100',
    primary: 'bg-slate-800 text-white hover:bg-slate-700',
    danger: 'border border-red-300 bg-white text-red-600 hover:bg-red-50',
    ghost: 'text-slate-600 hover:bg-slate-100',
  };
  return (
    <button
      className={`rounded px-3 py-1.5 text-sm font-medium disabled:opacity-50 ${styles[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function TextInput({ label, className = '', ...props }) {
  return (
    <label className="block">
      {label && <span className="text-sm font-medium text-slate-700">{label}</span>}
      <input
        className={`mt-1 w-full rounded border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none ${className}`}
        {...props}
      />
    </label>
  );
}

// Narrative textarea with label, optional required badge, guidance text, and an
// optional "Tighten with AI" button (Tabs 1 & 3).
export function NarrativeField({ q, value, onChange, tighten = true }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  async function onTighten() {
    if (!value || !value.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const { text } = await api.tighten(value);
      onChange(text);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-slate-700">
          {q.label}
          {q.required && <RequiredBadge />}
        </label>
        {tighten && (
          <Btn variant="ghost" onClick={onTighten} disabled={busy || !value?.trim()}>
            {busy ? 'Tightening…' : 'Tighten with AI'}
          </Btn>
        )}
      </div>
      <p className="mt-0.5 text-xs italic text-slate-500">{q.prompt}</p>
      <textarea
        className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
        rows={4}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
      />
      <Guidance>What to include: {q.include}</Guidance>
      {err && <p className="mt-1 text-xs text-red-600">{err}</p>}
    </div>
  );
}

export function Modal({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 z-20 flex items-start justify-center overflow-y-auto bg-black/30 p-4">
      <div className="mt-8 w-full max-w-2xl rounded-lg border border-slate-200 bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
          <Btn variant="ghost" onClick={onClose}>
            Close
          </Btn>
        </div>
        {children}
      </div>
    </div>
  );
}

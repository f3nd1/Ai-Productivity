import { useState } from 'react';
import { useTightenButton, useTightenRegister } from './tighten.jsx';

export function Guidance({ children }) {
  return <p className="mt-1.5 text-xs leading-5 text-slate-500">{children}</p>;
}

export function wordCount(t) {
  return (t || '').trim().split(/\s+/).filter(Boolean).length;
}

// Live word count against the 300-word form cap + a Copy button. Shared by the
// six B/D narrative fields (whose raw text IS their answer) and the C answer boxes.
export function WordCountCopy({ text }) {
  const [copied, setCopied] = useState(false);
  const n = wordCount(text);
  const over = n > 300;
  async function copy() {
    try {
      await navigator.clipboard.writeText(text || '');
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  }
  return (
    <div className="mt-1 flex items-center justify-between">
      <span className={`text-xs ${over ? 'font-semibold text-red-600' : 'text-slate-500'}`}>
        {n} / 300 words{over ? ' · over limit' : ''}
      </span>
      <Btn variant="ghost" className="!px-2 !py-1 text-xs" onClick={copy} disabled={!text?.trim()}>
        {copied ? 'Copied' : 'Copy'}
      </Btn>
    </div>
  );
}

// "[add: ...]" markers, e.g. "[add: how many hours per week this saved]".
// The AI no longer produces these — Elaborate and Quick Fill now write less
// instead of naming the gap. This stays so text generated before that change
// still gets flagged for cleanup; it renders nothing when there are none.
// A textarea can't style spans inside itself, so they're surfaced as a
// highlighted checklist under the field.
const PLACEHOLDER_RE = /\[add:[^\]]*\]/gi;

export function findPlaceholders(text) {
  return (text || '').match(PLACEHOLDER_RE) || [];
}

export function PlaceholderNotice({ text }) {
  const found = findPlaceholders(text);
  if (found.length === 0) return null;
  return (
    <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2.5">
      <p className="text-xs font-semibold text-amber-800">
        {found.length} detail{found.length === 1 ? '' : 's'} still needed before submission
      </p>
      <ul className="mt-1.5 space-y-1">
        {found.map((p, idx) => (
          <li key={idx}>
            <span className="rounded bg-amber-200/70 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-amber-900">
              {p}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-1.5 text-[11px] leading-4 text-amber-700">
        AI left these blank rather than invent a figure. Replace each one with the real detail, or delete it.
      </p>
    </div>
  );
}

// The Tighten / Elaborate pair. Every narrative field gets both: Tighten
// condenses, Elaborate expands a thin fragment without adding facts.
export function AiRewriteButtons({ tighten, elaborate, busy, mode, disabled }) {
  return (
    <div className="flex items-center gap-1">
      <Btn variant="ghost" onClick={tighten} disabled={busy || disabled}>
        {mode === 'tighten' ? 'Tightening…' : 'Tighten with AI'}
      </Btn>
      <Btn variant="ghost" onClick={elaborate} disabled={busy || disabled}>
        {mode === 'elaborate' ? 'Elaborating…' : 'Elaborate with AI'}
      </Btn>
    </div>
  );
}

export function RequiredBadge() {
  return (
    <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
      required
    </span>
  );
}

export function Btn({ children, className = '', variant = 'default', ...props }) {
  const styles = {
    default:
      'border border-slate-200 bg-white text-slate-700 shadow-sm hover:border-slate-300 hover:bg-slate-50',
    primary:
      'border border-indigo-600 bg-indigo-600 text-white shadow-sm shadow-indigo-200 hover:border-indigo-700 hover:bg-indigo-700',
    danger: 'border border-red-200 bg-white text-red-600 shadow-sm hover:border-red-300 hover:bg-red-50',
    ghost: 'border border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900',
  };
  return (
    <button
      className={`inline-flex items-center justify-center rounded-xl px-3.5 py-2 text-sm font-semibold transition focus:outline-none focus:ring-4 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function TextInput({ label, className = '', ...props }) {
  return (
    <label className="block">
      {label && <span className="field-label">{label}</span>}
      <input
        className={`field-control ${className}`}
        {...props}
      />
    </label>
  );
}

// Narrative textarea with label, optional required badge, guidance text, and a
// "Tighten with AI" button. When tightenId is given it also registers with the
// page-level tighten registry so "Tighten all" can drive it.
// `context` is optional related evidence Elaborate may draw on (B10 gets this
// initiative's Section C results, since those record what the solution did).
export function NarrativeField({ q, value, onChange, tighten = true, tightenId = null, tightenOrder = 0, context = '' }) {
  const { tighten: onTighten, elaborate: onElaborate, busy, mode, err } = useTightenButton(value, onChange, {
    label: q.label,
    guidance: q.include,
    context,
  });
  useTightenRegister(tightenId, tightenOrder, value, onChange);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="field-label">
          {q.label}
          {q.required && <RequiredBadge />}
        </label>
        {tighten && (
          <AiRewriteButtons
            tighten={onTighten}
            elaborate={onElaborate}
            busy={busy}
            mode={mode}
            disabled={!value?.trim()}
          />
        )}
      </div>
      <p className="mt-1 text-xs italic leading-5 text-slate-500">{q.prompt}</p>
      <textarea
        className="field-control min-h-28"
        rows={4}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
      />
      <WordCountCopy text={value} />
      <PlaceholderNotice text={value} />
      <Guidance>What to include: {q.include}</Guidance>
      {err && <p className="mt-1 text-xs text-red-600">{err}</p>}
    </div>
  );
}

export function Modal({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 z-20 flex items-start justify-center overflow-y-auto bg-slate-950/45 p-4 backdrop-blur-sm">
      <div className="app-panel mt-8 w-full max-w-2xl p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="section-title">{title}</h2>
          <Btn variant="ghost" onClick={onClose}>
            Close
          </Btn>
        </div>
        {children}
      </div>
    </div>
  );
}

import { useState } from 'react';
import { api } from '../api.js';
import { normalizeQuickFill, wouldOverwriteB, clearEstimate } from '../quickfill.js';
import { Btn, PlaceholderNotice, TextInput } from '../ui.jsx';

// Two-step modal: paste → review → apply. Nothing reaches the page until Apply,
// and Apply only populates in-memory state — the page's own Save is still what
// persists it, same as typing by hand.

const TYPES = [
  ['productivity', 'Productivity'],
  ['financial', 'Financial'],
  ['operational', 'Operational'],
];

const PLACEHOLDER =
  "Paste your notes — the problem, what you did, and any numbers you have. Doesn't need to be organized.";

function Field({ label, value, onChange, rows = 3, hint }) {
  return (
    <div>
      <label className="block">
        <span className="field-label">{label}</span>
        <textarea className="field-control" rows={rows} value={value} onChange={(e) => onChange(e.target.value)} />
      </label>
      {/* Same treatment Elaborate uses for its "[add: ...]" markers. */}
      <PlaceholderNotice text={value} />
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

// A figure the model derived from a vague hint ("roughly halved") rather than an
// exact stated number. Typing over the value clears the flag — at that point
// it's the user's figure, not the model's guess.
function EstimatedNote() {
  return (
    <p className="mt-1 text-xs font-medium text-amber-600">Estimated from your notes — confirm or adjust</p>
  );
}

function NumberField({ label, value, estimated, onChange }) {
  return (
    <div>
      <TextInput label={label} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
      {estimated && <EstimatedNote />}
    </div>
  );
}

function ProposedResult({ item, onChange, onDelete }) {
  const set = (k) => (v) => onChange({ ...item, [k]: v });
  // Editing a figure makes it the user's, so its estimate flag is dropped.
  const setNumber = (k) => (v) => onChange({ ...clearEstimate(item, k), [k]: v });
  return (
    <div className={`rounded-2xl border p-4 ${item.include ? 'border-slate-200 bg-white' : 'border-slate-200 bg-slate-50 opacity-60'}`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-400"
            checked={item.include}
            onChange={(e) => set('include')(e.target.checked)}
          />
          <span className="text-sm font-semibold text-slate-700">Include this result</span>
        </label>
        <Btn variant="danger" onClick={onDelete}>
          Delete
        </Btn>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="field-label">Type</span>
          <select className="field-control" value={item.type} onChange={(e) => set('type')(e.target.value)}>
            {TYPES.map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </label>
        <TextInput
          label={item.type === 'financial' ? 'Cost category' : 'Metric name'}
          value={item.metricOrCategory}
          onChange={(e) => set('metricOrCategory')(e.target.value)}
        />
        {item.type === 'financial' ? (
          <NumberField
            label="Monthly saving (SGD)"
            value={item.monthlySaving}
            estimated={item.estimated?.monthlySaving}
            onChange={setNumber('monthlySaving')}
          />
        ) : (
          <>
            <NumberField
              label="Before value"
              value={item.before}
              estimated={item.estimated?.before}
              onChange={setNumber('before')}
            />
            <NumberField
              label="After value"
              value={item.after}
              estimated={item.estimated?.after}
              onChange={setNumber('after')}
            />
            <TextInput label="Unit" value={item.unit} onChange={(e) => set('unit')(e.target.value)} />
          </>
        )}
      </div>

      <div className="mt-3">
        <Field label="Note" value={item.note} onChange={set('note')} rows={2} />
      </div>

      {item.type === 'financial' && item.monthlySaving === null && (
        <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
          Your notes gave no saving figure, so none was filled in — guessing one would put an invented
          number in your submission. Enter a monthly saving above, or add the hours and rate on the card
          after applying.
        </p>
      )}
    </div>
  );
}

export default function QuickFill({ info, onApply, onClose }) {
  const [step, setStep] = useState('paste'); // 'paste' | 'review'
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [message, setMessage] = useState(null);
  const [review, setReview] = useState(null);
  const [confirming, setConfirming] = useState(false);

  async function parse() {
    setBusy(true);
    setErr(null);
    setMessage(null);
    try {
      const raw = await api.quickFill(notes);
      const clean = normalizeQuickFill(raw);
      setReview({
        b8: clean.b8 || '',
        b9: clean.b9 || '',
        b10: clean.b10 || '',
        results: clean.results.map((r, i) => ({ ...r, key: `qf-${i}`, include: true })),
      });
      if (raw?.message) setMessage(raw.message);
      setStep('review');
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  const included = review?.results.filter((r) => r.include) || [];
  const nothingToApply =
    review && !review.b8.trim() && !review.b9.trim() && !review.b10.trim() && included.length === 0;

  function apply() {
    const payload = { b8: review.b8, b9: review.b9, b10: review.b10, results: included };
    // Warn before replacing B text the user already wrote — never silently.
    if (!confirming && wouldOverwriteB(info, payload)) {
      setConfirming(true);
      return;
    }
    onApply(payload);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 backdrop-blur-sm">
      <div className="app-panel my-6 w-full max-w-3xl bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="eyebrow">Quick fill</p>
            <h3 className="section-title mt-1">
              {step === 'paste' ? 'Paste your rough notes' : 'Review before applying'}
            </h3>
            <p className="muted-copy mt-1">
              {step === 'paste'
                ? 'The problem, solution and results are one connected story — paste them together and they get sorted out below.'
                : 'Nothing has been changed yet. Text in [brackets] marks a detail your notes didn’t give — replace it before submitting. Edit anything, untick what you don’t want, then apply.'}
            </p>
          </div>
          <Btn variant="ghost" onClick={onClose}>
            Cancel
          </Btn>
        </div>

        {err && <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{err}</p>}
        {message && <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">{message}</p>}

        {step === 'paste' && (
          <>
            <textarea
              className="field-control mt-5 min-h-64"
              rows={12}
              autoFocus
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={PLACEHOLDER}
            />
            <div className="mt-5 flex justify-end gap-2">
              <Btn variant="ghost" onClick={onClose}>
                Cancel
              </Btn>
              <Btn variant="primary" onClick={parse} disabled={busy || !notes.trim()}>
                {busy ? 'Parsing…' : 'Parse'}
              </Btn>
            </div>
          </>
        )}

        {step === 'review' && review && (
          <>
            <div className="mt-5 space-y-4">
              <Field
                label="B8 — Business problem"
                value={review.b8}
                onChange={(v) => setReview((s) => ({ ...s, b8: v }))}
                rows={4}
                hint={!review.b8.trim() ? 'Left blank — the notes said nothing bearing on this.' : null}
              />
              <Field
                label="B9 — Problem significance"
                value={review.b9}
                onChange={(v) => setReview((s) => ({ ...s, b9: v }))}
                rows={4}
                hint={!review.b9.trim() ? 'Left blank — the notes said nothing bearing on this.' : null}
              />
              <Field
                label="B10 — Solution effectiveness"
                value={review.b10}
                onChange={(v) => setReview((s) => ({ ...s, b10: v }))}
                rows={4}
                hint={!review.b10.trim() ? 'Left blank — the notes said nothing bearing on this.' : null}
              />
            </div>

            <div className="mt-6">
              <h4 className="font-semibold text-slate-900">
                Proposed Section C results{' '}
                <span className="text-sm font-normal text-slate-500">
                  ({included.length} of {review.results.length} selected)
                </span>
              </h4>
              {review.results.length === 0 ? (
                <p className="mt-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-6 text-center text-sm text-slate-500">
                  No measurable results found in the notes. Nothing was invented to fill this in — add results
                  by hand on the page if you have figures.
                </p>
              ) : (
                <div className="mt-3 space-y-3">
                  {review.results.map((item) => (
                    <ProposedResult
                      key={item.key}
                      item={item}
                      onChange={(next) =>
                        setReview((s) => ({
                          ...s,
                          results: s.results.map((r) => (r.key === item.key ? next : r)),
                        }))
                      }
                      onDelete={() =>
                        setReview((s) => ({ ...s, results: s.results.filter((r) => r.key !== item.key) }))
                      }
                    />
                  ))}
                </div>
              )}
            </div>

            {confirming && (
              <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-semibold text-amber-900">
                  This will replace your existing B8/B9/B10 text — continue?
                </p>
                <p className="mt-1 text-xs text-amber-800">
                  Only the fields filled in above are replaced. Applied changes still aren’t saved until you
                  click Save on the page.
                </p>
                <div className="mt-3 flex gap-2">
                  <Btn variant="ghost" onClick={() => setConfirming(false)}>
                    Cancel
                  </Btn>
                  <Btn variant="primary" onClick={apply}>
                    Yes, replace
                  </Btn>
                </div>
              </div>
            )}

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
              <p className="text-xs text-slate-500">
                Applying fills the page in only — click Save afterwards to keep it.
              </p>
              <div className="flex gap-2">
                <Btn variant="ghost" onClick={() => setStep('paste')}>
                  Back
                </Btn>
                <Btn variant="primary" onClick={apply} disabled={confirming || nothingToApply}>
                  Apply to page
                </Btn>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

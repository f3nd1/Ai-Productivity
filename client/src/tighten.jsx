import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api } from './api.js';

const TightenCtx = createContext(null);

// Wraps the per-initiative page. Children register their narrative fields here
// so a single "Tighten all" can drive every field without lifting all their
// state into the page. `registryRef` is a ref to a Map(id -> field handle ref)
// owned by the page, which reads it to run the sequence.
export function TightenProvider({ registryRef, children }) {
  const value = useMemo(
    () => ({
      register: (id, ref) => registryRef.current.set(id, ref),
      unregister: (id) => registryRef.current.delete(id),
    }),
    [registryRef]
  );
  return <TightenCtx.Provider value={value}>{children}</TightenCtx.Provider>;
}

// Register a narrative field. `order` controls the "Tighten all" sequence.
// get/set always read/write the field's latest value (the handle object is
// mutated in place each render, so the page reads current values mid-run).
export function useTightenRegister(id, order, value, setValue) {
  const ctx = useContext(TightenCtx);
  const ref = useRef({});
  ref.current.get = () => value;
  ref.current.set = setValue;
  ref.current.order = order;
  useEffect(() => {
    if (!ctx || id == null) return undefined;
    ctx.register(id, ref);
    return () => ctx.unregister(id);
  }, [ctx, id]);
}

// The per-field "Tighten with AI" button behaviour, shared by every narrative
// field (B8-B10, Section C notes, D14-D16).
export function useTightenButton(value, setValue) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  async function tighten() {
    if (!value?.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const { text } = await api.tighten(value);
      setValue(text);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }
  return { tighten, busy, err };
}

// Run tighten across every registered field, in `order`, skipping blanks.
// `onProgress(done, total)` is called before each call for a progress display.
export async function runTightenAll(registryRef, onProgress) {
  const handles = [...registryRef.current.values()]
    .map((ref) => ref.current)
    .filter((h) => h && (h.get() || '').trim())
    .sort((a, b) => a.order - b.order);
  for (let i = 0; i < handles.length; i++) {
    onProgress(i + 1, handles.length);
    try {
      const { text } = await api.tighten(handles[i].get());
      handles[i].set(text);
    } catch {
      // Skip a field that fails; keep going with the rest.
    }
  }
  return handles.length;
}

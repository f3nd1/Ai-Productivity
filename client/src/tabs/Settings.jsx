import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Btn } from '../ui.jsx';

function ModelSelect({ label, hint, value, onChange, options }) {
  // Always include the current value so it displays even before models are fetched.
  const opts = Array.from(new Set([value, 'gpt-4o-mini', ...options].filter(Boolean)));
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <select
        className="mt-1 w-full rounded border border-slate-300 px-3 py-1.5 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {opts.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </label>
  );
}

export default function Settings({ onSaved }) {
  const [loaded, setLoaded] = useState(null); // server snapshot (masked key etc.)
  const [enabled, setEnabled] = useState(true);
  const [analysisModel, setAnalysisModel] = useState('gpt-4o-mini');
  const [utilityModel, setUtilityModel] = useState('gpt-4o-mini');
  const [orgContext, setOrgContext] = useState('');
  const [keyInput, setKeyInput] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [models, setModels] = useState([]);
  const [msg, setMsg] = useState(null); // { kind: 'ok'|'err', text }
  const [busy, setBusy] = useState('');

  async function load() {
    try {
      const s = await api.getSettings();
      setLoaded(s);
      setEnabled(s.openai_enabled);
      setAnalysisModel(s.analysis_model);
      setUtilityModel(s.utility_model);
      setOrgContext(s.org_context || '');
    } catch (e) {
      setMsg({ kind: 'err', text: e.message });
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function fetchModels() {
    setBusy('models');
    setMsg(null);
    try {
      const { models } = await api.openaiModels();
      setModels(models);
      setMsg({ kind: 'ok', text: `Fetched ${models.length} models.` });
    } catch (e) {
      setMsg({ kind: 'err', text: e.message });
    } finally {
      setBusy('');
    }
  }

  async function test() {
    setBusy('test');
    setMsg(null);
    try {
      const r = await api.testOpenai();
      setMsg(
        r.ok
          ? { kind: 'ok', text: `Connection OK (${r.model}).` }
          : { kind: 'err', text: `Failed: ${r.error}` }
      );
    } catch (e) {
      setMsg({ kind: 'err', text: e.message });
    } finally {
      setBusy('');
    }
  }

  async function save() {
    setBusy('save');
    setMsg(null);
    try {
      await api.saveSettings({
        openai_enabled: enabled,
        analysis_model: analysisModel,
        utility_model: utilityModel,
        org_context: orgContext,
        // Only send a key if the user typed a new one; blank preserves the stored key.
        ...(keyInput.trim() ? { openai_key: keyInput.trim() } : {}),
      });
      setKeyInput('');
      await load();
      onSaved?.();
      setMsg({ kind: 'ok', text: 'Saved.' });
    } catch (e) {
      setMsg({ kind: 'err', text: e.message });
    } finally {
      setBusy('');
    }
  }

  const keyPlaceholder = loaded?.has_key
    ? `${loaded.key_masked} (${loaded.key_source}) — leave blank to keep`
    : 'sk-…';

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-slate-800">Settings</h2>

      {loaded && !loaded.persistable && (
        <div className="rounded border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          Supabase is not configured, so settings cannot be saved. They will fall back to server
          environment variables.
        </div>
      )}

      {/* OpenAI configuration */}
      <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
        <h3 className="font-medium text-slate-800">OpenAI configuration</h3>

        <label className="flex items-center gap-2">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          <span className="text-sm text-slate-700">Enable live AI calls</span>
          <span className="text-xs text-slate-500">
            (when off, drafting and tightening return labelled stub text even if a key is set)
          </span>
        </label>

        <div>
          <span className="text-sm font-medium text-slate-700">API key</span>
          <div className="mt-1 flex gap-2">
            <input
              type={showKey ? 'text' : 'password'}
              className="w-full rounded border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder={keyPlaceholder}
              autoComplete="off"
            />
            <Btn onClick={() => setShowKey((v) => !v)}>{showKey ? 'Hide' : 'Show'}</Btn>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Stored server-side only; the full key is never sent back to the browser.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Btn onClick={fetchModels} disabled={busy === 'models'}>
            {busy === 'models' ? 'Fetching…' : 'Fetch available models'}
          </Btn>
          <Btn onClick={test} disabled={busy === 'test'}>
            {busy === 'test' ? 'Testing…' : 'Test connection'}
          </Btn>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <ModelSelect
            label="Analysis model"
            hint="Used for drafting and tightening (the heavier task)."
            value={analysisModel}
            onChange={setAnalysisModel}
            options={models}
          />
          <ModelSelect
            label="Utility model"
            hint="Reserved for lighter text tasks; defaults to the analysis model."
            value={utilityModel}
            onChange={setUtilityModel}
            options={models}
          />
        </div>
      </section>

      {/* Organisation context */}
      <section className="space-y-2 rounded-lg border border-slate-200 bg-white p-4">
        <h3 className="font-medium text-slate-800">Organisation context</h3>
        <p className="text-xs text-slate-500">
          Included with every AI call so drafts stay consistent without re-explaining who United Ceres
          College is. Keep it factual — never invented figures.
        </p>
        <textarea
          rows={5}
          className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          value={orgContext}
          onChange={(e) => setOrgContext(e.target.value)}
          placeholder="e.g. United Ceres College is a private academic institution in Singapore offering diploma and degree programmes…"
        />
      </section>

      <div className="flex items-center gap-3">
        <Btn variant="primary" onClick={save} disabled={busy === 'save' || (loaded && !loaded.persistable)}>
          {busy === 'save' ? 'Saving…' : 'Save'}
        </Btn>
        {msg && (
          <span className={`text-sm ${msg.kind === 'ok' ? 'text-green-600' : 'text-red-600'}`}>
            {msg.text}
          </span>
        )}
      </div>
    </div>
  );
}

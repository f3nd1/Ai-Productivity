import { useEffect, useState, useCallback } from 'react';
import { api } from './api.js';
import Initiatives from './tabs/Initiatives.jsx';
import SectionC from './tabs/SectionC.jsx';
import SectionD from './tabs/SectionD.jsx';
import FinalSubmission from './tabs/FinalSubmission.jsx';

const TABS = [
  ['initiatives', 'Initiatives'],
  ['sectionC', 'Section C'],
  ['sectionD', 'Section D'],
  ['final', 'Final submission'],
];

export default function App() {
  const [tab, setTab] = useState('initiatives');
  const [initiatives, setInitiatives] = useState([]);
  const [results, setResults] = useState([]);
  const [sectionD, setSectionD] = useState(null);
  const [health, setHealth] = useState(null);
  const [loadError, setLoadError] = useState(null);

  const reload = useCallback(async () => {
    try {
      const [inits, res, sd] = await Promise.all([
        api.listInitiatives(),
        api.listResults(),
        api.getSectionD(),
      ]);
      setInitiatives(inits || []);
      setResults(res || []);
      setSectionD(sd);
      setLoadError(null);
    } catch (e) {
      setLoadError(e.message);
    }
  }, []);

  useEffect(() => {
    api.health().then(setHealth).catch(() => setHealth(null));
    reload();
  }, [reload]);

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-5xl px-6 py-4">
          <h1 className="text-xl font-semibold text-slate-800">AI Impact Builder</h1>
          <p className="text-sm text-slate-500">
            United Ceres College — IMDA SME AI Impact Awards evidence
          </p>
        </div>
        <nav className="mx-auto flex max-w-5xl gap-1 px-6">
          {TABS.map(([key, name]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`border-b-2 px-4 py-2 text-sm font-medium ${
                tab === key
                  ? 'border-slate-800 text-slate-800'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {name}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-6">
        {health && (!health.supabase || !health.openai) && (
          <div className="mb-4 rounded border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-800">
            Backend running in degraded mode:{' '}
            {!health.supabase && <span>Supabase not configured (data cannot be saved). </span>}
            {!health.openai && <span>OpenAI not configured (drafts show raw evidence).</span>}
          </div>
        )}
        {loadError && (
          <div className="mb-4 rounded border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-700">
            Could not load data: {loadError}
          </div>
        )}

        {tab === 'initiatives' && (
          <Initiatives initiatives={initiatives} reload={reload} />
        )}
        {tab === 'sectionC' && (
          <SectionC initiatives={initiatives} results={results} reload={reload} />
        )}
        {tab === 'sectionD' && <SectionD sectionD={sectionD} reload={reload} />}
        {tab === 'final' && (
          <FinalSubmission initiatives={initiatives} results={results} sectionD={sectionD} />
        )}
      </main>
    </div>
  );
}

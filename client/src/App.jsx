import { useEffect, useState, useCallback } from 'react';
import { api } from './api.js';
import Initiatives from './tabs/Initiatives.jsx';
import InitiativePage from './tabs/InitiativePage.jsx';
import Overview from './tabs/Overview.jsx';
import SectionD from './tabs/SectionD.jsx';
import Settings from './tabs/Settings.jsx';
import ChangeLog from './tabs/ChangeLog.jsx';

const TABS = [
  { key: 'initiatives', name: 'Initiatives', hint: 'Build and manage evidence', icon: 'spark' },
  { key: 'overview', name: 'Overview', hint: 'Review organisation-wide impact', icon: 'chart' },
  { key: 'sectiond', name: 'Overall / Section D', hint: 'Close with adoption and readiness', icon: 'people' },
  { key: 'settings', name: 'Settings', hint: 'Configure AI and context', icon: 'settings' },
  { key: 'changelog', name: 'Change Log', hint: 'Track application updates', icon: 'history' },
];

const PAGE_COPY = {
  initiatives: {
    kicker: 'Evidence workspace',
    title: 'AI Impact Builder',
    description: 'Prepare clear, measurable evidence for the IMDA SME AI Impact Awards.',
  },
  overview: {
    kicker: 'Performance view',
    title: 'Impact overview',
    description: 'See the combined operational, productivity and financial impact of all initiatives.',
  },
  sectiond: {
    kicker: 'Closing section',
    title: 'Overall Section D',
    description:
      'One set of adoption, work-process and future-readiness answers covering every initiative.',
  },
  settings: {
    kicker: 'Configuration',
    title: 'Application settings',
    description: 'Manage AI models, connection details and organisation context.',
  },
  changelog: {
    kicker: 'Release history',
    title: 'Change log',
    description: 'Review recent updates and confirm what has changed in the application.',
  },
};

function Icon({ name, className = 'h-5 w-5' }) {
  const common = {
    className,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  };
  if (name === 'chart') {
    return (
      <svg {...common}>
        <path d="M4 19V9" />
        <path d="M10 19V5" />
        <path d="M16 19v-7" />
        <path d="M22 19H2" />
      </svg>
    );
  }
  if (name === 'people') {
    return (
      <svg {...common}>
        <path d="M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19" />
        <circle cx="10" cy="8" r="3.2" />
        <path d="M20 19v-1.5a3.5 3.5 0 0 0-2.6-3.4" />
        <path d="M15.5 5.2a3.2 3.2 0 0 1 0 5.6" />
      </svg>
    );
  }
  if (name === 'settings') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.12 2.12-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V20h-3v-.08a1.7 1.7 0 0 0-1.03-1.56 1.7 1.7 0 0 0-1.88.34l-.06.06-2.12-2.12.06-.06A1.7 1.7 0 0 0 7 15.4a1.7 1.7 0 0 0-1.56-1.03H5v-3h.08A1.7 1.7 0 0 0 6.64 10a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.12-2.12.06.06A1.7 1.7 0 0 0 10.3 6.3a1.7 1.7 0 0 0 1.03-1.56V4h3v.08A1.7 1.7 0 0 0 15.36 5.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.12 2.12-.06.06A1.7 1.7 0 0 0 19.7 9.3a1.7 1.7 0 0 0 1.56 1.03H21v3h-.08A1.7 1.7 0 0 0 19.4 15Z" />
      </svg>
    );
  }
  if (name === 'history') {
    return (
      <svg {...common}>
        <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
        <path d="M3 3v5h5" />
        <path d="M12 7v5l3 2" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="m12 3 1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3Z" />
      <path d="m18.5 14 1 2.5L22 17.5l-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1 1-2.5Z" />
      <path d="m5 14 .8 2.2L8 17l-2.2.8L5 20l-.8-2.2L2 17l2.2-.8L5 14Z" />
    </svg>
  );
}

function HealthStatus({ health }) {
  const ready = health?.supabase && health?.openai;
  const label = !health ? 'Checking services' : ready ? 'All services ready' : 'Setup required';
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/90 p-3">
      <div className="flex items-center gap-2">
        <span
          className={`h-2.5 w-2.5 rounded-full ${
            !health ? 'animate-pulse bg-slate-400' : ready ? 'bg-emerald-500' : 'bg-amber-500'
          }`}
        />
        <span className="text-xs font-semibold text-slate-700">{label}</span>
      </div>
      <p className="mt-1.5 text-[11px] leading-4 text-slate-500">
        {ready ? 'Database and AI drafting are available.' : 'Open Settings to complete any missing connection.'}
      </p>
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState('initiatives');
  const [selectedId, setSelectedId] = useState(null);
  const [initiatives, setInitiatives] = useState([]);
  const [results, setResults] = useState([]);
  const [sectionD, setSectionD] = useState(null); // ONE overall row for the whole submission
  const [health, setHealth] = useState(null);
  const [loadError, setLoadError] = useState(null);

  const reload = useCallback(async () => {
    try {
      const [inits, res, d] = await Promise.all([
        api.listInitiatives(),
        api.listResults(),
        api.getSectionD(),
      ]);
      setInitiatives(inits || []);
      setResults(res || []);
      setSectionD(d || null);
      setLoadError(null);
    } catch (e) {
      setLoadError(e.message);
    }
  }, []);

  useEffect(() => {
    api.health().then(setHealth).catch(() => setHealth(null));
    reload();
  }, [reload]);

  const selected = selectedId ? initiatives.find((i) => i.id === selectedId) : null;
  const page = PAGE_COPY[tab];

  function goToTab(key) {
    setTab(key);
    if (key === 'initiatives') setSelectedId(null);
  }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="border-b border-slate-200/80 bg-white/90 px-4 py-4 backdrop-blur lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:border-b-0 lg:border-r lg:px-5 lg:py-6">
        <div className="flex items-center gap-3 px-2">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-500 to-sky-500 text-white shadow-lg shadow-indigo-200">
            <Icon name="spark" className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-semibold tracking-tight text-slate-950">AI Impact Builder</p>
            <p className="text-xs text-slate-500">United Ceres College</p>
          </div>
        </div>

        <nav className="mt-5 grid grid-cols-2 gap-2 lg:mt-8 lg:grid-cols-1" aria-label="Primary navigation">
          {TABS.map((item) => {
            const active = tab === item.key;
            return (
              <button
                key={item.key}
                onClick={() => goToTab(item.key)}
                className={`group flex items-center gap-3 rounded-2xl px-3 py-3 text-left transition ${
                  active
                    ? 'bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-100'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'
                }`}
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                    active ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200' : 'bg-white text-slate-500 ring-1 ring-slate-200'
                  }`}
                >
                  <Icon name={item.icon} className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{item.name}</span>
                  <span className="hidden truncate text-[11px] text-slate-400 lg:block">{item.hint}</span>
                </span>
              </button>
            );
          })}
        </nav>

        <div className="mt-auto hidden pt-6 lg:block">
          <HealthStatus health={health} />
          <p className="mt-4 px-2 text-[11px] leading-4 text-slate-400">IMDA SME AI Impact Awards evidence workspace</p>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="border-b border-white/70 bg-white/40 px-5 py-6 backdrop-blur md:px-8 lg:px-10 lg:py-8">
          <div className="mx-auto flex max-w-7xl flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow">{page.kicker}</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">{page.title}</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{page.description}</p>
            </div>
            <div className="flex items-center gap-2 rounded-2xl border border-white bg-white/80 px-3 py-2 shadow-sm lg:hidden">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  health?.supabase && health?.openai ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
              />
              <span className="text-xs font-semibold text-slate-600">
                {health?.supabase && health?.openai ? 'Services ready' : 'Setup required'}
              </span>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-5 py-6 md:px-8 lg:px-10 lg:py-8">
          {health && (!health.supabase || !health.openai) && (
            <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-900 shadow-sm">
              <span className="font-semibold">Backend is in limited mode.</span>{' '}
              {!health.supabase && <span>Supabase is not configured, so data cannot be saved. </span>}
              {!health.openai && <span>OpenAI is not configured, so drafts will show raw evidence.</span>}
            </div>
          )}
          {loadError && (
            <div className="mb-5 rounded-2xl border border-red-200 bg-red-50/90 px-4 py-3 text-sm text-red-700 shadow-sm">
              Could not load data: {loadError}
            </div>
          )}

          {tab === 'initiatives' &&
            (selected ? (
              <InitiativePage
                initiative={selected}
                results={results}
                sectionD={sectionD}
                reload={reload}
                onBack={() => setSelectedId(null)}
              />
            ) : (
              <Initiatives
                initiatives={initiatives}
                results={results}
                sectionD={sectionD}
                reload={reload}
                onSelect={setSelectedId}
              />
            ))}
          {tab === 'overview' && (
            <Overview
              initiatives={initiatives}
              results={results}
              sectionD={sectionD}
              onOpenInitiative={(id) => {
                setSelectedId(id);
                setTab('initiatives');
              }}
            />
          )}
          {tab === 'sectiond' && <SectionD sectionD={sectionD} reload={reload} />}
          {tab === 'settings' && (
            <Settings onSaved={() => api.health().then(setHealth).catch(() => {})} />
          )}
          {tab === 'changelog' && <ChangeLog />}
        </main>
      </div>
    </div>
  );
}

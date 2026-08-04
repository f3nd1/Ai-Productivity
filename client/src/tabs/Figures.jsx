import { useMemo, useState } from 'react';
import {
  FIGURE_COLUMNS,
  TYPE_LABEL,
  buildFigureRows,
  filterFigureRows,
  sortFigureRows,
  figureRowsToCsv,
} from '../figures.js';
import { downloadCsv } from '../csv.js';
import { Btn } from '../ui.jsx';

const money = (n) => '$' + Number(n).toLocaleString('en-GB', { maximumFractionDigits: 2 });
const DASH = '–';

// Tints match the Section C sub-section colours so a row's type reads at a glance.
const GROUP_TONE = {
  Productivity: 'bg-blue-50/70 text-blue-700',
  Financial: 'bg-emerald-50/70 text-emerald-700',
  Operational: 'bg-violet-50/70 text-violet-700',
};
const TYPE_TONE = {
  productivity: 'bg-blue-50 text-blue-700 ring-blue-100',
  financial: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  operational: 'bg-violet-50 text-violet-700 ring-violet-100',
};

function cellText(row, key) {
  const v = row[key];
  if (v === null || v === undefined) return DASH;
  if (key === 'finMonthly' || key === 'finAnnual') return money(v);
  if (key === 'finRoi' || key === 'prodPct') return `${v}%`;
  if (key === 'finPayback') return `${v} months`;
  if (key === 'opChange') return row.opChangeLabel ?? String(v);
  return String(v);
}

export default function Figures({ initiatives, results }) {
  const [sort, setSort] = useState({ key: 'code', dir: 'asc' });
  const [initiativeId, setInitiativeId] = useState('all');
  const [type, setType] = useState('all');

  const allRows = useMemo(() => buildFigureRows({ initiatives, results }), [initiatives, results]);
  const rows = useMemo(
    () => sortFigureRows(filterFigureRows(allRows, { initiativeId, type }), sort.key, sort.dir),
    [allRows, initiativeId, type, sort]
  );

  const toggleSort = (key) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));

  if (allRows.length === 0) {
    return (
      <div className="app-panel px-6 py-12 text-center">
        <p className="eyebrow">Nothing to compare yet</p>
        <h2 className="section-title mt-2">No Section C results recorded</h2>
        <p className="muted-copy mx-auto mt-2 max-w-lg">
          This table lists every measurable result across all initiatives. Open the Initiatives tab, choose an
          initiative and add a Productivity, Financial or Operational result to populate it.
        </p>
      </div>
    );
  }

  // Two-tier header: a spanning group row above the sortable column row.
  const groups = [];
  for (const col of FIGURE_COLUMNS) {
    const last = groups[groups.length - 1];
    if (last && last.label === col.group) last.span += 1;
    else groups.push({ label: col.group, span: 1 });
  }

  const filtered = rows.length !== allRows.length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Raw comparison</p>
          <h2 className="section-title mt-1">Figures table</h2>
          <p className="muted-copy mt-1">
            One row per Section C result, using the same calculators as each initiative's own page.
          </p>
        </div>
        <Btn onClick={() => downloadCsv('ai-impact-figures.csv', figureRowsToCsv(rows))} disabled={rows.length === 0}>
          Download as CSV
        </Btn>
      </div>

      <div className="app-card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block lg:col-span-2">
          <span className="field-label">Initiative</span>
          <select className="field-control" value={initiativeId} onChange={(e) => setInitiativeId(e.target.value)}>
            <option value="all">All initiatives</option>
            {initiatives.map((i) => (
              <option key={i.id} value={i.id}>
                {i.initiative_code ? `${i.initiative_code} — ` : ''}
                {i.name?.trim() || 'Untitled initiative'}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="field-label">Result type</span>
          <select className="field-control" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="all">All types</option>
            {Object.entries(TYPE_LABEL).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </label>
        <div className="flex items-end">
          <p className="text-xs text-slate-500">
            Showing {rows.length} of {allRows.length} result{allRows.length === 1 ? '' : 's'}.{' '}
            {filtered && (
              <button
                className="font-semibold text-indigo-600 hover:underline"
                onClick={() => {
                  setInitiativeId('all');
                  setType('all');
                }}
              >
                Clear filters
              </button>
            )}
          </p>
        </div>
      </div>

      <section className="app-card overflow-hidden">
        {rows.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-slate-500">
            No results match these filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-[0.14em] text-slate-500">
                  {groups.map((g, i) => (
                    <th
                      key={i}
                      colSpan={g.span}
                      className={`border-b border-slate-100 px-4 py-2 font-bold ${
                        g.label ? GROUP_TONE[g.label] : ''
                      }`}
                    >
                      {g.label || ''}
                    </th>
                  ))}
                </tr>
                <tr className="bg-slate-50/80 text-left text-[11px] uppercase tracking-[0.12em] text-slate-500">
                  {FIGURE_COLUMNS.map((col) => {
                    const active = sort.key === col.key;
                    return (
                      <th key={col.key} className="whitespace-nowrap px-4 py-3 font-semibold">
                        <button
                          className={`inline-flex items-center gap-1 transition hover:text-slate-800 ${
                            active ? 'text-slate-900' : ''
                          }`}
                          onClick={() => toggleSort(col.key)}
                          title={`Sort by ${col.group ? `${col.group} ${col.label}` : col.label}`}
                        >
                          {col.label}
                          <span className={active ? 'text-indigo-600' : 'text-slate-300'}>
                            {active ? (sort.dir === 'asc' ? '▲' : '▼') : '↕'}
                          </span>
                        </button>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100 transition hover:bg-indigo-50/30">
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs font-semibold text-slate-500">
                      {row.code}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">{row.initiative}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${
                          TYPE_TONE[row.type] || ''
                        }`}
                      >
                        {row.typeLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{row.metric}</td>
                    {FIGURE_COLUMNS.slice(4).map((col) => {
                      const text = cellText(row, col.key);
                      return (
                        <td
                          key={col.key}
                          className={`whitespace-nowrap px-4 py-3 ${
                            text === DASH ? 'text-slate-300' : 'font-medium text-slate-700'
                          }`}
                        >
                          {text}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

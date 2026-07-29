import { useMemo, useState } from 'react';
import { computeOverview, overviewRowsToCsv } from '../overview.js';
import { Btn } from '../ui.jsx';

const fmtMoney = (n) => '$' + Math.round(n).toLocaleString('en-GB');
const dash = (v, fmt = (x) => x) => (v === null || v === undefined ? 'Not recorded' : fmt(v));

function Stat({ label, value, sub, accent = 'indigo' }) {
  const tones = {
    indigo: 'from-indigo-500 to-violet-500 bg-indigo-50 text-indigo-700',
    sky: 'from-sky-500 to-cyan-500 bg-sky-50 text-sky-700',
    emerald: 'from-emerald-500 to-teal-500 bg-emerald-50 text-emerald-700',
    amber: 'from-amber-500 to-orange-500 bg-amber-50 text-amber-700',
    rose: 'from-rose-500 to-pink-500 bg-rose-50 text-rose-700',
    slate: 'from-slate-500 to-slate-700 bg-slate-100 text-slate-700',
  };
  const tone = tones[accent] || tones.indigo;
  const [gradient, background, text] = tone.split(' ');
  return (
    <div className="app-card relative overflow-hidden p-5">
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${gradient}`} />
      <div className={`inline-flex rounded-lg px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] ${background} ${text}`}>
        {label}
      </div>
      <div className="mt-4 text-2xl font-semibold tracking-tight text-slate-950">{value}</div>
      {sub && <div className="mt-1 text-xs leading-5 text-slate-500">{sub}</div>}
    </div>
  );
}

function MonthlyChart({ rows }) {
  const withMoney = rows.filter((r) => r.monthly != null && r.monthly > 0);
  if (withMoney.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-8 text-center text-sm text-slate-500">
        No financial savings have been recorded for this department.
      </div>
    );
  }
  const max = Math.max(...withMoney.map((r) => r.monthly));
  return (
    <div className="space-y-4">
      {withMoney.map((r) => (
        <div key={r.id}>
          <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
            <div className="min-w-0">
              <p className="truncate font-semibold text-slate-700" title={r.name}>{r.name}</p>
              <p className="text-xs text-slate-400">{r.department || 'Department not set'}</p>
            </div>
            <span className="shrink-0 font-semibold text-slate-900">{fmtMoney(r.monthly)}</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-sky-500"
              style={{ width: `${Math.max((r.monthly / max) * 100, 2)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function csvFileName(department) {
  const suffix = department === 'all'
    ? 'all-departments'
    : department.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `ai-impact-overview-${suffix || 'department'}.csv`;
}

function downloadCsv(rows, department) {
  const blob = new Blob(['\uFEFF', overviewRowsToCsv(rows)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = csvFileName(department);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function Overview({ initiatives, results, sectionD, onOpenInitiative }) {
  const [selectedDepartment, setSelectedDepartment] = useState('all');

  const departmentOptions = useMemo(
    () => Array.from(new Set(initiatives.map((initiative) => initiative.department?.trim()).filter(Boolean))).sort(),
    [initiatives]
  );

  // Section D is organisation-wide, so it is NOT filtered by department — the
  // same closing answers apply whichever department view is selected.
  const filteredData = useMemo(() => {
    if (selectedDepartment === 'all') return { initiatives, results, sectionD };
    const filteredInitiatives = initiatives.filter(
      (initiative) => initiative.department?.trim() === selectedDepartment
    );
    const ids = new Set(filteredInitiatives.map((initiative) => initiative.id));
    return {
      initiatives: filteredInitiatives,
      results: results.filter((result) => ids.has(result.initiative_id)),
      sectionD,
    };
  }, [initiatives, results, sectionD, selectedDepartment]);

  const { summary, rows } = useMemo(
    () => computeOverview(filteredData),
    [filteredData]
  );

  if (initiatives.length === 0) {
    return (
      <div className="app-panel px-6 py-12 text-center">
        <p className="eyebrow">No data yet</p>
        <h2 className="section-title mt-2">Overview will appear here</h2>
        <p className="muted-copy mx-auto mt-2 max-w-lg">
          Add an initiative and measurable results first. The figures will then roll up automatically.
        </p>
      </div>
    );
  }

  const bt = summary.byType;
  const counts = (c) => `${c.productivity}P · ${c.financial}F · ${c.operational}O`;
  const departmentLabel = selectedDepartment === 'all' ? 'All departments' : selectedDepartment;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Organisation summary</p>
          <h2 className="section-title mt-1">Evidence at a glance</h2>
        </div>
        <label className="block w-full sm:w-64">
          <span className="field-label">Department view</span>
          <select
            className="field-control mt-1.5"
            value={selectedDepartment}
            onChange={(event) => setSelectedDepartment(event.target.value)}
          >
            <option value="all">All departments</option>
            {departmentOptions.map((department) => (
              <option key={department} value={department}>{department}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <Stat label="Initiatives" value={summary.totalInitiatives} accent="indigo" />
        <Stat
          label="Department"
          value={selectedDepartment === 'all' ? departmentOptions.length || 'Not set' : selectedDepartment}
          sub={selectedDepartment === 'all' ? 'Departments represented' : 'Current filtered view'}
          accent="sky"
        />
        <Stat
          label="Section C results"
          value={summary.totalResults}
          sub={`${bt.productivity} productivity, ${bt.financial} financial, ${bt.operational} operational`}
          accent="slate"
        />
        <Stat label="Saved monthly" value={fmtMoney(summary.totalMonthly)} sub={`${fmtMoney(summary.totalAnnual)} annually`} accent="emerald" />
        <Stat label="Productivity gain" value={dash(summary.avgProductivityPct, (v) => `${v}%`)} sub="Average across recorded metrics" accent="amber" />
        <Stat
          label="Hours freed"
          value={summary.totalD15Hours}
          sub={`Per week, overall Section D${summary.d14Adoption != null ? ` · ${summary.d14Adoption}% adoption` : ''}`}
          accent="rose"
        />
      </div>

      <section className="app-card p-5 sm:p-6">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow">Financial impact</p>
            <h3 className="mt-1 text-lg font-semibold tracking-tight text-slate-950">Monthly saving by initiative</h3>
            <p className="mt-1 text-xs text-slate-500">Showing {departmentLabel}</p>
          </div>
          <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-100">
            Total {fmtMoney(summary.totalMonthly)}
          </span>
        </div>
        <MonthlyChart rows={rows} />
      </section>

      <section className="app-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
          <div>
            <p className="eyebrow">Detailed view</p>
            <h3 className="mt-1 text-lg font-semibold tracking-tight text-slate-950">Initiative performance</h3>
            <p className="mt-1 text-xs text-slate-500">
              {rows.length} initiative{rows.length === 1 ? '' : 's'}, {departmentLabel}
            </p>
          </div>
          <Btn onClick={() => downloadCsv(rows, selectedDepartment)} disabled={rows.length === 0}>
            Export CSV
          </Btn>
        </div>

        {rows.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-slate-500">
            No initiatives are assigned to this department.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="bg-slate-50/80 text-left text-[11px] uppercase tracking-[0.12em] text-slate-500">
                  <th className="px-5 py-3.5 font-semibold">Initiative</th>
                  <th className="px-5 py-3.5 font-semibold">Department</th>
                  <th className="px-5 py-3.5 font-semibold">C results</th>
                  <th className="px-5 py-3.5 font-semibold">Saved monthly</th>
                  <th className="px-5 py-3.5 font-semibold">Productivity</th>
                  <th className="px-5 py-3.5 font-semibold">Complete</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-slate-100 transition hover:bg-indigo-50/30">
                    <td className="px-5 py-4">
                      <button
                        onClick={() => onOpenInitiative(r.id)}
                        className="font-semibold text-slate-900 transition hover:text-indigo-700"
                      >
                        {r.name}
                      </button>
                    </td>
                    <td className="px-5 py-4">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                        {r.department || 'Not set'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-600">{counts(r.counts)}</td>
                    <td className="px-5 py-4 font-medium text-slate-700">{dash(r.monthly, fmtMoney)}</td>
                    <td className="px-5 py-4 text-slate-600">{dash(r.avgProductivityPct, (v) => `${v}%`)}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-indigo-500"
                            style={{ width: `${Math.round((r.completeness / 9) * 100)}%` }}
                          />
                        </div>
                        <span className="text-xs font-semibold text-slate-600">{r.completeness}/9</span>
                      </div>
                    </td>
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

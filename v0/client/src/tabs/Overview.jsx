import { useMemo } from 'react';
import { computeOverview } from '../overview.js';

const fmtMoney = (n) => '$' + Math.round(n).toLocaleString('en-GB');
const dash = (v, fmt = (x) => x) => (v === null || v === undefined ? '—' : fmt(v));

function Stat({ label, value, sub }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-slate-800">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

// Lightweight CSS bar chart — no charting dependency.
function MonthlyChart({ rows }) {
  const withMoney = rows.filter((r) => r.monthly != null && r.monthly > 0);
  if (withMoney.length === 0) {
    return <p className="text-sm text-slate-500">No financial savings recorded yet.</p>;
  }
  const max = Math.max(...withMoney.map((r) => r.monthly));
  return (
    <div className="space-y-2">
      {withMoney.map((r) => (
        <div key={r.id} className="flex items-center gap-3">
          <div className="w-40 shrink-0 truncate text-sm text-slate-700" title={r.name}>
            {r.name}
          </div>
          <div className="h-5 flex-1 rounded bg-slate-100">
            <div
              className="flex h-5 items-center rounded bg-slate-700 px-2"
              style={{ width: `${Math.max((r.monthly / max) * 100, 2)}%` }}
            >
              <span className="whitespace-nowrap text-[11px] font-medium text-white">{fmtMoney(r.monthly)}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Overview({ initiatives, results, sectionDList, onOpenInitiative }) {
  const { summary, rows } = useMemo(
    () => computeOverview({ initiatives, results, sectionDList }),
    [initiatives, results, sectionDList]
  );

  if (initiatives.length === 0) {
    return (
      <div>
        <h2 className="mb-2 text-lg font-semibold text-slate-800">Overview</h2>
        <p className="text-sm text-slate-500">
          No initiatives yet. Add one on the Initiatives tab and its figures will roll up here.
        </p>
      </div>
    );
  }

  const bt = summary.byType;
  const counts = (c) => `${c.productivity}P / ${c.financial}F / ${c.operational}O`;

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-slate-800">Overview</h2>

      {/* Summary row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="Initiatives" value={summary.totalInitiatives} />
        <Stat
          label="Section C results"
          value={summary.totalResults}
          sub={`${bt.productivity} Productivity, ${bt.financial} Financial, ${bt.operational} Operational`}
        />
        <Stat label="Saved / month" value={fmtMoney(summary.totalMonthly)} sub={`${fmtMoney(summary.totalAnnual)} / year`} />
        <Stat label="Avg productivity gain" value={dash(summary.avgProductivityPct, (v) => `${v}%`)} />
        <Stat label="Hours freed / week" value={summary.totalD15Hours} sub="across all Section D" />
      </div>

      {/* Chart */}
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h3 className="mb-3 font-medium text-slate-800">Combined monthly saving by initiative</h3>
        <MonthlyChart rows={rows} />
      </section>

      {/* Per-initiative table */}
      <section className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3 font-medium">Initiative</th>
              <th className="px-4 py-3 font-medium">C results</th>
              <th className="px-4 py-3 font-medium">Saved / month</th>
              <th className="px-4 py-3 font-medium">Avg productivity</th>
              <th className="px-4 py-3 font-medium">D14 adoption</th>
              <th className="px-4 py-3 font-medium">D15 hrs/week</th>
              <th className="px-4 py-3 font-medium">Complete</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-3">
                  <button
                    onClick={() => onOpenInitiative(r.id)}
                    className="font-medium text-slate-800 underline decoration-slate-300 underline-offset-2 hover:decoration-slate-800"
                  >
                    {r.name}
                  </button>
                </td>
                <td className="px-4 py-3 text-slate-600">{counts(r.counts)}</td>
                <td className="px-4 py-3 text-slate-600">{dash(r.monthly, fmtMoney)}</td>
                <td className="px-4 py-3 text-slate-600">{dash(r.avgProductivityPct, (v) => `${v}%`)}</td>
                <td className="px-4 py-3 text-slate-600">{dash(r.d14Adoption, (v) => `${v}%`)}</td>
                <td className="px-4 py-3 text-slate-600">{dash(r.d15Hours)}</td>
                <td className="px-4 py-3 text-slate-600">{r.completeness}/9</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

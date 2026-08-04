// Pure row-building for the Figures Table — one row per Section C result across
// every initiative. No React, so figures.test.mjs can verify the numbers.
//
// Every figure comes from computeResult(), the same calculator the Section C
// cards, Export block and Overview use. Nothing here re-derives a number, so
// this table can't drift from what an initiative's own page shows.
import { computeResult } from './calc.js';
import { toCsv } from './csv.js';

export const TYPE_LABEL = {
  productivity: 'Productivity',
  financial: 'Financial',
  operational: 'Operational',
};

// Column groups. `group` drives the two-tier header; `numeric` marks columns
// that sort numerically rather than alphabetically.
export const FIGURE_COLUMNS = [
  { key: 'code', label: 'Initiative ID', group: null },
  { key: 'initiative', label: 'Initiative name', group: null },
  { key: 'type', label: 'Type', group: null },
  { key: 'metric', label: 'Metric / Cost category', group: null },

  { key: 'prodBefore', label: 'Before', group: 'Productivity', numeric: true },
  { key: 'prodAfter', label: 'After', group: 'Productivity', numeric: true },
  { key: 'prodPct', label: '% Change', group: 'Productivity', numeric: true },

  { key: 'finMonthly', label: 'Monthly saving', group: 'Financial', numeric: true },
  { key: 'finAnnual', label: 'Annual saving', group: 'Financial', numeric: true },
  { key: 'finRoi', label: 'ROI %', group: 'Financial', numeric: true },
  { key: 'finPayback', label: 'Payback (months)', group: 'Financial', numeric: true },

  { key: 'opBefore', label: 'Before rate', group: 'Operational', numeric: true },
  { key: 'opAfter', label: 'After rate', group: 'Operational', numeric: true },
  { key: 'opChange', label: 'Point / % change', group: 'Operational', numeric: true },
];

const numOrNull = (v) => {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const finite = (n) => (Number.isFinite(n) ? n : null);

export function buildFigureRows({ initiatives = [], results = [] }) {
  const byId = new Map(initiatives.map((i) => [i.id, i]));

  return results.map((r, index) => {
    const init = byId.get(r.initiative_id);
    const type = r.type || 'productivity';
    const f = r.fields || {};
    const out = computeResult(type, f);

    const row = {
      id: r.id || `row-${index}`,
      initiativeId: r.initiative_id,
      code: init?.initiative_code || '—',
      initiative: init?.name?.trim() || 'Untitled initiative',
      type,
      typeLabel: TYPE_LABEL[type] || type,
      // Financial results describe a cost category rather than a metric.
      metric: (type === 'financial' ? f.costCategory : f.metric) || '—',
      // Every group is null unless this row is of that type — the UI and the
      // CSV both render null as an en dash.
      prodBefore: null,
      prodAfter: null,
      prodPct: null,
      finMonthly: null,
      finAnnual: null,
      finRoi: null,
      finPayback: null,
      opBefore: null,
      opAfter: null,
      opChange: null,
      opChangeLabel: null,
    };

    if (type === 'productivity') {
      row.prodBefore = numOrNull(f.before);
      row.prodAfter = numOrNull(f.after);
      row.prodPct = finite(out.pct);
    } else if (type === 'financial') {
      row.finMonthly = finite(out.monthly);
      row.finAnnual = finite(out.annual);
      row.finRoi = finite(out.roi);
      row.finPayback = finite(out.paybackMonths);
    } else if (type === 'operational') {
      row.opBefore = numOrNull(f.before);
      row.opAfter = numOrNull(f.after);
      // A "%" unit moves in percentage POINTS; anything else is a % change.
      // Both come straight off the calculator.
      const isPoints = out.pointChange !== undefined && out.pointChange !== null;
      row.opChange = isPoints ? finite(out.pointChange) : finite(out.pct);
      if (row.opChange !== null) {
        row.opChangeLabel = isPoints
          ? `${row.opChange >= 0 ? '+' : ''}${row.opChange} points`
          : `${row.opChange}%`;
      }
    }

    return row;
  });
}

// Missing values sort last in BOTH directions — a column of dashes at the top
// would bury the figures the table exists to compare.
export function sortFigureRows(rows, key, dir = 'asc') {
  const col = FIGURE_COLUMNS.find((c) => c.key === key);
  if (!col) return rows;
  const sign = dir === 'asc' ? 1 : -1;
  const missing = (v) => v === null || v === undefined || v === '' || v === '—';
  const read = (r) => (key === 'type' ? r.typeLabel : r[key]);
  return [...rows].sort((a, b) => {
    const av = read(a);
    const bv = read(b);
    if (missing(av) || missing(bv)) return missing(av) && missing(bv) ? 0 : missing(av) ? 1 : -1;
    return (col.numeric ? av - bv : String(av).localeCompare(String(bv))) * sign;
  });
}

export function filterFigureRows(rows, { initiativeId = 'all', type = 'all' } = {}) {
  return rows.filter(
    (r) => (initiativeId === 'all' || r.initiativeId === initiativeId) && (type === 'all' || r.type === type)
  );
}

// The CSV mirrors exactly what's on screen, including the dashes, so a reader
// can tell "not applicable to this row type" from "zero".
export function figureRowsToCsv(rows = []) {
  const headers = FIGURE_COLUMNS.map((c) => (c.group ? `${c.group} — ${c.label}` : c.label));
  const body = rows.map((row) =>
    FIGURE_COLUMNS.map((c) => {
      if (c.key === 'type') return row.typeLabel;
      const v = row[c.key];
      return v === null || v === undefined ? '–' : v;
    })
  );
  return toCsv(headers, body);
}

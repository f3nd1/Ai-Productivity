import { createPortal } from 'react-dom';
import { printResultRows } from '../export.js';

// A dedicated document render, NOT a print stylesheet over the live form.
// Textareas, inputs and buttons never print well, so nothing here is a control:
// every field is flowing prose or a real table. It portals to <body> so the app
// tree is untouched, and `print.css` hides #root while showing this in print.

const SECTION_C = [
  { qid: 'c11', type: 'productivity', number: '11', title: 'Productivity Gains' },
  { qid: 'c12', type: 'financial', number: '12', title: 'Financial Impact' },
  { qid: 'c13', type: 'operational', number: '13', title: 'Operational Benefits' },
];

const SECTION_B = [
  { number: '8', title: 'Business Problem Definition', key: 'b8_problem' },
  { number: '9', title: 'Problem Significance', key: 'b9_significance' },
  { number: '10', title: 'Solution Effectiveness', key: 'b10_solution' },
];

const EXPORT_FIELDS = [
  ['Finding', 'finding'],
  ['Root Cause & Resolution', 'rootCause'],
  ['Action Taken', 'actionTaken'],
  ['General Notes', 'generalNotes'],
];

// Blank lines in a stored field are real paragraph breaks in the document.
function Prose({ text }) {
  const paragraphs = String(text || '')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (paragraphs.length === 0) return <p className="print-empty">Not recorded.</p>;
  return paragraphs.map((p, i) => (
    <p key={i} className="print-body">
      {p.split('\n').map((linePart, j, all) => (
        <span key={j}>
          {linePart}
          {j < all.length - 1 && <br />}
        </span>
      ))}
    </p>
  ));
}

function Numbered({ number, title, children }) {
  return (
    <section className="print-section">
      <h3 className="print-heading">
        <span className="print-number">{number}.</span> {title}
      </h3>
      {children}
    </section>
  );
}

function ResultTable({ type, results }) {
  if (results.length === 0) return null;
  const { columns, rows } = printResultRows(type, results);
  const notes = results.map((r) => (r.fields?.note || '').trim()).filter(Boolean);
  return (
    <>
      <table className="print-table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {notes.length > 0 && (
        <div className="print-notes">
          {notes.map((n, i) => (
            <p key={i} className="print-note">
              {n}
            </p>
          ))}
        </div>
      )}
    </>
  );
}

// The document itself, separate from how it gets mounted — so it can be
// rendered and inspected without a DOM.
// Section D is deliberately absent: it is ONE shared answer for the whole
// submission, so printing it inside a per-initiative record repeated the same
// three narratives on every initiative's PDF. It belongs to the submission, not
// to this document.
export function PrintDocument({ initiative, results, answers, notApplicable, exportFields }) {
  const generated = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const fields = exportFields || {};

  return (
    <article className="print-doc" role="document">
      <header className="print-cover">
        <p className="print-org">United Ceres College</p>
        <p className="print-kicker">IMDA SME AI Impact Awards 2026 — Evidence Record</p>
        <h1 className="print-title">{initiative.name?.trim() || 'Untitled initiative'}</h1>
        <dl className="print-meta">
          <div>
            <dt>Department</dt>
            <dd>{initiative.department?.trim() || 'Not set'}</dd>
          </div>
          <div>
            <dt>Generated</dt>
            <dd>{generated}</dd>
          </div>
        </dl>
      </header>

      <h2 className="print-section-title">Section B — Impact and Value Add of AI</h2>
      {SECTION_B.map(({ number, title, key }) => (
        <Numbered key={number} number={number} title={title}>
          <Prose text={initiative[key]} />
        </Numbered>
      ))}

      <h2 className="print-section-title">Section C — Measurable Results</h2>
      {SECTION_C.map(({ qid, type, number, title }) => {
        const linked = results.filter((r) => (r.type || 'productivity') === type);
        const na = notApplicable?.[qid] === true;
        return (
          <Numbered key={qid} number={number} title={title}>
            {na ? (
              <p className="print-empty">Not applicable to this initiative.</p>
            ) : (
              <>
                {/* The generated answer is the form-ready text, so it leads. */}
                <Prose text={answers?.[qid]} />
                <ResultTable type={type} results={linked} />
                {linked.length === 0 && <p className="print-empty">No measurable results recorded.</p>}
              </>
            )}
          </Numbered>
        );
      })}

      <h2 className="print-section-title">Export — ERPNext Quality Action Resolution</h2>
      {EXPORT_FIELDS.map(([label, key]) => (
        <section key={key} className="print-section">
          <h3 className="print-heading">{label}</h3>
          <Prose text={fields[key]} />
        </section>
      ))}

    </article>
  );
}

// One or more documents plus a single footer. The footer is position:fixed so
// the browser repeats it on every page — rendering one per document would stack
// N identical copies in the same spot.
function PrintSheet({ items }) {
  return (
    <div className="print-sheet">
      {items.map((item) => (
        <PrintDocument key={item.initiative.id} {...item} />
      ))}
      <footer className="print-footer">United Ceres College — Confidential</footer>
    </div>
  );
}

// Portals to <body> so the sheet sits outside #root — print.css then hides
// #root entirely, guaranteeing no app chrome can leak into the output.
// Takes either one initiative's props, or `items` for a multi-initiative print.
export default function PrintView({ items, ...single }) {
  return createPortal(<PrintSheet items={items || [single]} />, document.body);
}

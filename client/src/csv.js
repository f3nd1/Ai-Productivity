// Shared CSV building, used by the Overview export and the Figures Table export.
// Everything is quoted so commas, quotes and newlines inside values (initiative
// names, cost categories) can't break the row structure. CRLF because that's
// what Excel expects.
const csvCell = (value) => `"${(value == null ? '' : String(value)).replaceAll('"', '""')}"`;

export function toCsv(headers, rows) {
  return [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
}

// Triggers a browser download. The BOM makes Excel read it as UTF-8 rather than
// mangling the £/$ and any non-ASCII in initiative names.
export function downloadCsv(filename, csv) {
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

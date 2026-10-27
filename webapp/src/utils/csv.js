// Builds a CSV file in the browser and downloads it (no backend change needed).
// Cells starting with = + - @ are prefixed with ' so Excel never runs them as formulas.
function cell(value) {
  if (value === null || value === undefined) return '';
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function downloadCsv(filename, columns, rows) {
  const lines = [columns.map((c) => cell(c.label)).join(',')];
  rows.forEach((row) => lines.push(columns.map((c) => cell(typeof c.value === 'function' ? c.value(row) : row[c.value])).join(',')));
  // BOM so Excel opens accents (e.g. "Raffles'") correctly
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export type CsvCell = string | number | boolean | null | undefined;

export const UTF8_BOM = '\uFEFF';

// Leading whitespace/tabs/CR followed by spreadsheet formula trigger chars (=, +, -, @) or raw tab/CR
const FORMULA_TRIGGER_RE = /^[\s\t\r]*[=+\-@]|^[\t\r]/;
const NEEDS_QUOTING_RE = /[",\r\n]/;

export function sanitizeCsvCell(value: CsvCell): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : '';
  }
  if (typeof value === 'boolean') {
    return value ? 'Evet' : 'Hayır';
  }

  let text = value.replace(/\0/g, '');
  if (FORMULA_TRIGGER_RE.test(text)) {
    text = `'${text}`;
  }

  if (NEEDS_QUOTING_RE.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function buildCsv(
  headers: readonly string[],
  rows: readonly (readonly CsvCell[])[],
): string {
  const lines = [
    headers.map(sanitizeCsvCell).join(','),
    ...rows.map((row) => row.map(sanitizeCsvCell).join(',')),
  ];
  return `${UTF8_BOM}${lines.join('\r\n')}\r\n`;
}

export function formatMicronutrientsForCsv(micros: Record<string, number>): string {
  const entries = Object.entries(micros).filter(([, amount]) => amount > 0);
  if (entries.length === 0) return '';
  return entries.map(([key, amount]) => `${key}:${amount}`).join('; ');
}

// CSV export helper for admin tables.
// Safely escapes values, prefixes formula-injection-prone cells, and triggers a browser download.

type Primitive = string | number | boolean | null | undefined;
type Row = Record<string, unknown>;

function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let str: string;
  if (value instanceof Date) {
    str = value.toISOString();
  } else if (typeof value === "object") {
    try {
      str = JSON.stringify(value);
    } catch {
      str = String(value);
    }
  } else {
    str = String(value);
  }
  // Mitigate CSV formula injection in spreadsheet apps
  if (/^[=+\-@\t\r]/.test(str)) str = "'" + str;
  // Escape quotes and wrap if needed
  if (/[",\n\r]/.test(str)) {
    str = `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export interface CsvColumn<T> {
  header: string;
  /** Either a key name on the row or a function returning the value. */
  value: keyof T | ((row: T) => Primitive | Date | object);
}

export function rowsToCsv<T extends Row>(rows: T[], columns: CsvColumn<T>[]): string {
  const head = columns.map((c) => escapeCell(c.header)).join(",");
  const body = rows
    .map((row) =>
      columns
        .map((col) => {
          const raw = typeof col.value === "function" ? col.value(row) : (row as any)[col.value];
          return escapeCell(raw);
        })
        .join(","),
    )
    .join("\n");
  // BOM ensures Excel reads UTF-8 correctly
  return "\uFEFF" + head + "\n" + body;
}

export function downloadCsv<T extends Row>(filename: string, rows: T[], columns: CsvColumn<T>[]): void {
  const csv = rowsToCsv(rows, columns);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = filename.endsWith(".csv") ? filename : `${filename}_${stamp}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

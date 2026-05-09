import { describe, expect, it } from "vitest";
import { rowsToCsv, type CsvColumn } from "./csv-export";

interface Row {
  name: string;
  total: number;
  note: string | null;
  created: Date;
}

const columns: CsvColumn<Row>[] = [
  { header: "Name", value: "name" },
  { header: "Total", value: "total" },
  { header: "Note", value: "note" },
  { header: "Created", value: (r) => r.created },
];

describe("rowsToCsv", () => {
  it("emits a UTF-8 BOM and header row", () => {
    const csv = rowsToCsv([], columns);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain("Name,Total,Note,Created");
  });

  it("escapes quotes, commas and newlines", () => {
    const csv = rowsToCsv(
      [{ name: 'A "quoted", val', total: 10, note: "line1\nline2", created: new Date("2026-01-01T00:00:00Z") }],
      columns,
    );
    expect(csv).toContain('"A ""quoted"", val"');
    expect(csv).toContain('"line1\nline2"');
    expect(csv).toContain("2026-01-01T00:00:00.000Z");
  });

  it("mitigates formula injection with a leading apostrophe", () => {
    const csv = rowsToCsv(
      [{ name: "=SUM(A1:A2)", total: 0, note: "+danger", created: new Date(0) }],
      columns,
    );
    expect(csv).toContain("'=SUM(A1:A2)");
    expect(csv).toContain("'+danger");
  });

  it("renders null/undefined as empty cells", () => {
    const csv = rowsToCsv(
      [{ name: "x", total: 1, note: null, created: new Date(0) }],
      columns,
    );
    const dataRow = csv.split("\n")[1];
    expect(dataRow.split(",")[2]).toBe("");
  });
});

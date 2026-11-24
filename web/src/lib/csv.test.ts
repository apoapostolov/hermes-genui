// CSV is the table block's own data told the way every spreadsheet reads it (RFC 4180): CRLF between records,
// and a cell quoted exactly when it cannot travel plain — when it holds a comma, a double quote, or a line break —
// with each inner quote doubled. The reader's view (filter box, sort order, ticks) is state on the page; the export
// is the stored table: headers first, then every row in the order it was saved.
import { describe, expect, it } from "vitest";
import { csvCell, csvOf } from "./csv";

/** A reader for the round-trip, exactly as RFC 4180 says: bare or quoted cells, doubled quotes, records
 *  ended by CRLF (or a bare LF or CR, which real files carry too). Lives here, not in the shipped module:
 *  the export writes, and only the test needs to read. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let i = 0;
  while (i < text.length) {
    if (text[i] === '"') {
      let value = "";
      for (i++; i < text.length; i++) {
        if (text[i] === '"') {
          if (text[i + 1] === '"') { value += '"'; i++; } else break;
        } else value += text[i];
      }
      i++;  // the closing quote
      row.push(value);
    } else {
      let j = i;
      while (j < text.length && text[j] !== "," && text[j] !== "\r" && text[j] !== "\n") j++;
      row.push(text.slice(i, j));
      i = j;
    }
    if (i < text.length && text[i] === ",") { i++; continue; }
    if (text[i] === "\r") i += text[i + 1] === "\n" ? 2 : 1;
    else if (text[i] === "\n") i += 1;
    rows.push(row);
    row = [];
  }
  if (i === text.length && text.length > 0 && !/[\r\n]$/.test(text)) rows.push(row);
  return rows;
}

describe("csvCell", () => {
  it("leaves plain words bare", () => {
    expect(csvCell("Pixel")).toBe("Pixel");
    expect(csvCell("")).toBe("");
  });
  it("quotes the cells that cannot travel bare", () => {
    expect(csvCell("₹42,999")).toBe('"₹42,999"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("two\nlines")).toBe('"two\nlines"');
    expect(csvCell("two\r\nlines")).toBe('"two\r\nlines"');
  });
});

describe("csvOf", () => {
  it("writes headers first, then every row, one record per line with CRLF", () => {
    expect(csvOf(["Phone", "Price"], [["Pixel", "₹44,999"], ["Galaxy", "₹42,999"]])).toBe(
      "Phone,Price\r\nPixel,\"₹44,999\"\r\nGalaxy,\"₹42,999\"\r\n",
    );
  });
  it("keeps empty cells as empty fields, never as nothing", () => {
    expect(csvOf(["A", "B", "C"], [["x", "", "z"]])).toBe("A,B,C\r\nx,,z\r\n");
  });
  it("survives the nastiest words: quotes, commas, newlines and unicode, in every position", () => {
    const rows = [['He said "ok, sure"', "a\r\nb", "— dash ₹ —"]];
    expect(parseCsv(csvOf(["q", "n", "u"], rows))).toEqual([["q", "n", "u"], ...rows]);
  });
});

describe("round trips", () => {
  it("a table written out reads back as the same table, cell for cell", () => {
    const columns = ["Plan", "Cost", "Notes"];
    const rows = [
      ["Kyoto", "₹120,000", 'includes "three" hotels, two trains'],
      ["Osaka", "", "day\ntrip to Nara"],
      ["Nara", "free", "deer\r\n"],
    ];
    expect(parseCsv(csvOf(columns, rows))).toEqual([columns, ...rows]);
  });
});

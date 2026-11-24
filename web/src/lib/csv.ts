// CSV: the table block's own data, told the way every spreadsheet reads it (RFC 4180). A cell is quoted exactly
// when it cannot travel bare — it holds a comma, a double quote or a line break — and a doubled "" keeps every
// quote inside. Records end CRLF, including the last, as the spec says. No dependency, no parsing: a writer.
/** One cell, quoted only where bare text could not hold it together. */
export function csvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

/** A whole table: headers first, then every row in the order it was stored, one CRLF-terminated record each. */
export function csvOf(headers: string[], rows: string[][]): string {
  return [headers, ...rows].map((line) => line.map(csvCell).join(",") + "\r\n").join("");
}

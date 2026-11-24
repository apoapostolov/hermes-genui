import { describe, expect, it, vi } from "vitest";
import { livePicks, pickedMessage, rowHaystack, rowKey, rowMatches, selectedRows } from "./pick";
import type { StructuredRow, TableColumn, TableSource } from "./read";
import { pinLocale } from "../../lib/locale.testing";

const COLUMNS: TableColumn[] = [
  { id: "shop", label: "Shop", kind: "text" },
  { id: "spend", label: "Spend", kind: "currency", unit: "$" },
  { id: "from", label: "From", kind: "sources" },
];

const row = (shop: string, spend: number, sources: TableSource[] = []): StructuredRow => ({
  cells: { shop: { text: shop }, spend: { text: String(spend), value: spend } },
  sources,
});

const A = row("A", 1200, [{ label: "POS", url: "https://example.org/a" }]);
const B = row("B", 1800, [{ label: "Manual" }]);
const C = row("C", 900);

describe("rowMatches", () => {
  it("keeps every row on an empty or blank-only query", () => {
    expect(rowMatches(A, COLUMNS, "")).toBe(true);
    expect(rowMatches(A, COLUMNS, "   ")).toBe(true);
  });

  it("finds a word in a cell, whatever its case", () => {
    expect(rowMatches(A, COLUMNS, "a")).toBe(true);
    expect(rowMatches(B, COLUMNS, "B")).toBe(true);
    expect(rowMatches(C, COLUMNS, "zzz")).toBe(false);
  });

  it("finds a number that exists only as a value, and one that reads with a currency", () => {
    pinLocale("en-US");
    const typed: StructuredRow = { cells: { spend: { text: "", value: 44999 } }, sources: [] };
    expect(rowMatches(typed, COLUMNS, "44999")).toBe(true); // the number itself
    expect(rowMatches(typed, COLUMNS, "44,999")).toBe(true); // what the cell reads as
    vi.restoreAllMocks();
  });

  it("finds a source by its name, whether or not the table has a sources column", () => {
    expect(rowMatches(A, COLUMNS, "pos")).toBe(true);
    expect(rowMatches(B, COLUMNS, "Manual")).toBe(true);
    expect(rowHaystack(A, COLUMNS)).toContain("POS");
  });
});

describe("rowKey", () => {
  it("is the row's data, not its seat: the same data anywhere carries the same key", () => {
    expect(rowKey(B, COLUMNS)).toBe(rowKey(row("B", 1800, [{ label: "Manual" }]), COLUMNS));
    expect(rowKey(B, COLUMNS)).not.toBe(rowKey(C, COLUMNS));
  });

  it("carries the row's sources, so a renamed source is different data", () => {
    expect(rowKey(A, COLUMNS)).not.toBe(rowKey(row("A", 1200), COLUMNS));
  });

  it("leaves tone out: a re-toned cell is the same fact and must not drop a tick", () => {
    const plain = row("D", 500);
    const toned: StructuredRow = { cells: { ...plain.cells, shop: { text: "D", tone: "accent" } }, sources: [] };
    expect(rowKey(toned, COLUMNS)).toBe(rowKey(plain, COLUMNS));
  });
});

describe("livePicks", () => {
  it("discards a key whose row left the source: removal is real, not hiding", () => {
    expect(livePicks([A, C], COLUMNS, [rowKey(B, COLUMNS)])).toEqual([]);
    expect(livePicks([A, row("B2", 1800)], COLUMNS, [rowKey(B, COLUMNS)])).toEqual([]); // replaced
    expect(livePicks([], COLUMNS, [rowKey(B, COLUMNS)])).toEqual([]); // board emptied
  });

  it("gone once means gone: identical data reappearing later cannot resurrect an old tick", () => {
    const afterRemoval = livePicks([A], COLUMNS, livePicks([A, B], COLUMNS, [rowKey(B, COLUMNS)]));
    expect(afterRemoval).toEqual([]);
    expect(livePicks([A, B], COLUMNS, afterRemoval)).toEqual([]); // B is back; the dead key stays dead
  });

  it("unchanged or reordered data keeps every tick, in hand order", () => {
    expect(livePicks([A, B, C], COLUMNS, [rowKey(B, COLUMNS), rowKey(A, COLUMNS)]))
      .toEqual([rowKey(B, COLUMNS), rowKey(A, COLUMNS)]);
    expect(livePicks([C, A, B], COLUMNS, [rowKey(B, COLUMNS), rowKey(A, COLUMNS)]))
      .toEqual([rowKey(B, COLUMNS), rowKey(A, COLUMNS)]);
    expect(livePicks([A, B, C], COLUMNS, [])).toEqual([]);
  });
});

describe("selectedRows", () => {
  it("answers the ticked rows in board order, wherever the reader ticked them", () => {
    expect(selectedRows([A, B, C], COLUMNS, [rowKey(C, COLUMNS), rowKey(A, COLUMNS)])).toEqual([A, C]);
  });

  it("a key whose row is gone contributes nothing, silently and safely", () => {
    expect(selectedRows([A, C], COLUMNS, [rowKey(B, COLUMNS)])).toEqual([]);
  });
});

describe("pickedMessage", () => {
  it("sends the caption, the column labels once, then each ticked row in order", () => {
    pinLocale("en-US");
    expect(pickedMessage("Spend", COLUMNS, [A, B, C], [rowKey(C, COLUMNS), rowKey(A, COLUMNS)])).toBe(
      "Spend:\nShop | Spend | From\nA | $1,200 | POS\nC | $900 | –",
    );
    vi.restoreAllMocks();
  });

  it("says where the rows come from when there is no caption", () => {
    pinLocale("en-US");
    expect(pickedMessage(undefined, COLUMNS, [A, B], [rowKey(B, COLUMNS)])).toBe(
      "Table:\nShop | Spend | From\nB | $1,800 | Manual",
    );
    vi.restoreAllMocks();
  });

  it("names a row's sources after its cells when the table has no sources column", () => {
    pinLocale("en-US");
    const columns = COLUMNS.filter((c) => c.kind !== "sources");
    expect(pickedMessage("Spend", columns, [A], [rowKey(A, columns)])).toBe(
      "Spend:\nShop | Spend\nA | $1,200 | [POS]",
    );
    vi.restoreAllMocks();
  });

  it("a tick whose row is gone adds nothing: it never throws and never misselects", () => {
    pinLocale("en-US");
    const stale = rowKey(B, COLUMNS);
    expect(() => pickedMessage("Spend", COLUMNS, [A], [stale])).not.toThrow();
    expect(pickedMessage("Spend", COLUMNS, [A], [stale])).toBe("Spend:\nShop | Spend | From");
    vi.restoreAllMocks();
  });

  it("reads a text cell as written and a missing cell as a dash, like the drawing does", () => {
    const ragged: StructuredRow = { cells: { shop: { text: "Only the name" } }, sources: [] };
    expect(pickedMessage("Spend", COLUMNS, [ragged], [rowKey(ragged, COLUMNS)])).toBe(
      "Spend:\nShop | Spend | From\nOnly the name | – | –",
    );
  });
});

import { describe, expect, it } from "vitest";
import { livePicks, pickedMessage, rowKey, rowMatches, selectedRows } from "./pick";

describe("rowMatches", () => {
  it("shows every row on an empty or blank-only query", () => {
    expect(rowMatches(["Pixel 10a", "₹44,999"], "")).toBe(true);
    expect(rowMatches(["Pixel 10a"], "   ")).toBe(true);
  });
  it("finds a word in any cell, whatever its case", () => {
    const row = ["Pixel 10a", "₹44,999", "Great camera"];
    expect(rowMatches(row, "pixel")).toBe(true);
    expect(rowMatches(row, "10A")).toBe(true);
    expect(rowMatches(row, "44,999")).toBe(true);
    expect(rowMatches(row, "camera")).toBe(true);
    expect(rowMatches(row, "galaxy")).toBe(false);
  });
});

describe("pickedMessage", () => {
  const columns = ["Phone", "Price", "Camera"];
  const rows = [
    ["Pixel 10a", "₹44,999", "Great"],
    ["Nothing 4", "₹39,999", "OK"],
    ["Galaxy A56", "₹42,999", "Fine"],
  ];

  it("sends the caption, the column names and the chosen rows in order", () => {
    expect(pickedMessage("Phones under ₹50k", columns, rows, [rowKey(rows[2]), rowKey(rows[0])])).toBe(
      "Phones under ₹50k:\nPhone | Price | Camera\nPixel 10a | ₹44,999 | Great\nGalaxy A56 | ₹42,999 | Fine",
    );
  });
  it("says where the rows come from when there is no caption", () => {
    expect(pickedMessage(undefined, columns, rows, [rowKey(rows[1])])).toBe(
      "Table:\nPhone | Price | Camera\nNothing 4 | ₹39,999 | OK",
    );
  });
  it("a key whose row is gone adds nothing — it never throws and never misselects", () => {
    const stale = rowKey(rows[1]);
    const shrunk = [rows[0], rows[2]]; // the picked row was removed upstream
    expect(() => pickedMessage("Phones", columns, shrunk, [stale])).not.toThrow();
    expect(pickedMessage("Phones", columns, shrunk, [stale])).toBe("Phones:\nPhone | Price | Camera");
    expect(selectedRows(shrunk, [stale])).toEqual([]);
  });
  it("a replaced row does not inherit the old key: the new data is never sent", () => {
    const old = rowKey(rows[1]);
    const moved = [rows[0], ["Galaxy S26", "₹71,999", "Zoom"], rows[2]]; // seat 1 holds different data
    expect(selectedRows(moved, [old])).toEqual([]);
    expect(pickedMessage("Phones", columns, moved, [old])).toBe("Phones:\nPhone | Price | Camera");
  });
  it("rowKey is data, not position: the same row anywhere carries the same key", () => {
    expect(rowKey(rows[1])).toBe(rowKey(["Nothing 4", "₹39,999", "OK"]));
    expect(rowKey(rows[1])).not.toBe(rowKey(["Nothing 4", "₹39,999", "OK "]));
    expect(selectedRows([rows[2], rows[1], rows[0]], [rowKey(rows[1])])).toEqual([rows[1]]);
  });
});

describe("livePicks", () => {
  const A = ["Pixel 10a", "₹44,999", "Great"];
  const B = ["Nothing 4", "₹39,999", "OK"];
  const C = ["Galaxy A56", "₹42,999", "Fine"];
  it("discards a key whose row left the source — removal is real, not hiding", () => {
    expect(livePicks([A, C], [rowKey(B)])).toEqual([]);
    expect(livePicks([A, ["Galaxy S26", "₹71,999", "Zoom"]], [rowKey(B)])).toEqual([]); // replaced
    expect(livePicks([], [rowKey(B)])).toEqual([]); // board emptied
  });
  it("gone once means gone: reappearing identical data cannot resurrect an old tick", () => {
    const afterRemoval = livePicks([A], livePicks([A, B], [rowKey(B)])); // pick B, then lose it
    expect(afterRemoval).toEqual([]);
    expect(livePicks([A, B], afterRemoval)).toEqual([]); // B is back — the dead key stays dead
  });
  it("unchanged or reordered data keeps every pick, in hand order", () => {
    expect(livePicks([A, B, C], [rowKey(B), rowKey(A)])).toEqual([rowKey(B), rowKey(A)]);
    expect(livePicks([C, A, B], [rowKey(B), rowKey(A)])).toEqual([rowKey(B), rowKey(A)]);
    expect(livePicks([A, B, C], [])).toEqual([]);
  });
});

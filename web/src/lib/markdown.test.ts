// The parity contract for the host-side Markdown (t_bff8178a round 2, F1): web/src/lib/markdown.ts says EXACTLY
// what hooks/text_fallback.py says about the same stored blocks. The golden file web/src/lib/markdown.corpus.json
// is written by the REAL Python serializer (tests/hooks/test_export_markdown_corpus.py regenerates it
// deliberately); every case here is asserted against it. On top of the corpus, the number-format edge cases that
// decide whole bytes are pinned directly, because they are where two ports of one function actually diverge.
import { describe, expect, it } from "vitest";
import { blocksAsMarkdown, fmtNum, safeText, safeUrl, mdEscape, roundHalfEven, chartKind, arithmetic } from "./markdown";
import corpus from "./markdown.corpus.json";

type Case = { name: string; blocks: unknown[]; expected: string };

describe("markdown: the host twin of the chat serializer (corpus)", () => {
  for (const entry of corpus as Case[]) {
    it(entry.name, () => {
      expect(blocksAsMarkdown(entry.blocks)).toBe(entry.expected);
    });
  }
});

describe("fmt_num: Python's formats, digit for digit", () => {
  const cases: [number, string][] = [
    [72275, "72,275"], [18.6, "18.6"], [7200.0, "7,200"], [1234.5678, "1,234.57"],
    [0.004567, "0.00457"], [2.675, "2.67"], [0.125, "0.125"], [0.375, "0.375"],
    [0.0001, "0.0001"], [1e-5, "1e-05"], [-1e-5, "-1e-05"],
    [0.99999, "1"], [-0.001, "-0.001"], [7.5, "7.5"], [0.5, "0.5"], [1234567, "1,234,567"],
    [-1234.5678, "-1,234.57"], [1e15, "1,000,000,000,000,000"], [0, "0"], [-0, "0"],
    [0.0000125, "1.25e-05"],
    [Number.NaN, ""], [Number.POSITIVE_INFINITY, ""],
  ];
  for (const [value, want] of cases) {
    it(`${value} → ${want}`, () => {
      expect(fmtNum(value)).toBe(want);
    });
  }
});

describe("round_half_even: Python's round, not JS's", () => {
  it("ties go to the even side and binary fuzz stays nearest", () => {
    expect(roundHalfEven(12.5, 0)).toBe(12);
    expect(roundHalfEven(13.5, 0)).toBe(14);
    expect(roundHalfEven(2.675, 2)).toBe(2.67);   // the exact value is 2.67499999…
    expect(roundHalfEven(0.125, 2)).toBe(0.12);
    expect(roundHalfEven(0.375, 2)).toBe(0.38);
  });
});

describe("safe_text / safe_url: the same caps, escapes and refusals", () => {
  it("caps at the limit minus one plus an ellipsis, escapes marks, strips control", () => {
    expect(safeText("x".repeat(400))).toBe(`${"x".repeat(299)}…`);
    expect(safeText("a\x1b[31mb")).toBe("a\\[31mb");
    expect(safeText("one\ntwo")).toBe("one two");
    expect(safeText("one\ntwo", 300, false)).toBe("one\ntwo");
    expect(safeText("tab\there")).toBe("tab here");
    expect(safeText(72275)).toBe("72,275");
    expect(safeText(true)).toBe("");
  });
  it("urls: only http(s), percented, capped", () => {
    expect(safeUrl("https://a.org/a b)(c")).toBe("https://a.org/a%20b%29%28c");
    expect(safeUrl("javascript:alert(1)")).toBe("");
    expect(safeUrl("http://x.org", true)).toBe("");
    expect(safeUrl("h".repeat(500) + "://x")).toBe("");
  });
  it("md_escape touches only link, image, HTML and backslash marks", () => {
    expect(mdEscape("Revenue (Q3) rose!")).toBe("Revenue (Q3) rose!");
    expect(mdEscape("<b>")).toBe("\\<b\\>");
  });
});

describe("arithmetic: the same grammar text_fallback's calculator words trust", () => {
  const names = new Map<string, number>([["x", 1], ["p", 4000000], ["r", 8.5], ["n", 20]]);
  it("works out the simple ones", () => {
    expect(arithmetic("2 + 3 * (4 - 1) / 2", new Map())).toBe(6.5);
    expect(arithmetic("-x + 1.5", names)).toBe(0.5);
  });
  it("refuses what text_fallback refuses, exactly", () => {
    expect(arithmetic("emi(p, r, n)", names)).toBeNull();     // helpers play in Hermes Desktop
    expect(arithmetic("x y", names)).toBeNull();
    expect(arithmetic("1 / 0", new Map())).toBeNull();
    expect(arithmetic("1.1 ^ 2", new Map())).toBeNull();      // powers are not the calculator's text grammar
    expect(arithmetic("1.1 ^ 2", new Map(), true)).toBeCloseTo(1.21);
    expect(arithmetic("(0) ^ 0.5", new Map())).toBeNull();
    expect(arithmetic("p > 1", names)).toBeNull();            // comparisons are not arithmetic here either
    expect(arithmetic("x" + " + ".repeat(100) + "1", new Map())).toBeNull(); // beyond the 300-char formula cap
  });
});

describe("chart_kind: the same lenient word", () => {
  it("normalizes and aliases like the drawing side", () => {
    expect(chartKind("Donut")).toBe("donut");
    expect(chartKind("stacked_bar")).toBe("stacked");
    expect(chartKind("waterfall")).toBe("waterfall");     // #34's kind
    expect(chartKind("hist")).toBe("histogram");          // #35's kind, aliased exactly as chart.py does
    expect(chartKind("rangebar")).toBe("range");          // #35's other kind and its aliases
    expect(chartKind("floatingbar")).toBe("range");
    expect(chartKind("constructor")).toBe("line");   // a prototype name is still not a kind
    expect(chartKind(null)).toBe("line");
  });
});

describe("the walk itself", () => {
  it("a non-list is not a board", () => {
    expect(blocksAsMarkdown("plan")).toBe("");
    expect(blocksAsMarkdown(null)).toBe("");
  });
});

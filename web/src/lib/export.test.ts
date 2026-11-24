// The host's export acts, apart from any click: what a chart's PNG is built from, how the files read, where the
// bytes go. Canvas pixels belong to real Chrome (tests/test_export_chrome.py); these pin everything the act
// computes BEFORE a single pixel is painted — the caption lines it composites (with the provenance line that now
// travels), the geometry it sizes the canvas with, the OPAQUE backdrop it fills first, the rebuilt horizontal-bar
// picture, the file text, the name — and the CSV comment header provenance rides in. No door is asked anywhere:
// fetchBoardExport left with the rework, and these functions take the page's own memory as arguments.
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  captionLines, chartFileBase, fileBase, hbarSvg, jsonFile, LINE_GAP, LINE_RATIO, markdownFile,
  measureLine, opaqueBackdrop, over, parseColour, PNG_PAD, pngMetrics, saveBlob, serializeSvg, tableCsvBlob,
} from "./export";
import { provenanceOf } from "../core/provenance";
import type { Block } from "../registry";
import type { ChartSpec } from "../blocks/chart/chartData";

const chart = (src?: string) => ({ type: "chart", spec: { type: "line", x: ["a"], series: [{ data: [1] }], ...(src ? { source: src } : {}) } } as Block);

function fixture(html: string): HTMLElement {
  const host = document.createElement("div");
  host.innerHTML = html;
  return host;
}

// The XY chart's own DOM (blocks/chart/Chart.tsx + Legend.tsx), class for class.
const XY_FIGURE = `
<figure class="hb-card hb-chart">
  <figcaption class="hb-chart-head"><span class="hb-chart-title">Revenue</span><span class="hb-chip">▲ 4.2%</span></figcaption>
  <div class="hb-chart-figure"><span class="hb-chart-big">$9,800</span><span class="hb-chart-at"></span></div>
  <div class="hb-chart-plot"><svg width="100%" height="220" viewBox="0 0 660 220"><g></g></svg></div>
  <div class="hb-legend">
    <span class="hb-legend-item"><i class="hb-legend-dot" style="background: rgb(47, 111, 237)"></i>Ads<span class="hb-legend-value">$4,000</span></span>
    <span class="hb-legend-item"><i class="hb-legend-dot" style="background: rgb(222, 127, 56)"></i>Organic</span>
  </div>
  <div class="hb-chart-source">Finance board</div>
</figure>`;

// The pie's own DOM (blocks/chart/PieChart.tsx): its legend is a table, not a row of items.
const PIE_FIGURE = `
<figure class="hb-card hb-chart hb-pie">
  <figcaption class="hb-chart-title">Shares</figcaption>
  <div class="hb-pie-body"><svg class="hb-pie-svg" width="240" height="240"></svg>
    <table class="hb-pie-legend"><tbody>
      <tr><td class="hb-pie-swatch"><i style="background: rgb(1, 2, 3)"></i></td><td class="hb-pie-name">Ads</td><td class="hb-pie-value">40%</td></tr>
    </tbody></table>
  </div>
</figure>`;

describe("captionLines", () => {
  it("reads the chart's own words, in the order they sit: title, figure, legend (each item a line), source", () => {
    const lines = captionLines(fixture(XY_FIGURE));
    expect(lines.map((l) => l.text)).toEqual(["Revenue", "$9,800", "Ads $4,000", "Organic", "Finance board"]);
    expect(lines[2].swatch).toBe("rgb(47, 111, 237)");
    expect(lines[3].swatch).toBe("rgb(222, 127, 56)");
    expect(lines[0].size).toBeGreaterThan(0);   // the real computed size, not a guess
    expect(lines[0].font).toContain("px");
    expect(lines[0].colour).toMatch(/rgb/);
  });
  it("a pie's legend rows are lines too, with their swatches", () => {
    const lines = captionLines(fixture(PIE_FIGURE));
    expect(lines.map((l) => l.text)).toEqual(["Shares", "Ads 40%"]);
    expect(lines[1].swatch).toBe("rgb(1, 2, 3)");
  });
  it("a bare drawing has no lines to composite", () => {
    expect(captionLines(fixture("<div><svg></svg></div>"))).toEqual([]);
  });
  it("the board's provenance line rides last, in the source line's voice", () => {
    const lines = captionLines(fixture(XY_FIGURE), "Trip ledger · as of 2026-11-18 · Snapshot");
    expect(lines.map((l) => l.text)).toEqual([
      "Revenue", "$9,800", "Ads $4,000", "Organic", "Finance board", "Trip ledger · as of 2026-11-18 · Snapshot",
    ]);
    expect(lines[5].font).toBe(lines[4].font);   // the same voice the figure already speaks
  });
  it("a provenance line already said by the figure's own source is not said twice", () => {
    const lines = captionLines(fixture(XY_FIGURE), "Finance board");
    expect(lines.map((l) => l.text).filter((t) => t === "Finance board")).toHaveLength(1);
  });
  it("an empty provenance adds no line", () => {
    expect(captionLines(fixture(XY_FIGURE), "").map((l) => l.text)).toEqual([
      "Revenue", "$9,800", "Ads $4,000", "Organic", "Finance board",
    ]);
  });
});

describe("pngMetrics", () => {
  it("sizes the canvas around the drawing and the widest line, pad on every side", () => {
    const lines = [
      { text: "A", font: "12px x", colour: "#000", size: 12 },
      { text: "BB", font: "16px x", colour: "#000", size: 16, swatch: "#f00" },
    ];
    const m = pngMetrics(lines, (l) => (l.swatch ? 100 : 60), 300, 200);
    expect(m.width).toBe(300 + PNG_PAD * 2);                       // the drawing is wider than any line
    const wide = pngMetrics(lines, (l) => (l.swatch ? 900 : 60), 300, 200);
    expect(wide.width).toBe(900 + measureLine(lines[1]) + PNG_PAD * 2);  // a long word grows the canvas, never clips
    expect(m.height).toBe(Math.round(200 + 12 * LINE_RATIO + 16 * LINE_RATIO + LINE_GAP + PNG_PAD * 2));
    expect(pngMetrics([], () => 0, 300, 200)).toEqual({ width: 300 + PNG_PAD * 2, height: 200 + PNG_PAD * 2 });
  });
});

describe("the backdrop an export paints first is OPAQUE, always", () => {
  it("parses the browser's own colour answers", () => {
    expect(parseColour("rgb(1, 2, 3)")).toEqual([1, 2, 3, 1]);
    expect(parseColour("rgba(32, 32, 32, 0.08)")).toEqual([32, 32, 32, 0.08]);
    expect(parseColour("transparent")).toBeNull();
  });
  it("composites source-over the way the page does", () => {
    expect(over([0, 0, 0, 0.5], [255, 255, 255])).toEqual([128, 128, 128]);
    expect(over([10, 20, 30, 1], [99, 99, 99])).toEqual([10, 20, 30]);   // an opaque layer covers everything
  });
  it("walks up from the drawing to the first solid ground and composites every wash in between", () => {
    const host = fixture('<div style="background-color: rgb(240, 240, 240)"><div style="background-color: rgba(0, 0, 0, 0.5)"><div id="card"></div></div></div>');
    expect(opaqueBackdrop(host.querySelector("#card") as HTMLElement)).toEqual([120, 120, 120]);
  });
  it("a fully translucent chain still lands on solid white, never on a transparent canvas", () => {
    const host = fixture('<div style="background-color: rgba(255, 0, 0, 0.3)"><div id="card"></div></div>');
    const [r, g, b] = opaqueBackdrop(host.querySelector("#card") as HTMLElement);
    expect([r, g, b]).toEqual([255, 179, 179]);   // 0.3 over the white ground (0.7 × 255 = 178.5, half up)
  });
});

describe("hbarSvg: the DOM-drawn bars rebuilt as a picture MEASURED from the drawing's own layout", () => {
  // The hbar DOM HBarChart.tsx draws, class for class. Every box the picture reads carries its laid-out rect in
  // PAGE coordinates (data-box="left,top,width,height"); the rebuilt picture must place every bar, zero line and
  // word at exactly that rect minus the box origin. This is the layout Chrome measured on the shipped drawing
  // (rows at y 0/25/50, bars landing at 1.5/26.5/51.5) — the coordinates the formula-derived rebuild got wrong
  // (middle bar printed at 52, the last at 102 over an image 66 tall; every series' word at one spot).
  type Row = { label: string; values: string[]; bars: string[]; zero?: string };
  const BOX = [10, 20, 686, 67];
  const laid = (rows: Row[]) => {
    const html = `
<figure class="hb-card hb-chart">
  <figcaption class="hb-chart-title">Costs</figcaption>
  <div class="hb-hbar-box" data-box="${BOX.join(",")}"><div class="hb-hbar-grid" role="img">
    ${rows.map((r, i) => {
      const y = 20 + i * 25;
      const cells = (cls: string, inner: string) => `<div class="${cls}">${inner}</div>`;
      return `
      <div class="hb-hbar-label" data-box="10,${y},64,17">${r.label}</div>
      ${cells("hb-hbar-tracks", r.bars.map((b) => `
        <div class="hb-hbar-track">${b === "-" ? "" : `
          ${r.zero ? `<div class="hb-hbar-zero" data-box="${b.split("|")[0]}"></div>` : ""}
          <div class="hb-hbar-bar" data-box="${r.zero ? b.split("|")[1] : b}" style="background: rgb(47, 111, 230)"></div>`}
        </div>`).join(""))}
      ${cells("hb-hbar-values", r.values.map((v, k) => `<span class="hb-hbar-value" data-box="${v}">w${i}-${k}</span>`).join(""))}`;
    }).join("")}
  </div></div>
</figure>`;
    const fig = fixture(html);
    for (const el of fig.querySelectorAll<HTMLElement>("[data-box]")) {
      const [l, t, w, h] = el.getAttribute("data-box")!.split(",").map(Number);
      el.getBoundingClientRect = () => (
        { left: l, top: t, width: w, height: h, right: l + w, bottom: t + h, x: l, y: t, toJSON: () => ({}) } as DOMRect);
    }
    return fig;
  };
  const spec = (data: (number | null)[]): ChartSpec => ({
    type: "bar", x: ["Stay", "Flights", "Local"], series: [{ name: "Cost", data }],
  } as ChartSpec);
  const attrs = (body: string, tag: string, key: string): Record<string, string> => {
    const m = body.match(new RegExp(`<${tag}[^>]*${tag === "rect" ? "data-bar" : "data-word"}="${key}"[^>]*>`));
    if (!m) throw new Error(`no <${tag}> emitted for ${key} in ${body}`);
    return Object.fromEntries([...m[0].matchAll(/(\w[\w-]*)="([^"]*)"/g)].map(([, k, v]) => [k, v]));
  };

  it("every bar sits at its OWN rendered rect, rows in bounds, sized to the box", () => {
    const fig = laid([
      { label: "Stay", values: ["660,21.5,26,14"], bars: ["86,21.5,562.25,14"] },
      { label: "Flights", values: ["660,46.5,26,14"], bars: ["86,46.5,421.6875,14"] },
      { label: "Local", values: ["660,71.5,26,14"], bars: ["86,71.5,160.640625,14"] },
    ]);
    const picture = hbarSvg(fig, spec([42000, 31500, 28000]));
    expect(picture).not.toBeNull();
    expect(picture!.width).toBe(686);            // the laid-out box, not a derived sum of columns
    expect(picture!.height).toBe(67);            // every row fits — nothing can leave the picture
    for (const [key, want] of [["0:0", 1.5], ["1:0", 26.5], ["2:0", 51.5]] as [string, number][]) {
      const a = attrs(picture!.body, "rect", key);
      expect(Number(a.x)).toBeCloseTo(76, 1);    // 86 minus the box's own left
      expect(Number(a.y)).toBeCloseTo(want, 1);  // its real row, not row + the track's offsetTop again
      expect(Number(a.height)).toBeCloseTo(14, 1);
      expect(Number(a.y) + Number(a.height)).toBeLessThanOrEqual(picture!.height);
    }
    expect(Number(attrs(picture!.body, "rect", "1:0").width)).toBeCloseTo(421.6875, 1);
    expect(picture!.body.match(/<rect /g)).toHaveLength(3);
    expect(picture!.body.match(/<text /g)).toHaveLength(6);
    expect(picture!.body).toContain(">Stay</text>");
  });
  it("each series' word rides at its OWN span, never stacked on a sibling's", () => {
    const fig = laid([
      { label: "Stay", values: ["660,21.5,36,12", "660,37.5,36,12"], bars: ["86,21.5,562,12", "86,37.5,227,12"] },
      { label: "Flights", values: ["660,66.5,36,12", "660,82.5,36,12"], bars: ["86,66.5,421,12", "86,82.5,150,12"] },
      { label: "Local", values: ["660,111.5,36,12", "660,127.5,36,12"], bars: ["86,111.5,160,12", "86,127.5,66,12"] },
    ]);
    const two = { type: "bar", x: ["Stay", "Flights", "Local"],
      series: [{ name: "A", data: [42000, 31500, 12000] }, { name: "B", data: [17000, 12000, 5000] } ] } as ChartSpec;
    const picture = hbarSvg(fig, two);
    const words = [0, 1].map((k) => attrs(picture!.body, "text", `0:${k}`));
    expect(words[0].y).not.toBe(words[1].y);                       // the old build printed both at one spot
    expect(Number(words[0].y)).toBeCloseTo(7.5, 1);                // span 21.5 + 6 minus the box top of 20
    expect(Number(words[1].y)).toBeCloseTo(23.5, 1);
    for (const w of words) {
      expect(w["text-anchor"]).toBe("end");
      expect(Number(w.x)).toBeCloseTo(686, 1);                     // the span's right edge, the drawn alignment
    }
    const bars = [0, 1].map((k) => attrs(picture!.body, "rect", `0:${k}`));
    expect(Number(bars[1].y)).toBeCloseTo(17.5, 1);                // series B's own track, not series A's
  });
  it("a null value draws no bar; its word is the drawing's dash", () => {
    const fig = laid([
      { label: "Stay", values: ["650,21.5,36,14"], bars: ["86,21.5,562,14"] },
      { label: "Flights", values: ["650,46.5,36,14"], bars: ["86,46.5,421,14"] },
      { label: "Local", values: ["650,71.5,36,14"], bars: ["-"] },
    ]);
    const picture = hbarSvg(fig, spec([42000, 31500, null]));
    expect(picture!.body.match(/<rect /g)).toHaveLength(2);        // the gap is not a bar
    expect(picture!.body).toContain("w2-0");
  });
  it("a signed board carries each zero line where the drawing put it, sampled not computed", () => {
    const fig = laid([
      { label: "Stay", values: ["650,21.5,36,14"], bars: ["243.5,17.5,1,22|304,21.5,34,14"], zero: "yes" },
      { label: "Flights", values: ["650,46.5,36,14"], bars: ["243.5,42.5,1,22|100,46.5,143,14"], zero: "yes" },
      { label: "Local", values: ["650,71.5,36,14"], bars: ["243.5,67.5,1,22|60,71.5,183,14"], zero: "yes" },
    ]);
    const picture = hbarSvg(fig, spec([12, -24, -36]));
    const zeros = [...picture!.body.matchAll(/<rect data-zero="(\d:0)" x="([\d.]+)" y="([\d.]+)"/g)];
    expect(zeros).toHaveLength(3);                                 // the line per row, where it was laid out
    expect(Number(zeros[1][2])).toBeCloseTo(233.5, 1);             // 243.5 minus the box left
    expect(Number(zeros[1][3])).toBeCloseTo(22.5, 1);              // 42.5 minus the box top
    expect(picture!.body.match(/<rect data-bar/g)).toHaveLength(3);
  });
  it("a figure without the hbar grid is not a picture to rebuild", () => {
    expect(hbarSvg(fixture("<figure></figure>"), spec([1]))).toBeNull();
  });
  it("a figure that was never laid out is refused, not invented", () => {
    const fig = fixture(`<figure class="hb-card hb-chart"><div class="hb-hbar-box"><div class="hb-hbar-grid">
      <div class="hb-hbar-label">Stay</div><div class="hb-hbar-tracks"><div class="hb-hbar-track">
      <div class="hb-hbar-bar"></div></div></div><div class="hb-hbar-values"><span>w</span></div>
    </div></div></figure>`);
    expect(hbarSvg(fig, { type: "bar", x: ["Stay"], series: [{ name: "A", data: [1] }] } as ChartSpec)).toBeNull();
  });
});

describe("file names", () => {
  it("keeps readable words, drops the rest, caps the length, and never comes back empty", () => {
    expect(fileBase("Kyoto: day 1!", "x")).toBe("kyoto-day-1");
    expect(fileBase("  Two   Spaces ", "x")).toBe("two-spaces");
    expect(fileBase("日本語だ", "x")).toBe("x");
    expect(fileBase(undefined, "board-7f3a")).toBe("board-7f3a");
    expect(fileBase("a".repeat(90), "x")).toHaveLength(40);
  });
  it("a chart is named for its title, falling back to the drawing it is", () => {
    expect(chartFileBase(fixture(XY_FIGURE))).toBe("revenue");
    expect(chartFileBase(fixture("<figure class='hb-card hb-chart'></figure>"))).toBe("chart");
  });
});

describe("the files themselves", () => {
  it("a Markdown export carries the provenance footer and ends in a newline", () => {
    const p = provenanceOf([chart("OpenWeather"), { type: "heading", text: "Hi" } as Block]);
    expect(markdownFile("# Hi", p)).toBe("# Hi\n\n---\n\nOpenWeather\n");
  });
  it("a board with no provenance gets no footer it did not have", () => {
    expect(markdownFile("body", provenanceOf([{ type: "divider" } as Block]))).toBe("body\n");
  });
  it("an empty body with provenance still says where the data came from", () => {
    const p = provenanceOf([{ type: "source", text: "Ledger" } as Block]);
    expect(markdownFile("", p)).toBe("---\n\nLedger\n");
  });
  it("a JSON export is the stored envelope, pretty and whole", () => {
    const stored = { version: 2, model_note: "kept", blocks: [{ type: "divider" }] };
    expect(jsonFile(stored)).toBe(`${JSON.stringify(stored, null, 2)}\n`);
  });
  it("a CSV blob carries the escaping and a UTF-8 BOM for spreadsheets", async () => {
    const blob = tableCsvBlob({ type: "table", columns: ["A"], rows: [["x,y"]] });
    expect(blob.type).toBe("text/csv;charset=utf-8");
    // The bytes ARE the file: the first three are the BOM. text() then reads the record itself — per spec it
    // decodes UTF-8 and drops the BOM, so the BOM is a bytes claim, not a text claim.
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(await blob.text()).toBe("A\r\n\"x,y\"\r\n");
  });
  it("provenance rides as a leading '#' comment: the data block below it never moved", async () => {
    const blob = tableCsvBlob({ type: "table", columns: ["A"], rows: [["x,y"]] }, "Trip ledger · OpenWeather");
    expect(await blob.text()).toBe("# Trip ledger · OpenWeather\r\nA\r\n\"x,y\"\r\n");
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);   // BOM still first, comment still a comment
  });
  it("an empty provenance word adds no line", async () => {
    expect(await tableCsvBlob({ type: "table", columns: ["A"], rows: [["1"]] }, "   ").text()).toBe("A\r\n1\r\n");
  });
});

describe("serializeSvg", () => {
  it("travels with its own namespace, its stated box, and the drawing's geometry", () => {
    const host = fixture('<svg width="100%" height="220" viewBox="0 0 660 220"><rect x="1" y="2" width="3" height="4"></rect></svg>');
    const text = serializeSvg(host.querySelector("svg")!);
    expect(text).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(text).toContain('height="220"');       // a stated length
    expect(text).toContain('width="660"');        // a percent box without layout falls to the viewBox, never "100"
    expect(text).toContain('x="1"');
    expect(text).not.toContain("100%");
  });
});

describe("saveBlob", () => {
  afterEach(() => {
    vi.useRealTimers();
    // biome-ignore lint: restoring the real (absent) factory
    delete (URL as { createObjectURL?: unknown }).createObjectURL;
    delete (URL as { revokeObjectURL?: unknown }).revokeObjectURL;
  });
  it("hands the blob to the browser as a named download and revokes the door after", () => {
    vi.useFakeTimers();
    const created: string[] = [];
    const revoked: string[] = [];
    (URL as { createObjectURL: (b: Blob) => string }).createObjectURL = () => (created.push("u"), "blob:u");
    (URL as { revokeObjectURL: (u: string) => void }).revokeObjectURL = (u: string) => revoked.push(u);
    const seen: string[] = [];
    const grab = (e: Event) => {
      const a = (e.target as HTMLElement).closest?.("a");
      if (a) seen.push(a.getAttribute("download") ?? "");
    };
    document.addEventListener("click", grab, true);
    saveBlob(new Blob(["hi"], { type: "text/plain" }), "note.txt");
    document.removeEventListener("click", grab, true);
    expect(created).toEqual(["u"]);
    expect(seen).toEqual(["note.txt"]);
    vi.advanceTimersByTime(61_000);
    expect(revoked).toEqual(["blob:u"]);
  });
});

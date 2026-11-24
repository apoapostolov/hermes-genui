// The host's export acts — the whole of enhancement #6, in browser primitives only: NO new dependency, NO model
// round-trip, and NO network at the moment of export. A board's stored envelope already sits in the page's memory
// (it is what the board was drawn from), the Markdown serializer has a host-side twin (lib/markdown.ts, corpus-
// pinned to hooks/text_fallback.py byte for byte), and a table's CSV and a chart's PNG never left the browser.
//  · csvBlob: the table's own data, RFC 4180, with a UTF-8 BOM so Excel reads it like the viewer does. Provenance
//    travels as a leading '#' comment line BEFORE the data block: RFC 4180's data rows stay byte-exact — a reader
//    that ignores comment lines sees exactly the stored headers and rows — and the file itself says where its
//    numbers came from. A board that declares no provenance gets no comment line.
//  · chartPng: a chart with a picture (the hand-drawn SVG of Chart.tsx/PieChart.tsx) is serialized as it is, with
//    every element's computed paint inlined. The horizontal-bar kind draws DOM instead (HBarChart.tsx) — so its
//    picture is REBUILT BY MEASURING that drawing: every bar, zero line and word at the rect the browser laid
//    out, painted with the colours sampled from the elements themselves. Both pictures then ride the one
//    pipeline: <img> decode, canvas raster at a fixed 2x, the words composited above. The canvas is filled with
//    the block's backdrop COMPOSITED TO OPAQUE first (the card's translucent colour over whatever the page
//    paints behind it): a PNG whose background carries alpha 8 disappears on a dark viewer surface — an export
//    must stand on its own. The board's provenance line, composed by the SAME core/provenance.ts the drawn
//    footer uses, rides as the last line above the picture.
//  · saveBlob: bytes to a named host download. Nothing here sends a word to the composer.
import { csvOf } from "./csv";
import { provenanceLine, type BoardProvenance } from "../core/provenance";
import type { ChartSpec } from "../blocks/chart/chartData";
import type { StructuredTable, TableBlock } from "../blocks/table/read";

// The PNG's geometry, exported so real Chrome can assert against the SAME formulas the act uses.
export const PNG_SCALE = 2;        // every machine, every zoom: a fixed 2x raster
export const PNG_PAD = 14;
export const LINE_RATIO = 1.4;
export const LINE_GAP = 6;
const SWATCH = 12;                 // the legend colour square a swatch line leads with
const SWATCH_GAP = 6;
const MINUS = "\u2013";            // a null value's word, the drawing's own dash

/** One line of words above a chart's picture in the exported PNG. */
export type CaptionLine = {
  text: string;
  /** A CSS font shorthand for canvas: "600 13px ui-sans-serif, …". */
  font: string;
  colour: string;
  size: number;
  swatch?: string;
};

/** The room a swatch costs before its line's text. */
export function measureLine(line: CaptionLine): number {
  return line.swatch ? SWATCH + SWATCH_GAP : 0;
}

/** The canvas size in CSS px that holds the drawing plus every line at its measured width. */
export function pngMetrics(
  lines: CaptionLine[], measure: (line: CaptionLine) => number, svgWidth: number, svgHeight: number,
): { width: number; height: number } {
  const textWidth = lines.reduce((widest, l) => Math.max(widest, measure(l) + measureLine(l)), 0);
  const textHeight = lines.length
    ? lines.reduce((h, l) => h + l.size * LINE_RATIO, 0) + (lines.length - 1) * LINE_GAP
    : 0;
  return {
    width: Math.round(Math.max(svgWidth, textWidth)) + PNG_PAD * 2,
    height: Math.round(svgHeight + textHeight) + PNG_PAD * 2,
  };
}

function fontOf(cs: CSSStyleDeclaration): { font: string; size: number } {
  const size = Number.parseFloat(cs.fontSize) || 14;
  const parts = [cs.fontStyle !== "normal" ? cs.fontStyle : "", cs.fontWeight, `${size}px`, cs.fontFamily];
  return { font: parts.filter(Boolean).join(" "), size };
}

/** The chart figure's words, in the order they sit above the picture: the title, the headline line, every
 *  legend item (the XY row's and the pie's table alike), the source line, and — when the board declares
 *  provenance — the footer's own line last. Plain-text reads: inline formatting the board draws (chips, mini
 *  bars) is not words an export line carries. */
export function captionLines(figure: HTMLElement, provenance = ""): CaptionLine[] {
  const out: CaptionLine[] = [];
  const line = (el: Element | null | undefined, text: string, swatch?: string): void => {
    if (!el || !text.trim()) return;
    const cs = getComputedStyle(el);
    const { font, size } = fontOf(cs);
    out.push({ text, font, colour: cs.color, size, ...(swatch ? { swatch } : {}) });
  };
  const title = figure.querySelector(".hb-chart-title");
  line(title, title?.textContent?.trim() ?? "");
  const figureEl = figure.querySelector(".hb-chart-figure");
  line(figureEl, (figureEl?.textContent ?? "").trim());
  for (const item of figure.querySelectorAll(".hb-legend-item")) {
    const swatch = item.querySelector<HTMLElement>(".hb-legend-dot");
    // The parts of an item's line: its own name word, then the value and note spans — joined with a space,
    // because textContent glues them ("Ads" + "$4,000") the way JSX children sit on separate lines.
    const words = [...item.childNodes]
      .filter((n) => n.nodeType === Node.TEXT_NODE || (n as HTMLElement).classList?.contains("hb-legend-value")
        || (n as HTMLElement).classList?.contains("hb-legend-note"))
      .map((n) => (n.textContent ?? "").trim())
      .filter(Boolean)
      .join(" ");
    line(item, words, swatch ? getComputedStyle(swatch).backgroundColor : undefined);
  }
  for (const row of figure.querySelectorAll(".hb-pie-legend tr")) {
    if (!row.querySelector(".hb-pie-swatch")) continue;  // a header row has no word of its own
    const sw = row.querySelector<HTMLElement>(".hb-pie-swatch i");
    const words = [...row.querySelectorAll("td")]
      .filter((td) => !td.classList.contains("hb-pie-swatch"))
      .map((td) => (td.textContent ?? "").trim()).filter(Boolean).join(" ");
    line(row, words, sw ? getComputedStyle(sw).backgroundColor : undefined);
  }
  const source = figure.querySelector(".hb-chart-source");
  line(source, source?.textContent?.trim() ?? "");
  // The provenance footer's own words, in the source line's voice (the fallback keeps the same quiet look on a
  // figure that has no inline source of its own).
  if (provenance.trim() && provenance.trim() !== (source?.textContent?.trim() ?? "")) {
    const styleEl = source ?? figure;
    const cs = getComputedStyle(styleEl);
    const { font, size } = fontOf(cs);
    out.push({ text: provenance.trim(), font, colour: cs.color, size });
  }
  return out;
}

// --- the backdrop: an export must stand on any surface -------------------------------------------------------

const RGB = /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+))?\s*\)/;
const TRANSPARENT = /^rgba?\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\)$/;

/** Parse a computed background-color into [r, g, b, a] (a: 1 when the browser answered rgb(), not rgba). */
export function parseColour(value: string): [number, number, number, number] | null {
  const m = RGB.exec(value);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3]), m[4] === undefined ? 1 : Number(m[4])];
}

/** "a over b", both opaque [r,g,b]: source-over compositing of one translucent colour on a solid one. */
export function over(fg: [number, number, number, number], bg: [number, number, number]): [number, number, number] {
  const a = fg[3];
  return [
    Math.round(fg[0] * a + bg[0] * (1 - a)),
    Math.round(fg[1] * a + bg[1] * (1 - a)),
    Math.round(fg[2] * a + bg[2] * (1 - a)),
  ];
}

/** The element's painted backdrop as ONE OPAQUE colour: every translucent background from the element up to the
 *  first solid one, composited the way the page already paints it. The card's translucent ink wash (the theme's
 *  --hb-card is a colour-mix at a few percent) over the page's solid ground is the colour the reader sees — and
 *  the only colour a PNG may carry if it is to read the same on a white page and a black one. */
export function opaqueBackdrop(el: HTMLElement): [number, number, number] {
  const layers: [number, number, number, number][] = [];
  let base: [number, number, number] = [255, 255, 255];  // nothing solid found: the browser's own ground is white
  for (let node: HTMLElement | null = el; node; node = node.parentElement) {
    const cs = getComputedStyle(node);
    const value = cs.backgroundColor;
    if (value && value !== "transparent" && !TRANSPARENT.test(value)) {
      const rgb = parseColour(value);
      if (!rgb) continue;
      if (rgb[3] >= 1) {
        base = [rgb[0], rgb[1], rgb[2]];
        break;
      }
      layers.push(rgb);
    }
  }
  let out = base;
  for (let i = layers.length - 1; i >= 0; i--) out = over(layers[i], out);  // furthest ancestor first, as painted
  return out;
}

// --- the horizontal-bar picture: MEASURED from the drawing that is actually on the page -----------------------

const SVG_NS = 'xmlns="http://www.w3.org/2000/svg"';

function esc(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** What hbarSvg reads off the live drawing: nothing derived — every element's real laid-out box and paint. */
export type HbarPicture = {
  width: number;
  height: number;
  body: string;
};

/** The horizontal bars as a standalone SVG document, MEASURED from the live drawing: every bar, zero line,
 *  label and value word is placed at the exact rect the browser laid out (relative to the picture's own box),
 *  and the picture is that box — so no row can overlap another, print at a shared spot, or leave the image.
 *  (The earlier rebuild computed these places from the layout formulas and drifted: stacked value words at one
 *  coordinate, later rows' bars double-counted out of the canvas.) Paint comes from the elements as drawn;
 *  picked-row dimming is view state — it rides the bar's opacity, never its background, so the export shows
 *  every bar at full strength. */
export function hbarSvg(figure: HTMLElement, spec: ChartSpec): HbarPicture | null {
  const box = figure.querySelector<HTMLElement>(".hb-hbar-box");
  const grid = box?.querySelector<HTMLElement>(".hb-hbar-grid");
  if (!box || !grid) return null;
  const rows = spec.x.map(String);
  const labelEls = [...grid.querySelectorAll<HTMLElement>(".hb-hbar-label")];
  const trackEls = [...grid.querySelectorAll<HTMLElement>(".hb-hbar-tracks")];
  const valueEls = [...grid.querySelectorAll<HTMLElement>(".hb-hbar-values")];
  if (!labelEls.length || labelEls.length !== rows.length
    || trackEls.length !== rows.length || valueEls.length !== rows.length) return null;
  const base = box.getBoundingClientRect();
  if (base.width < 2 || base.height < 2) return null;  // not laid out here: nothing measured, nothing to invent
  const rel = (el: HTMLElement): { x: number; y: number; w: number; h: number } => {
    const r = el.getBoundingClientRect();
    return { x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height };
  };
  const TRANSPARENT_PAINT = /^rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*0\s*\)$/;
  const pictureW = Math.ceil(base.width);
  const pictureH = Math.ceil(base.height);
  // A box may bleed past the picture's edge (the signed zero line sits 4px proud of its track); the picture
  // shows the part that is IN it, never a rect outside the viewBox where a raster would silently drop it.
  const fit = (r: { x: number; y: number; w: number; h: number }): typeof r => {
    const x = Math.max(r.x, 0);
    const y = Math.max(r.y, 0);
    return { x, y, w: Math.max(Math.min(r.x + r.w, pictureW) - x, 1), h: Math.max(Math.min(r.y + r.h, pictureH) - y, 1) };
  };
  const sample = (el: Element | null): string => {
    if (!el) return "";
    const value = getComputedStyle(el).backgroundColor;
    return value && value !== "transparent" && !TRANSPARENT_PAINT.test(value) && !TRANSPARENT.test(value) ? value : "";
  };
  const look = (el: HTMLElement, fallback: string): { family: string; size: string; ink: string } => {
    const cs = getComputedStyle(el);
    return {
      family: (cs.fontFamily || "sans-serif").replaceAll('"', "'"),
      size: cs.fontSize || "12px",
      ink: cs.color || fallback,
    };
  };
  const parts: string[] = [];
  rows.forEach((_row, i) => {
    const lr = rel(labelEls[i]);
    const lf = look(labelEls[i], "#222");
    const labelWord = (labelEls[i].textContent ?? "").trim() || rows[i];
    parts.push(`<text data-label="${i}" x="${lr.x.toFixed(1)}" y="${(lr.y + lr.h / 2).toFixed(1)}" `
      + `dominant-baseline="central" font-family="${esc(lf.family)}" font-size="${esc(lf.size)}" `
      + `fill="${esc(lf.ink)}">${esc(labelWord)}</text>`);
    const tracks = [...trackEls[i].querySelectorAll<HTMLElement>(".hb-hbar-track")];
    tracks.forEach((track, k) => {
      const zero = track.querySelector<HTMLElement>(".hb-hbar-zero");
      if (zero) {
        const zr = fit(rel(zero));
        parts.push(`<rect data-zero="${i}:${k}" x="${zr.x.toFixed(1)}" y="${zr.y.toFixed(1)}" `
          + `width="${zr.w.toFixed(1)}" height="${zr.h.toFixed(1)}" fill="${esc(sample(zero) || "#999")}"/>`);
      }
      const bar = track.querySelector<HTMLElement>(".hb-hbar-bar");
      if (!bar) return;  // a null value has no bar drawn, so none in the picture either
      const br = fit(rel(bar));
      parts.push(`<rect data-bar="${i}:${k}" x="${br.x.toFixed(1)}" y="${br.y.toFixed(1)}" `
        + `width="${br.w.toFixed(1)}" height="${br.h.toFixed(1)}" rx="3" fill="${esc(sample(bar) || "#888")}"/>`);
    });
    const spans = [...valueEls[i].querySelectorAll<HTMLElement>("span")];
    spans.forEach((span, k) => {
      const vr = rel(span);
      const vf = look(span, "#222");
      const word = (span.textContent ?? "").trim() || MINUS;
      parts.push(`<text data-word="${i}:${k}" x="${(vr.x + vr.w).toFixed(1)}" y="${(vr.y + vr.h / 2).toFixed(1)}" `
        + `text-anchor="end" dominant-baseline="central" font-family="${esc(vf.family)}" `
        + `font-size="${esc(vf.size)}" fill="${esc(vf.ink)}">${esc(word)}</text>`);
    });
  });
  return { width: pictureW, height: pictureH, body: parts.join("") };
}

// --- the drawing side's shared text reads ------------------------------------------------------------------------

// The properties that carry a drawing's look. Geometry already sits in SVG attributes (x/y/d/viewBox); these are
// the ones that come from the app's stylesheet — and an <img> rasterizing a detached SVG sees no stylesheet at
// all, so every element's computed value travels with it.
const PAINT = [
  "fill", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin", "stroke-dasharray", "stroke-dashoffset",
  "fill-opacity", "stroke-opacity", "opacity", "font-family", "font-size", "font-weight", "font-style",
  "text-anchor", "dominant-baseline", "letter-spacing", "paint-order", "vector-effect",
];

/** A self-contained SVG document: the drawing's own box, every element's computed paint inlined, nothing
 *  external left to fetch. */
export function serializeSvg(svg: SVGSVGElement): string {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const sources = [svg as Element, ...svg.querySelectorAll<Element>("*")];
  const copies = [clone as Element, ...clone.querySelectorAll<Element>("*")];
  const box = svg.getBoundingClientRect();
  // The size the raster must have: the drawn box where layout is real (Chrome), and where it is not (jsdom
  // reports nothing) the stated length — never a percent, which would be a different picture — falling back
  // to the viewBox, which is exactly the drawing's own units.
  const px = (which: "width" | "height", view: number): string => {
    if (view > 0) return String(Math.round(view));
    const attr = (svg.getAttribute(which) ?? "").trim();
    const stated = Number.parseFloat(attr);
    if (attr && !attr.endsWith("%") && Number.isFinite(stated) && stated > 0) return String(Math.round(stated));
    const vb = (svg.getAttribute("viewBox") ?? "").trim().split(/[\s,]+/).map(Number);
    if (vb.length === 4) {
      const side = vb[which === "width" ? 2 : 3];
      if (Number.isFinite(side) && side > 0) return String(Math.round(side));
    }
    return "640";
  };
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", px("width", box.width));
  clone.setAttribute("height", px("height", box.height));
  for (const [i, src] of sources.entries()) {
    const dst = copies[i];
    if (!dst) continue;
    const cs = getComputedStyle(src);
    if (cs.display === "none" || cs.visibility === "hidden") { dst.remove(); continue; }
    for (const prop of PAINT) {
      const value = cs.getPropertyValue(prop);
      if (value) (dst as SVGGraphicsElement).style.setProperty(prop, value);
    }
  }
  return new XMLSerializer().serializeToString(clone);
}

/** A promise that is only ever true after the host has agreed to a download: decode an image, take a canvas's
 *  bytes. Null (never a throw) wherever the browser cannot — jsdom has no 2D context, and the act's Chrome
 *  regressions are where pixels are actually proven. */
async function loadImage(src: string): Promise<HTMLImageElement | null> {
  const url = URL.createObjectURL(new Blob([src], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function canvasPng(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((done) => canvas.toBlob((blob) => done(blob), "image/png"));
}

/** A chart as a PNG blob: its words (and the board's provenance line) composited above its picture, at
 *  PNG_SCALE, on an OPAQUE backdrop — the page's own colours, composited, never a translucent one floating on
 *  whatever surface the reader opens the file over. The picture is the chart's own SVG where one was drawn; for
 *  the horizontal-bar kind (pure DOM drawing) is rebuilt by MEASURING that drawing's laid-out boxes. Null when
 *  there is neither a picture nor a 2D context here (tests). */
export async function chartPng(
  figure: HTMLElement, opts: { spec?: ChartSpec; provenance?: string } = {},
): Promise<Blob | null> {
  const svg = figure.querySelector<SVGSVGElement>("svg");
  let svgWidth = 0;
  let svgHeight = 0;
  let document_: string;
  if (svg) {
    const box = svg.getBoundingClientRect();
    const stated = (which: "width" | "height"): number => {
      const raw = Number.parseFloat(svg.getAttribute(which) ?? "");
      return Number.isFinite(raw) && raw > 0 ? raw : 640;
    };
    svgWidth = Math.round(box.width || stated("width"));
    svgHeight = Math.round(box.height || stated("height"));
    document_ = serializeSvg(svg);
  } else if (opts.spec) {
    const picture = hbarSvg(figure, opts.spec);
    if (!picture) return null;
    svgWidth = Math.round(picture.width);
    svgHeight = Math.round(picture.height);
    document_ = `<svg ${SVG_NS} width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}">`
      + picture.body + "</svg>";
  } else {
    return null;
  }
  const lines = captionLines(figure, opts.provenance ?? "");
  const probe = document.createElement("canvas").getContext("2d");
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!probe || !ctx) return null;  // no 2D context here (tests): pixels are Chrome's to prove
  const measure = (l: CaptionLine): number => {
    probe.font = l.font;
    return probe.measureText(l.text).width;
  };
  const { width, height } = pngMetrics(lines, measure, svgWidth, svgHeight);
  const img = await loadImage(document_);
  if (!img) return null;
  canvas.width = Math.round(width * PNG_SCALE);
  canvas.height = Math.round(height * PNG_SCALE);
  ctx.scale(PNG_SCALE, PNG_SCALE);
  const [r, g, b] = opaqueBackdrop(figure);
  ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;  // opaque, always: the PNG must stand on any surface
  ctx.fillRect(0, 0, width, height);
  const textHeight = lines.reduce((h, l) => h + l.size * LINE_RATIO, 0) +
    (lines.length ? (lines.length - 1) * LINE_GAP : 0);
  let y = PNG_PAD;
  ctx.textBaseline = "top";
  for (const l of lines) {
    if (l.swatch) {
      ctx.fillStyle = l.swatch;
      ctx.fillRect(PNG_PAD, y + Math.max(0, (l.size * LINE_RATIO - SWATCH) / 2), SWATCH, SWATCH);
    }
    ctx.font = l.font;
    ctx.fillStyle = l.colour;
    ctx.fillText(l.text, PNG_PAD + measureLine(l), y);
    y += l.size * LINE_RATIO + LINE_GAP;
  }
  ctx.drawImage(img, PNG_PAD, PNG_PAD + textHeight, svgWidth, svgHeight);
  return canvasPng(canvas);
}

/** A table block's own tabular data — the table as the BOARD said it, never the reader's view of it. Two shapes
 *  reach this on the current base (web/src/blocks/table/read.ts): the legacy list of column words and rows of
 *  cell words, kept VERBATIM; and #41's structured table, read back into the same grid — headers are the column
 *  labels, a number-family cell (number, currency, percent, bar) travels as its RAW value where it has one, a
 *  sources column joins the row's source labels with the provenance separator " · ", everything else travels
 *  as the word it shows. The reader's view (the filter box, the sort ticks, the paged window, the computed
 *  aggregate footer) is state and arithmetic on the page; none of it is stored data, none of it is exported. */
/** #41's shape, as the reader says it: a structured table carries structured: true. */
function isStructuredTable(block: TableBlock): block is StructuredTable {
  return "structured" in block && block.structured === true;
}

function tableWords(block: TableBlock): { headers: string[]; rows: string[][] } {
  if (isStructuredTable(block)) {
    const headers = block.columns.map((col) => col.label);
    const numberFamily = new Set(["number", "currency", "percent", "bar"]);
    const rows = block.rows.map((row) => block.columns.map((col) => {
      if (col.kind === "sources") return row.sources.map((s) => s.label).join(", ");  // the very word the table says
      const cell = row.cells[col.id];
      if (!cell) return "";
      if (numberFamily.has(col.kind) && cell.value !== undefined && cell.value !== null) return String(cell.value);
      return cell.text;
    }));
    return { headers, rows };
  }
  return { headers: block.columns, rows: block.rows };  // legacy: the stored words verbatim
}

/** A table as a CSV file body. Provenance (core/provenance.ts's own line, when the board says any) rides
 *  FIRST as a '#' comment record: the RFC 4180 data block below it is exactly the stored table — comment-aware
 *  readers skip the line, byte readers see where the numbers came from. A board that says nothing gets no
 *  comment line: an export of an ordinary table carries no provenance it did not have. */
export function tableCsvBlob(block: TableBlock, provenance = ""): Blob {
  const { headers, rows } = tableWords(block);
  const head = provenance.trim() ? `# ${provenance.trim()}\r\n` : "";
  return new Blob([`\uFEFF${head}${csvOf(headers, rows)}`], { type: "text/csv;charset=utf-8" });
}

/** The board's Markdown file: the host-side twin of the chat serializer's whole text (no cap — a file is not
 *  one chat message), then the provenance footer — the SAME core/provenance.ts line the CSV comment and the
 *  PNG caption use. A board with no provenance gets no footer it did not have. */
export function markdownFile(body: string, provenance: BoardProvenance): string {
  const parts: string[] = [];
  const head = body.trimEnd();
  const footer = provenanceLine(provenance);
  if (head) parts.push(head);
  if (footer) parts.push(`---\n\n${footer}`);
  return `${parts.join("\n\n")}\n`;
}

/** The board's JSON file: the stored envelope, every word it has, pretty. */
export function jsonFile(stored: unknown): string {
  return `${JSON.stringify(stored, null, 2)}\n`;
}

/** A name a filesystem and a spreadsheet will both take: lowercase words, single dashes, nothing else, 40 at
 *  most — and never empty: the fallback is the last word. */
export function fileBase(name: string | undefined | null, fallback: string): string {
  const slug = (name ?? "")
    .trim().toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]+/g, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/, "");
  return slug || fallback;
}

/** A chart is named for its title, the word the figure itself says. */
export function chartFileBase(figure: HTMLElement): string {
  return fileBase(figure.querySelector(".hb-chart-title")?.textContent ?? "", "chart");
}

/** Hand the bytes to the browser as a named download. The door stays open for a minute, long enough for a
 *  large board's file to start, then it is revoked. */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

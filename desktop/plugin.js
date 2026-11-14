// src/plugin.tsx
import { host, TRANSCRIPT_DIRECTIVE_AREA } from "@hermes/plugin-sdk";

// src/host/actions.ts
import { createContext } from "react";

// src/lib/icons.ts
var ICON_NAMES = [
  "mail",
  "rupee",
  "bell",
  "cal",
  "check",
  "clock",
  "chart",
  "photo",
  "spark",
  "chat",
  "brain",
  "sun",
  "moon",
  "sunset",
  "note",
  "globe",
  "search",
  "heart",
  "plane",
  "bed",
  "food",
  "walk",
  "pin",
  "trophy",
  "lock",
  "star",
  "leaf",
  "flame",
  "ticket",
  "info",
  "alert"
];

// src/core/fields.ts
function num(v) {
  if (typeof v === "number" && isFinite(v)) return v;
  return null;
}
function str(v, max = 120) {
  if (typeof v !== "string") return void 0;
  const trimmed = v.trim();
  if (!trimmed) return void 0;
  return trimmed.slice(0, max);
}
function firstText(values, max = 120) {
  for (const v of values) {
    const found = str(v, max);
    if (found !== void 0) return found;
  }
  return void 0;
}
function cutAtWord(text, max) {
  if (text.length <= max) return text;
  const room = text.slice(0, max - 1);
  const lastSpace = room.search(/\s\S*$/);
  const cut = lastSpace > max / 2 ? room.slice(0, lastSpace) : room;
  return `${cut.replace(/[\s,;:.–—-]+$/, "")}\u2026`;
}
function firstWords(values, max = 120) {
  const found = firstText(values, Infinity);
  return found === void 0 ? void 0 : cutAtWord(found, max);
}
function firstList(values) {
  return values.find((v) => Array.isArray(v));
}
function icon(v) {
  if (ICON_NAMES.includes(v)) return v;
  return void 0;
}
function slug(v) {
  if (typeof v === "string" && /^[a-z][a-z0-9_-]{0,23}$/.test(v)) return v;
  return void 0;
}
function https(v) {
  if (typeof v === "string" && /^https:\/\//.test(v)) return v;
  return void 0;
}
function clean(o) {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== void 0));
}
var Trail = class _Trail {
  path;
  dropped;
  constructor(path = "", dropped = []) {
    this.path = path;
    this.dropped = dropped;
  }
  /** One step deeper: new Trail("1").at("groups").at(2).path → "1.groups.2" */
  at(step) {
    const path = this.path ? `${this.path}.${step}` : String(step);
    return new _Trail(path, this.dropped);
  }
  drop(why) {
    this.dropped.push({ path: this.path, why });
    return null;
  }
};
function keepFirst(items, max, here, what) {
  if (items.length > max) here.drop(`kept the first ${max} ${what} of ${items.length}`);
  return items.slice(0, max);
}
function textOrNumber(v, max = 120) {
  if (num(v) !== null) return String(v);
  return str(v, max);
}
function firstTextOrNumber(values, max = 120) {
  for (const v of values) {
    const found = textOrNumber(v, max);
    if (found !== void 0) return found;
  }
  return void 0;
}
var AT_REFERENCE = /@\w[\w-]*:|@(?:diff|staged)\b/;
var NO_SEND = "a button's message can't start with / @ or ! or carry @-references";
function actsBeforeTheModel(message) {
  if (typeof message !== "string") return false;
  const text = message.trim();
  return /^[/@!]/.test(text) || AT_REFERENCE.test(text);
}

// src/host/actions.ts
var BlockActions = createContext({ send: () => {
}, fill: () => {
} });
var MAX_SENT = 120;
function composerActions(composer) {
  const insert = async (text) => {
    await composer?.insertText(null, text, { mode: "block" });
  };
  const fill = (text) => {
    insert(text).then(() => composer?.focus(null)).catch(() => {
    });
  };
  return {
    send(text) {
      if (text.length > MAX_SENT || actsBeforeTheModel(text)) {
        fill(text);
        return;
      }
      try {
        if (composer?.submit(null, text)) return;
        insert(text).catch(() => {
        });
      } catch {
        insert(text).catch(() => {
        });
      }
    },
    fill
  };
}

// src/host/BlockTag.tsx
import { useContext as useContext7, useEffect as useEffect9, useState as useState24 } from "react";

// src/blocks/flow/highlight.tsx
import { createContext as createContext2, useCallback, useContext, useMemo, useState } from "react";
import { jsx } from "react/jsx-runtime";
var FlowWalks = createContext2({ walks: /* @__PURE__ */ new Map(), setWalk: () => {
} });
function FlowLightBoard({ children }) {
  const [walks, setWalks] = useState(() => /* @__PURE__ */ new Map());
  const setWalk = useCallback((flow, walk) => {
    setWalks((was) => {
      const old = was.get(flow);
      if (old === walk || old && walk && old.steps === walk.steps && old.at === walk.at && old.from === walk.from) return was;
      const next = new Map(was);
      if (walk === void 0) next.delete(flow);
      else next.set(flow, walk);
      return next;
    });
  }, []);
  const value = useMemo(() => ({ walks, setWalk }), [walks, setWalk]);
  return /* @__PURE__ */ jsx(FlowWalks.Provider, { value, children });
}
function useWalk(flow) {
  const { walks } = useContext(FlowWalks);
  return flow === void 0 ? void 0 : walks.get(flow);
}
function useSetWalk() {
  return useContext(FlowWalks).setWalk;
}

// src/blocks/actions/Actions.tsx
import { useContext as useContext2 } from "react";

// src/lib/Icon.tsx
import { jsx as jsx2 } from "react/jsx-runtime";
var PATHS = {
  mail: '<path d="M4 6h16v12H4z"/><path d="m4 7 8 6 8-6"/>',
  rupee: '<path d="M7 5h10M7 9h10M13 19 8 13h2a4 4 0 0 0 0-8"/>',
  bell: '<path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  cal: '<rect x="4" y="5" width="16" height="15" rx="3"/><path d="M8 3v4M16 3v4M4 10h16"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  clock: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l2.5 2"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4-4"/>',
  note: '<path d="M6 4h9l4 4v12H6z"/><path d="M14 4v5h5M9 13h7M9 17h5"/>',
  globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.5 3.5 5.5 3.5 8.5s-1 6-3.5 8.5c-2.5-2.5-3.5-5.5-3.5-8.5s1-6 3.5-8.5z"/>',
  chart: '<path d="M4 19h16"/><path d="m5 15 4-5 4 3 6-7"/>',
  photo: '<rect x="3" y="5" width="18" height="14" rx="3"/><circle cx="9" cy="10" r="1.6"/><path d="m4 17 5-4 4 3 3-2 4 3"/>',
  spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>',
  chat: '<path d="M20 12a8 8 0 0 1-11.5 7.2L4 20l1-4.2A8 8 0 1 1 20 12z"/>',
  brain: '<path d="M9 4a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 2 5 3 3 0 0 0 3 3V4zM15 4a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-2 5 3 3 0 0 1-3 3V4z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
  moon: '<path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5z"/>',
  sunset: '<path d="M4 18h16M7 14a5 5 0 0 1 10 0M12 4v3M4.9 8.9l1.4 1.4M19.1 8.9l-1.4 1.4"/>',
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  plane: '<path d="M10.5 13.5 3 11l1.5-1.5 7.5 1L16 6.5a2 2 0 0 1 3 3L15 13.5l1 7.5L14.5 22.5 12 15z"/>',
  bed: '<path d="M3 18V7M3 14h18v4M21 14v-2a3 3 0 0 0-3-3h-7v5"/><circle cx="7" cy="11" r="1.6"/>',
  food: '<path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M16 21V3c-2 1.5-3 4-3 7h3"/>',
  walk: '<circle cx="13" cy="4.5" r="1.8"/><path d="M10 21l2-6 2.5 2V21M9 12l2-4 3 1 2 3M11 8l-2 5"/>',
  pin: '<path d="M12 21s-6-5.6-6-11a6 6 0 0 1 12 0c0 5.4-6 11-6 11z"/><circle cx="12" cy="10" r="2.2"/>',
  trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8M9.5 17h5"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  star: '<path d="m12 4 2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 16.4l-4.8 2.5.9-5.4-3.9-3.8 5.4-.8z"/>',
  leaf: '<path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14M5 19l7-7"/>',
  flame: '<path d="M12 21a6 6 0 0 0 6-6c0-4-3-6-4-10-2 2-3 4-3 6-1-1-1.5-2-1.5-3C7 10 6 12.5 6 15a6 6 0 0 0 6 6z"/>',
  ticket: '<path d="M4 8a2 2 0 0 0 0 4v4h16v-4a2 2 0 0 1 0-4V4H4zM14 4v16" transform="translate(0 2) scale(1 .9)"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8v.01"/>',
  alert: '<path d="M12 4.5 21 19.5H3z"/><path d="M12 10.5v4M12 17v.01"/>'
};
function Icon({ name, size = 16, stroke = 2 }) {
  return /* @__PURE__ */ jsx2(
    "svg",
    {
      width: size,
      height: size,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: stroke,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      "aria-hidden": "true",
      dangerouslySetInnerHTML: { __html: PATHS[name] }
    }
  );
}

// src/blocks/actions/Actions.tsx
import { jsx as jsx3, jsxs } from "react/jsx-runtime";
function Actions({ items }) {
  const { send } = useContext2(BlockActions);
  return /* @__PURE__ */ jsx3("div", { className: "hb-actions", children: items.map((a, i) => /* @__PURE__ */ jsxs("button", { type: "button", className: "hb-pill", title: a.run, onClick: () => send(a.run), children: [
    /* @__PURE__ */ jsx3(Icon, { name: "spark", size: 14, stroke: 2.2 }),
    a.label
  ] }, i)) });
}
function Button({ label, run, url }) {
  const { send } = useContext2(BlockActions);
  if (run) {
    return /* @__PURE__ */ jsx3("div", { className: "hb-actions", children: /* @__PURE__ */ jsxs("button", { type: "button", className: "hb-pill", title: run, onClick: () => send(run), children: [
      /* @__PURE__ */ jsx3(Icon, { name: "spark", size: 14, stroke: 2.2 }),
      label
    ] }) });
  }
  return /* @__PURE__ */ jsx3("div", { className: "hb-actions", children: /* @__PURE__ */ jsxs("a", { className: "hb-pill", href: url, target: "_blank", rel: "noreferrer", children: [
    /* @__PURE__ */ jsx3(Icon, { name: "globe", size: 14, stroke: 2.2 }),
    label
  ] }) });
}

// src/blocks/actions/read.ts
var MAX_BUTTONS = 3;
function readActions(raw, here) {
  const list = firstList([raw.items, raw.buttons]);
  if (!list) return here.drop("actions needs items");
  const items = [];
  list.forEach((item, i) => {
    const label = firstText([item?.label, item?.text], 40);
    const run = firstText([item?.run, item?.ask, item?.message], 300);
    if (!label || !run) {
      here.at("items").at(i).drop("button needs a label and a run message");
      return;
    }
    if (actsBeforeTheModel(run)) {
      here.at("items").at(i).drop(NO_SEND);
      return;
    }
    items.push({ label, run });
  });
  if (!items.length) return here.drop("actions has no usable button");
  return { type: "actions", items: keepFirst(items, MAX_BUTTONS, here, "buttons") };
}
function readButton(raw, here) {
  const label = firstText([raw.label, raw.text], 40);
  if (!label) return here.drop("button needs a label");
  const run = firstText([raw.run, raw.ask, raw.message], 300);
  const url = https(raw.url);
  if (!run && !url) return here.drop("button needs run or an https url");
  if (actsBeforeTheModel(run)) return here.drop(NO_SEND);
  return clean({ type: "button", label, run, url });
}

// src/blocks/atoms/Atoms.tsx
import { useState as useState2 } from "react";

// src/lib/locale.ts
function userLocale() {
  return typeof navigator !== "undefined" && navigator.language ? navigator.language : "en-US";
}
function usesLakhCrore() {
  return /-IN$/.test(userLocale());
}

// src/lib/format.ts
function formatIndian(v, digits) {
  return v.toLocaleString("en-IN", { maximumFractionDigits: digits });
}
function formatChange(change, unit = "%") {
  if (change === null || change === void 0 || !isFinite(change)) return "";
  const v = Math.abs(change).toFixed(1);
  const u = unit === "pt" ? " pt" : "%";
  return change > 0 ? `\u25B2 ${v}${u}` : change < 0 ? `\u25BC ${v}${u}` : `${v}${u}`;
}
var MONEY = /^([$₹€£¥])(Cr|K|M|B)?$/;
var MONEY_IN_WORDS = /^([$₹€£¥])(\s?\p{L}[\p{L} .]{0,11})$/u;
function formatAmount(v, unit) {
  const usual = MONEY.exec(unit ?? "");
  const m = usual ?? MONEY_IN_WORDS.exec(unit ?? "");
  if (!m) return null;
  const [, sym, scale = ""] = m;
  const abs = Math.abs(v);
  const digits = abs >= 1e3 ? 0 : usual ? scale ? 1 : 2 : abs >= 100 ? 1 : 2;
  const n = sym === "\u20B9" ? formatIndian(abs, digits) : formatNumber(abs, { digits });
  return `${v < 0 ? "-" : ""}${sym}${n}${scale === "Cr" ? " Cr" : scale}`;
}
function formatNumber(v, { digits } = {}) {
  const abs = Math.abs(v);
  if (digits === void 0) digits = abs >= 1e3 ? 0 : abs >= 100 ? 1 : 2;
  return v.toLocaleString(userLocale(), { maximumFractionDigits: digits });
}
function formatCompact(v, locale = userLocale()) {
  return new Intl.NumberFormat(locale, { notation: "compact", maximumSignificantDigits: 3 }).format(v);
}
function formatPercent(v, digits = 1) {
  return `${formatNumber(v, { digits })}%`;
}
function formatWithUnit(v, unit) {
  const money = formatAmount(v, unit);
  if (money !== null) return money;
  const n = formatNumber(v);
  if (unit === "%") return `${n}%`;
  if (!unit) return n;
  const isPluralWord = /^[a-z]{3,}s$/i.test(unit);
  if (v === 1 && isPluralWord) return `${n} ${unit.slice(0, -1)}`;
  return `${n} ${unit}`;
}

// src/lib/InlineText.tsx
import { Fragment, jsx as jsx4 } from "react/jsx-runtime";
function InlineText({ text }) {
  const parts = [];
  const pattern = /\*\*(.+?)\*\*/g;
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    parts.push(/* @__PURE__ */ jsx4("strong", { children: match[1] }, match.index));
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return /* @__PURE__ */ jsx4(Fragment, { children: parts });
}

// src/blocks/atoms/Atoms.tsx
import { jsx as jsx5, jsxs as jsxs2 } from "react/jsx-runtime";
function Heading({ text }) {
  return /* @__PURE__ */ jsx5("div", { className: "hb-heading", children: /* @__PURE__ */ jsx5(InlineText, { text }) });
}
function Text({ text }) {
  return /* @__PURE__ */ jsx5("div", { className: "hb-text", children: /* @__PURE__ */ jsx5(InlineText, { text }) });
}
function Divider() {
  return /* @__PURE__ */ jsx5("div", { className: "hb-divider", role: "separator" });
}
function Badge({ text, tone }) {
  return /* @__PURE__ */ jsx5("div", { className: "hb-badge", children: /* @__PURE__ */ jsx5("span", { className: `hb-chip hb-chip-${tone ?? "plain"}`, children: text }) });
}
function LinkLine({ text, url }) {
  return /* @__PURE__ */ jsx5("div", { className: "hb-link", children: /* @__PURE__ */ jsxs2("a", { href: url, target: "_blank", rel: "noreferrer", children: [
    /* @__PURE__ */ jsx5(Icon, { name: "globe", size: 14, stroke: 2.2 }),
    text
  ] }) });
}
function Picture({ url, caption }) {
  const [failed, setFailed] = useState2(false);
  if (failed) return null;
  return /* @__PURE__ */ jsxs2("figure", { className: "hb-image", children: [
    /* @__PURE__ */ jsx5("img", { src: url, alt: caption ?? "", loading: "lazy", referrerPolicy: "no-referrer", onError: () => setFailed(true) }),
    caption && /* @__PURE__ */ jsx5("figcaption", { children: caption })
  ] });
}
function barAmount(value, max, unit) {
  if (max === 100 && !unit) return `${value}%`;
  const money = formatAmount(value, unit);
  if (money !== null) return `${money} / ${formatAmount(max, unit)}`;
  const amount = `${formatNumber(value, { digits: 3 })} / ${formatNumber(max, { digits: 3 })}`;
  return unit ? `${amount} ${unit}` : amount;
}
function Bar({ label, value, max, unit }) {
  const share = Math.max(0, Math.min(1, value / max));
  return /* @__PURE__ */ jsxs2("div", { className: "hb-card hb-bar", children: [
    /* @__PURE__ */ jsxs2("div", { className: "hb-bar-head", children: [
      /* @__PURE__ */ jsx5("span", { className: "hb-bar-label", children: label }),
      /* @__PURE__ */ jsx5("span", { className: "hb-bar-amount", children: barAmount(value, max, unit) })
    ] }),
    /* @__PURE__ */ jsx5("div", { className: "hb-bar-track", children: /* @__PURE__ */ jsx5("span", { className: "hb-bar-fill", style: { width: `${share * 100}%` } }) })
  ] });
}

// src/blocks/atoms/read.ts
function readHeading(raw, here) {
  const text = firstText([raw.text, raw.title], 80);
  if (!text) return here.drop("heading needs text");
  return { type: "heading", text };
}
function readText(raw, here) {
  const text = firstWords([raw.text, raw.content, raw.body], 600);
  if (!text) return here.drop("text needs text");
  return { type: "text", text };
}
function readDivider() {
  return { type: "divider" };
}
function badgeTone(v) {
  const word = typeof v === "string" ? v.toLowerCase() : "";
  if (["good", "success", "positive", "ok"].includes(word)) return "good";
  if (["warn", "warning", "bad", "negative", "danger"].includes(word)) return "warn";
  return void 0;
}
function readBadge(raw, here) {
  const text = firstWords([raw.text, raw.label], 40);
  if (!text) return here.drop("badge needs text");
  return clean({ type: "badge", text, tone: badgeTone(raw.tone) });
}
function readLink(raw, here) {
  const url = https(raw.url) ?? https(raw.href);
  if (!url) return here.drop("link needs an https url");
  const text = firstText([raw.text, raw.label, raw.title], 80) ?? siteName(url);
  return { type: "link", text, url };
}
function siteName(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
function readImage(raw, here) {
  const url = https(raw.url) ?? https(raw.src) ?? https(raw.image);
  if (!url) return here.drop("image needs an https url");
  return clean({ type: "image", url, caption: firstText([raw.caption, raw.alt, raw.title], 80) });
}
function readBar(raw, here) {
  const label = firstText([raw.label, raw.title], 40);
  if (!label) return here.drop("bar needs a label");
  const value = num(raw.value);
  if (value === null) return here.drop("bar needs a numeric value");
  let max = num(raw.max) ?? num(raw.goal) ?? num(raw.total) ?? 100;
  if (max <= 0) max = 100;
  return clean({ type: "bar", label, value, max, unit: str(raw.unit, 12) });
}

// src/blocks/calculator/Calculator.tsx
import { useMemo as useMemo3, useState as useState8 } from "react";

// src/blocks/chart/chartData.ts
var CHART_KINDS = ["line", "bar", "area", "stacked", "hbar", "combo", "pie", "donut"];
var KIND_ALIASES = { doughnut: "donut", stackedbar: "stacked", horizontalbar: "hbar", barh: "hbar" };
function chartKind(name) {
  if (typeof name !== "string") return "line";
  const plain = name.toLowerCase().replace(/[\s_-]/g, "");
  const known = CHART_KINDS.find((k) => k === plain);
  if (known) return known;
  return KIND_ALIASES[plain] ?? "line";
}
function maxSeries(kind) {
  if (kind === "stacked" || kind === "area") return 6;
  return 3;
}
function isOnRightScale(kind, index, seriesUnit, axis, chartUnit) {
  if (kind !== "combo" || index === 0) return false;
  if (axis === "right") return true;
  return seriesUnit !== void 0 && seriesUnit !== chartUnit;
}
var MONTH = "(jan(uary)?|feb(ruary)?|mar(ch)?|apr(il)?|may|june?|july?|aug(ust)?|sep(t(ember)?)?|oct(ober)?|nov(ember)?|dec(ember)?)\\.?";
var YEAR = "('?\\d{2}|\\d{4})";
var FY = `(fy\\s*)?${YEAR}([-/]\\d{2,4})?`;
var ORDERED = [
  `-?\\d+(\\.\\d+)?`,
  // 2024, 7, 0.25
  `${MONTH}(\\s*[-'\u2019/]?\\s*${YEAR})?`,
  // Jan, March 2025, Jan '25, Jan-25
  `\\d{1,2}\\s+${MONTH}(,?\\s+${YEAR})?`,
  // 12 Oct, 12 Oct 2025
  `${MONTH}\\s+\\d{1,2}(,?\\s+\\d{4})?`,
  // Oct 12, Oct 12, 2025
  `q[1-4](\\s*[-'\u2019]?\\s*${FY})?`,
  // Q1, Q3 2025, Q1 FY25, Q4'24
  `${FY}\\s*-?\\s*q[1-4]`,
  // 2025 Q1, FY25 Q2
  `fy\\s*${YEAR}([-/]\\d{2,4})?`,
  // FY24, FY2024-25, FY 24-25
  `\\d{4}-\\d{2}(-\\d{2}([t ].*)?)?`,
  // 2025-11, 2025-11-03, 2025-11-03T09:15
  `\\d{1,2}[/.-]\\d{1,2}[/.-]\\d{2,4}`,
  // 03/11/2025, 3.11.25
  `(year|yr|month|week|wk|day|hour|hr)s?\\s*\\d+`
  // Year 3, Week 12
].map((p) => new RegExp(`^${p}$`, "i"));
function isOrderedLabel(label) {
  const text = String(label).trim();
  return ORDERED.some((re) => re.test(text));
}
function kindToDraw(spec) {
  if (spec.type !== "bar") return spec.type;
  const { x } = spec;
  if (x.every(isOrderedLabel)) return "bar";
  const lieDown = x.some((label) => String(label).length > 12) || x.length >= 2 && x.length <= 3 || spec.series.length === 1 && x.length >= 9;
  return lieDown ? "hbar" : "bar";
}
function changePct(data) {
  const v = data.filter((x) => x !== null);
  if (v.length < 2 || v[0] === 0) return null;
  return (v[v.length - 1] - v[0]) / Math.abs(v[0]) * 100;
}
var MAX_SLICES = 8;
function pieSlices(x, data) {
  const slices = [];
  data.forEach((v, i) => {
    if (v !== null && v > 0 && i < x.length) slices.push({ label: x[i], value: v });
  });
  if (slices.length <= MAX_SLICES) return { x: slices.map((s) => s.label), data: slices.map((s) => s.value) };
  const biggestFirst = [...slices].sort((a, b) => b.value - a.value);
  const kept = new Set(biggestFirst.slice(0, MAX_SLICES - 1));
  const shown = slices.filter((s) => kept.has(s));
  let other = 0;
  for (const s of slices) if (!kept.has(s)) other += s.value;
  return { x: [...shown.map((s) => s.label), "Other"], data: [...shown.map((s) => s.value), other] };
}
function stackSeries(series, n) {
  const up = new Array(n).fill(0);
  const down = new Array(n).fill(0);
  return series.map((s) => {
    const bands = [];
    for (let i = 0; i < n; i++) {
      const v = s.data[i] ?? null;
      if (v === null) {
        bands.push(null);
      } else if (v >= 0) {
        bands.push({ from: up[i], to: up[i] + v });
        up[i] += v;
      } else {
        bands.push({ from: down[i], to: down[i] + v });
        down[i] += v;
      }
    }
    return bands;
  });
}
function totalAt(series, i) {
  let total = null;
  for (const s of series) {
    const v = s.data[i] ?? null;
    if (v !== null) total = (total ?? 0) + v;
  }
  return total;
}
function scaleFor(values, fromZero) {
  if (!values.length) return { min: 0, max: 1 };
  let lo = Math.min(...values);
  const hi = Math.max(...values);
  if (fromZero) lo = Math.min(0, lo);
  const pad = (hi - lo || Math.abs(hi) || 1) * 0.08;
  const startsAtZero = fromZero && lo >= 0;
  return { min: startsAtZero ? 0 : lo - pad, max: hi + pad };
}
function partColour(k) {
  return `var(--hb-chart-${k % 8 + 1})`;
}
function sharePct(share) {
  const pct = share * 100;
  if (pct < 10) return `${+pct.toFixed(1)}%`;
  return `${Math.round(pct)}%`;
}
function shareNote(values, v) {
  const known = values.filter((d) => d !== null);
  const total = known.reduce((sum, d) => sum + d, 0);
  if (known.some((d) => d < 0) || total <= 0) return void 0;
  return `${sharePct(v / total)} of total`;
}
function seriesName(series, k) {
  return series[k].name ?? (series.length === 1 ? "Value" : `Series ${k + 1}`);
}
function chartScales(spec, bands) {
  if (bands) {
    const ends = bands.flat().flatMap((b) => b === null ? [] : [b.from, b.to]);
    return { left: scaleFor(ends, true), right: null };
  }
  const leftValues = spec.series.filter((s) => !s.right).flatMap((s) => numbersOf(s.data));
  const rightValues = spec.series.filter((s) => s.right).flatMap((s) => numbersOf(s.data));
  const fromZero = spec.type === "bar" || spec.type === "combo";
  const right = rightValues.length ? scaleFor(rightValues, false) : null;
  return { left: scaleFor(leftValues, fromZero), right };
}
function numbersOf(data) {
  return data.filter((v) => v !== null);
}
var SHORT_FROM = 1e5;
var MAX_UNIT = 12;
function fmt(v, unit, { full = false } = {}) {
  const scaled = (unit?.length ?? 0) > 1 ? formatAmount(v, unit) : null;
  if (scaled !== null) return scaled;
  if (unit === "%") return formatPercent(v);
  const abs = Math.abs(v);
  const rupees = unit === "\u20B9" || unit === "INR";
  const sign = rupees ? "\u20B9" : unit && /^[$€£¥]$/.test(unit) ? unit : "";
  const short = !full && abs >= SHORT_FROM;
  const digits = abs >= 1e3 ? 0 : 2;
  const s = short ? formatCompact(abs, rupees || usesLakhCrore() ? "en-IN" : void 0) : rupees ? formatIndian(abs, digits) : formatNumber(abs, { digits });
  const signed = `${v < 0 ? "-" : ""}${sign}${s}`;
  return sign || !unit || unit === "pts" || unit.length > MAX_UNIT ? signed : `${signed} ${unit}`;
}

// src/lib/formula.ts
var MAX_LENGTH = 300;
var MAX_DEPTH = 30;
var HELPERS = {
  min: [1, 10],
  max: [1, 10],
  round: [1, 2],
  abs: [1, 1],
  if: [3, 3],
  emi: [3, 3],
  sip: [3, 3],
  pct: [2, 2],
  prepay_years: [4, 4],
  prepay_interest: [4, 4],
  balance: [4, 4],
  principal_paid: [4, 4],
  interest_paid: [4, 4],
  sip_value: [3, 3]
};
function isHelper(name) {
  return Object.hasOwn(HELPERS, name);
}
var TOKEN = /\s*(?:((?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)|([A-Za-z_][A-Za-z0-9_]*)|(<=|>=|==|!=|[-+*/^(),<>]))/iy;
function tokenize(text) {
  if (text.length > MAX_LENGTH) throw new Error("formula too long");
  const tokens = [];
  TOKEN.lastIndex = 0;
  while (TOKEN.lastIndex < text.length) {
    const from = TOKEN.lastIndex;
    if (/^\s*$/.test(text.slice(from))) break;
    const m = TOKEN.exec(text);
    if (!m) throw new Error(`can't read "${text.slice(from).trim().slice(0, 12)}"`);
    tokens.push(m[1] ?? m[2] ?? m[3]);
  }
  return tokens;
}
function parseFormula(text) {
  const tokens = tokenize(text);
  let at2 = 0;
  let depth = 0;
  const peek = () => tokens[at2];
  const take = (want) => {
    const t = tokens[at2];
    if (want !== void 0 && t !== want) throw new Error(`expected ${want}`);
    at2 += 1;
    return t;
  };
  const deeper = () => {
    depth += 1;
    if (depth > MAX_DEPTH) throw new Error("formula nests too deep");
  };
  function comparison() {
    const left = sum();
    if (["<", "<=", ">", ">=", "==", "!="].includes(peek())) return { kind: "binary", op: take(), left, right: sum() };
    return left;
  }
  function sum() {
    let left = product();
    while (peek() === "+" || peek() === "-") left = { kind: "binary", op: take(), left, right: product() };
    return left;
  }
  function product() {
    let left = unary();
    while (peek() === "*" || peek() === "/") left = { kind: "binary", op: take(), left, right: unary() };
    return left;
  }
  function unary() {
    deeper();
    let node;
    if (peek() === "-") {
      take();
      node = { kind: "negate", arg: unary() };
    } else if (peek() === "+") {
      take();
      node = unary();
    } else node = power();
    depth -= 1;
    return node;
  }
  function power() {
    const base = primary();
    if (peek() === "^") {
      take();
      return { kind: "binary", op: "^", left: base, right: unary() };
    }
    return base;
  }
  function primary() {
    const t = take();
    if (t === void 0) throw new Error("formula ends too soon");
    if (/^[\d.]/.test(t)) return { kind: "number", value: Number(t) };
    if (t === "(") {
      const inside2 = comparison();
      take(")");
      return inside2;
    }
    if (!/^[A-Za-z_]/.test(t)) throw new Error(`unexpected "${t}"`);
    if (peek() !== "(") return { kind: "name", name: t };
    if (!isHelper(t)) throw new Error(`unknown helper ${t}()`);
    take("(");
    const args = [comparison()];
    while (peek() === ",") {
      take();
      args.push(comparison());
    }
    take(")");
    const [fewest, most] = HELPERS[t];
    if (args.length < fewest || args.length > most) throw new Error(`${t}() takes ${fewest === most ? fewest : `${fewest}-${most}`} values`);
    return { kind: "call", fn: t, args };
  }
  const tree = comparison();
  if (at2 < tokens.length) throw new Error(`unexpected "${tokens[at2]}"`);
  return tree;
}
function namesIn(node, found = /* @__PURE__ */ new Set()) {
  if (node.kind === "name") found.add(node.name);
  if (node.kind === "negate") namesIn(node.arg, found);
  if (node.kind === "binary") {
    namesIn(node.left, found);
    namesIn(node.right, found);
  }
  if (node.kind === "call") node.args.forEach((a) => namesIn(a, found));
  return [...found];
}
function newBudget(operations) {
  return { left: operations };
}
function spend(budget, n = 1) {
  if (!budget) return;
  budget.left -= n;
  if (budget.left < 0) throw new Error("too much work");
}
function evaluate(formula, values, budget) {
  try {
    const tree = typeof formula === "string" ? parseFormula(formula) : formula;
    const result = valueOf(tree, values, budget);
    if (!Number.isFinite(result)) return null;
    return result;
  } catch {
    return null;
  }
}
function valueOf(node, values, budget) {
  spend(budget);
  const of = (n) => valueOf(n, values, budget);
  switch (node.kind) {
    case "number":
      return node.value;
    case "name": {
      const v = values.get(node.name);
      if (v === void 0) throw new Error(`unknown name ${node.name}`);
      return v;
    }
    case "negate":
      return -of(node.arg);
    case "binary":
      return binary(node.op, of(node.left), of(node.right));
    case "call": {
      if (node.fn === "if") return of(node.args[0]) !== 0 ? of(node.args[1]) : of(node.args[2]);
      return helper(node.fn, node.args.map(of), budget);
    }
  }
}
function binary(op, a, b) {
  if (op === "+") return a + b;
  if (op === "-") return a - b;
  if (op === "*") return a * b;
  if (op === "/") return divide(a, b);
  if (op === "^") return a ** b;
  const comparisons = { "<": a < b, "<=": a <= b, ">": a > b, ">=": a >= b, "==": a === b, "!=": a !== b };
  return comparisons[op] ? 1 : 0;
}
function divide(a, b) {
  if (b === 0) throw new Error("division by zero");
  return a / b;
}
function helper(fn, args, budget) {
  switch (fn) {
    case "min":
      return Math.min(...args);
    case "max":
      return Math.max(...args);
    case "abs":
      return Math.abs(args[0]);
    case "round":
      return roundTo(args[0], args[1] ?? 0);
    case "pct":
      return divide(args[0], args[1]) * 100;
    case "emi":
      return emi(args[0], args[1], args[2]);
    case "sip":
      return sip(args[0], args[1], args[2]);
    case "prepay_years":
      return prepay(args[0], args[1], args[2], args[3], budget).months / 12;
    case "prepay_interest":
      return prepay(args[0], args[1], args[2], args[3], budget).interest;
    case "balance":
      return balance(args[0], args[1], args[2], args[3]);
    case "principal_paid":
      return principalPaid(args[0], args[1], args[2], args[3]);
    case "interest_paid":
      return interestPaid(args[0], args[1], args[2], args[3]);
    case "sip_value":
      return sip(args[0], args[1], args[2]);
  }
  throw new Error(`unknown helper ${fn}()`);
}
function roundTo(x, digits) {
  const scale = 10 ** Math.round(digits);
  return Math.round(x * scale) / scale;
}
var MAX_YEARS = 100;
function termMonths(years) {
  if (!(years <= MAX_YEARS)) throw new Error(`a loan term is at most ${MAX_YEARS} years`);
  return years * 12;
}
function emi(principal, ratePct, years) {
  const months = termMonths(years);
  if (months <= 0) throw new Error("emi needs a term");
  const r = ratePct / 12 / 100;
  if (r === 0) return principal / months;
  const growth = (1 + r) ** months;
  return principal * r * growth / (growth - 1);
}
function sip(monthly, ratePct, years) {
  const months = years * 12;
  const i = ratePct / 12 / 100;
  if (i === 0) return monthly * months;
  return monthly * ((1 + i) ** months - 1) / i * (1 + i);
}
function balance(principal, ratePct, years, afterYears) {
  const months = termMonths(years);
  if (months <= 0) throw new Error("balance needs a term");
  const paid = afterYears * 12;
  if (paid <= 0) return principal;
  if (paid >= months) return 0;
  const r = ratePct / 12 / 100;
  if (r === 0) return principal * (1 - paid / months);
  const growth = (1 + r) ** paid;
  return Math.max(0, principal * growth - emi(principal, ratePct, years) * (growth - 1) / r);
}
function principalPaid(principal, ratePct, years, afterYears) {
  return principal - balance(principal, ratePct, years, afterYears);
}
function interestPaid(principal, ratePct, years, afterYears) {
  const monthsPaid = Math.min(Math.max(afterYears * 12, 0), years * 12);
  return emi(principal, ratePct, years) * monthsPaid - principalPaid(principal, ratePct, years, afterYears);
}
function prepay(principal, ratePct, years, yearlyExtra, budget) {
  if (yearlyExtra < 0) throw new Error("the yearly extra can't be negative");
  const monthly = emi(principal, ratePct, years);
  const r = ratePct / 12 / 100;
  const lastMonth = Math.ceil(termMonths(years));
  let owed = principal;
  let interest = 0;
  let months = 0;
  while (owed > 5e-3 && months < lastMonth) {
    spend(budget);
    months += 1;
    const thisMonth = owed * r;
    interest += thisMonth;
    owed = Math.max(0, owed + thisMonth - monthly);
    if (months % 12 === 0) owed = Math.max(0, owed - yearlyExtra);
  }
  return { months, interest };
}

// src/blocks/calculator/calcChart.ts
var MAX_POINTS = 200;
var MAX_SERIES = 3;
var MAX_CHART_WORK = 1e6;
var ID = /^[A-Za-z_][A-Za-z0-9_]{0,23}$/;
function readCalcChart(raw, ids, here) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return here.drop("chart must be an object") ?? void 0;
  const x = raw.x && typeof raw.x === "object" ? raw.x : {};
  const name = str(x.name, 24);
  const nameProblem = !name || !ID.test(name) ? 'x needs a name like "y"' : ids.includes(name) ? `x name "${name}" is an input's id` : isHelper(name) ? `x name "${name}" is a helper's name` : null;
  if (nameProblem) return here.drop(nameProblem) ?? void 0;
  const from = bound(x.from) ?? 0;
  const to = bound(x.to);
  const step = bound(x.step) ?? 1;
  if (to === null) return here.drop("x needs from, to and step (numbers or formulas)") ?? void 0;
  const series = [];
  (firstList([raw.series]) ?? []).forEach((s, i) => {
    const where = here.at("series").at(i);
    const label = firstText([s?.name, s?.label], 40);
    const formula = firstText([s?.formula, s?.expr], 300);
    if (!label || !formula) return where.drop("series needs a name and a formula");
    noteUnknownNames(formula, [...ids, name], where);
    series.push({ name: label, formula });
  });
  if (!series.length) return here.drop("chart has no usable series") ?? void 0;
  const kind = chartKind(raw.kind);
  return clean({
    kind: kind === "area" || kind === "bar" ? kind : "line",
    title: firstText([raw.title], 80),
    unit: firstText([raw.unit], 12),
    x: clean({ name, from, to, step, label: labelFor(firstText([x.label], 40), name) }),
    series: keepFirst(series, MAX_SERIES, here, "series")
  });
}
function labelFor(label, name) {
  if (!label) return void 0;
  const place = `{${name}}`;
  const placeholders = label.match(/\{[^{}]*\}/g) ?? [];
  const named = placeholders.length === 1 ? label.replace(placeholders[0], place) : label;
  return named.split(place).map((part) => part.replace(/[{}]/g, "")).join(place).trim() || void 0;
}
function bound(v) {
  return num(v) ?? str(v, 300) ?? null;
}
function noteUnknownNames(formula, known, here) {
  try {
    const unknown = namesIn(parseFormula(formula)).filter((n) => !known.includes(n));
    if (unknown.length) here.drop(`formula uses ${unknown.join(", ")}, which no input has; leaves gaps`);
  } catch (e) {
    here.drop(`formula can't be read (${e.message}); leaves gaps`);
  }
}
function calcChartSpec(chart, values) {
  const budget = newBudget(MAX_CHART_WORK);
  const at2 = (b) => typeof b === "number" ? b : evaluate(b, values, budget);
  const from = at2(chart.x.from), to = at2(chart.x.to), step = at2(chart.x.step);
  if (from === null || to === null || step === null) return null;
  const xs = pointsAlong(from, to, step);
  if (!xs.length) return null;
  const trees = chart.series.map((s) => tryParse(s.formula));
  const series = chart.series.map((s, k) => {
    const data = xs.map((xv) => {
      const tree = trees[k];
      return tree ? evaluate(tree, new Map(values).set(chart.x.name, xv), budget) : null;
    });
    return { name: s.name, data, right: false };
  });
  if (series.every((s) => s.data.every((v) => v === null))) return null;
  const label = (xv) => chart.x.label ? chart.x.label.split(`{${chart.x.name}}`).join(String(xv)) : String(xv);
  const type = chart.kind === "area" && series.length > 1 ? "line" : chart.kind;
  return clean({ type, title: chart.title, x: xs.map(label), series, unit: chart.unit, figure: false });
}
function pointsAlong(from, to, step) {
  if (!(step > 0) || to < from) return [];
  const count = (s2) => Math.floor((to - from) / s2 + 1e-9) + 1;
  let s = step;
  if (count(s) > MAX_POINTS) s = step * Math.ceil(count(s) / MAX_POINTS);
  if (!Number.isFinite(count(s))) return [];
  const n = Math.min(count(s), MAX_POINTS);
  return Array.from({ length: n }, (_, i) => Math.round((from + i * s) * 1e9) / 1e9);
}
function tryParse(formula) {
  try {
    return parseFormula(formula);
  } catch {
    return null;
  }
}

// src/blocks/chart/Chart.tsx
import { useId, useMemo as useMemo2, useRef as useRef4, useState as useState7 } from "react";

// src/blocks/chart/geometry.ts
function textWidth(text, size = 11) {
  return text.length * size * 0.6;
}
function xLabelsShown(n, step, minGap) {
  if (n <= 1 || step <= 0) return [0];
  const every = Math.max(1, Math.ceil(minGap / step));
  const shown = [];
  for (let i = 0; i < n; i += every) shown.push(i);
  return shown;
}
var MAX_SLOT = 96;
var MIN_BAR = 14;
var MAX_BAR = 56;
function columnLayout(plotWidth, n, seriesCount) {
  const slot = Math.min(plotWidth / Math.max(n, 1), MAX_SLOT);
  const wanted = Math.min(Math.max(slot * 0.6 / seriesCount, MIN_BAR), MAX_BAR);
  const bar = Math.min(wanted, slot * 0.9 / seriesCount);
  return { slot, bar, start: (plotWidth - slot * n) / 2 };
}
function barPath(x, width, base, end, radius = 4) {
  const f = (n) => +n.toFixed(1);
  const r = Math.min(radius, width / 2, Math.abs(base - end));
  const toward = end < base ? 1 : -1;
  const x2 = x + width;
  return `M${f(x)},${f(base)}V${f(end + toward * r)}Q${f(x)},${f(end)} ${f(x + r)},${f(end)}H${f(x2 - r)}Q${f(x2)},${f(end)} ${f(x2)},${f(end + toward * r)}V${f(base)}Z`;
}
var STRAIGHT_UP_TO = 12;
function linePath(pts) {
  if (pts.length > STRAIGHT_UP_TO) return smoothPath(pts);
  const f = (n) => +n.toFixed(1);
  return pts.map(([x, y], i) => `${i ? "L" : "M"}${f(x)},${f(y)}`).join("");
}
function smoothPath(pts) {
  if (!pts.length) return "";
  const f = (n) => +n.toFixed(1);
  let d = `M${f(pts[0][0])},${f(pts[0][1])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? p2;
    d += ` C${f(p1[0] + (p2[0] - p0[0]) / 6)},${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)},${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])},${f(p2[1])}`;
  }
  return d;
}
function spreadLabels(ys, gap = 14, bottom = Infinity) {
  const order = ys.map((_, i) => i).sort((a, b) => ys[a] - ys[b]);
  const placed = order.map((i) => ys[i]);
  for (let k = 1; k < placed.length; k++) placed[k] = Math.max(placed[k], placed[k - 1] + gap);
  if (placed.length && placed[placed.length - 1] > bottom) {
    placed[placed.length - 1] = bottom;
    for (let k = placed.length - 2; k >= 0; k--) placed[k] = Math.min(placed[k], placed[k + 1] - gap);
  }
  const out = new Array(ys.length);
  order.forEach((i, k) => out[i] = placed[k]);
  return out;
}
function niceTicks(lo, hi, steps = 3) {
  if (lo === hi) [lo, hi] = [lo - 1, hi + 1];
  const raw = (hi - lo) / steps;
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = power * ([1, 2, 2.5, 5].find((f) => raw / power <= f) ?? 10);
  const ticks = [];
  for (let k = Math.floor(lo / step); k <= Math.ceil(hi / step); k++) ticks.push(+(k * step).toFixed(10));
  return ticks;
}

// src/blocks/chart/layout.ts
var COLUMNS_H = 210;
var LINES_H = 220;
var TOP = 10;
var BOTTOM = 26;
var VALUE_ROOM = 16;
var SIDE = 8;
var MAX_VALUE_LABELS = 12;
var LINE_LABEL_GAP = 80;
var END_NAME_MAX = 16;
var TICK_GAP = 8;
function isChangeLine(spec) {
  return spec.type === "line" && spec.tone === "change" && spec.series.length === 1;
}
function seriesEnds(data) {
  const first = data.find((v) => v !== null) ?? null;
  let last = data.length - 1;
  while (last >= 0 && data[last] === null) last--;
  return { first, last };
}
function valueColour(spec, k, v) {
  if (!isChangeLine(spec)) return partColour(k);
  const start = seriesEnds(spec.series[0].data).first ?? v;
  return v >= start ? "var(--hb-good)" : "var(--hb-warn)";
}
var unitOf = (spec, s) => s.unit ?? spec.unit;
function xyLayout(spec, width, scales) {
  const n = spec.x.length;
  const slotted = spec.type === "bar" || spec.type === "stacked" || spec.type === "combo";
  const H = slotted ? COLUMNS_H : LINES_H;
  const base = H - BOTTOM;
  const endTexts = spec.type === "line" ? lineEndTexts(spec) : [];
  const ticks = gridTicks(spec);
  const tickRoom = ticks.length ? TICK_GAP + Math.max(...ticks.map((t) => textWidth(fmt(t, spec.unit)))) : 0;
  const left = (slotted ? 4 : SIDE) + tickRoom;
  const endRoom = endTexts.length ? Math.min(110, 14 + Math.max(...endTexts.map((e) => textWidth(e.text, 11.5)))) : 0;
  const right = width - (endRoom || (slotted ? 4 : SIDE));
  const plotWidth = right - left;
  const perSlot = spec.type === "bar" ? spec.series.length : 1;
  const columns = columnLayout(plotWidth, n, perSlot);
  const xAt = (i) => slotted ? left + columns.start + columns.slot * (i + 0.5) : left + (n === 1 ? plotWidth / 2 : plotWidth * i / (n - 1));
  const step = slotted ? columns.slot : n > 1 ? plotWidth / (n - 1) : 0;
  const valueLabels = spec.type === "bar" && n * perSlot <= MAX_VALUE_LABELS && spec.series.every((s) => s.data.every((v) => v === null || textWidth(fmt(v, unitOf(spec, s)), 11.5) <= columns.slot / perSlot));
  const top = TOP + (valueLabels ? VALUE_ROOM : 0);
  const scaleY = ({ min, max }) => (v) => top + (base - top) * (1 - (v - min) / (max - min || 1));
  const yAt = scaleY(ticks.length ? { min: ticks[0], max: ticks[ticks.length - 1] } : scales.left);
  const yRight = scales.right ? scaleY(scales.right) : yAt;
  const yOf = (s) => s.right ? yRight : yAt;
  const longest = Math.max(...spec.x.map((label) => textWidth(String(label))));
  const minGap = slotted ? longest + 8 : Math.max(LINE_LABEL_GAP, longest + 12);
  const xLabels = xLabelsShown(n, step, minGap);
  const dotYs = endTexts.map((e) => yAt(e.value));
  const textYs = spreadLabels(dotYs, 14, base);
  const placedEnds = endTexts.map((e, j) => ({
    series: e.series,
    at: e.at,
    text: e.text,
    dotY: dotYs[j],
    y: textYs[j],
    dot: valueColour(spec, e.series, e.value),
    ink: spec.series.length === 1 ? "var(--hb-ink)" : partColour(e.series)
  }));
  return {
    W: width,
    H,
    left,
    right,
    top,
    base,
    slotted,
    bar: columns.bar,
    xAt,
    yAt,
    yOf,
    xLabels,
    valueLabels,
    ends: placedEnds,
    ticks
  };
}
function gridTicks(spec) {
  if (spec.type !== "line" || spec.series.length < 2) return [];
  const values = spec.series.flatMap((s) => s.data.filter((v) => v !== null));
  return values.length ? niceTicks(Math.min(...values), Math.max(...values)) : [];
}
var START_ABOVE = 6;
var START_BELOW = 14;
var LETTER_H = 9;
var BELOW_ROOM = 6;
function startLabelY(points, from, to, y, base) {
  const ys = heightsUnder(points, from, to);
  const rise = y - Math.min(y, ...ys);
  const fall = Math.max(y, ...ys) - y;
  const above = y - START_ABOVE;
  const below = y + START_BELOW;
  if (rise > fall) return below <= base + BELOW_ROOM ? below : above;
  return above - LETTER_H >= 0 ? above : below;
}
function heightsUnder(points, from, to) {
  const ys = [];
  points.forEach(([x, y], j) => {
    if (x >= from && x <= to) ys.push(y);
    const next = points[j + 1];
    if (!next) return;
    for (const edge of [from, to]) {
      if (x < edge && next[0] > edge) ys.push(y + (next[1] - y) * (edge - x) / (next[0] - x));
    }
  });
  return ys;
}
function lineEndTexts(spec) {
  const one = spec.series.length === 1;
  return spec.series.flatMap((s, k) => {
    const at2 = seriesEnds(s.data).last;
    if (at2 < 0) return [];
    const value = s.data[at2];
    const name = seriesName(spec.series, k);
    const text = one ? fmt(value, unitOf(spec, s)) : name.length > END_NAME_MAX ? `${name.slice(0, END_NAME_MAX - 1)}\u2026` : name;
    return [{ series: k, at: at2, value, text }];
  });
}
function xyTip(spec, i, layout) {
  const rows = [];
  let y = layout.base;
  let pile = 0;
  spec.series.forEach((s, k) => {
    const v = s.data[i] ?? null;
    if (v === null) return;
    rows.push({ colour: valueColour(spec, k, v), name: seriesName(spec.series, k), value: fmt(v, unitOf(spec, s), { full: true }) });
    pile += Math.max(v, 0);
    y = Math.min(y, layout.yOf(s)(spec.type === "stacked" || spec.type === "area" ? pile : v));
  });
  return { x: layout.xAt(i), y, title: String(spec.x[i]), rows, note: tipNote(spec, i) };
}
function tipNote(spec, i) {
  if (spec.series.length !== 1 || spec.type !== "line") return void 0;
  const data = spec.series[0].data;
  const v = data[i] ?? null;
  const start = data.findIndex((d) => d !== null);
  const first = data[start];
  if (v === null || i <= start || first === 0) return void 0;
  return `${formatChange((v - first) / Math.abs(first) * 100)} since start`;
}

// src/blocks/chart/useWidth.ts
import { useLayoutEffect, useState as useState3 } from "react";
var UNMEASURED_WIDTH = 560;
function useWidth(ref) {
  const [width, setWidth] = useState3(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setWidth(Math.round(el.getBoundingClientRect().width));
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const watcher = new ResizeObserver(measure);
    watcher.observe(el);
    return () => watcher.disconnect();
  }, [ref]);
  return width || UNMEASURED_WIDTH;
}

// src/blocks/chart/pick.ts
function stepPick(at2, key, n, rows = false) {
  const next = key === "ArrowRight" || rows && key === "ArrowDown";
  const back = key === "ArrowLeft" || rows && key === "ArrowUp";
  if (key === "Escape") return null;
  if (next) return at2 === null ? 0 : Math.min(n - 1, at2 + 1);
  if (back) return at2 === null ? n - 1 : Math.max(0, at2 - 1);
  return void 0;
}
function pickKeys(n, at2, pick, rows = false) {
  return {
    tabIndex: 0,
    onKeyDown: (e) => {
      const next = stepPick(at2, e.key, n, rows);
      if (next === void 0) return;
      e.preventDefault();
      pick(next);
    },
    onBlur: () => pick(null)
  };
}

// src/blocks/chart/ChartTip.tsx
import { useLayoutEffect as useLayoutEffect2, useRef, useState as useState4 } from "react";
import { Fragment as Fragment2, jsx as jsx6, jsxs as jsxs3 } from "react/jsx-runtime";
var GAP = 12;
function tipPlace(x, y, tipWidth, tipHeight, boxWidth) {
  let left = x + GAP;
  if (left + tipWidth > boxWidth - 2) left = Math.max(2, x - GAP - tipWidth);
  let top = y - tipHeight - GAP;
  if (top < -8) top = y + 14;
  return { left, top };
}
function ChartTip({ tip }) {
  const card = useRef(null);
  const [kept, setKept] = useState4(tip);
  if (tip && tip !== kept) setKept(tip);
  const shown = tip ?? kept;
  useLayoutEffect2(() => {
    const el = card.current;
    if (!el || !tip) return;
    const box = el.offsetParent;
    const { left, top } = tipPlace(tip.x, tip.y, el.offsetWidth, el.offsetHeight, box?.clientWidth ?? 0);
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
  }, [tip]);
  return /* @__PURE__ */ jsx6("div", { ref: card, className: `hb-tip${tip ? " hb-tip-on" : ""}`, role: "status", "aria-live": "polite", children: shown && /* @__PURE__ */ jsxs3(Fragment2, { children: [
    /* @__PURE__ */ jsx6("div", { className: "hb-tip-title", children: shown.title }),
    shown.rows.map((row, k) => /* @__PURE__ */ jsxs3("div", { className: "hb-tip-row", children: [
      /* @__PURE__ */ jsx6("i", { style: { background: row.colour } }),
      /* @__PURE__ */ jsx6("span", { className: "hb-tip-name", children: row.name }),
      /* @__PURE__ */ jsx6("b", { className: "hb-tip-value", children: row.value })
    ] }, k)),
    shown.note && /* @__PURE__ */ jsx6("div", { className: "hb-tip-note", children: shown.note })
  ] }) });
}

// src/blocks/chart/Legend.tsx
import { jsx as jsx7, jsxs as jsxs4 } from "react/jsx-runtime";
function ChartLegend({ series, at: at2, unit }) {
  return /* @__PURE__ */ jsx7("div", { className: "hb-legend", children: series.map((s, k) => {
    const value = at2 === void 0 ? null : s.data[at2] ?? null;
    return /* @__PURE__ */ jsxs4("span", { className: "hb-legend-item", children: [
      /* @__PURE__ */ jsx7("i", { className: "hb-legend-dot", style: { background: partColour(k) } }),
      seriesName(series, k),
      value !== null && /* @__PURE__ */ jsx7("span", { className: "hb-legend-value", children: fmt(value, s.unit ?? unit) }),
      s.right && /* @__PURE__ */ jsx7("span", { className: "hb-legend-note", children: "(right scale)" })
    ] }, k);
  }) });
}

// src/blocks/chart/LineMarks.tsx
import { jsx as jsx8, jsxs as jsxs5 } from "react/jsx-runtime";
function LineMarks({ spec, layout, gid, hover }) {
  const { xAt, yAt, left, right, top, base } = layout;
  const one = spec.series.length === 1;
  const start = isChangeLine(spec) ? seriesEnds(spec.series[0].data).first : null;
  const zero = yAt(0);
  const showZero = !one && zero > top && zero < base;
  return /* @__PURE__ */ jsxs5("g", { children: [
    layout.ticks.length ? /* @__PURE__ */ jsx8(Gridlines, { spec, layout }) : /* @__PURE__ */ jsx8("line", { x1: left, x2: right, y1: base, y2: base, className: "hb-chart-rule" }),
    showZero && /* @__PURE__ */ jsx8("line", { x1: left, x2: right, y1: zero, y2: zero, className: "hb-chart-rule-strong", strokeDasharray: "3 3" }),
    start !== null && /* @__PURE__ */ jsx8(StartMark, { spec, layout, gid, start }),
    spec.series.map((s, k) => {
      const pts = pointsOf(s.data, layout);
      if (!pts.length) return null;
      return /* @__PURE__ */ jsx8(
        "path",
        {
          d: linePath(pts),
          fill: "none",
          stroke: start !== null ? `url(#change-${gid})` : partColour(k),
          strokeWidth: one ? 2.25 : 1.75,
          strokeLinejoin: "round",
          strokeLinecap: "round",
          pathLength: 1,
          strokeDasharray: "1",
          strokeDashoffset: "1",
          className: "hb-chart-line hb-chart-draw"
        },
        k
      );
    }),
    layout.ends.map((e) => /* @__PURE__ */ jsxs5("g", { children: [
      /* @__PURE__ */ jsx8("circle", { cx: xAt(e.at), cy: e.dotY, r: "3.5", fill: e.dot, className: "hb-chart-dot" }),
      /* @__PURE__ */ jsx8("text", { x: xAt(e.at) + 8, y: e.y + 4, className: "hb-chart-end", style: { fill: e.ink }, children: e.text })
    ] }, e.series)),
    hover !== null && /* @__PURE__ */ jsxs5("g", { children: [
      /* @__PURE__ */ jsx8(Crosshair, { layout, at: hover }),
      spec.series.map((s, k) => {
        const v = s.data[hover] ?? null;
        return v === null ? null : /* @__PURE__ */ jsx8("circle", { cx: xAt(hover), cy: yAt(v), r: "4", fill: valueColour(spec, k, v), className: "hb-chart-dot" }, k);
      })
    ] })
  ] });
}
function Gridlines({ spec, layout }) {
  const { left, right, yAt } = layout;
  return /* @__PURE__ */ jsx8("g", { children: layout.ticks.map((t) => /* @__PURE__ */ jsxs5("g", { children: [
    /* @__PURE__ */ jsx8("line", { x1: left, x2: right, y1: yAt(t), y2: yAt(t), className: "hb-chart-rule" }),
    /* @__PURE__ */ jsx8("text", { x: left - TICK_GAP, y: yAt(t) + 4, textAnchor: "end", className: "hb-chart-tick", children: fmt(t, spec.unit) })
  ] }, t)) });
}
function pointsOf(data, { xAt, yAt }) {
  return data.flatMap((v, i) => v === null ? [] : [[xAt(i), yAt(v)]]);
}
function StartMark({ spec, layout, gid, start }) {
  const { left, right, top, base, yAt } = layout;
  const y = yAt(start);
  const at2 = Math.min(1, Math.max(0, (y - top) / (base - top || 1)));
  const label = `Start ${fmt(start, spec.series[0].unit ?? spec.unit)}`;
  const labelY = startLabelY(pointsOf(spec.series[0].data, layout), left, left + 2 + textWidth(label), y, base);
  return /* @__PURE__ */ jsxs5("g", { children: [
    /* @__PURE__ */ jsx8("defs", { children: /* @__PURE__ */ jsxs5("linearGradient", { id: `change-${gid}`, gradientUnits: "userSpaceOnUse", x1: "0", x2: "0", y1: top, y2: base, children: [
      /* @__PURE__ */ jsx8("stop", { offset: at2, style: { stopColor: "var(--hb-good)" } }),
      /* @__PURE__ */ jsx8("stop", { offset: at2, style: { stopColor: "var(--hb-warn)" } })
    ] }) }),
    /* @__PURE__ */ jsx8("line", { x1: left, x2: right, y1: y, y2: y, className: "hb-chart-rule-strong", strokeDasharray: "3 3" }),
    /* @__PURE__ */ jsx8("text", { x: left + 2, y: labelY, className: "hb-chart-axis hb-chart-halo", children: label })
  ] });
}
function Crosshair({ layout, at: at2 }) {
  const x = layout.xAt(at2);
  return /* @__PURE__ */ jsx8("line", { x1: x, x2: x, y1: layout.top, y2: layout.base, className: "hb-chart-rule-strong" });
}

// src/blocks/chart/ColumnMarks.tsx
import { jsx as jsx9, jsxs as jsxs6 } from "react/jsx-runtime";
var SERIES_GAP = 2;
var shade = (hover, i) => hover === null || hover === i ? 1 : 0.55;
function Baseline({ layout }) {
  const y = layout.yAt(0);
  return /* @__PURE__ */ jsx9("line", { x1: layout.left, x2: layout.right, y1: y, y2: y, className: "hb-chart-rule-strong" });
}
function BarMarks({ spec, layout, hover }) {
  const { xAt, yAt, bar } = layout;
  const count = spec.series.length;
  const zero = yAt(0);
  return /* @__PURE__ */ jsxs6("g", { children: [
    spec.series.map((s, k) => s.data.map((v, i) => {
      if (v === null) return null;
      const x = xAt(i) - bar * count / 2 + k * bar;
      const width = count > 1 ? bar - SERIES_GAP : bar;
      const end = yAt(v);
      return /* @__PURE__ */ jsxs6("g", { opacity: shade(hover, i), children: [
        /* @__PURE__ */ jsx9("path", { d: barPath(x, width, zero, end), fill: partColour(k), className: "hb-chart-bar" }),
        layout.valueLabels && /* @__PURE__ */ jsx9("text", { x: x + width / 2, y: v < 0 ? end + 14 : end - 6, textAnchor: "middle", className: "hb-chart-value", children: fmt(v, s.unit ?? spec.unit) })
      ] }, `${k}-${i}`);
    })),
    /* @__PURE__ */ jsx9(Baseline, { layout })
  ] });
}
function StackMarks({ bands, layout, hover }) {
  const { xAt, yAt, bar } = layout;
  return /* @__PURE__ */ jsxs6("g", { children: [
    bands.map((partBands, k) => partBands.map((b, i) => b === null || b.from === b.to ? null : /* @__PURE__ */ jsx9(
      "rect",
      {
        x: xAt(i) - bar / 2,
        y: Math.min(yAt(b.from), yAt(b.to)),
        width: bar,
        height: Math.max(Math.abs(yAt(b.from) - yAt(b.to)) - 2, 1),
        rx: "3",
        fill: partColour(k),
        opacity: shade(hover, i)
      },
      `${k}-${i}`
    ))),
    /* @__PURE__ */ jsx9(Baseline, { layout })
  ] });
}
function ComboMarks({ spec, layout, hover }) {
  const { xAt, yAt, bar } = layout;
  const zero = yAt(0);
  return /* @__PURE__ */ jsxs6("g", { children: [
    spec.series[0].data.map((v, i) => v === null ? null : /* @__PURE__ */ jsx9("path", { d: barPath(xAt(i) - bar / 2, bar, zero, yAt(v)), fill: partColour(0), opacity: shade(hover, i), className: "hb-chart-bar" }, i)),
    /* @__PURE__ */ jsx9(Baseline, { layout }),
    spec.series.slice(1).map((s, j) => {
      const y = layout.yOf(s);
      const pts = s.data.flatMap((v, i) => v === null ? [] : [[xAt(i), y(v)]]);
      if (!pts.length) return null;
      const colour = partColour(j + 1);
      return /* @__PURE__ */ jsxs6("g", { children: [
        /* @__PURE__ */ jsx9("path", { d: linePath(pts), fill: "none", stroke: colour, strokeWidth: "2.25", strokeLinejoin: "round", strokeLinecap: "round" }),
        pts.map(([cx, cy], i) => /* @__PURE__ */ jsx9("circle", { cx, cy, r: "3.5", fill: colour, className: "hb-chart-dot" }, i))
      ] }, j);
    })
  ] });
}

// src/blocks/chart/AreaMarks.tsx
import { jsx as jsx10, jsxs as jsxs7 } from "react/jsx-runtime";
function AreaMarks({ bands, layout }) {
  return /* @__PURE__ */ jsxs7("g", { children: [
    /* @__PURE__ */ jsx10("line", { x1: layout.left, x2: layout.right, y1: layout.base, y2: layout.base, className: "hb-chart-rule" }),
    bands.map((partBands, k) => /* @__PURE__ */ jsx10(Area, { bands: partBands, layout, colour: partColour(k) }, k))
  ] });
}
function Area({ bands, layout, colour }) {
  const top = [];
  const bottom = [];
  bands.forEach((b, i) => {
    if (b === null) return;
    top.push([layout.xAt(i), layout.yAt(b.to)]);
    bottom.push([layout.xAt(i), layout.yAt(b.from)]);
  });
  if (!top.length) return null;
  const topEdge = linePath(top);
  const backAlongBottom = linePath(bottom.reverse()).replace(/^M/, "L");
  return /* @__PURE__ */ jsxs7("g", { children: [
    /* @__PURE__ */ jsx10("path", { d: `${topEdge} ${backAlongBottom} Z`, fill: colour, fillOpacity: ".3" }),
    /* @__PURE__ */ jsx10("path", { d: topEdge, fill: "none", stroke: colour, strokeWidth: "2", strokeLinejoin: "round", strokeLinecap: "round" })
  ] });
}

// src/blocks/chart/HBarChart.tsx
import { Fragment as Fragment3, useRef as useRef2, useState as useState5 } from "react";
import { jsx as jsx11, jsxs as jsxs8 } from "react/jsx-runtime";
function HBarChart({ spec }) {
  const [tip, setTip] = useState5(null);
  const [picked, setPicked] = useState5(null);
  const box = useRef2(null);
  const tracks = useRef2([]);
  const values = spec.series.flatMap((s) => s.data.filter((v) => v !== null));
  const lo = Math.min(0, ...values);
  const hi = Math.max(0, ...values);
  const span = hi - lo || 1;
  const zeroAt = -lo / span * 100;
  const single = spec.series.length === 1;
  const signed = lo < 0;
  const colourOf2 = (k, v) => {
    if (!single || !signed) return partColour(k);
    return v >= 0 ? "var(--hb-good)" : "var(--hb-warn)";
  };
  const unitOf2 = (k) => spec.series[k].unit ?? spec.unit;
  const barOf = (v) => {
    const width = Math.max(Math.abs(v) / span * 100, 1.5);
    return { left: v < 0 ? zeroAt - width : zeroAt, width };
  };
  function pick(i) {
    setPicked(i);
    const track = i === null ? null : tracks.current[i];
    if (i === null || !track || !box.current) return setTip(null);
    const rows = [];
    let end = zeroAt;
    spec.series.forEach((s, k) => {
      const v = s.data[i] ?? null;
      if (v === null) return;
      rows.push({ colour: colourOf2(k, v), name: seriesName(spec.series, k), value: fmt(v, unitOf2(k), { full: true }) });
      const { left, width } = barOf(v);
      end = Math.max(end, left + width);
    });
    const t = track.getBoundingClientRect();
    const b = box.current.getBoundingClientRect();
    setTip({ x: t.left - b.left + t.width * end / 100, y: t.top - b.top, title: String(spec.x[i]), rows });
  }
  const shade2 = (i) => picked === null || picked === i ? 1 : 0.55;
  const rowEvents = (i) => ({ onPointerEnter: () => pick(i), onPointerDown: () => pick(i) });
  return /* @__PURE__ */ jsxs8("figure", { className: "hb-card hb-chart", children: [
    /* @__PURE__ */ jsx11("figcaption", { className: "hb-chart-title", children: spec.title ?? spec.series[0].name ?? "Chart" }),
    !single && /* @__PURE__ */ jsx11(ChartLegend, { series: spec.series }),
    /* @__PURE__ */ jsxs8("div", { ref: box, className: "hb-hbar-box", children: [
      /* @__PURE__ */ jsx11(
        "div",
        {
          className: `hb-hbar-grid${single ? "" : " hb-hbar-many"}`,
          role: "img",
          "aria-label": spec.title ?? "chart",
          ...pickKeys(spec.x.length, picked, pick, true),
          onPointerLeave: () => pick(null),
          children: spec.x.map((label, i) => /* @__PURE__ */ jsxs8(Fragment3, { children: [
            /* @__PURE__ */ jsx11("div", { className: "hb-hbar-label", ...rowEvents(i), children: label }),
            /* @__PURE__ */ jsx11("div", { className: "hb-hbar-tracks", ref: (el) => {
              tracks.current[i] = el;
            }, ...rowEvents(i), children: spec.series.map((s, k) => {
              const v = s.data[i] ?? null;
              const bar = v === null ? null : barOf(v);
              return /* @__PURE__ */ jsxs8("div", { className: "hb-hbar-track", children: [
                signed && /* @__PURE__ */ jsx11("div", { className: "hb-hbar-zero", style: { left: `${zeroAt}%` } }),
                v !== null && bar && /* @__PURE__ */ jsx11("div", { className: "hb-hbar-bar", style: {
                  left: `${bar.left}%`,
                  width: `${bar.width}%`,
                  background: colourOf2(k, v),
                  opacity: shade2(i)
                } })
              ] }, k);
            }) }),
            /* @__PURE__ */ jsx11("div", { className: "hb-hbar-values", ...rowEvents(i), children: spec.series.map((s, k) => {
              const v = s.data[i] ?? null;
              const tone = single && signed && v !== null ? v >= 0 ? " hb-hbar-up" : " hb-hbar-down" : "";
              return /* @__PURE__ */ jsx11("span", { className: `hb-hbar-value${tone}`, children: v === null ? "\u2013" : fmt(v, unitOf2(k)) }, k);
            }) })
          ] }, i))
        }
      ),
      /* @__PURE__ */ jsx11(ChartTip, { tip })
    ] }),
    spec.source && /* @__PURE__ */ jsx11("div", { className: "hb-chart-source", children: spec.source })
  ] });
}

// src/blocks/chart/PieChart.tsx
import { useRef as useRef3, useState as useState6 } from "react";
import { jsx as jsx12, jsxs as jsxs9 } from "react/jsx-runtime";
var BOX = 168;
var C = BOX / 2;
var OUTER = 80;
var HOLE = 52;
function at(turn, r) {
  const a = turn * 2 * Math.PI;
  return [+(C + r * Math.sin(a)).toFixed(2), +(C - r * Math.cos(a)).toFixed(2)];
}
function slicePath(start, end, hole) {
  const stop = Math.min(end, start + 0.9999);
  const large = stop - start > 0.5 ? 1 : 0;
  const [x1, y1] = at(start, OUTER);
  const [x2, y2] = at(stop, OUTER);
  if (hole === 0) return `M${C},${C} L${x1},${y1} A${OUTER},${OUTER} 0 ${large} 1 ${x2},${y2} Z`;
  const [x3, y3] = at(stop, hole);
  const [x4, y4] = at(start, hole);
  return `M${x1},${y1} A${OUTER},${OUTER} 0 ${large} 1 ${x2},${y2} L${x3},${y3} A${hole},${hole} 0 ${large} 0 ${x4},${y4} Z`;
}
function shortLabel(label) {
  if (label.length <= 15) return label;
  return `${label.slice(0, 14)}\u2026`;
}
function sliceColour(label, i) {
  if (label === "Other") return "var(--hb-muted)";
  return partColour(i);
}
function PieChart({ spec }) {
  const [picked, setPicked] = useState6(null);
  const [tip, setTip] = useState6(null);
  const svg = useRef3(null);
  const values = spec.series[0].data;
  const total = values.reduce((sum, v) => sum + v, 0);
  const unit = spec.series[0].unit ?? spec.unit;
  const donut = spec.type === "donut";
  const hole = donut ? HOLE : 0;
  const slices = [];
  let start = 0;
  for (const v of values) {
    slices.push({ start, end: start + v / total });
    start += v / total;
  }
  const valuesAreShares = unit === "%";
  const biggest = values.indexOf(Math.max(...values));
  const headline = valuesAreShares ? { value: sharePct(values[biggest] / total), label: String(spec.x[biggest]) } : { value: fmt(total, unit), label: "Total" };
  function pick(i) {
    setPicked(i);
    const el = svg.current;
    const body = el?.parentElement;
    if (i === null || !el || !body) return setTip(null);
    const [x, y] = at((slices[i].start + slices[i].end) / 2, donut ? (OUTER + HOLE) / 2 : OUTER * 0.6);
    const drawing = el.getBoundingClientRect();
    const around = body.getBoundingClientRect();
    const label = String(spec.x[i]);
    setTip({
      x: drawing.left - around.left + x,
      y: drawing.top - around.top + y,
      title: label,
      rows: [{ colour: sliceColour(label, i), name: seriesName(spec.series, 0), value: fmt(values[i], unit, { full: true }) }],
      note: valuesAreShares ? void 0 : shareNote(values, values[i])
    });
  }
  const toggle = (i) => pick(picked === i ? null : i);
  const faded = (i) => picked === null || picked === i ? 1 : 0.5;
  const mouse = (i) => (e) => e.pointerType === "mouse" && pick(i);
  return /* @__PURE__ */ jsxs9("figure", { className: "hb-card hb-chart hb-pie", children: [
    /* @__PURE__ */ jsx12("figcaption", { className: "hb-chart-title", children: spec.title ?? spec.series[0].name ?? "Chart" }),
    !donut && /* @__PURE__ */ jsxs9("div", { className: "hb-chart-figure", children: [
      /* @__PURE__ */ jsx12("span", { className: "hb-chart-big", children: headline.value }),
      /* @__PURE__ */ jsx12("span", { className: "hb-chart-at", children: headline.label })
    ] }),
    /* @__PURE__ */ jsxs9("div", { className: "hb-pie-body", children: [
      /* @__PURE__ */ jsxs9(
        "svg",
        {
          ref: svg,
          width: BOX,
          height: BOX,
          viewBox: `0 0 ${BOX} ${BOX}`,
          className: "hb-pie-svg",
          role: "img",
          "aria-label": spec.title ?? "chart",
          ...pickKeys(values.length, picked, pick),
          children: [
            slices.map((s, i) => /* @__PURE__ */ jsx12(
              "path",
              {
                d: slicePath(s.start, s.end, hole),
                fill: sliceColour(String(spec.x[i]), i),
                opacity: faded(i),
                className: "hb-slice",
                onClick: () => toggle(i),
                onPointerEnter: mouse(i),
                onPointerLeave: mouse(null)
              },
              i
            )),
            donut && /* @__PURE__ */ jsxs9("g", { textAnchor: "middle", pointerEvents: "none", children: [
              /* @__PURE__ */ jsx12("text", { x: C, y: C - 2, className: "hb-pie-total", children: headline.value }),
              /* @__PURE__ */ jsx12("text", { x: C, y: C + 15, className: "hb-chart-axis", children: shortLabel(headline.label) })
            ] })
          ]
        }
      ),
      /* @__PURE__ */ jsx12("table", { className: "hb-pie-legend", children: /* @__PURE__ */ jsx12("tbody", { children: values.map((v, i) => /* @__PURE__ */ jsxs9("tr", { onClick: () => toggle(i), onPointerEnter: mouse(i), onPointerLeave: mouse(null), style: { opacity: faded(i) }, children: [
        /* @__PURE__ */ jsx12("td", { className: "hb-pie-swatch", children: /* @__PURE__ */ jsx12("i", { style: { background: sliceColour(String(spec.x[i]), i) } }) }),
        /* @__PURE__ */ jsx12("td", { className: "hb-pie-name", children: spec.x[i] }),
        !valuesAreShares && /* @__PURE__ */ jsx12("td", { className: "hb-pie-value", children: fmt(v, unit) }),
        /* @__PURE__ */ jsx12("td", { className: "hb-pie-share", children: sharePct(v / total) })
      ] }, i)) }) }),
      /* @__PURE__ */ jsx12(ChartTip, { tip })
    ] }),
    spec.source && /* @__PURE__ */ jsx12("div", { className: "hb-chart-source", children: spec.source })
  ] });
}

// src/blocks/chart/Chart.tsx
import { Fragment as Fragment4, jsx as jsx13, jsxs as jsxs10 } from "react/jsx-runtime";
var WIDE_FROM = 60;
function Chart({ spec }) {
  if (spec.type === "pie" || spec.type === "donut") return /* @__PURE__ */ jsx13(PieChart, { spec });
  if (kindToDraw(spec) === "hbar") return /* @__PURE__ */ jsx13(HBarChart, { spec });
  return /* @__PURE__ */ jsx13(XYChart, { spec });
}
function XYChart({ spec }) {
  const plot = useRef4(null);
  const svg = useRef4(null);
  const width = useWidth(plot);
  const [hover, setHover] = useState7(null);
  const gid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const n = spec.x.length;
  const piled = spec.type === "stacked" || spec.type === "area";
  const bands = useMemo2(() => piled ? stackSeries(spec.series, n) : null, [spec, n, piled]);
  const scales = useMemo2(() => chartScales(spec, bands), [spec, bands]);
  const layout = useMemo2(() => xyLayout(spec, width, scales), [spec, width, scales]);
  const tip = useMemo2(() => hover === null ? null : xyTip(spec, hover, layout), [spec, hover, layout]);
  function pickAt(e) {
    const r = svg.current?.getBoundingClientRect();
    if (!r || !r.width) return;
    const x = (e.clientX - r.left) / r.width * layout.W;
    let best = 0;
    for (let i = 1; i < n; i++) if (Math.abs(layout.xAt(i) - x) < Math.abs(layout.xAt(best) - x)) best = i;
    setHover(best);
  }
  const multiLegend = spec.type === "combo" || spec.type === "bar" && spec.series.length > 1 || spec.type === "line" && spec.series.length > 1;
  const wide = spec.type === "line" && n >= WIDE_FROM;
  return /* @__PURE__ */ jsxs10("figure", { className: `hb-card hb-chart${wide ? " hb-chart-wide" : ""}`, children: [
    /* @__PURE__ */ jsx13(Headline, { spec, hover }),
    /* @__PURE__ */ jsxs10("div", { ref: plot, className: "hb-chart-plot", children: [
      /* @__PURE__ */ jsxs10(
        "svg",
        {
          ref: svg,
          width: "100%",
          height: layout.H,
          viewBox: `0 0 ${layout.W} ${layout.H}`,
          className: "hb-chart-svg",
          role: "img",
          "aria-label": spec.title ?? "chart",
          ...pickKeys(n, hover, setHover),
          onPointerDown: pickAt,
          onPointerMove: (e) => (e.buttons || e.pointerType === "mouse") && pickAt(e),
          onPointerLeave: () => setHover(null),
          children: [
            /* @__PURE__ */ jsx13(XLabels, { spec, layout }),
            spec.type === "line" && /* @__PURE__ */ jsx13(LineMarks, { spec, layout, gid, hover }),
            spec.type === "bar" && /* @__PURE__ */ jsx13(BarMarks, { spec, layout, hover }),
            spec.type === "stacked" && bands && /* @__PURE__ */ jsx13(StackMarks, { bands, layout, hover }),
            spec.type === "area" && bands && /* @__PURE__ */ jsx13(AreaMarks, { bands, layout }),
            spec.type === "combo" && /* @__PURE__ */ jsx13(ComboMarks, { spec, layout, hover }),
            (spec.type === "area" || spec.type === "combo") && hover !== null && /* @__PURE__ */ jsx13(Crosshair, { layout, at: hover })
          ]
        }
      ),
      /* @__PURE__ */ jsx13(ChartTip, { tip })
    ] }),
    multiLegend && /* @__PURE__ */ jsx13(ChartLegend, { series: spec.series }),
    piled && spec.series.length > 1 && /* @__PURE__ */ jsx13(ChartLegend, { series: spec.series, at: hover ?? lastIndex(spec), unit: spec.unit }),
    spec.source && /* @__PURE__ */ jsx13("div", { className: "hb-chart-source", children: spec.source })
  ] });
}
function lastIndex(spec) {
  const { last } = seriesEnds(spec.series[0].data);
  return last < 0 ? spec.x.length - 1 : last;
}
function Headline({ spec, hover }) {
  const piled = spec.type === "stacked" || spec.type === "area";
  const pct = spec.type === "line" ? changePct(spec.series[0].data) : null;
  const shown = hover ?? lastIndex(spec);
  const big = piled ? totalAt(spec.series, shown) : spec.series[0].data[shown] ?? null;
  const bigUnit = piled ? spec.unit : spec.series[0].unit ?? spec.unit;
  const listed = piled ? [] : spec.series.slice(1);
  const withFigure = spec.figure !== false;
  return /* @__PURE__ */ jsxs10(Fragment4, { children: [
    /* @__PURE__ */ jsxs10("figcaption", { className: "hb-chart-head", children: [
      /* @__PURE__ */ jsx13("span", { className: "hb-chart-title", children: spec.title ?? spec.series[0].name ?? "Chart" }),
      pct !== null && withFigure && /* @__PURE__ */ jsxs10("span", { className: `hb-chip ${pct >= 0 ? "hb-chip-good" : "hb-chip-warn"}`, children: [
        pct >= 0 ? "\u25B2" : "\u25BC",
        " ",
        Math.abs(pct).toFixed(1),
        "%"
      ] })
    ] }),
    withFigure && /* @__PURE__ */ jsxs10("div", { className: "hb-chart-figure", children: [
      /* @__PURE__ */ jsx13("span", { className: "hb-chart-big", children: big === null ? "\u2013" : fmt(big, bigUnit) }),
      /* @__PURE__ */ jsxs10("span", { className: "hb-chart-at", children: [
        hover !== null ? spec.x[shown] : "",
        listed.map((s, k) => {
          const v = s.data[shown] ?? null;
          return v === null ? null : /* @__PURE__ */ jsxs10("span", { className: "hb-chart-other", children: [
            s.name ? `${s.name} ` : "",
            fmt(v, s.unit ?? spec.unit)
          ] }, k);
        })
      ] })
    ] })
  ] });
}
function XLabels({ spec, layout }) {
  const last = spec.x.length - 1;
  const anchor = (i) => layout.slotted ? "middle" : i === 0 && last > 0 ? "start" : i === last && last > 0 ? "end" : "middle";
  return /* @__PURE__ */ jsx13("g", { children: layout.xLabels.map((i) => /* @__PURE__ */ jsx13("text", { x: layout.xAt(i), y: layout.H - 7, textAnchor: anchor(i), className: "hb-chart-axis", children: String(spec.x[i]) }, i)) });
}

// src/blocks/calculator/Calculator.tsx
import { jsx as jsx14, jsxs as jsxs11 } from "react/jsx-runtime";
function Calculator({ title, inputs, outputs, chart }) {
  const [values, setValues] = useState8(() => new Map(inputs.map((x) => [x.id, x.value])));
  const move = (id, v) => setValues((all) => new Map(all).set(id, v));
  const spec = useMemo3(() => chart ? calcChartSpec(chart, values) : null, [chart, values]);
  return /* @__PURE__ */ jsxs11("div", { className: "hb-card hb-calc", children: [
    title && /* @__PURE__ */ jsx14("div", { className: "hb-card-title", children: /* @__PURE__ */ jsx14(InlineText, { text: title }) }),
    inputs.map((input) => /* @__PURE__ */ jsx14(Slider, { input, value: values.get(input.id) ?? input.value, onMove: (v) => move(input.id, v) }, input.id)),
    outputs.length > 0 && /* @__PURE__ */ jsx14("div", { className: "hb-calc-results", children: outputs.map((o, i) => /* @__PURE__ */ jsx14(Result, { output: o, values }, i)) }),
    spec && /* @__PURE__ */ jsx14(Chart, { spec })
  ] });
}
function Slider({ input, value, onMove }) {
  return /* @__PURE__ */ jsxs11("label", { className: "hb-calc-slider", children: [
    /* @__PURE__ */ jsxs11("span", { className: "hb-calc-head", children: [
      /* @__PURE__ */ jsx14("span", { className: "hb-calc-label", children: /* @__PURE__ */ jsx14(InlineText, { text: input.label }) }),
      /* @__PURE__ */ jsx14("span", { className: "hb-calc-value", children: formatWithUnit(value, input.unit) })
    ] }),
    /* @__PURE__ */ jsx14(
      "input",
      {
        type: "range",
        className: "hb-range",
        min: input.min,
        max: input.max,
        step: input.step,
        value,
        onChange: (e) => onMove(Number(e.target.value))
      }
    ),
    /* @__PURE__ */ jsxs11("span", { className: "hb-calc-ends", children: [
      /* @__PURE__ */ jsx14("span", { children: formatWithUnit(input.min, input.unit) }),
      /* @__PURE__ */ jsx14("span", { children: formatWithUnit(input.max, input.unit) })
    ] })
  ] });
}
function Result({ output, values }) {
  const value = evaluate(output.formula, values);
  return /* @__PURE__ */ jsxs11("div", { className: "hb-calc-result", children: [
    /* @__PURE__ */ jsx14("div", { className: "hb-calc-result-label", children: /* @__PURE__ */ jsx14(InlineText, { text: output.label }) }),
    /* @__PURE__ */ jsx14("div", { className: "hb-calc-result-value", "aria-live": "polite", children: value === null ? "\u2013" : formatWithUnit(value, output.unit) })
  ] });
}

// src/blocks/calculator/read.ts
var MAX_INPUTS = 6;
var MAX_OUTPUTS = 6;
var ID2 = /^[A-Za-z_][A-Za-z0-9_]{0,23}$/;
function readCalculator(raw, here) {
  const inputs = [];
  const rawInputs = firstList([raw.inputs, raw.sliders]) ?? [];
  rawInputs.forEach((item, i) => {
    const where = here.at("inputs").at(i);
    const input = readInput(item, where);
    if (!input) return;
    if (inputs.some((x) => x.id === input.id)) {
      where.drop(`input id "${input.id}" is used twice`);
      return;
    }
    inputs.push(input);
  });
  if (!inputs.length) return here.drop("calculator has no usable input");
  const kept = keepFirst(inputs, MAX_INPUTS, here, "inputs");
  const ids = kept.map((x) => x.id);
  const outputs = [];
  const rawOutputs = firstList([raw.outputs, raw.results]) ?? [];
  rawOutputs.forEach((item, i) => {
    const output = readOutput(item, ids, here.at("outputs").at(i));
    if (output) outputs.push(output);
  });
  const title = firstText([raw.title], 80);
  const chart = raw.chart === void 0 ? void 0 : readCalcChart(raw.chart, ids, here.at("chart"));
  return clean({ type: "calculator", title, inputs: kept, outputs: keepFirst(outputs, MAX_OUTPUTS, here, "outputs"), chart });
}
function readInput(item, here) {
  if (!item || typeof item !== "object") return here.drop("input is not an object");
  const id = firstText([item.id, item.name, item.key], 24);
  if (!id || !ID2.test(id) || isHelper(id)) return here.drop(`input needs an id like "p" or "rate" (got ${JSON.stringify(id ?? null)})`);
  const label = firstText([item.label, item.title], 40) ?? id;
  const given = num(item.value) ?? num(item.default);
  const min = num(item.min) ?? 0;
  const max = num(item.max) ?? defaultMax(given);
  if (max <= min) return here.drop("input's max must be above its min");
  const step = positive(num(item.step)) ?? niceStep((max - min) / 100);
  const value = Math.min(max, Math.max(min, given ?? min));
  return clean({ id, label, min, max, step, value, unit: firstText([item.unit], 12) });
}
function readOutput(item, ids, here) {
  if (!item || typeof item !== "object") return here.drop("output is not an object");
  const label = firstText([item.label, item.title, item.name], 40);
  const formula = firstText([item.formula, item.expr, item.value], 300);
  if (!label || !formula) return here.drop("output needs a label and a formula");
  try {
    const unknown = namesIn(parseFormula(formula)).filter((name) => !ids.includes(name));
    if (unknown.length) here.drop(`formula uses ${unknown.join(", ")}, which no input has; shows \u2013`);
  } catch (e) {
    here.drop(`formula can't be read (${e.message}); shows \u2013`);
  }
  return clean({ label, formula, unit: firstText([item.unit], 12) });
}
function defaultMax(value) {
  if (value !== null && value > 0) return value * 2;
  return 100;
}
function positive(v) {
  if (v !== null && v > 0) return v;
  return null;
}
function niceStep(rough) {
  const power = 10 ** Math.floor(Math.log10(rough));
  const scaled = rough / power;
  if (scaled < 1.5) return power;
  if (scaled < 3.5) return 2 * power;
  if (scaled < 7.5) return 5 * power;
  return 10 * power;
}

// src/blocks/callout/Callout.tsx
import { jsx as jsx15, jsxs as jsxs12 } from "react/jsx-runtime";
var TONE_ICON = { info: "info", tip: "spark", warn: "alert" };
function Callout({ tone, title, text }) {
  return /* @__PURE__ */ jsxs12("div", { className: `hb-callout hb-callout-${tone}`, children: [
    /* @__PURE__ */ jsx15("span", { className: "hb-callout-icon", children: /* @__PURE__ */ jsx15(Icon, { name: TONE_ICON[tone], size: 17, stroke: 2.2 }) }),
    /* @__PURE__ */ jsxs12("div", { className: "hb-callout-body", children: [
      title && /* @__PURE__ */ jsx15("div", { className: "hb-callout-title", children: /* @__PURE__ */ jsx15(InlineText, { text: title }) }),
      /* @__PURE__ */ jsx15("div", { children: /* @__PURE__ */ jsx15(InlineText, { text }) })
    ] })
  ] });
}

// src/blocks/callout/read.ts
var TONES = {
  info: "info",
  note: "info",
  neutral: "info",
  tip: "tip",
  success: "tip",
  good: "tip",
  idea: "tip",
  warn: "warn",
  warning: "warn",
  caution: "warn",
  danger: "warn",
  alert: "warn",
  error: "warn"
};
function readCallout(raw, here) {
  const toneWord = firstText([raw.tone, raw.variant], 20)?.toLowerCase() ?? "info";
  const tone = TONES[toneWord] ?? "info";
  let title = firstText([raw.title], 80);
  let text = firstWords([raw.text, raw.body, raw.message, raw.content], 400);
  if (!text && title) {
    text = title;
    title = void 0;
  }
  if (!text) return here.drop("callout needs text");
  return clean({ type: "callout", tone, title, text });
}

// src/blocks/chart/read.ts
function readChart(raw, here) {
  const spec = readSpec(raw);
  if (!spec) return here.drop("chart needs x labels and at least one series");
  return { type: "chart", spec };
}
function readSpec(d) {
  if (!Array.isArray(d.x) || !Array.isArray(d.series) || !d.series.length) return null;
  const type = chartKind(d.kind);
  const unit = typeof d.unit === "string" ? d.unit : void 0;
  let x = d.x.map(String);
  let series = d.series.filter((s) => s && Array.isArray(s.data)).slice(0, maxSeries(type)).map((s, k) => readSeries(s, k, type, unit));
  if (!series.length || series.every((s) => s.data.every((v) => v === null))) return null;
  if (type === "pie" || type === "donut") {
    const slices = pieSlices(x, series[0].data);
    if (!slices.x.length) return null;
    x = slices.x;
    series = [{ ...series[0], data: slices.data }];
  }
  const spec = {
    type,
    title: typeof d.title === "string" ? d.title : void 0,
    x,
    series,
    unit,
    source: typeof d.source === "string" ? d.source : void 0
  };
  if (typeof d.figure === "boolean") spec.figure = d.figure;
  if (d.tone === "change") spec.tone = "change";
  return spec;
}
function readSeries(s, k, type, chartUnit) {
  const name = typeof s.name === "string" ? s.name : void 0;
  const data = s.data.map((v) => typeof v === "number" && isFinite(v) ? v : null);
  const unit = typeof s.unit === "string" ? s.unit : void 0;
  const right = isOnRightScale(type, k, unit, s.axis, chartUnit);
  return { name, data, unit, right };
}

// src/blocks/checklist/Checklist.tsx
import { useContext as useContext3, useEffect, useRef as useRef5, useState as useState9 } from "react";

// src/blocks/checklist/savedState.ts
var boards = /* @__PURE__ */ new Map();
function stateIn(answer) {
  const state = answer?.state;
  if (state && typeof state === "object" && !Array.isArray(state)) return { ...state };
  return {};
}
function loadBoardState(rest, blockId) {
  const known = boards.get(blockId);
  if (known) return known.loaded;
  const board = { state: {}, loaded: Promise.resolve({}), saving: Promise.resolve() };
  board.loaded = rest(`/blocks/${blockId}/state`).then(
    (answer) => {
      board.state = stateIn(answer);
      return board.state;
    },
    () => {
      boards.delete(blockId);
      return {};
    }
  );
  boards.set(blockId, board);
  return board.loaded;
}
async function saveBoardValue(rest, blockId, key, value) {
  await loadBoardState(rest, blockId);
  const board = boards.get(blockId);
  if (!board) return;
  board.state = { ...board.state, [key]: value };
  const state = board.state;
  board.saving = board.saving.then(() => rest(`/blocks/${blockId}/state`, { method: "PUT", body: { state } })).then(() => {
  }, () => {
  });
  await board.saving;
}
function toggleTick(ticks, i) {
  if (ticks.includes(i)) return ticks.filter((t) => t !== i);
  return [...ticks, i].sort((a, b) => a - b);
}
function readTicks(saved, count) {
  if (!Array.isArray(saved)) return null;
  const ticks = /* @__PURE__ */ new Set();
  for (const t of saved) {
    if (Number.isInteger(t) && t >= 0 && t < count) ticks.add(t);
  }
  return [...ticks].sort((a, b) => a - b);
}
function ticksAfterLoad(saved, onScreen, tapped) {
  if (tapped) return onScreen;
  return saved ?? onScreen;
}

// src/blocks/checklist/Checklist.tsx
import { jsx as jsx16, jsxs as jsxs13 } from "react/jsx-runtime";
function Checklist({ title, numbered, items, ticked, path }) {
  const [ticks, tap] = useSavedTicks(path, ticked, items.length);
  const done = ticks.length;
  const allDone = done === items.length;
  return /* @__PURE__ */ jsxs13("div", { className: "hb-card hb-checklist", children: [
    /* @__PURE__ */ jsxs13("div", { className: "hb-checklist-head", children: [
      title && /* @__PURE__ */ jsx16("span", { className: "hb-card-title", children: /* @__PURE__ */ jsx16(InlineText, { text: title }) }),
      /* @__PURE__ */ jsx16("span", { className: allDone ? "hb-checklist-count hb-checklist-count-done" : "hb-checklist-count", "aria-live": "polite", children: allDone ? "All done" : `${done} of ${items.length} done` })
    ] }),
    /* @__PURE__ */ jsx16("div", { className: "hb-checklist-track", children: /* @__PURE__ */ jsx16("span", { className: "hb-checklist-fill", style: { width: `${done / items.length * 100}%` } }) }),
    items.map((item, i) => /* @__PURE__ */ jsxs13("div", { children: [
      startsGroup(items, i) && /* @__PURE__ */ jsx16("div", { className: "hb-checklist-group", children: /* @__PURE__ */ jsx16(InlineText, { text: item.group }) }),
      /* @__PURE__ */ jsxs13(
        "button",
        {
          type: "button",
          role: "checkbox",
          "aria-checked": ticks.includes(i),
          onClick: () => tap(i),
          className: ticks.includes(i) ? "hb-check hb-check-on" : "hb-check",
          children: [
            /* @__PURE__ */ jsx16("span", { className: "hb-check-mark", children: ticks.includes(i) ? /* @__PURE__ */ jsx16(Icon, { name: "check", size: 13, stroke: 3 }) : numbered ? i + 1 : null }),
            /* @__PURE__ */ jsx16("span", { className: "hb-check-text", children: /* @__PURE__ */ jsx16(InlineText, { text: item.text }) })
          ]
        }
      )
    ] }, i))
  ] });
}
function startsGroup(items, i) {
  const group = items[i].group;
  if (!group) return false;
  return items[i - 1]?.group !== group;
}
function useSavedTicks(path, ticked, count) {
  const { rest, blockId } = useContext3(BlockActions);
  const [ticks, setTicks] = useState9(ticked);
  const shown = useRef5(ticked);
  const tapped = useRef5(false);
  shown.current = ticks;
  useEffect(() => {
    if (!rest || !blockId) return;
    let live = true;
    loadBoardState(rest, blockId).then((state) => {
      if (live) setTicks(ticksAfterLoad(readTicks(state[path], count), shown.current, tapped.current));
    });
    return () => {
      live = false;
    };
  }, [rest, blockId, path, count]);
  function tap(i) {
    tapped.current = true;
    const next = toggleTick(shown.current, i);
    shown.current = next;
    setTicks(next);
    if (rest && blockId) void saveBoardValue(rest, blockId, path, next);
  }
  return [ticks, tap];
}

// src/blocks/checklist/read.ts
var MAX_ITEMS = 40;
function readChecklist(raw, here) {
  const found = collectItems(raw, here);
  if (!found.length) return here.drop("checklist has no item with text");
  const kept = keepFirst(found, MAX_ITEMS, here, "items");
  const items = [];
  const ticked = [];
  kept.forEach((item, i) => {
    items.push(clean({ text: item.text, group: item.group }));
    if (item.done) ticked.push(i);
  });
  const numbered = raw.numbered === true || raw.ordered === true;
  const title = firstText([raw.title, raw.label], 80);
  return clean({ type: "checklist", title, numbered, items, ticked, path: here.path });
}
function collectItems(raw, here) {
  const found = [];
  const flat = firstList([raw.items, raw.tasks, raw.steps]);
  flat?.forEach((item, i) => {
    const read = readItem(item, void 0);
    if (read) found.push(read);
    else here.at("items").at(i).drop("item has no text");
  });
  const groups = firstList([raw.groups, raw.sections]) ?? [];
  groups.forEach((g, gi) => {
    const label = firstText([g?.label, g?.title, g?.name], 60);
    const list = firstList([g?.items, g?.tasks]) ?? [];
    list.forEach((item, i) => {
      const read = readItem(item, label);
      if (read) found.push(read);
      else here.at("groups").at(gi).at("items").at(i).drop("item has no text");
    });
  });
  return found;
}
function readItem(item, groupLabel) {
  if (typeof item === "string") {
    const text2 = firstText([item], 160);
    if (!text2) return null;
    return { text: text2, group: groupLabel, done: false };
  }
  if (!item || typeof item !== "object") return null;
  const text = firstText([item.text, item.title, item.label, item.name], 160);
  if (!text) return null;
  const group = firstText([item.group, item.section, item.category], 60) ?? groupLabel;
  return { text, group, done: item.done === true || item.checked === true };
}

// src/blocks/flip/Flip.tsx
import { useState as useState10 } from "react";

// src/blocks/flip/columns.ts
function flipColumns(cards) {
  if (cards <= 4) return Math.max(1, cards);
  const lastRow = (cols) => cards % cols || cols;
  return lastRow(3) / 3 > lastRow(4) / 4 ? 3 : 4;
}

// src/blocks/flip/Flip.tsx
import { jsx as jsx17, jsxs as jsxs14 } from "react/jsx-runtime";
function Flip({ title, cards }) {
  const [turned, setTurned] = useState10(() => cards.map(() => false));
  const toggle = (i) => setTurned((was) => was.map((t, k) => k === i ? !t : t));
  const tall = cards.some((c) => c.image);
  return /* @__PURE__ */ jsxs14("div", { className: "hb-flip", children: [
    title && /* @__PURE__ */ jsx17("div", { className: "hb-card-title", children: title }),
    /* @__PURE__ */ jsx17(
      "div",
      {
        className: tall ? "hb-flip-grid hb-flip-tall" : "hb-flip-grid",
        style: { "--hb-flip-cols": flipColumns(cards.length) },
        children: cards.map((c, i) => /* @__PURE__ */ jsx17(Card, { card: c, place: `${i + 1} of ${cards.length}`, turned: turned[i] === true, onTurn: () => toggle(i) }, i))
      }
    )
  ] });
}
function Card({ card, place, turned, onTurn }) {
  const [photoFailed, setPhotoFailed] = useState10(false);
  const photo = card.image && !photoFailed ? card.image : void 0;
  const label = turned ? `${card.front}: ${card.back}` : `${card.front}, tap to see the answer`;
  return /* @__PURE__ */ jsx17("button", { type: "button", className: "hb-flip-card", onClick: onTurn, "aria-pressed": turned, "aria-label": label, children: /* @__PURE__ */ jsxs14("span", { className: turned ? "hb-flip-inner hb-flip-turned" : "hb-flip-inner", children: [
    /* @__PURE__ */ jsxs14("span", { className: "hb-flip-face hb-flip-front", children: [
      /* @__PURE__ */ jsx17("span", { className: "hb-flip-label", children: place }),
      /* @__PURE__ */ jsx17("span", { className: "hb-flip-question", children: /* @__PURE__ */ jsx17(InlineText, { text: card.front }) }),
      /* @__PURE__ */ jsxs14("span", { className: "hb-flip-foot", children: [
        /* @__PURE__ */ jsx17("span", { children: "Tap to turn" }),
        /* @__PURE__ */ jsx17("span", { "aria-hidden": "true", children: "\u21BB" })
      ] })
    ] }),
    /* @__PURE__ */ jsxs14("span", { className: "hb-flip-face hb-flip-back", children: [
      photo && /* @__PURE__ */ jsx17("img", { src: photo, alt: "", loading: "lazy", referrerPolicy: "no-referrer", onError: () => setPhotoFailed(true) }),
      /* @__PURE__ */ jsx17("span", { className: "hb-flip-label", children: "Answer" }),
      /* @__PURE__ */ jsx17("span", { className: "hb-flip-answer", children: /* @__PURE__ */ jsx17(InlineText, { text: card.back }) })
    ] })
  ] }) });
}

// src/blocks/flip/read.ts
var FRONT_MAX = 140;
var BACK_MAX = 260;
function readFlip(raw, here) {
  const rawCards = Array.isArray(raw.cards) ? raw.cards : [];
  const cards = [];
  rawCards.forEach((c, i) => {
    const front = firstWords([c?.front, c?.question], FRONT_MAX);
    const back = firstWords([c?.back, c?.answer], BACK_MAX);
    if (!front || !back) {
      here.at("cards").at(i).drop("card needs a front and a back");
      return;
    }
    cards.push(clean({ front, back, image: https(c.image) }));
  });
  if (!cards.length) return here.drop("flip has no cards");
  return clean({ type: "flip", title: str(raw.title, 60), cards: keepFirst(cards, 12, here, "cards") });
}

// src/blocks/flow/Flow.tsx
import { Fragment as Fragment5, useId as useId2, useLayoutEffect as useLayoutEffect3, useMemo as useMemo4, useRef as useRef6, useState as useState11 } from "react";

// src/lib/motion.ts
function lessMotion() {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// src/blocks/flow/packet.ts
function packetPath(a, b, backward) {
  const across = b.left >= a.right - 1 || a.left >= b.right - 1;
  const middle = (e) => ({ x: (e.left + e.right) / 2, y: (e.top + e.bottom) / 2 });
  if (!backward) {
    return across ? [{ x: a.right, y: middle(a).y }, { x: b.left, y: middle(a).y }] : [{ x: middle(a).x, y: a.bottom }, { x: middle(b).x, y: b.top }];
  }
  if (across) {
    const start2 = { x: middle(a).x, y: a.top };
    const end2 = { x: middle(b).x, y: b.top };
    return arc(start2, { x: (start2.x + end2.x) / 2, y: Math.min(a.top, b.top) - 40 }, end2);
  }
  const start = { x: a.right, y: middle(a).y };
  const end = { x: b.right, y: middle(b).y };
  return arc(start, { x: Math.max(a.right, b.right) + 34, y: (start.y + end.y) / 2 }, end);
}
function arc(a, control, b, count = 16) {
  return Array.from({ length: count + 1 }, (_, k) => {
    const t = k / count;
    const u = 1 - t;
    return { x: u * u * a.x + 2 * u * t * control.x + t * t * b.x, y: u * u * a.y + 2 * u * t * control.y + t * t * b.y };
  });
}

// src/blocks/flow/walk.ts
function flowState(nodes, groups, steps, at2) {
  const holds = nodes.map((n) => n.holds ?? []);
  const place = (id) => id === void 0 ? -1 : nodes.findIndex((n) => n.id === id);
  const moving = isMoving(nodes, steps);
  let seen = /* @__PURE__ */ new Set();
  let layers = groups.map(() => 0);
  let lit;
  for (const step of steps.slice(0, at2 + 1)) {
    const i = place(step.node);
    if (i === 0 && seen.size) {
      seen = /* @__PURE__ */ new Set();
      layers = groups.map(() => 0);
    }
    if (i >= 0) seen.add(i);
    for (const [id, chips] of Object.entries(step.holds ?? {})) {
      const k = place(id);
      if (k >= 0) holds[k] = chips;
    }
    const g = groups.findIndex((gr) => i >= gr.from && i <= gr.to);
    if (g >= 0) {
      const most = groups[g].count ?? Infinity;
      layers[g] = Math.min(most, Math.max(1, layers[g]) + (step.tick ?? 0));
    }
    lit = i >= 0 ? i : void 0;
  }
  return { holds, seen: moving && steps.length ? seen : null, lit, layers };
}
function isMoving(nodes, steps) {
  return nodes.some((n) => n.holds) || steps.some((s) => s.holds || s.send || s.tick);
}

// src/blocks/flow/Flow.tsx
import { Fragment as Fragment6, jsx as jsx18, jsxs as jsxs15 } from "react/jsx-runtime";
var NODE_MIN = 88;
var ARROW = 24;
var FRAME = 16;
var HOLDS_MIN = 104;
var SEND_MS = 420;
var TICK_MS = 260;
var TICK_TOTAL_MS = 3e3;
var NO_STEPS = [];
function fitsAcross(nodes, groups, width, holds = false) {
  return nodes * (holds ? HOLDS_MIN : NODE_MIN) + (nodes - 1) * ARROW + groups * FRAME <= width;
}
function pieces(count, groups) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const group = groups.find((g) => g.from === i);
    if (group) {
      out.push({ start: i, end: group.to, group });
      i = group.to;
    } else out.push({ start: i, end: i });
  }
  return out;
}
function Flow({ id, title, direction, nodes, groups = [] }) {
  const box = useRef6(null);
  const packet = useRef6(null);
  const boxes = useRef6([]);
  const width = useWidth(box);
  const [open, setOpen] = useState11(null);
  const walk = useWalk(id);
  const steps = walk?.steps ?? NO_STEPS;
  const target = useMemo4(() => flowState(nodes, groups, steps, walk?.at ?? 0), [nodes, groups, steps, walk?.at]);
  const travelling = useTravel(walk, nodes, groups, target, packet, boxes, box);
  const state = travelling ?? target;
  const moving = isMoving(nodes, steps);
  const holds = state.holds.some((h) => h.length > 0);
  const panelId = useId2();
  const down = direction === "down" || !fitsAcross(nodes.length, groups.length, width, holds);
  const shown = open === null ? void 0 : nodes[open];
  const node = (n, i, arrow) => /* @__PURE__ */ jsxs15("li", { className: "hb-flow-step", children: [
    arrow && /* @__PURE__ */ jsx18(Arrow, {}),
    /* @__PURE__ */ jsx18(
      NodeBox,
      {
        node: n,
        chips: state.holds[i],
        lit: state.lit === i,
        idle: state.seen !== null && !state.seen.has(i),
        open: open === i,
        panelId,
        boxRef: (el) => {
          boxes.current[i] = el;
        },
        onTap: () => setOpen((was) => was === i ? null : i)
      }
    )
  ] }, i);
  function onKeyDown(e) {
    if (e.key === "Escape" && open !== null) setOpen(null);
  }
  return /* @__PURE__ */ jsxs15("div", { className: "hb-card hb-flow", onKeyDown, children: [
    title && /* @__PURE__ */ jsx18("div", { className: "hb-card-title", children: title }),
    /* @__PURE__ */ jsxs15("div", { ref: box, className: "hb-flow-box", children: [
      /* @__PURE__ */ jsx18("ol", { className: `hb-flow-chain ${down ? "hb-flow-down" : "hb-flow-right"}`, children: pieces(nodes.length, groups).map(({ start, end, group }) => group ? /* @__PURE__ */ jsxs15("li", { className: "hb-flow-step", style: { flexGrow: end - start + 1 }, children: [
        start > 0 && /* @__PURE__ */ jsx18(Arrow, {}),
        /* @__PURE__ */ jsxs15("div", { className: "hb-flow-group", children: [
          /* @__PURE__ */ jsxs15("div", { className: "hb-flow-group-head", children: [
            /* @__PURE__ */ jsx18("span", { className: "hb-flow-group-label", children: group.label }),
            group.count !== void 0 && /* @__PURE__ */ jsx18(Counter, { layer: state.layers[groups.indexOf(group)], count: group.count })
          ] }),
          /* @__PURE__ */ jsx18("ol", { className: "hb-flow-chain", children: nodes.slice(start, end + 1).map((n, k) => node(n, start + k, k > 0)) })
        ] })
      ] }, start) : /* @__PURE__ */ jsx18(Fragment5, { children: node(nodes[start], start, start > 0) }, start)) }),
      moving && walk && /* @__PURE__ */ jsx18("div", { ref: packet, className: "hb-flow-packet", "aria-hidden": "true" })
    ] }),
    shown?.note && /* @__PURE__ */ jsxs15("div", { id: panelId, className: "hb-flow-panel", role: "region", "aria-label": shown.label, children: [
      /* @__PURE__ */ jsx18("div", { className: "hb-flow-panel-title", children: shown.label }),
      /* @__PURE__ */ jsx18("p", { className: "hb-flow-note", children: /* @__PURE__ */ jsx18(InlineText, { text: shown.note }) })
    ] })
  ] });
}
function Counter({ layer, count }) {
  return /* @__PURE__ */ jsx18("span", { className: "hb-chip hb-chip-soft hb-flow-count", children: layer ? `layer ${layer} of ${count}` : `\xD7 ${count}` });
}
function useTravel(walk, nodes, groups, target, packet, boxes, frame) {
  const [travelling, setTravelling] = useState11(null);
  useLayoutEffect3(() => {
    const step = walk && walk.from !== null && walk.at === walk.from + 1 ? walk.steps[walk.at] : void 0;
    const dot = packet.current;
    if (!walk || !step || !(step.send || step.tick) || !dot || typeof dot.animate !== "function" || lessMotion()) {
      setTravelling(null);
      return;
    }
    const before = flowState(nodes, groups, walk.steps, walk.from);
    let live = true;
    let flight = null;
    const edges = (i) => {
      const el = boxes.current[i];
      const outer = frame.current?.getBoundingClientRect();
      if (!el || !outer) return null;
      const r = el.getBoundingClientRect();
      return { left: r.left - outer.left, top: r.top - outer.top, right: r.right - outer.left, bottom: r.bottom - outer.top };
    };
    const hop = async (from, to, ms) => {
      const a = edges(from);
      const b = edges(to);
      if (!a || !b) return live;
      const path = packetPath(a, b, to <= from);
      dot.style.opacity = "1";
      flight = dot.animate(path.map((p) => ({ transform: `translate(${p.x}px, ${p.y}px)` })), { duration: ms, easing: "ease-in-out", fill: "forwards" });
      try {
        await flight.finished;
        return live;
      } catch {
        return false;
      } finally {
        dot.style.opacity = "0";
      }
    };
    setTravelling(before);
    (async () => {
      const g = step.tick ? groups.findIndex((gr) => target.lit !== void 0 && target.lit >= gr.from && target.lit <= gr.to) : -1;
      if (g >= 0) {
        const { from: first, to: last } = groups[g];
        const ms = Math.min(TICK_MS, TICK_TOTAL_MS / (2 * step.tick));
        for (let k = 1; k <= step.tick; k++) {
          const layers = before.layers.map((v, j) => j === g ? Math.min(groups[g].count ?? Infinity, Math.max(1, v) + k) : v);
          if (!await hop(last, first, ms)) return;
          setTravelling({ ...before, lit: first, layers });
          if (!await hop(first, last, ms)) return;
          setTravelling({ ...before, lit: last, layers });
        }
      }
      if (step.send && before.lit !== void 0 && target.lit !== void 0 && !await hop(before.lit, target.lit, SEND_MS)) return;
      if (live) setTravelling(null);
    })();
    return () => {
      live = false;
      flight?.cancel();
    };
  }, [walk]);
  return travelling;
}
function NodeBox({ node, chips, lit, idle, open, panelId, boxRef, onTap }) {
  const className = `hb-flow-node${lit ? " hb-flow-lit" : ""}${open ? " hb-flow-open" : ""}${idle ? " hb-flow-idle" : ""}`;
  const holds = chips.length > 0 && /* @__PURE__ */ jsx18(Chips, { chips }, JSON.stringify(chips));
  const inside2 = /* @__PURE__ */ jsxs15(Fragment6, { children: [
    node.icon && /* @__PURE__ */ jsx18("span", { className: "hb-flow-icon", children: /* @__PURE__ */ jsx18(Icon, { name: node.icon, size: 14 }) }),
    /* @__PURE__ */ jsx18("span", { className: "hb-flow-label", children: node.label })
  ] });
  if (!node.note) return /* @__PURE__ */ jsxs15("div", { ref: boxRef, className, "aria-current": lit ? "step" : void 0, children: [
    inside2,
    holds
  ] });
  return /* @__PURE__ */ jsxs15(
    "button",
    {
      ref: boxRef,
      type: "button",
      className,
      "aria-expanded": open,
      "aria-controls": open ? panelId : void 0,
      "aria-current": lit ? "step" : void 0,
      onClick: onTap,
      children: [
        inside2,
        /* @__PURE__ */ jsx18("span", { className: "hb-flow-more", "aria-hidden": "true", children: open ? "\u2212" : "+" }),
        holds
      ]
    }
  );
}
function Chips({ chips }) {
  return /* @__PURE__ */ jsx18("span", { className: "hb-flow-holds", children: chips.map((c, k) => /* @__PURE__ */ jsx18("span", { className: c.accent ? "hb-flow-chip hb-flow-chip-accent" : "hb-flow-chip", children: c.text }, k)) });
}
function Arrow() {
  return /* @__PURE__ */ jsx18("span", { className: "hb-flow-arrow", "aria-hidden": "true", children: /* @__PURE__ */ jsx18(
    "svg",
    {
      width: "16",
      height: "16",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      children: /* @__PURE__ */ jsx18("path", { d: "M4 12h15M13 6l6 6-6 6" })
    }
  ) });
}

// src/blocks/flow/read.ts
var MAX_NODES = 10;
var MAX_GROUPS = 3;
var MAX_CHIPS = 10;
var CHIP = 16;
var NO_RUN = "group needs a label and a run of node ids next to each other";
function readFlow(raw, here) {
  const list = firstList([raw.nodes, raw.stages]) ?? [];
  const nodes = [];
  const seen = /* @__PURE__ */ new Set();
  list.forEach((n, i) => {
    const label = firstText([n?.label, n?.title, n?.name], 40);
    if (!label) {
      here.at("nodes").at(i).drop("node needs a label");
      return;
    }
    let id = slug(n.id);
    if (id !== void 0 && seen.has(id)) id = void 0;
    if (id !== void 0) seen.add(id);
    const holds = readChips(n.holds, here.at("nodes").at(i).at("holds"));
    nodes.push(clean({ id, label, icon: icon(n.icon), note: firstText([n.note, n.text, n.description], 280), holds }));
  });
  if (nodes.length < 2) return here.drop("flow needs at least 2 nodes");
  const kept = keepFirst(nodes, MAX_NODES, here, "nodes");
  const groups = readGroups(raw.groups, kept, here);
  return clean({
    type: "flow",
    id: slug(raw.id),
    title: str(raw.title, 80),
    direction: raw.direction === "down" ? "down" : "right",
    nodes: kept,
    groups: groups.length ? groups : void 0
  });
}
function readGroups(rawGroups, nodes, here) {
  if (!Array.isArray(rawGroups)) return [];
  const groups = [];
  const taken = /* @__PURE__ */ new Set();
  rawGroups.forEach((g, j) => {
    const at2 = here.at("groups").at(j);
    const label = str(g?.label, 40);
    const ids = Array.isArray(g?.nodes) ? g.nodes : [];
    const spots = ids.map((id) => nodes.findIndex((n) => n.id !== void 0 && n.id === id));
    const from = spots[0];
    const isRun = spots.length > 0 && spots.every((p, k) => p >= 0 && p === from + k);
    if (!label || !isRun) {
      at2.drop(NO_RUN);
      return;
    }
    if (spots.some((p) => taken.has(p))) {
      at2.drop("groups can't share nodes");
      return;
    }
    spots.forEach((p) => taken.add(p));
    const count = num(g.count);
    const counted = count !== null && Number.isInteger(count) && count >= 2 && count <= 100 ? count : void 0;
    if (g.count !== void 0 && counted === void 0) at2.drop("count is a whole number from 2 to 100; left out");
    groups.push(clean({ label, from, to: spots[spots.length - 1], count: counted }));
  });
  return keepFirst(groups, MAX_GROUPS, here, "groups");
}
function readChips(raw, here) {
  if (!Array.isArray(raw)) return void 0;
  const chips = [];
  for (const c of raw) {
    const text = textOrNumber(c && typeof c === "object" ? c.text : c, CHIP);
    if (text !== void 0) chips.push(clean({ text, accent: c?.tone === "accent" ? true : void 0 }));
  }
  return keepFirst(chips, MAX_CHIPS, here, "chips");
}

// src/blocks/form/Form.tsx
import { useContext as useContext4, useEffect as useEffect2, useRef as useRef7, useState as useState12 } from "react";

// src/blocks/form/read.ts
var MAX_FIELDS = 12;
var MAX_OPTIONS = 60;
var LABEL = 100;
var OPTION = 80;
var NOTE = 80;
var GROUP = 40;
var END = 20;
var PLACEHOLDER = 60;
var TEXT_VALUE = 500;
var KINDS = ["select", "radio", "checkbox", "text", "slider"];
var FIELD_ID = /^[A-Za-z_][\w-]{0,39}$/;
var RESERVED_IDS = ["__proto__", "constructor", "prototype"];
var KIND_NAMES = {
  select: "select",
  dropdown: "select",
  radio: "radio",
  choice: "radio",
  checkbox: "checkbox",
  checkboxes: "checkbox",
  multi: "checkbox",
  multiselect: "checkbox",
  text: "text",
  input: "text",
  textarea: "text",
  slider: "slider",
  range: "slider"
};
function readForm(raw, here) {
  const rawFields = firstList([raw.fields, raw.inputs, raw.questions]);
  if (!rawFields) return here.drop("form needs fields");
  const fields = [];
  rawFields.forEach((item, i) => {
    const where = here.at("fields").at(i);
    const field = readField(item, where);
    if (!field) return;
    if (fields.some((f) => f.id === field.id)) {
      where.drop(`field id "${field.id}" is used twice`);
      return;
    }
    fields.push(field);
  });
  if (!fields.length) return here.drop("form has no usable field");
  const title = firstText([raw.title, raw.label], 80);
  const id = formIdFrom(firstText([raw.id, raw.name], 60), title);
  const submit = firstText([raw.submit, raw.button], 24) ?? "Send";
  return clean({ type: "form", id, title, submit, fields: keepFirst(fields, MAX_FIELDS, here, "fields"), path: here.path });
}
function formIdFrom(id, title) {
  if (id) return id;
  const slug2 = (title ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  return slug2 || "form-1";
}
function shortLabel2(text, max = LABEL) {
  if (text.length <= max) return text;
  const room = text.slice(0, max - 1);
  const lastSpace = room.lastIndexOf(" ");
  const atWord = lastSpace > max / 2 ? room.slice(0, lastSpace) : room;
  return `${atWord.trimEnd()}\u2026`;
}
function readField(item, here) {
  if (!item || typeof item !== "object") return here.drop("field is not an object");
  const named = String(item.kind ?? item.type ?? "").trim().toLowerCase();
  const kind = KIND_NAMES[named];
  if (!kind) return here.drop(`field kind "${named}" isn't one of ${KINDS.join(", ")}`);
  const id = firstText([item.id, item.name, item.key], 200);
  if (!id) return here.drop("field needs an id");
  if (!FIELD_ID.test(id)) return here.drop('field id must be a word like "where" (letters, digits, _ or -)');
  if (RESERVED_IDS.includes(id)) return here.drop(`field id "${id}" is reserved`);
  const whole2 = firstText([item.label, item.title], 400);
  const group = firstText([item.group, item.section], GROUP);
  const base = clean({ id, label: whole2 ? shortLabel2(whole2) : id, group, required: item.required === true });
  if (kind === "text") return readTextField(item, named, base);
  if (kind === "slider") return readSlider(item, base, here);
  const options = readOptions(firstList([item.options, item.choices]) ?? [], here);
  if (!options.length) return here.drop(`${kind} needs options`);
  const values = options.map((o) => o.value);
  if (kind === "checkbox") {
    const ticked = prefilledList(item.value).map((v) => String(v)).filter((v) => values.includes(v));
    return { ...base, kind, options, value: [...new Set(ticked)] };
  }
  const given = firstTextOrNumber([item.value, item.default]);
  const value = given !== void 0 && values.includes(given) ? given : void 0;
  return clean({ ...base, kind, options, value });
}
function prefilledList(value) {
  if (Array.isArray(value)) return value;
  if (value === void 0) return [];
  return [value];
}
function readOptions(list, here) {
  const options = [];
  for (const o of list) {
    const isObject2 = !!o && typeof o === "object";
    const value = isObject2 ? firstTextOrNumber([o.value, o.id, o.label], OPTION) : firstTextOrNumber([o], OPTION);
    if (value === void 0 || options.some((x) => x.value === value)) continue;
    const label = (isObject2 ? firstText([o.label, o.name], OPTION) : void 0) ?? value;
    const note = isObject2 ? firstText([o.note, o.description], NOTE) : void 0;
    options.push(clean({ value, label, note }));
  }
  return keepFirst(options, MAX_OPTIONS, here, "options");
}
function readTextField(item, named, base) {
  const placeholder = firstText([item.placeholder, item.hint], PLACEHOLDER);
  const multiline = item.multiline === true || named === "textarea";
  const value = firstText([item.value, item.default], TEXT_VALUE);
  return clean({ ...base, kind: "text", placeholder, multiline, value });
}
function readSlider(item, base, here) {
  const min = num(item.min) ?? 0;
  const max = num(item.max) ?? 100;
  if (min >= max) return here.drop("slider needs min below max");
  const given = num(item.step);
  const step = given !== null && given > 0 ? given : niceStep((max - min) / 100);
  const value = onStep(num(item.value) ?? num(item.default) ?? min, min, max, step);
  return clean({ ...base, kind: "slider", min, max, step, value, unit: firstText([item.unit], 12), ends: readEnds(item.ends) });
}
function readEnds(v) {
  if (!Array.isArray(v) || v.length !== 2) return void 0;
  const left = firstText([v[0]], END);
  const right = firstText([v[1]], END);
  return left && right ? [left, right] : void 0;
}
function onStep(value, min, max, step) {
  const inRange = Math.min(max, Math.max(min, value));
  const snapped = Math.min(max, min + Math.round((inRange - min) / step) * step);
  return Number(snapped.toFixed(Math.max(decimals(step), decimals(min))));
}
function decimals(n) {
  const text = String(n);
  const dot = text.indexOf(".");
  return dot === -1 ? 0 : text.length - dot - 1;
}

// src/blocks/form/formMessage.ts
function startingValues(form) {
  const values = {};
  for (const f of form.fields) {
    if (f.kind === "checkbox") values[f.id] = [...f.value];
    else if (f.kind === "slider") values[f.id] = f.value;
    else if (f.kind === "text") values[f.id] = f.value ?? "";
    else values[f.id] = f.value ?? null;
  }
  return values;
}
function hasValue(value) {
  if (typeof value === "number") return true;
  if (Array.isArray(value)) return value.length > 0;
  return typeof value === "string" && value.trim() !== "";
}
function canSend(form, values, sent) {
  if (sent) return false;
  return form.fields.every((f) => !f.required || hasValue(values[f.id]));
}
function answerWords(field, value) {
  if (!hasValue(value ?? null)) return "";
  if (field.kind === "slider") return formatWithUnit(value, field.unit);
  if (field.kind === "text") return String(value).trim().split(/\s*\n\s*/).join(" / ");
  const labelOf = (v) => field.options.find((o) => o.value === v)?.label ?? v;
  if (field.kind === "checkbox") return value.map(labelOf).join(", ");
  return labelOf(String(value));
}
function startsGroup2(fields, i) {
  const group = fields[i].group;
  if (!group) return false;
  return fields[i - 1]?.group !== group;
}
function answerMessage(form, values) {
  const lines = [form.title ? `Form: ${form.title} (${form.id})` : `Form: ${form.id}`];
  form.fields.forEach((f, i) => {
    if (startsGroup2(form.fields, i)) lines.push(`\u2014 ${f.group} \u2014`);
    lines.push(`${f.label}: ${answerWords(f, values[f.id]) || "(none)"}`);
  });
  return lines.join("\n");
}

// src/blocks/form/sentForm.ts
function sentRecord(values) {
  return { sent: true, values: { ...values } };
}
function readSent(saved, form) {
  if (!saved || typeof saved !== "object" || saved.sent !== true) return null;
  const given = saved.values;
  const values = startingValues(form);
  if (!given || typeof given !== "object" || Array.isArray(given)) return values;
  for (const field of form.fields) {
    if (!Object.prototype.hasOwnProperty.call(given, field.id)) continue;
    const kept = fitting(field, given[field.id]);
    if (kept !== void 0) values[field.id] = kept;
  }
  return values;
}
function fitting(field, value) {
  if (field.kind === "slider") return typeof value === "number" && isFinite(value) ? onStep(value, field.min, field.max, field.step) : void 0;
  if (field.kind === "text") return typeof value === "string" && value.length <= TEXT_VALUE ? value : void 0;
  const options = field.options.map((o) => o.value);
  if (field.kind === "checkbox") {
    if (!Array.isArray(value)) return void 0;
    return options.filter((o) => value.includes(o));
  }
  if (value === null) return null;
  return typeof value === "string" && options.includes(value) ? value : void 0;
}

// src/blocks/form/Form.tsx
import { jsx as jsx19, jsxs as jsxs16 } from "react/jsx-runtime";
function Form(form) {
  const { send } = useContext4(BlockActions);
  const [values, setValues] = useState12(() => startingValues(form));
  const [sent, markSent] = useSentForm(form, setValues);
  const ready = canSend(form, values, sent);
  function onSend() {
    if (!ready) return;
    markSent(values);
    send(answerMessage(form, values));
  }
  return /* @__PURE__ */ jsxs16(
    "form",
    {
      className: sent ? "hb-card hb-form hb-form-sent" : "hb-card hb-form",
      "aria-disabled": sent,
      onSubmit: (e) => {
        e.preventDefault();
        onSend();
      },
      children: [
        form.title && /* @__PURE__ */ jsx19("div", { className: "hb-card-title", children: /* @__PURE__ */ jsx19(InlineText, { text: form.title }) }),
        /* @__PURE__ */ jsx19("fieldset", { disabled: sent, children: form.fields.map((field, i) => /* @__PURE__ */ jsxs16("div", { children: [
          startsGroup2(form.fields, i) && /* @__PURE__ */ jsx19("div", { className: "hb-form-group", children: /* @__PURE__ */ jsx19(InlineText, { text: field.group }) }),
          /* @__PURE__ */ jsx19(FieldView, { field, value: values[field.id], onChange: (v) => setValues((all) => ({ ...all, [field.id]: v })) })
        ] }, field.id)) }),
        /* @__PURE__ */ jsxs16("div", { className: "hb-form-foot", children: [
          sent && /* @__PURE__ */ jsx19("span", { className: "hb-form-done", children: "\u2713 Sent" }),
          /* @__PURE__ */ jsx19("button", { type: "submit", className: "hb-pill hb-pill-solid", disabled: !ready, children: form.submit })
        ] })
      ]
    }
  );
}
function useSentForm(form, setValues) {
  const { rest, blockId } = useContext4(BlockActions);
  const [sent, setSent] = useState12(false);
  const sentHere = useRef7(false);
  const latest = useRef7(form);
  latest.current = form;
  useEffect2(() => {
    if (!rest || !blockId) return;
    let live = true;
    loadBoardState(rest, blockId).then((state) => {
      if (!live || sentHere.current) return;
      const answers = readSent(state[latest.current.path], latest.current);
      if (!answers) return;
      setValues(answers);
      setSent(true);
    });
    return () => {
      live = false;
    };
  }, [rest, blockId, form.path, setValues]);
  function markSent(values) {
    sentHere.current = true;
    setSent(true);
    if (rest && blockId) void saveBoardValue(rest, blockId, form.path, sentRecord(values));
  }
  return [sent, markSent];
}
function FieldView({ field, value, onChange }) {
  if (field.kind === "slider") {
    const at2 = typeof value === "number" ? value : field.value;
    return /* @__PURE__ */ jsxs16("label", { className: "hb-form-field", children: [
      /* @__PURE__ */ jsxs16("span", { className: "hb-calc-head", children: [
        /* @__PURE__ */ jsx19("span", { className: "hb-calc-label", children: /* @__PURE__ */ jsx19(InlineText, { text: field.label }) }),
        /* @__PURE__ */ jsx19("span", { className: "hb-calc-value", children: formatWithUnit(at2, field.unit) })
      ] }),
      /* @__PURE__ */ jsx19(
        "input",
        {
          type: "range",
          className: "hb-range",
          min: field.min,
          max: field.max,
          step: field.step,
          value: at2,
          onChange: (e) => onChange(Number(e.target.value))
        }
      ),
      field.ends && /* @__PURE__ */ jsxs16("span", { className: "hb-form-ends", children: [
        /* @__PURE__ */ jsx19("span", { children: field.ends[0] }),
        /* @__PURE__ */ jsx19("span", { children: field.ends[1] })
      ] })
    ] });
  }
  if (field.kind === "text") {
    const text = typeof value === "string" ? value : "";
    const props = { className: "hb-input", value: text, maxLength: TEXT_VALUE, placeholder: field.placeholder };
    return /* @__PURE__ */ jsxs16("label", { className: "hb-form-field", children: [
      /* @__PURE__ */ jsx19("span", { className: "hb-form-label", children: /* @__PURE__ */ jsx19(InlineText, { text: field.label }) }),
      field.multiline ? /* @__PURE__ */ jsx19("textarea", { ...props, rows: 3, onChange: (e) => onChange(e.target.value) }) : /* @__PURE__ */ jsx19("input", { type: "text", ...props, onChange: (e) => onChange(e.target.value) })
    ] });
  }
  if (field.kind === "select") {
    const chosen = field.options.find((o) => o.value === value);
    return /* @__PURE__ */ jsxs16("label", { className: "hb-form-field", children: [
      /* @__PURE__ */ jsx19("span", { className: "hb-form-label", children: /* @__PURE__ */ jsx19(InlineText, { text: field.label }) }),
      /* @__PURE__ */ jsxs16("select", { className: "hb-input", value: chosen ? chosen.value : "", onChange: (e) => onChange(e.target.value), children: [
        !chosen && /* @__PURE__ */ jsx19("option", { value: "", disabled: true, children: "Choose\u2026" }),
        field.options.map((o) => /* @__PURE__ */ jsx19("option", { value: o.value, children: o.label }, o.value))
      ] }),
      chosen?.note && /* @__PURE__ */ jsx19("span", { className: "hb-form-note", children: chosen.note })
    ] });
  }
  return /* @__PURE__ */ jsx19(Pills, { field, value, onChange });
}
function Pills({ field, value, onChange }) {
  const isRadio = field.kind === "radio";
  const picked = isRadio ? [String(value ?? "")] : Array.isArray(value) ? value : [];
  function tap(option) {
    if (isRadio) return onChange(option.value);
    const ticked = picked.includes(option.value) ? picked.filter((v) => v !== option.value) : [...picked, option.value];
    onChange(field.options.map((o) => o.value).filter((v) => ticked.includes(v)));
  }
  return /* @__PURE__ */ jsxs16("div", { className: "hb-form-field", role: isRadio ? "radiogroup" : "group", "aria-label": field.label, children: [
    /* @__PURE__ */ jsx19("span", { className: "hb-form-label", children: /* @__PURE__ */ jsx19(InlineText, { text: field.label }) }),
    /* @__PURE__ */ jsx19("div", { className: "hb-options", children: field.options.map((o) => {
      const on = picked.includes(o.value);
      return /* @__PURE__ */ jsxs16(
        "button",
        {
          type: "button",
          role: isRadio ? "radio" : "checkbox",
          "aria-checked": on,
          onClick: () => tap(o),
          className: on ? "hb-option hb-option-on" : "hb-option",
          children: [
            o.label,
            o.note && /* @__PURE__ */ jsx19("span", { className: "hb-option-note", children: o.note })
          ]
        },
        o.value
      );
    }) })
  ] });
}

// src/blocks/heatmap/Heatmap.tsx
import { Fragment as Fragment7, useState as useState13 } from "react";

// src/blocks/heatmap/heatmapColour.ts
var FAINT = 10;
var DEEP = 70;
function rangeOf(values) {
  let low = Infinity;
  let high = -Infinity;
  for (const row of values) {
    for (const v of row) {
      if (v === null) continue;
      low = Math.min(low, v);
      high = Math.max(high, v);
    }
  }
  if (low === Infinity) return { low: 0, high: 0 };
  return { low, high };
}
function cellColour(value, range, scale) {
  if (value === null) return "var(--hb-well)";
  let colour;
  let share;
  if (scale === "diverging") {
    const biggest = Math.max(Math.abs(range.low), Math.abs(range.high));
    colour = value < 0 ? "--hb-warn" : "--hb-good";
    share = biggest === 0 ? 0 : Math.abs(value) / biggest;
  } else {
    const span = range.high - range.low;
    colour = "--hb-accent";
    share = span === 0 ? 1 : (value - range.low) / span;
  }
  const percent = Math.round(FAINT + (DEEP - FAINT) * share);
  return `color-mix(in srgb, var(${colour}) ${percent}%, transparent)`;
}
function cellText(value, unit) {
  if (value === null) return "\u2013";
  const text = Number.isInteger(value) ? String(value) : value.toFixed(1);
  if (!unit) return text;
  if (unit === "%") return `${text}%`;
  return `${text} ${unit}`;
}

// src/blocks/heatmap/Heatmap.tsx
import { jsx as jsx20, jsxs as jsxs17 } from "react/jsx-runtime";
var SHOW_NUMBERS_UP_TO = 6;
function Heatmap({ title, rows, cols, values, unit, scale }) {
  const [picked, setPicked] = useState13(null);
  const range = rangeOf(values);
  const numbersInCells = cols.length <= SHOW_NUMBERS_UP_TO;
  return /* @__PURE__ */ jsxs17("div", { className: "hb-card hb-heatmap", children: [
    title && /* @__PURE__ */ jsx20("div", { className: "hb-card-title", children: title }),
    /* @__PURE__ */ jsxs17(
      "div",
      {
        className: "hb-heat-grid",
        style: { gridTemplateColumns: `minmax(0, max-content) repeat(${cols.length}, minmax(0, 1fr))` },
        role: "table",
        "aria-label": title ?? "Heat map",
        children: [
          /* @__PURE__ */ jsx20("span", {}),
          cols.map((c, j) => /* @__PURE__ */ jsx20("span", { className: "hb-heat-col", role: "columnheader", children: c }, j)),
          rows.map((r, i) => /* @__PURE__ */ jsxs17(Fragment7, { children: [
            /* @__PURE__ */ jsx20("span", { className: "hb-heat-row", role: "rowheader", children: r }),
            cols.map((c, j) => {
              const v = values[i][j];
              return /* @__PURE__ */ jsx20(
                "button",
                {
                  type: "button",
                  className: "hb-heat-cell",
                  style: { background: cellColour(v, range, scale) },
                  onClick: () => setPicked({ row: i, col: j }),
                  "aria-label": `${r}, ${c}: ${cellText(v, unit)}`,
                  children: numbersInCells && v !== null ? cellText(v, unit) : ""
                },
                j
              );
            })
          ] }, i))
        ]
      }
    ),
    picked && /* @__PURE__ */ jsxs17("div", { className: "hb-heat-picked", children: [
      rows[picked.row],
      " \xB7 ",
      cols[picked.col],
      ": ",
      /* @__PURE__ */ jsx20("b", { children: cellText(values[picked.row][picked.col], unit) })
    ] })
  ] });
}

// src/blocks/heatmap/read.ts
var MAX_SIDE = 12;
function readHeatmap(raw, here) {
  const cols = labels(raw.cols);
  const rowLabels = labels(raw.rows);
  const rawValues = Array.isArray(raw.values) ? raw.values : [];
  if (!cols.length || !rowLabels.length || !rawValues.length) return here.drop("heatmap needs rows, cols and values");
  const keptCols = keepFirst(cols, MAX_SIDE, here, "cols");
  const rows = [];
  const values = [];
  rowLabels.forEach((label, i) => {
    const cells = rawValues[i];
    if (!Array.isArray(cells)) {
      here.at("values").at(i).drop(`no values for row "${label}"`);
      return;
    }
    if (cells.length < keptCols.length) {
      here.at("values").at(i).drop(`row "${label}" has ${cells.length} values, the heatmap has ${keptCols.length} columns`);
      return;
    }
    rows.push(label);
    values.push(keptCols.map((_, j) => num(cells[j])));
  });
  if (!rows.length) return here.drop("heatmap has no usable row");
  const keptRows = keepFirst(rows, MAX_SIDE, here, "rows");
  const keptValues = values.slice(0, keptRows.length);
  return clean({
    type: "heatmap",
    title: str(raw.title, 80),
    rows: keptRows,
    cols: keptCols,
    values: keptValues,
    unit: str(raw.unit, 12),
    scale: scaleOf(raw.scale, keptValues)
  });
}
function labels(v) {
  if (!Array.isArray(v)) return [];
  const out = [];
  for (const item of v) {
    const text = textOrNumber(item, 24);
    if (text !== void 0) out.push(text);
  }
  return out;
}
function scaleOf(asked, values) {
  if (asked === "sequential" || asked === "diverging") return asked;
  const anyNegative = values.some((row) => row.some((v) => v !== null && v < 0));
  return anyNegative ? "diverging" : "sequential";
}

// src/blocks/images/Images.tsx
import { useEffect as useEffect3, useState as useState14 } from "react";
import { jsx as jsx21, jsxs as jsxs18 } from "react/jsx-runtime";
function Images({ block }) {
  const [failed, setFailed] = useState14(/* @__PURE__ */ new Set());
  const [open, setOpen] = useState14(null);
  const shown = block.images.filter((p) => !failed.has(p.url));
  if (!shown.length) return null;
  const fail = (url) => setFailed((before) => new Set(before).add(url));
  return /* @__PURE__ */ jsxs18("figure", { className: "hb-photos", children: [
    block.title && /* @__PURE__ */ jsx21("figcaption", { className: "hb-chart-title", children: block.title }),
    /* @__PURE__ */ jsx21("div", { className: "hb-photo-strip", children: shown.map((p) => /* @__PURE__ */ jsxs18("button", { type: "button", className: "hb-photo", onClick: () => setOpen(p), "aria-label": p.caption ?? "Open photo", children: [
      /* @__PURE__ */ jsx21("img", { src: p.url, alt: p.caption ?? "", loading: "lazy", referrerPolicy: "no-referrer", onError: () => fail(p.url) }),
      (p.caption || p.source) && /* @__PURE__ */ jsxs18("span", { className: "hb-photo-text", children: [
        p.caption && /* @__PURE__ */ jsx21("span", { className: "hb-photo-caption", children: p.caption }),
        p.source && /* @__PURE__ */ jsx21("span", { className: "hb-photo-source", children: p.source })
      ] })
    ] }, p.url)) }),
    open && /* @__PURE__ */ jsx21(Overlay, { photo: open, onClose: () => setOpen(null) })
  ] });
}
function Overlay({ photo, onClose }) {
  useEffect3(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return /* @__PURE__ */ jsxs18("div", { className: "hb-photo-overlay", role: "dialog", "aria-label": photo.caption ?? "Photo", onClick: onClose, children: [
    /* @__PURE__ */ jsx21("img", { src: photo.url, alt: photo.caption ?? "", referrerPolicy: "no-referrer" }),
    (photo.caption || photo.source) && /* @__PURE__ */ jsxs18("div", { className: "hb-photo-overlay-text", children: [
      photo.caption,
      photo.source && /* @__PURE__ */ jsxs18("span", { children: [
        " \xB7 ",
        photo.source
      ] })
    ] })
  ] });
}

// src/blocks/images/read.ts
function readImages(raw, here) {
  const list = Array.isArray(raw.images) ? raw.images : Array.isArray(raw.photos) ? raw.photos : [];
  const photos = [];
  list.forEach((p, i) => {
    const url = https(p?.url) ?? https(p?.src);
    if (!url) {
      here.at("images").at(i).drop("photo needs an https url");
      return;
    }
    photos.push(clean({ url, caption: firstText([p.caption, p.alt, p.title], 120), source: firstText([p.source, p.credit], 60) }));
  });
  if (!photos.length) return here.drop("images has no https photo");
  return clean({ type: "images", title: str(raw.title, 60), images: keepFirst(photos, 12, here, "photos") });
}

// src/blocks/kpis/Kpis.tsx
import { jsx as jsx22, jsxs as jsxs19 } from "react/jsx-runtime";
function isYear(k) {
  return typeof k.value === "number" && !k.unit && Number.isInteger(k.value) && k.value >= 1800 && k.value <= 2100;
}
var CURRENCY = /^[$₹€£¥]$/;
function kpiValue(k, { full = false } = {}) {
  if (k.value === null) return "\u2013";
  if (typeof k.value === "string") return k.value;
  if (isYear(k)) return String(k.value);
  const short = !full && Math.abs(k.value) >= SHORT_FROM;
  if (short && k.unit && CURRENCY.test(k.unit)) return fmt(k.value, k.unit);
  const money = formatAmount(k.value, k.unit);
  if (money !== null) return money;
  const plain = short ? fmt(k.value) : formatNumber(k.value, { digits: Math.abs(k.value) >= 1e3 ? 0 : 1 });
  const attached = k.unit === "%" || k.unit?.startsWith("/");
  return attached ? `${plain}${k.unit}` : k.unit ? `${plain} ${k.unit}` : plain;
}
function KpiCard({ item, trendColour }) {
  const shown = kpiValue(item);
  const full = kpiValue(item, { full: true });
  const change = formatChange(item.change, item.change_unit);
  const isText = typeof item.value === "string";
  return /* @__PURE__ */ jsxs19("div", { className: "hb-card hb-kpi", children: [
    /* @__PURE__ */ jsx22("div", { className: "hb-kpi-label", children: item.label }),
    /* @__PURE__ */ jsx22("div", { className: isText ? "hb-kpi-value hb-kpi-value-text" : "hb-kpi-value", title: full !== shown ? full : void 0, children: shown }),
    change && /* @__PURE__ */ jsx22("div", { className: `hb-kpi-change ${changeClass(item.change)}`, children: change }),
    item.trend && /* @__PURE__ */ jsx22(Sparkline, { values: item.trend, colour: trendColour })
  ] });
}
function Kpis({ items }) {
  const several = items.filter((k) => k.trend).length >= 2;
  return /* @__PURE__ */ jsx22("div", { className: "hb-kpis", children: items.map((k, i) => /* @__PURE__ */ jsx22(KpiCard, { item: k, trendColour: several ? partColour(i) : void 0 }, i)) });
}
function changeClass(change) {
  return change > 0 ? "hb-kpi-up" : change < 0 ? "hb-kpi-down" : "hb-kpi-flat";
}
var SPARK_W = 120;
var SPARK_H = 28;
var SPARK_PAD = 2;
function Sparkline({ values, colour }) {
  return /* @__PURE__ */ jsx22("svg", { className: "hb-kpi-spark", viewBox: `0 0 ${SPARK_W} ${SPARK_H}`, preserveAspectRatio: "none", "aria-hidden": "true", children: /* @__PURE__ */ jsx22("path", { d: sparkPath(values), style: colour ? { stroke: colour } : void 0 }) });
}
function sparkPath(values) {
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = SPARK_H - 2 * SPARK_PAD;
  const y = (v) => hi === lo ? SPARK_H / 2 : SPARK_PAD + (1 - (v - lo) / (hi - lo)) * span;
  const x = (i) => i / (values.length - 1) * SPARK_W;
  return values.map((v, i) => `${i ? "L" : "M"}${round(x(i))} ${round(y(v))}`).join("");
}
function round(n) {
  return Math.round(n * 10) / 10;
}

// src/blocks/kpis/read.ts
var TREND_FEWEST = 2;
var TREND_MOST = 60;
function readKpi(item) {
  let value = num(item.value);
  if (value === null) value = str(item.value, 40) ?? null;
  const unit = typeof item.unit === "string" ? item.unit : void 0;
  const changeUnit = item.change_unit === "pt" ? "pt" : "%";
  const kpi = { label: item.label, value, unit, change: num(item.change), change_unit: changeUnit };
  if (kpi.unit === void 0) delete kpi.unit;
  if (kpi.change === null) delete kpi.change;
  const trend = readTrend(item.trend);
  if (trend) kpi.trend = trend;
  return kpi;
}
function readTrend(v) {
  if (!Array.isArray(v)) return void 0;
  const numbers = v.map(num).filter((n) => n !== null);
  return numbers.length >= TREND_FEWEST ? numbers.slice(-TREND_MOST) : void 0;
}
function readKpis(raw, here) {
  if (!Array.isArray(raw.items)) return here.drop("kpis needs items");
  const items = [];
  raw.items.forEach((item, i) => {
    if (!item || typeof item.label !== "string") {
      here.at("items").at(i).drop("item has no label");
      return;
    }
    items.push(readKpi(item));
  });
  if (!items.length) return here.drop("kpis has no item with a label");
  return { type: "kpis", items: keepFirst(items, 4, here, "items") };
}
function readStat(raw, here) {
  const label = firstText([raw.label, raw.title], 40);
  if (!label) return here.drop("stat needs a label");
  return { type: "stat", ...readKpi({ ...raw, label }) };
}

// src/blocks/layout/Containers.tsx
import { useState as useState15 } from "react";
import { jsx as jsx23, jsxs as jsxs20 } from "react/jsx-runtime";
var OWN_WIDTH_KINDS = ["badge", "button", "link"];
function Row({ kinds, children }) {
  return /* @__PURE__ */ jsx23("div", { className: "hb-row", children: children.map((child, i) => /* @__PURE__ */ jsx23("div", { className: OWN_WIDTH_KINDS.includes(kinds[i]) ? "hb-row-cell hb-row-cell-own" : "hb-row-cell", children: child }, i)) });
}
function Grid({ children }) {
  return /* @__PURE__ */ jsx23("div", { className: "hb-grid", children: children.map((child, i) => /* @__PURE__ */ jsx23("div", { className: "hb-grid-cell", children: child }, i)) });
}
function Columns({ children }) {
  return /* @__PURE__ */ jsx23("div", { className: "hb-columns", children: children.map((child, i) => /* @__PURE__ */ jsx23("div", { className: "hb-column", children: child }, i)) });
}
function Section({ title, collapsed, children }) {
  const [open, setOpen] = useState15(!collapsed);
  if (!collapsed) {
    return /* @__PURE__ */ jsxs20("div", { className: "hb-card hb-section", children: [
      title && /* @__PURE__ */ jsx23("div", { className: "hb-card-title", children: /* @__PURE__ */ jsx23(InlineText, { text: title }) }),
      /* @__PURE__ */ jsx23("div", { className: "hb-section-body", children })
    ] });
  }
  return /* @__PURE__ */ jsxs20("div", { className: "hb-card hb-section", children: [
    /* @__PURE__ */ jsxs20("button", { type: "button", className: "hb-section-toggle", onClick: () => setOpen(!open), "aria-expanded": open, children: [
      /* @__PURE__ */ jsx23("span", { className: "hb-card-title", children: /* @__PURE__ */ jsx23(InlineText, { text: title ?? "" }) }),
      /* @__PURE__ */ jsx23(
        "svg",
        {
          className: open ? "hb-chevron hb-chevron-open" : "hb-chevron",
          width: "18",
          height: "18",
          viewBox: "0 0 24 24",
          fill: "none",
          stroke: "currentColor",
          strokeWidth: "2.2",
          strokeLinecap: "round",
          strokeLinejoin: "round",
          "aria-hidden": "true",
          children: /* @__PURE__ */ jsx23("path", { d: "M9 6l6 6-6 6" })
        }
      )
    ] }),
    open && /* @__PURE__ */ jsx23("div", { className: "hb-section-body hb-appear", children })
  ] });
}

// src/blocks/layout/read.ts
var WIDE_KINDS = [
  "chart",
  "timeline",
  "images",
  "table",
  "section",
  "grid",
  "list",
  "heatmap",
  "flip",
  "progress",
  "streak",
  "actions",
  "tiles",
  "checklist",
  "calculator",
  "form"
];
var MAX_IN_ROW = 3;
var MAX_IN_GRID = 6;
var MAX_COLUMNS = 3;
function readContainer(raw, here, depth, readChild) {
  const kind = raw.type;
  const list = firstList([raw.children, raw.items, raw.blocks, raw.content]) ?? [];
  const deepestAllowed = kind === "section" || kind === "columns" ? 0 : 1;
  const flatten = depth > deepestAllowed;
  const childDepth = flatten ? depth : depth + 1;
  let children = [];
  list.forEach((child, i) => {
    children.push(...readChild(child, here.at("children").at(i), childDepth));
  });
  if (!children.length) {
    here.drop(`${kind} has no children it can draw`);
    return [];
  }
  const title = firstText([raw.title, raw.label], 60);
  if (flatten) {
    here.drop(`${kind} nested too deep; drawn in place`);
    if (kind === "section" && title) return [{ type: "heading", text: title }, ...children];
    return children;
  }
  if (kind === "section") {
    const collapsed = raw.collapsed === true;
    let shownTitle = title;
    if (!shownTitle && collapsed) shownTitle = "Details";
    return [clean({ type: "section", title: shownTitle, collapsed, children })];
  }
  if (kind === "columns") {
    if (children.length === 1) return children;
    return [{ type: "columns", children: keepFirst(children, MAX_COLUMNS, here, "children") }];
  }
  const wide = children.find((b) => WIDE_KINDS.includes(b.type));
  if (kind === "row" && wide) {
    here.drop(`a ${wide.type} can't sit in a row; drawn as a stack`);
    return children;
  }
  if (children.length === 1) return children;
  if (kind === "row") {
    children = keepFirst(children, MAX_IN_ROW, here, "children");
    return [{ type: "row", children }];
  }
  children = keepFirst(children, MAX_IN_GRID, here, "children");
  return [{ type: "grid", children }];
}

// src/blocks/layout/readTabs.ts
var MAX_TABS = 6;
var MAX_LABEL = 30;
function readTabs(raw, here, depth, readChild, inTab = false) {
  const list = firstList([raw.tabs, raw.items]) ?? [];
  const flatten = depth > 0 || inTab;
  const tabs = [];
  for (let i = 0; i < list.length; i++) {
    const tab = readTab(list[i], here.at("tabs").at(i), depth, readChild);
    if (!tab) continue;
    tabs.push(tab);
    if (flatten) break;
  }
  if (!tabs.length) {
    here.drop("tabs has no tab it can draw");
    return [];
  }
  if (flatten) {
    here.drop("tabs go at the top level only; first tab drawn in place");
    return tabs[0].children;
  }
  if (tabs.length === 1) {
    here.drop("tabs has only one tab; drawn in place");
    return tabs[0].children;
  }
  return [{ type: "tabs", tabs: keepFirst(tabs, MAX_TABS, here, "tabs") }];
}
function readTab(item, here, depth, readChild) {
  if (!item || typeof item !== "object" || Array.isArray(item)) return here.drop("tab is not an object");
  const label = firstText([item.label, item.title], MAX_LABEL);
  if (!label) return here.drop("tab needs a label");
  const children = readTabChildren(firstList([item.children, item.items, item.blocks, item.content]) ?? [], here, depth, readChild);
  if (!children.length) return here.drop("tab has no children it can draw");
  return { label, children };
}
function readTabChildren(list, here, depth, readChild) {
  const out = [];
  list.forEach((child, i) => {
    const at2 = here.at("children").at(i);
    if (depth === 0 && child?.type === "tabs") out.push(...readTabs(child, at2, 0, readChild, true));
    else out.push(...readChild(child, at2, depth));
  });
  return out;
}

// src/blocks/layout/Tabs.tsx
import { useId as useId3, useRef as useRef8, useState as useState16 } from "react";
import { jsx as jsx24, jsxs as jsxs21 } from "react/jsx-runtime";
function tabAfterKey(current, count, key) {
  if (key === "ArrowRight") return (current + 1) % count;
  if (key === "ArrowLeft") return (current - 1 + count) % count;
  return current;
}
function Tabs({ labels: labels2, panel }) {
  const [picked, setPicked] = useState16(0);
  const buttons = useRef8([]);
  const base = useId3().replace(/[^a-zA-Z0-9]/g, "");
  const onKey = (e) => {
    const next = tabAfterKey(picked, labels2.length, e.key);
    if (next === picked) return;
    e.preventDefault();
    setPicked(next);
    buttons.current[next]?.focus();
  };
  return /* @__PURE__ */ jsxs21("div", { className: "hb-tabs", children: [
    /* @__PURE__ */ jsx24("div", { className: "hb-tab-bar", role: "tablist", onKeyDown: onKey, children: labels2.map((label, i) => /* @__PURE__ */ jsx24(
      "button",
      {
        type: "button",
        role: "tab",
        id: `${base}-tab-${i}`,
        "aria-controls": `${base}-panel`,
        "aria-selected": i === picked,
        tabIndex: i === picked ? 0 : -1,
        className: i === picked ? "hb-tab hb-tab-on" : "hb-tab",
        ref: (el) => {
          buttons.current[i] = el;
        },
        onClick: () => setPicked(i),
        children: /* @__PURE__ */ jsx24(InlineText, { text: label })
      },
      i
    )) }),
    /* @__PURE__ */ jsx24("div", { className: "hb-tab-panel hb-appear", role: "tabpanel", id: `${base}-panel`, "aria-labelledby": `${base}-tab-${picked}`, children: panel(picked) }, picked)
  ] });
}

// src/blocks/list/List.tsx
import { useContext as useContext5, useState as useState17 } from "react";

// src/blocks/list/rowAvatar.ts
var AVATAR_COLOURS = [1, 3, 8, 4, 6];
function rowLead(item, ranked, photoFailed) {
  if (item.image && !photoFailed) return "image";
  if (item.icon) return "icon";
  if (ranked) return "none";
  if (initialOf(item.title) === null) return "none";
  return "initial";
}
function initialOf(title) {
  const first = title.match(/[\p{L}\p{N}]/u);
  if (!first) return null;
  return first[0].toLocaleUpperCase();
}
function avatarColour(title) {
  const name = title.replaceAll("**", "").split(" \xB7 ")[0].trim().toLowerCase();
  let hash = 0;
  for (const ch of name) {
    hash = (hash * 31 + ch.codePointAt(0)) % 1000003;
  }
  return `var(--hb-chart-${AVATAR_COLOURS[hash % AVATAR_COLOURS.length]})`;
}

// src/blocks/list/List.tsx
import { Fragment as Fragment8, jsx as jsx25, jsxs as jsxs22 } from "react/jsx-runtime";
function List({ title, ranked, items }) {
  return /* @__PURE__ */ jsxs22("div", { className: "hb-card hb-list", children: [
    title && /* @__PURE__ */ jsx25("div", { className: "hb-list-heading", children: /* @__PURE__ */ jsx25(InlineText, { text: title }) }),
    items.map((item, i) => /* @__PURE__ */ jsx25(ListRow, { item, rank: ranked ? i + 1 : null }, i))
  ] });
}
function ListRow({ item, rank }) {
  const { send } = useContext5(BlockActions);
  const [photoFailed, setPhotoFailed] = useState17(false);
  const lead = rowLead(item, rank !== null, photoFailed);
  const body = /* @__PURE__ */ jsxs22(Fragment8, { children: [
    rank !== null && /* @__PURE__ */ jsx25("span", { className: "hb-list-rank", children: rank }),
    lead === "image" && /* @__PURE__ */ jsx25("img", { className: "hb-list-photo", src: item.image, alt: "", loading: "lazy", referrerPolicy: "no-referrer", onError: () => setPhotoFailed(true) }),
    lead === "icon" && item.icon && /* @__PURE__ */ jsx25("span", { className: "hb-list-icon", children: /* @__PURE__ */ jsx25(Icon, { name: item.icon, size: 17, stroke: 2.2 }) }),
    lead === "initial" && /* @__PURE__ */ jsx25("span", { className: "hb-list-initial", style: { background: avatarColour(item.title) }, "aria-hidden": "true", children: initialOf(item.title) }),
    /* @__PURE__ */ jsxs22("span", { className: "hb-list-body", children: [
      /* @__PURE__ */ jsx25("span", { className: "hb-list-title", children: /* @__PURE__ */ jsx25(InlineText, { text: item.title }) }),
      item.subtitle && /* @__PURE__ */ jsx25("span", { className: "hb-list-subtitle", children: /* @__PURE__ */ jsx25(InlineText, { text: item.subtitle }) })
    ] }),
    item.value && /* @__PURE__ */ jsx25("span", { className: "hb-list-value", children: /* @__PURE__ */ jsx25(InlineText, { text: item.value }) }),
    (item.run || item.url) && /* @__PURE__ */ jsx25(Chevron, {})
  ] });
  if (item.run) {
    const run = item.run;
    return /* @__PURE__ */ jsx25("button", { type: "button", className: "hb-list-row hb-list-link hb-list-button", title: run, onClick: () => send(run), children: body });
  }
  if (item.url) {
    return /* @__PURE__ */ jsx25("a", { className: "hb-list-row hb-list-link", href: item.url, target: "_blank", rel: "noreferrer", children: body });
  }
  return /* @__PURE__ */ jsx25("div", { className: "hb-list-row", children: body });
}
function Chevron() {
  return /* @__PURE__ */ jsx25(
    "svg",
    {
      className: "hb-list-chevron",
      width: "16",
      height: "16",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.2",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      "aria-hidden": "true",
      children: /* @__PURE__ */ jsx25("path", { d: "M9 6l6 6-6 6" })
    }
  );
}

// src/blocks/layers/Layers.tsx
import { useEffect as useEffect5, useRef as useRef9, useState as useState19 } from "react";

// src/lib/canvas.ts
import { useEffect as useEffect4, useState as useState18 } from "react";
function fitCanvas(canvas, height) {
  const ctx = canvas.getContext?.("2d");
  if (!ctx) return null;
  const ratio = window.devicePixelRatio || 1;
  const width = canvas.clientWidth;
  const tall = height ?? canvas.clientHeight;
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(tall * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  return { ctx, width, height: tall };
}
function colourOf(el, token) {
  const before = el.style.color;
  el.style.color = `var(${token})`;
  const colour = getComputedStyle(el).color;
  el.style.color = before;
  return colour;
}
function useTheme() {
  const [version, setVersion] = useState18(0);
  useEffect4(() => {
    const bump = () => setVersion((v) => v + 1);
    const watcher = typeof MutationObserver === "undefined" ? null : new MutationObserver(bump);
    watcher?.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style", "data-theme"] });
    const scheme = typeof window.matchMedia === "function" ? window.matchMedia("(prefers-color-scheme: dark)") : null;
    scheme?.addEventListener?.("change", bump);
    return () => {
      watcher?.disconnect();
      scheme?.removeEventListener?.("change", bump);
    };
  }, []);
  return version;
}

// src/blocks/layers/geometry.ts
var SLAB = { width: 2.4, depth: 1.5, thick: 0.16, gap: 0.34, open: 0.5, pull: 0.6 };
function rotate([x, y, z], yaw, pitch) {
  const x1 = x * Math.cos(yaw) + z * Math.sin(yaw);
  const z1 = -x * Math.sin(yaw) + z * Math.cos(yaw);
  return { x: x1, y: y * Math.cos(pitch) - z1 * Math.sin(pitch), depth: y * Math.sin(pitch) + z1 * Math.cos(pitch) };
}
function stackShapes(n, open, yaw, pitch, width, height) {
  const tall = n * SLAB.thick + (n - 1) * SLAB.gap + SLAB.open;
  const reach = Math.hypot(SLAB.width, SLAB.depth + SLAB.pull);
  const scale = Math.min(width * 0.6 / reach, height * 0.9 / (tall * Math.cos(pitch) + reach * Math.sin(pitch)));
  const cx = width * 0.36;
  const cy = height / 2;
  const screen = ([x, y, z]) => {
    const r = rotate([x, y - tall / 2, z], yaw, pitch);
    return { x: cx + r.x * scale, y: cy - r.y * scale };
  };
  const w = SLAB.width / 2;
  const d = SLAB.depth / 2;
  let floor = 0;
  return Array.from({ length: n }, (_, i) => {
    const z = (open[i] ?? 0) * SLAB.pull;
    const room = SLAB.open * (open[i] ?? 0) / 2;
    const bottom = floor + room;
    const top = bottom + SLAB.thick;
    floor = top + SLAB.gap + room;
    const face = (corners, strength) => ({ corners: corners.map(screen), strength });
    const faces = [];
    const side = Math.sin(yaw) > 0 ? -w : w;
    if (Math.sin(yaw) !== 0) faces.push(face([[side, bottom, z - d], [side, bottom, z + d], [side, top, z + d], [side, top, z - d]], 0.62));
    faces.push(face([[-w, bottom, z + d], [w, bottom, z + d], [w, top, z + d], [-w, top, z + d]], 0.5));
    const roof = face([[-w, top, z - d], [w, top, z - d], [w, top, z + d], [-w, top, z + d]], 0.22);
    faces.push(roof);
    const edge = roof.corners.reduce((a, b) => b.x > a.x ? b : a);
    return { faces, label: { x: edge.x + 12, y: edge.y + 2 } };
  });
}
function inside(corners, x, y) {
  let hit = false;
  for (let a = 0, b = corners.length - 1; a < corners.length; b = a++) {
    const p = corners[a];
    const q = corners[b];
    if (p.y > y !== q.y > y && x < (q.x - p.x) * (y - p.y) / (q.y - p.y) + p.x) hit = !hit;
  }
  return hit;
}
function slabAt(shapes, x, y) {
  for (let k = shapes.length - 1; k >= 0; k--) {
    if (shapes[k].faces.some((f) => inside(f.corners, x, y))) return k;
  }
  return null;
}

// src/blocks/layers/Layers.tsx
import { jsx as jsx26, jsxs as jsxs23 } from "react/jsx-runtime";
var TURN = 40;
var START_YAW = 28;
var PITCH = 30;
var OPEN_MS = 340;
var TONE_TOKEN = {
  blue: "--hb-chart-1",
  amber: "--hb-chart-2",
  green: "--hb-chart-3",
  violet: "--hb-chart-4",
  accent: "--hb-accent",
  grey: "--hb-muted"
};
var rad = (deg) => deg * Math.PI / 180;
function Layers({ title, caption, layers }) {
  const canvas = useRef9(null);
  const shapes = useRef9([]);
  const drag = useRef9(null);
  const [at2, setAt] = useState19(0);
  const [yaw, setYaw] = useState19(START_YAW);
  const open = useOpening(at2, layers.length);
  const width = useWidth(canvas);
  const theme = useTheme();
  const layer = layers[at2];
  const go = (i) => setAt(Math.max(0, Math.min(layers.length - 1, i)));
  const turn = (by) => setYaw((was) => Math.max(-TURN, Math.min(TURN, was + by)));
  useEffect5(() => {
    const el = canvas.current;
    const fit = el && fitCanvas(el);
    if (!el || !fit) return;
    shapes.current = stackShapes(layers.length, open, rad(yaw), rad(PITCH), fit.width, fit.height);
    paint(fit.ctx, el, fit.width, fit.height, shapes.current, layers.map((l) => l.tone), layers.map((l) => l.label), open);
  }, [open, yaw, width, theme, layers]);
  function onPointerDown(e) {
    drag.current = { x: e.clientX, moved: 0 };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }
  function onPointerMove(e) {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.x;
    drag.current = { x: e.clientX, moved: drag.current.moved + Math.abs(dx) };
    turn(dx * 0.5);
  }
  function onPointerUp(e) {
    if (drag.current && drag.current.moved < 5) {
      const box = e.currentTarget.getBoundingClientRect();
      const hit = slabAt(shapes.current, e.clientX - box.left, e.clientY - box.top);
      if (hit !== null) go(hit);
    }
    drag.current = null;
  }
  function onCanvasKey(e) {
    const moves = {
      ArrowLeft: () => turn(-5),
      ArrowRight: () => turn(5),
      ArrowUp: () => go(at2 + 1),
      ArrowDown: () => go(at2 - 1)
    };
    if (!moves[e.key]) return;
    e.preventDefault();
    e.stopPropagation();
    moves[e.key]();
  }
  function onSideKey(e) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    go(at2 + (e.key === "ArrowRight" ? 1 : -1));
  }
  const plainNote = layer.note ? ` ${layer.note.replace(/\*\*/g, "")}` : "";
  return /* @__PURE__ */ jsxs23("div", { className: "hb-card hb-layers", children: [
    title && /* @__PURE__ */ jsx26("div", { className: "hb-card-title", children: title }),
    /* @__PURE__ */ jsxs23("div", { className: "hb-layers-body", children: [
      /* @__PURE__ */ jsxs23("div", { className: "hb-layers-stage", children: [
        /* @__PURE__ */ jsx26(
          "canvas",
          {
            ref: canvas,
            className: "hb-layers-canvas",
            tabIndex: 0,
            role: "img",
            "aria-label": `${title ?? "Layers"} in 3D, ${layer.label} pulled out, ${at2 + 1} of ${layers.length}.${plainNote}`,
            onPointerDown,
            onPointerMove,
            onPointerUp,
            onPointerCancel: () => {
              drag.current = null;
            },
            onKeyDown: onCanvasKey
          }
        ),
        /* @__PURE__ */ jsx26("p", { className: "hb-layers-hint", children: "Drag the drawing, or use \u2190 \u2192 on it, to turn it; \u2191 \u2193 change the slab." }),
        caption && /* @__PURE__ */ jsx26("p", { className: "hb-layers-caption", children: caption })
      ] }),
      /* @__PURE__ */ jsxs23("div", { className: "hb-layers-side", onKeyDown: onSideKey, children: [
        /* @__PURE__ */ jsxs23("div", { className: "hb-steps-head", children: [
          /* @__PURE__ */ jsx26("div", { className: "hb-steps-title", children: layer.label }),
          /* @__PURE__ */ jsx26("span", { className: "hb-steps-place", children: `${at2 + 1} of ${layers.length}` })
        ] }),
        /* @__PURE__ */ jsx26("div", { className: "hb-steps-body", "aria-live": "polite", children: layer.note && /* @__PURE__ */ jsx26("p", { className: "hb-steps-text", children: /* @__PURE__ */ jsx26(InlineText, { text: layer.note }) }) }),
        /* @__PURE__ */ jsx26("div", { className: "hb-steps-foot", children: /* @__PURE__ */ jsxs23("div", { className: "hb-steps-moves", children: [
          /* @__PURE__ */ jsx26("button", { type: "button", className: "hb-pill", disabled: at2 === 0, onClick: () => go(at2 - 1), children: "Back" }),
          /* @__PURE__ */ jsx26("button", { type: "button", className: "hb-pill hb-pill-solid", disabled: at2 === layers.length - 1, onClick: () => go(at2 + 1), children: "Next" })
        ] }) }),
        /* @__PURE__ */ jsx26("ol", { className: "hb-layers-list", "aria-label": "Slabs", children: layers.map((l, i) => /* @__PURE__ */ jsx26("li", { children: /* @__PURE__ */ jsx26("button", { type: "button", className: "hb-layers-slab", "aria-pressed": i === at2, onClick: () => go(i), children: l.label }) }, i)) })
      ] })
    ] })
  ] });
}
function useOpening(at2, n) {
  const [open, setOpen] = useState19(() => Array.from({ length: n }, (_, i) => i === at2 ? 1 : 0));
  const now = useRef9(open);
  now.current = open;
  useEffect5(() => {
    const target = Array.from({ length: n }, (_, i) => i === at2 ? 1 : 0);
    if (lessMotion() || typeof requestAnimationFrame !== "function") return setOpen(target);
    const from = now.current;
    const start = performance.now();
    let frame = requestAnimationFrame(function step(time) {
      const p = Math.min(1, (time - start) / OPEN_MS);
      const eased = p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;
      setOpen(target.map((v, k) => (from[k] ?? 0) + (v - (from[k] ?? 0)) * eased));
      if (p < 1) frame = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(frame);
  }, [at2, n]);
  return open;
}
function paint(ctx, el, width, height, shapes, tones, labels2, open) {
  const surface = colourOf(el, "--hb-surface");
  const ink = colourOf(el, "--hb-ink");
  const accent = colourOf(el, "--hb-accent");
  const font = getComputedStyle(el).fontFamily || "system-ui";
  ctx.clearRect(0, 0, width, height);
  ctx.lineWidth = 1;
  ctx.textBaseline = "middle";
  shapes.forEach((shape, i) => {
    const lit = (open[i] ?? 0) > 0.5;
    const tone = lit ? accent : colourOf(el, TONE_TOKEN[tones[i]]);
    shape.faces.forEach((face, f) => {
      const roof = f === shape.faces.length - 1;
      ctx.beginPath();
      face.corners.forEach((p, k) => k ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
      ctx.closePath();
      ctx.shadowColor = accent;
      ctx.shadowBlur = lit && roof ? 18 * (open[i] ?? 0) : 0;
      ctx.globalAlpha = 1;
      ctx.fillStyle = surface;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = roof && lit ? 0.45 : face.strength;
      ctx.fillStyle = tone;
      ctx.fill();
      ctx.globalAlpha = 0.28;
      ctx.strokeStyle = ink;
      ctx.stroke();
    });
    ctx.globalAlpha = lit ? 1 : 0.65;
    ctx.fillStyle = lit ? accent : ink;
    ctx.font = `${lit ? 700 : 600} 12.5px ${font}`;
    ctx.fillText(labels2[i], shape.label.x, shape.label.y);
  });
  ctx.globalAlpha = 1;
}

// src/blocks/layers/read.ts
var TONES2 = ["blue", "amber", "green", "violet", "accent", "grey"];
function readLayers(raw, here) {
  const layers = [];
  (firstList([raw.layers, raw.levels]) ?? []).forEach((l, i) => {
    const label = firstText([l?.label, l?.title, l?.name], 24);
    if (!label) return here.at("layers").at(i).drop("layer needs a label");
    const tone = TONES2.includes(l.tone) ? l.tone : "blue";
    layers.push(clean({ label, tone, note: firstText([l.note, l.text, l.description], 280) }));
  });
  if (layers.length < 2) return here.drop("layers needs at least 2 slabs");
  return clean({
    type: "layers",
    title: str(raw.title, 80),
    caption: str(raw.caption, 200),
    layers: keepFirst(layers, 12, here, "layers")
  });
}

// src/blocks/list/read.ts
var MAX_ITEMS2 = 12;
function readList(raw, here) {
  const list = firstList([raw.items, raw.rows]);
  if (!list) return here.drop("list needs items");
  const items = [];
  list.forEach((item, i) => {
    const row = readListItem(item);
    if (!row) {
      here.at("items").at(i).drop("row has no title");
      return;
    }
    if (actsBeforeTheModel(row.run)) {
      here.at("items").at(i).drop(NO_SEND);
      return;
    }
    items.push(row);
  });
  if (!items.length) return here.drop("list has no row with a title");
  const ranked = raw.ranked === true || raw.numbered === true;
  return clean({ type: "list", title: firstText([raw.title], 60), ranked, items: keepFirst(items, MAX_ITEMS2, here, "rows") });
}
function readListItem(item) {
  if (typeof item === "string") {
    const title2 = firstText([item], 80);
    return title2 ? { title: title2 } : null;
  }
  if (!item || typeof item !== "object") return null;
  const named = firstText([item.title, item.name, item.label], 80);
  const title = named ?? firstText([item.text], 160);
  if (!title) return null;
  const textUnder = named ? item.text : void 0;
  return clean({
    title,
    subtitle: firstWords([item.subtitle, item.description, item.detail, item.note, textUnder], 160),
    value: firstTextOrNumber([item.value, item.price, item.rating, item.score, item.meta, item.badge], 30),
    icon: icon(item.icon),
    image: https(item.image),
    run: firstText([item.run], 300),
    url: https(item.url)
  });
}

// src/blocks/progress/Progress.tsx
import { Fragment as Fragment9, jsx as jsx27, jsxs as jsxs24 } from "react/jsx-runtime";
function trackShare(value, goal, steps) {
  if (!steps.length) return Math.max(0, Math.min(1, value / goal));
  if (value <= steps[0].at) return 0;
  for (let k = 1; k < steps.length; k++) {
    if (value < steps[k].at) return (k - 1 + (value - steps[k - 1].at) / (steps[k].at - steps[k - 1].at)) / (steps.length - 1);
  }
  return 1;
}
function amountOf(value, goal, unit) {
  const plain = fmt(goal);
  const joined = fmt(goal, unit);
  if (!unit || joined !== plain && joined !== `${plain} ${unit}`) return `${fmt(value, unit)} / ${joined}`;
  return `${fmt(value)} / ${plain} ${unit}`;
}
function Progress({ title, value, goal, unit, steps }) {
  const share = trackShare(value, goal, steps);
  return /* @__PURE__ */ jsxs24("div", { className: "hb-card hb-progress", children: [
    /* @__PURE__ */ jsxs24("div", { className: "hb-progress-head", children: [
      /* @__PURE__ */ jsx27("span", { className: "hb-progress-icon", children: /* @__PURE__ */ jsx27(Icon, { name: "trophy", size: 19, stroke: 2.2 }) }),
      /* @__PURE__ */ jsx27("span", { className: "hb-card-title", children: title }),
      /* @__PURE__ */ jsxs24("span", { className: "hb-progress-amount", children: [
        /* @__PURE__ */ jsx27(Icon, { name: "flame", size: 15, stroke: 2.2 }),
        amountOf(value, goal, unit)
      ] })
    ] }),
    steps.length === 0 ? /* @__PURE__ */ jsx27("div", { className: "hb-progress-track", children: /* @__PURE__ */ jsx27("span", { className: "hb-progress-fill", style: { width: `${share * 100}%` } }) }) : /* @__PURE__ */ jsx27(Checkpoints, { steps, value, share, unit })
  ] });
}
function Checkpoints({ steps, value, share, unit }) {
  const n = steps.length;
  const edge = `${50 / n}%`;
  const span = (n - 1) / n * 100;
  return /* @__PURE__ */ jsxs24(Fragment9, { children: [
    /* @__PURE__ */ jsxs24("div", { className: "hb-progress-nodes", children: [
      /* @__PURE__ */ jsx27("span", { className: "hb-progress-track hb-progress-track-steps", style: { left: edge, right: edge } }),
      /* @__PURE__ */ jsx27("span", { className: "hb-progress-fill hb-progress-fill-steps", style: { left: edge, width: `${span * share}%` } }),
      steps.map((s, k) => {
        const done = value >= s.at;
        return /* @__PURE__ */ jsx27("span", { className: done ? "hb-progress-node hb-progress-node-done" : "hb-progress-node", style: { left: `${(k + 0.5) / n * 100}%` }, children: /* @__PURE__ */ jsx27(Icon, { name: done ? "check" : "lock", size: 12, stroke: 2.6 }) }, k);
      })
    ] }),
    /* @__PURE__ */ jsx27("div", { className: "hb-progress-labels", style: { gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }, children: steps.map((s, k) => /* @__PURE__ */ jsx27("span", { children: typeof s.label === "number" ? fmt(s.label, unit) : s.label }, k)) })
  ] });
}

// src/blocks/progress/read.ts
function readProgress(raw, here) {
  const title = str(raw.title, 40);
  if (!title) return here.drop("progress needs a title");
  const value = num(raw.value);
  if (value === null) return here.drop("progress needs a numeric value");
  const goal = num(raw.goal);
  if (goal === null || goal <= 0) return here.drop("progress needs a goal above 0");
  const steps = [];
  const rawSteps = Array.isArray(raw.steps) ? raw.steps : [];
  rawSteps.forEach((st, i) => {
    const label = str(st?.label, 28) ?? num(st?.label);
    const at2 = num(st?.at);
    if (label === void 0 || label === null || at2 === null) {
      here.at("steps").at(i).drop("checkpoint needs a label and a number `at`");
      return;
    }
    steps.push({ label, at: at2 });
  });
  steps.sort((a, b) => a.at - b.at);
  return clean({ type: "progress", title, value, goal, unit: str(raw.unit, 12), steps: keepFirst(steps, 6, here, "checkpoints") });
}

// src/blocks/simulate/read.ts
var ID3 = /^[A-Za-z_][A-Za-z0-9_]{0,23}$/;
var MAX_INPUTS2 = 4;
var MAX_VALUES = 8;
var MAX_PILES = 3;
var MAX_STEPS = 1e3;
var MAX_SECONDS = 60;
var DEFAULT_SECONDS = 10;
function readSimulate(raw, here) {
  const t = readTime(raw.t);
  if (!t) return here.drop("t needs a name (not a helper's) and to above 0");
  const taken = /* @__PURE__ */ new Set([t.name]);
  const values = [];
  const rawValues = raw.values && typeof raw.values === "object" && !Array.isArray(raw.values) ? raw.values : {};
  for (const [name, v] of Object.entries(rawValues)) {
    const n = num(v);
    if (!ID3.test(name) || isHelper(name) || taken.has(name) || n === null) {
      here.at("values").drop(`value "${name}" left out: a new name and a number, please`);
      continue;
    }
    taken.add(name);
    values.push([name, n]);
  }
  const inputs = [];
  (firstList([raw.inputs, raw.sliders]) ?? []).forEach((item, i) => {
    const input = readInput(item, here.at("inputs").at(i));
    if (!input) return;
    if (taken.has(input.id)) return here.at("inputs").at(i).drop(`name "${input.id}" is used twice`);
    taken.add(input.id);
    inputs.push(input);
  });
  const view = raw.view && typeof raw.view === "object" ? raw.view : {};
  const piles = [];
  (firstList([view.piles, view.series, raw.piles, raw.series]) ?? []).forEach((p, i) => {
    const pile = readPile(p, taken, here.at("view").at("piles").at(i));
    if (pile) piles.push(pile);
  });
  if (!piles.length) return here.drop("simulate has no pile it can work out");
  const per = num(view.per);
  return clean({
    type: "simulate",
    title: firstText([raw.title], 80),
    t,
    inputs: keepFirst(inputs, MAX_INPUTS2, here, "inputs"),
    values: keepFirst(values, MAX_VALUES, here, "values"),
    view: view.kind === "chart" ? "chart" : "dots",
    per: per !== null && per > 0 ? per : void 0,
    start: str(view.start, 40),
    piles: keepFirst(piles, MAX_PILES, here, "piles"),
    unit: str(raw.unit, 12),
    source: str(raw.source, 120)
  });
}
function readTime(raw) {
  if (!raw || typeof raw !== "object") return null;
  const name = str(raw.name, 24);
  const to = num(raw.to);
  if (!name || !ID3.test(name) || isHelper(name) || to === null || to <= 0) return null;
  const given = num(raw.step);
  const step = Math.max(given !== null && given > 0 ? given : 1, to / MAX_STEPS);
  const speed = num(raw.speed);
  const seconds = speed !== null && speed > 0 ? Math.min(MAX_SECONDS, to / speed) : DEFAULT_SECONDS;
  return clean({ name, to, step, unit: str(raw.unit, 12), seconds });
}
function readPile(p, names, here) {
  const name = firstText([p?.name, p?.label], 40);
  const formula = firstText([p?.formula, p?.expr], 300);
  if (!name || !formula) return here.drop("pile needs a name and a formula");
  try {
    const unknown = namesIn(parseFormula(formula)).filter((n) => !names.has(n));
    if (unknown.length) return here.drop(`formula uses ${unknown.join(", ")}, which nothing gives`);
  } catch (e) {
    return here.drop(`formula can't be read (${e.message})`);
  }
  return clean({ name, formula, adds: firstText([p.adds], 40) });
}

// src/blocks/simulate/Simulate.tsx
import { useEffect as useEffect7, useMemo as useMemo5, useRef as useRef12, useState as useState20 } from "react";

// src/blocks/source/Source.tsx
import { jsx as jsx28 } from "react/jsx-runtime";
function Source({ text, url }) {
  if (!url) return /* @__PURE__ */ jsx28("div", { className: "hb-source", children: text });
  return /* @__PURE__ */ jsx28("div", { className: "hb-source", children: /* @__PURE__ */ jsx28("a", { href: url, target: "_blank", rel: "noreferrer", children: text }) });
}

// src/blocks/simulate/Piles.tsx
import { useEffect as useEffect6, useRef as useRef10 } from "react";

// src/blocks/simulate/sim.ts
var MAX_DOTS = 600;
var DEFAULT_DOTS = 150;
function whole(t, step) {
  return Math.round(Math.floor(t / step + 1e-9) * step * 1e9) / 1e9;
}
function timesOf(to, step) {
  const out = [];
  for (let k = 0; k * step <= to + 1e-9; k++) out.push(whole(k * step, step));
  return out;
}
function niceAbove(v) {
  const power = 10 ** Math.floor(Math.log10(v));
  const m = v / power;
  return (m <= 1 + 1e-9 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * power;
}
function dotPer(per, most) {
  if (!(most > 0)) return per ?? 1;
  if (per !== void 0 && most / per <= MAX_DOTS) return per;
  return niceAbove(most / (per === void 0 ? DEFAULT_DOTS : MAX_DOTS));
}
function dotColour(n, start, counts, k) {
  const bands = [start, ...counts.slice(0, k + 1)];
  const band = bands.findIndex((limit) => n < limit);
  return band < 0 ? k + 1 : band;
}

// src/blocks/simulate/Piles.tsx
import { Fragment as Fragment10, jsx as jsx29, jsxs as jsxs25 } from "react/jsx-runtime";
var GROW_MS = 280;
var DOT = 14;
function Piles({ piles, amounts, start, per, most, playing, unit, label }) {
  const counts = amounts.map((a) => Math.max(0, Math.round((a ?? 0) / per)));
  const startDots = Math.max(0, Math.round(start / per));
  const tallest = Math.max(1, ...most.map((m) => Math.round(m / per)));
  return /* @__PURE__ */ jsxs25(Fragment10, { children: [
    /* @__PURE__ */ jsx29("div", { className: "hb-sim-piles", children: piles.map((pile, k) => /* @__PURE__ */ jsx29(
      Pile,
      {
        k,
        name: pile.name,
        amount: amounts[k],
        counts,
        startDots,
        tallest,
        playing,
        unit
      },
      k
    )) }),
    /* @__PURE__ */ jsxs25("div", { className: "hb-legend", children: [
      /* @__PURE__ */ jsxs25("span", { className: "hb-legend-item", children: [
        /* @__PURE__ */ jsx29("i", { className: "hb-legend-dot", style: { background: partColour(0) } }),
        `${label ?? "Start"} (a dot is ${fmt(per, unit, { full: true })})`
      ] }),
      piles.map((pile, k) => /* @__PURE__ */ jsxs25("span", { className: "hb-legend-item", children: [
        /* @__PURE__ */ jsx29("i", { className: "hb-legend-dot", style: { background: partColour(k + 1) } }),
        pile.adds ?? pile.name
      ] }, k))
    ] })
  ] });
}
function Pile({ k, name, amount, counts, startDots, tallest, playing, unit }) {
  const canvas = useRef10(null);
  const born = useRef10([]);
  const width = useWidth(canvas);
  const theme = useTheme();
  const count = counts[k];
  const cols = Math.max(20, Math.floor(width / DOT));
  const size = width / cols;
  const height = Math.ceil(tallest / cols) * size;
  const shown = amount === null ? "\u2013" : fmt(amount, unit, { full: true });
  useEffect6(() => {
    const el = canvas.current;
    if (!el) return;
    const grow = playing && !lessMotion();
    let frame = 0;
    const draw = () => {
      const fit = fitCanvas(el, height);
      if (!fit) return;
      const now = performance.now();
      const palette = [1, 2, 3, 4].map((i) => colourOf(el, `--hb-chart-${i}`));
      born.current.length = Math.min(born.current.length, count);
      while (born.current.length < count) born.current.push(grow ? now : 0);
      let growing = false;
      fit.ctx.clearRect(0, 0, fit.width, fit.height);
      for (let n = 0; n < count; n++) {
        const g = Math.min(1, (now - born.current[n]) / GROW_MS);
        if (g < 1) growing = true;
        fit.ctx.fillStyle = palette[dotColour(n, startDots, counts, k)];
        fit.ctx.beginPath();
        fit.ctx.arc(n % cols * size + size / 2, fit.height - (Math.floor(n / cols) * size + size / 2), size * 0.38 * g, 0, Math.PI * 2);
        fit.ctx.fill();
      }
      if (growing) frame = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(frame);
  }, [count, counts.join(), startDots, width, height, theme]);
  return /* @__PURE__ */ jsxs25("div", { className: "hb-sim-pile", children: [
    /* @__PURE__ */ jsx29("div", { className: "hb-sim-pile-name", children: name }),
    /* @__PURE__ */ jsx29("div", { className: "hb-sim-amount", children: shown }),
    /* @__PURE__ */ jsx29("canvas", { ref: canvas, className: "hb-sim-canvas", style: { height }, role: "img", "aria-label": `${name}: ${shown}, ${count} dots` })
  ] });
}

// src/blocks/simulate/SimChart.tsx
import { useRef as useRef11 } from "react";
import { jsx as jsx30, jsxs as jsxs26 } from "react/jsx-runtime";
var HEIGHT = 220;
var PAD = { left: 52, right: 12, top: 10, bottom: 22 };
function SimChart({ piles, lines, times, index, unit }) {
  const box = useRef11(null);
  const width = useWidth(box);
  const to = times[times.length - 1];
  const top = Math.max(1e-9, ...lines.flat().map((v) => v ?? 0));
  const yStep = niceAbove(top / 4);
  const yMax = Math.ceil(top / yStep) * yStep;
  const xStep = niceAbove(to / 5);
  const x = (t) => PAD.left + t / to * (width - PAD.left - PAD.right);
  const y = (v) => HEIGHT - PAD.bottom - v / yMax * (HEIGHT - PAD.top - PAD.bottom);
  const yTicks = Array.from({ length: Math.round(yMax / yStep) + 1 }, (_, k) => k * yStep);
  const xTicks = Array.from({ length: Math.floor(to / xStep + 1e-9) + 1 }, (_, k) => k * xStep);
  const now = times[index];
  const label = piles.map((p, k) => `${p.name} ${valueText(lines[k][index], unit)}`).join(", ");
  return /* @__PURE__ */ jsxs26("div", { ref: box, className: "hb-sim-chart", children: [
    /* @__PURE__ */ jsxs26("svg", { width: "100%", height: HEIGHT, viewBox: `0 0 ${width} ${HEIGHT}`, role: "img", "aria-label": `Line chart at ${fmt(now)}: ${label}`, children: [
      yTicks.map((v) => /* @__PURE__ */ jsxs26("g", { children: [
        /* @__PURE__ */ jsx30("line", { x1: PAD.left, x2: width - PAD.right, y1: y(v), y2: y(v), className: "hb-sim-grid" }),
        /* @__PURE__ */ jsx30("text", { x: PAD.left - 6, y: y(v) + 4, textAnchor: "end", children: fmt(v, unit) })
      ] }, v)),
      xTicks.map((t) => /* @__PURE__ */ jsx30("text", { x: x(t), y: HEIGHT - 6, textAnchor: "middle", children: fmt(t) }, t)),
      piles.map((_, k) => {
        const points = lines[k].slice(0, index + 1).flatMap((v, i) => v === null ? [] : [`${x(times[i]).toFixed(1)},${y(v).toFixed(1)}`]);
        const last = lines[k][index];
        return /* @__PURE__ */ jsxs26("g", { style: { color: partColour(k + 1) }, children: [
          /* @__PURE__ */ jsx30("polyline", { points: points.join(" "), className: "hb-sim-line" }),
          last !== null && /* @__PURE__ */ jsx30("circle", { cx: x(now), cy: y(last), r: 4.5, className: "hb-sim-point" })
        ] }, k);
      })
    ] }),
    /* @__PURE__ */ jsx30("div", { className: "hb-legend", children: piles.map((p, k) => /* @__PURE__ */ jsxs26("span", { className: "hb-legend-item", children: [
      /* @__PURE__ */ jsx30("i", { className: "hb-legend-dot", style: { background: partColour(k + 1) } }),
      p.name,
      /* @__PURE__ */ jsx30("span", { className: "hb-legend-value", children: valueText(lines[k][index], unit) })
    ] }, k)) })
  ] });
}
function valueText(v, unit) {
  return v === null || v === void 0 ? "\u2013" : fmt(v, unit, { full: true });
}

// src/blocks/simulate/Simulate.tsx
import { jsx as jsx31, jsxs as jsxs27 } from "react/jsx-runtime";
function Simulate(block) {
  const { title, t: time, inputs, values: fixed, piles, unit, source } = block;
  const root = useRef12(null);
  const clock = useRef12(time.to);
  const [sliders, setSliders] = useState20(() => new Map(inputs.map((x) => [x.id, x.value])));
  const [view, setView] = useState20(block.view);
  const [at2, setAt] = useState20(time.to);
  const [playing, setPlaying] = useState20(false);
  const trees = useMemo5(() => piles.map((p) => parseFormula(p.formula)), [piles]);
  const names = useMemo5(() => new Map([...fixed, ...sliders]), [fixed, sliders]);
  const times = useMemo5(() => timesOf(time.to, time.step), [time]);
  const lines = useMemo5(() => valuesOver(trees, names, time.name, times), [trees, names, time.name, times]);
  const most = useMemo5(() => {
    const tops = new Map([...fixed, ...inputs.map((x) => [x.id, x.max])]);
    const high = valuesOver(trees, tops, time.name, [time.to]);
    return trees.map((_, k) => Math.max(0, high[k][0] ?? 0, ...lines[k].map((v) => v ?? 0)));
  }, [trees, fixed, inputs, lines, time]);
  const per = dotPer(block.per, most.reduce((a, b) => a + b, 0));
  const index = Math.round(at2 / time.step);
  const amounts = lines.map((line) => line[index] ?? null);
  usePlay(playing, () => setPlaying(false), clock, time, setAt);
  usePauseWhenHidden(root, playing, () => setPlaying(false));
  function play() {
    if (playing) return setPlaying(false);
    if (clock.current >= time.to) {
      clock.current = 0;
      setAt(0);
    }
    setPlaying(true);
  }
  function scrub(v) {
    setPlaying(false);
    clock.current = v;
    setAt(v);
  }
  return /* @__PURE__ */ jsxs27("div", { ref: root, className: "hb-card hb-sim", children: [
    /* @__PURE__ */ jsxs27("div", { className: "hb-sim-head", children: [
      title && /* @__PURE__ */ jsx31("div", { className: "hb-card-title", children: /* @__PURE__ */ jsx31(InlineText, { text: title }) }),
      /* @__PURE__ */ jsxs27("div", { className: "hb-sim-switch", role: "group", "aria-label": "View", children: [
        /* @__PURE__ */ jsx31("button", { type: "button", "aria-pressed": view === "dots", onClick: () => setView("dots"), children: "Dots" }),
        /* @__PURE__ */ jsx31("button", { type: "button", "aria-pressed": view === "chart", onClick: () => setView("chart"), children: "Line chart" })
      ] })
    ] }),
    /* @__PURE__ */ jsxs27("div", { className: "hb-sim-controls", children: [
      /* @__PURE__ */ jsxs27("button", { type: "button", className: "hb-pill hb-pill-solid hb-sim-play", onClick: play, children: [
        /* @__PURE__ */ jsx31("svg", { width: "14", height: "14", viewBox: "0 0 24 24", "aria-hidden": "true", fill: "currentColor", children: /* @__PURE__ */ jsx31("path", { d: playing ? "M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" : "M8 5.5v13l10.5-6.5z" }) }),
        playing ? "Pause" : "Play"
      ] }),
      /* @__PURE__ */ jsxs27("label", { className: "hb-calc-slider hb-sim-time", children: [
        /* @__PURE__ */ jsxs27("span", { className: "hb-calc-head", children: [
          /* @__PURE__ */ jsx31("span", { className: "hb-calc-label", children: time.unit ? capital(time.unit) : time.name }),
          /* @__PURE__ */ jsx31("span", { className: "hb-calc-value", children: `${fmt(at2)} of ${fmt(time.to)}` })
        ] }),
        /* @__PURE__ */ jsx31(
          "input",
          {
            type: "range",
            className: "hb-range",
            min: 0,
            max: time.to,
            step: time.step,
            value: at2,
            "aria-label": time.unit ?? time.name,
            onChange: (e) => scrub(Number(e.target.value))
          }
        )
      ] }),
      inputs.map((input) => /* @__PURE__ */ jsx31(
        Slider,
        {
          input,
          value: sliders.get(input.id) ?? input.value,
          onMove: (v) => setSliders((all) => new Map(all).set(input.id, v))
        },
        input.id
      ))
    ] }),
    view === "dots" ? /* @__PURE__ */ jsx31(Piles, { piles, amounts, start: lines[0][0] ?? 0, per, most, playing, unit, label: block.start }) : /* @__PURE__ */ jsx31(SimChart, { piles, lines, times, index, unit }),
    source && /* @__PURE__ */ jsx31(Source, { text: source })
  ] });
}
function capital(word) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}
function valuesOver(trees, names, tName, times) {
  const budget = newBudget(MAX_CHART_WORK);
  return trees.map((tree) => times.map((t) => evaluate(tree, new Map(names).set(tName, t), budget)));
}
function usePlay(playing, stop, clock, time, show) {
  useEffect7(() => {
    if (!playing) return;
    let last = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      clock.current = Math.min(time.to, clock.current + (now - last) / 1e3 * (time.to / time.seconds));
      last = now;
      show(whole(clock.current, time.step));
      if (clock.current >= time.to) return stop();
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [playing]);
}
function usePauseWhenHidden(root, playing, pause) {
  useEffect7(() => {
    if (!playing || !root.current || typeof IntersectionObserver === "undefined") return;
    const watcher = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) pause();
    });
    watcher.observe(root.current);
    return () => watcher.disconnect();
  }, [playing]);
}

// src/blocks/source/read.ts
function readSource(raw, here) {
  const named = [];
  if (Array.isArray(raw.sources)) {
    for (const s of raw.sources) if (s && firstText([s.name, s.title])) named.push(s);
  }
  let text = typeof raw.text === "string" ? raw.text : "";
  if (!text) text = named.map((s) => firstText([s.name, s.title])).join(" \xB7 ");
  if (!text) return here.drop("source needs text");
  const candidates = [raw.url, ...named.map((s) => s.url)];
  const url = candidates.find((u) => typeof u === "string" && /^https?:\/\//.test(u));
  if (url) return { type: "source", text, url };
  return { type: "source", text };
}

// src/blocks/steps/read.ts
function readSteps(raw, here) {
  const list = firstList([raw.items, raw.steps]) ?? [];
  const items = [];
  list.forEach((s, i) => {
    const title = firstText([s?.title, s?.label], 80);
    if (!title) {
      here.at("items").at(i).drop("step needs a title");
      return;
    }
    const tick = num(s.tick);
    items.push(clean({
      title,
      text: firstText([s.text, s.body, s.description], 600),
      node: slug(s.node),
      image: https(s.image),
      holds: readHolds(s.holds, here.at("items").at(i).at("holds")),
      send: s.send === true ? true : void 0,
      tick: tick !== null && Number.isInteger(tick) && tick >= 1 && tick <= 20 ? tick : void 0
    }));
  });
  if (!items.length) return here.drop("steps has no titled step");
  return clean({ type: "steps", title: str(raw.title, 80), for: slug(raw.for) ?? slug(raw.flow), items: keepFirst(items, 12, here, "steps") });
}
function readHolds(raw, here) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return void 0;
  const holds = {};
  for (const [key, value] of Object.entries(raw).slice(0, 10)) {
    const id = slug(key);
    const chips = id === void 0 ? void 0 : readChips(value, here.at(id));
    if (id !== void 0 && chips !== void 0) holds[id] = chips;
  }
  return Object.keys(holds).length ? holds : void 0;
}

// src/blocks/steps/Steps.tsx
import { useEffect as useEffect8, useRef as useRef13, useState as useState21 } from "react";
import { jsx as jsx32, jsxs as jsxs28 } from "react/jsx-runtime";
function Steps({ title, for: flow, items }) {
  const [at2, setAt] = useState21(0);
  const [failed, setFailed] = useState21(() => /* @__PURE__ */ new Set());
  const setWalk = useSetWalk();
  const before = useRef13(null);
  const step = items[at2];
  const go = (to) => setAt(Math.max(0, Math.min(items.length - 1, to)));
  useEffect8(() => {
    if (flow !== void 0) setWalk(flow, { steps: items, at: at2, from: before.current });
    before.current = at2;
  }, [flow, items, at2, setWalk]);
  useEffect8(() => () => {
    if (flow !== void 0) setWalk(flow, void 0);
  }, [flow, setWalk]);
  function onKeyDown(e) {
    if (e.key === "ArrowRight") go(at2 + 1);
    else if (e.key === "ArrowLeft") go(at2 - 1);
    else return;
    e.preventDefault();
  }
  const photo = step.image && !failed.has(at2) ? step.image : void 0;
  return /* @__PURE__ */ jsxs28("div", { className: "hb-card hb-steps", role: "group", "aria-label": title ?? "Steps", onKeyDown, children: [
    /* @__PURE__ */ jsxs28("div", { className: "hb-steps-head", children: [
      title && /* @__PURE__ */ jsx32("div", { className: "hb-card-title", children: title }),
      /* @__PURE__ */ jsx32("span", { className: "hb-steps-place", children: `${at2 + 1} of ${items.length}` })
    ] }),
    /* @__PURE__ */ jsxs28("div", { className: "hb-steps-body", "aria-live": "polite", children: [
      /* @__PURE__ */ jsx32("div", { className: "hb-steps-title", children: step.title }),
      step.text && /* @__PURE__ */ jsx32("p", { className: "hb-steps-text", children: /* @__PURE__ */ jsx32(InlineText, { text: step.text }) }),
      photo && /* @__PURE__ */ jsx32(
        "img",
        {
          className: "hb-steps-photo",
          src: photo,
          alt: "",
          loading: "lazy",
          referrerPolicy: "no-referrer",
          onError: () => setFailed((was) => new Set(was).add(at2))
        },
        at2
      )
    ] }),
    /* @__PURE__ */ jsxs28("div", { className: "hb-steps-foot", children: [
      /* @__PURE__ */ jsx32("div", { className: "hb-steps-dots", children: items.map((s, i) => /* @__PURE__ */ jsx32(
        "button",
        {
          type: "button",
          className: i === at2 ? "hb-steps-dot hb-steps-dot-on" : "hb-steps-dot",
          "aria-label": `Step ${i + 1}: ${s.title}`,
          "aria-current": i === at2 ? "step" : void 0,
          onClick: () => go(i)
        },
        i
      )) }),
      /* @__PURE__ */ jsxs28("div", { className: "hb-steps-moves", children: [
        /* @__PURE__ */ jsx32("button", { type: "button", className: "hb-pill", disabled: at2 === 0, onClick: () => go(at2 - 1), children: "Back" }),
        /* @__PURE__ */ jsx32("button", { type: "button", className: "hb-pill hb-pill-solid", disabled: at2 === items.length - 1, onClick: () => go(at2 + 1), children: "Next" })
      ] })
    ] })
  ] });
}

// src/blocks/streak/read.ts
function readStreak(raw, here) {
  const count = num(raw.count);
  if (count === null) return here.drop("streak needs a numeric count");
  const days = [];
  const rawDays = Array.isArray(raw.days) ? raw.days : [];
  rawDays.forEach((d, i) => {
    const label2 = str(d?.label, 4);
    if (!label2) {
      here.at("days").at(i).drop("day has no label");
      return;
    }
    days.push(clean({ label: label2, date: str(d.date, 3), done: d.done === true, today: d.today === true }));
  });
  const label = str(raw.label, 30) ?? "Current streak";
  const unit = str(raw.unit, 12) ?? "days";
  return { type: "streak", count, label, unit, days: keepFirst(days, 7, here, "days") };
}

// src/blocks/streak/Streak.tsx
import { jsx as jsx33, jsxs as jsxs29 } from "react/jsx-runtime";
function unitFor(count, unit) {
  if (count === 1 && unit.endsWith("s")) return unit.slice(0, -1);
  return unit;
}
function Streak({ count, label, unit, days }) {
  return /* @__PURE__ */ jsxs29("div", { className: "hb-card hb-streak", children: [
    /* @__PURE__ */ jsxs29("div", { className: "hb-streak-head", children: [
      /* @__PURE__ */ jsxs29("div", { children: [
        /* @__PURE__ */ jsx33("div", { className: "hb-streak-label", children: label }),
        /* @__PURE__ */ jsxs29("div", { className: "hb-streak-count", children: [
          formatNumber(count, { digits: 3 }),
          " ",
          /* @__PURE__ */ jsx33("span", { children: unitFor(count, unit) })
        ] })
      ] }),
      /* @__PURE__ */ jsx33("span", { className: "hb-streak-medal", children: /* @__PURE__ */ jsx33(Icon, { name: "star", size: 24, stroke: 2.4 }) })
    ] }),
    days.length > 0 && /* @__PURE__ */ jsx33("div", { className: "hb-streak-week", style: { gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }, children: days.map((d, k) => /* @__PURE__ */ jsxs29("div", { className: d.today ? "hb-streak-day hb-streak-today" : "hb-streak-day", children: [
      /* @__PURE__ */ jsx33("span", { className: "hb-streak-day-label", children: d.label }),
      d.done ? /* @__PURE__ */ jsx33("span", { className: "hb-streak-done", children: /* @__PURE__ */ jsx33(Icon, { name: "check", size: 15, stroke: 2.6 }) }) : /* @__PURE__ */ jsx33("span", { className: "hb-streak-date", children: d.date ?? "\xB7" }),
      /* @__PURE__ */ jsx33("span", { className: "hb-streak-dot" })
    ] }, k)) })
  ] });
}

// src/blocks/table/read.ts
var MAX_COLUMNS2 = 8;
var MAX_ROWS = 30;
function readTable(raw, here) {
  const rawRows = firstList([raw.rows, raw.data]) ?? [];
  let columns = readColumns(firstList([raw.columns, raw.headers, raw.header]));
  let rowsToRead = rawRows;
  if (!columns.length) {
    const first = rawRows[0];
    if (Array.isArray(first)) {
      columns = readColumns(first);
      rowsToRead = rawRows.slice(1);
    } else if (first && typeof first === "object") {
      columns = readColumns(Object.keys(first));
    }
  }
  if (!columns.length) return here.drop("table needs columns");
  columns = keepFirst(columns, MAX_COLUMNS2, here.at("columns"), "columns");
  const rows = [];
  rowsToRead.forEach((row, i) => {
    const cells = readRow(row, columns, here.at("rows").at(i));
    if (cells) rows.push(cells);
  });
  if (!rows.length) here.drop("table has no rows");
  const kept = keepFirst(rows, MAX_ROWS, here.at("rows"), "rows");
  const highlight = readHighlight(raw.highlight, columns, kept, here.at("highlight"));
  const caption = firstText([raw.caption, raw.title], 100);
  return clean({ type: "table", columns, rows: kept, highlight, caption });
}
function readColumns(list) {
  if (!list) return [];
  return list.map((c) => {
    if (c && typeof c === "object") return firstText([c.label, c.name, c.title], 40) ?? "";
    return textOrNumber(c, 40) ?? "";
  });
}
function readRow(row, columns, here) {
  let cells;
  if (Array.isArray(row)) {
    cells = row;
  } else if (row && typeof row === "object") {
    cells = cellsByColumnName(row, columns);
  } else {
    return here.drop("row is not a list of cells");
  }
  if (cells.length > columns.length) return here.drop(`row has ${cells.length} cells, table has ${columns.length} columns`);
  const out = cells.map(cellText2);
  while (out.length < columns.length) out.push("");
  return out;
}
function cellsByColumnName(row, columns) {
  const byLowerName = new Map(Object.entries(row).map(([k, v]) => [k.toLowerCase(), v]));
  return columns.map((c) => byLowerName.get(c.toLowerCase()));
}
function cellText2(v) {
  if (v === true) return "Yes";
  if (v === false) return "No";
  return textOrNumber(v, 120) ?? "";
}
function readHighlight(v, columns, rows, here) {
  if (v === void 0 || v === null) return void 0;
  let found;
  if (num(v) !== null) {
    found = { row: v };
  } else if (typeof v === "string") {
    found = highlightByName(v, columns, rows);
  } else if (typeof v === "object") {
    if (num(v.row) !== null) found = { row: v.row };
    const column = num(v.column) ?? num(v.col);
    if (!found && column !== null) found = { column };
  }
  if (!found) {
    here.drop("highlight should be {row: n} or {column: n}");
    return void 0;
  }
  const inRange = "row" in found ? isIndex(found.row, rows.length) : isIndex(found.column, columns.length);
  if (!inRange) {
    here.drop("highlight is outside the table");
    return void 0;
  }
  return found;
}
function highlightByName(name, columns, rows) {
  const wanted = str(name)?.toLowerCase();
  const row = rows.findIndex((r) => r[0].toLowerCase() === wanted);
  if (row >= 0) return { row };
  const column = columns.findIndex((c) => c.toLowerCase() === wanted);
  if (column >= 0) return { column };
  return void 0;
}
function isIndex(n, length) {
  return Number.isInteger(n) && n >= 0 && n < length;
}

// src/blocks/table/Table.tsx
import { useState as useState22 } from "react";

// src/blocks/table/sort.ts
function cellNumber(cell) {
  const plain = cell.replace(/,/g, "").replace(/^−/, "-");
  const m = /^([-+]?)[^\d\-+]{0,3}([-+]?\d+(?:\.\d+)?)/.exec(plain);
  if (!m) return null;
  const n = Number(m[2]);
  return m[1] === "-" ? -n : n;
}
function sortedOrder(rows, sort) {
  const order = rows.map((_, i) => i);
  if (!sort) return order;
  const sign = sort.direction === "up" ? 1 : -1;
  return order.sort((a, b) => {
    const left = rows[a][sort.column] ?? "";
    const right = rows[b][sort.column] ?? "";
    if (!left || !right) return blanksLast(left, right);
    return sign * compareCells(left, right);
  });
}
function blanksLast(left, right) {
  if (!left && !right) return 0;
  if (!left) return 1;
  return -1;
}
function compareCells(left, right) {
  const a = cellNumber(left);
  const b = cellNumber(right);
  if (a !== null && b !== null) return a - b;
  return left.localeCompare(right, void 0, { numeric: true, sensitivity: "base" });
}
function nextSort(sort, column) {
  if (!sort || sort.column !== column) return { column, direction: "up" };
  if (sort.direction === "up") return { column, direction: "down" };
  return null;
}
function isNumberColumn(rows, column) {
  const filled = rows.map((r) => r[column]).filter((cell) => cell);
  return filled.length > 0 && filled.every((cell) => cellNumber(cell) !== null);
}

// src/blocks/table/cells.ts
function isChangeColumn(rows, column) {
  if (!isNumberColumn(rows, column) || !rows.some((r) => /^[-+−]/.test(r[column] ?? ""))) return false;
  const filled = rows.map((r) => (r[column] ?? "").trim()).filter(Boolean);
  const allPercent = filled.every((cell) => cell.endsWith("%"));
  const allSigned = filled.every((cell) => /^[-+−]/.test(cell) || cellNumber(cell) === 0);
  return allPercent || allSigned;
}
function changeOf(cell) {
  const n = cellNumber(cell);
  if (n === null || n === 0) return null;
  return n > 0 ? "up" : "down";
}
function miniBar(value, largest) {
  const width = largest > 0 ? Math.abs(value) / largest * 50 : 0;
  return { left: value < 0 ? 50 - width : 50, width };
}
var AMOUNT = /^([-+−]?)([$₹€£¥]?)(\d{1,3}(?:,\d{2,3})+|\d+)(\.\d+)?$/;
function bigNumber(cell) {
  const m = AMOUNT.exec(cell.trim());
  if (!m) return null;
  const [, sign, currency, digits, decimals2 = ""] = m;
  if (!currency && !digits.includes(",")) return null;
  const magnitude = Number(digits.replace(/,/g, "") + decimals2);
  if (magnitude < SHORT_FROM) return null;
  const v = sign === "-" || sign === "\u2212" ? -magnitude : magnitude;
  const unit = currency || void 0;
  const plus = sign === "+" ? "+" : "";
  return { short: plus + fmt(v, unit), full: plus + fmt(v, unit, { full: true }) };
}

// src/blocks/table/Table.tsx
import { jsx as jsx34, jsxs as jsxs30 } from "react/jsx-runtime";
var MINI_BARS_FROM = 3;
function Table({ columns, rows, highlight, caption }) {
  const [sort, setSort] = useState22(null);
  const order = sortedOrder(rows, sort);
  const bestRow = highlight && "row" in highlight ? highlight.row : -1;
  const bestColumn = highlight && "column" in highlight ? highlight.column : -1;
  const numeric = columns.map((_, c) => isNumberColumn(rows, c));
  const change = columns.map((_, c) => isChangeColumn(rows, c));
  const largest = columns.map((_, c) => change[c] ? largestChange(rows, c) : 0);
  const withBars = rows.length >= MINI_BARS_FROM;
  const cellClass = (c, text, extra = "") => [
    numeric[c] ? "hb-num" : "",
    c === 0 ? "hb-first" : "",
    c === bestColumn ? "hb-best-col" : "",
    text.length > 28 ? "hb-wrap" : "",
    extra
  ].filter(Boolean).join(" ");
  return /* @__PURE__ */ jsxs30("div", { className: "hb-card hb-table-card", children: [
    caption && /* @__PURE__ */ jsx34("div", { className: "hb-chart-title hb-table-caption", children: /* @__PURE__ */ jsx34(InlineText, { text: caption }) }),
    /* @__PURE__ */ jsx34("div", { className: "hb-table-scroll", children: /* @__PURE__ */ jsxs30("table", { className: columns.length >= 3 ? "hb-table hb-table-wide" : "hb-table", children: [
      /* @__PURE__ */ jsx34("thead", { children: /* @__PURE__ */ jsx34("tr", { children: columns.map((name, c) => /* @__PURE__ */ jsx34("th", { "aria-sort": ariaSort(sort, c), className: cellClass(c, name, sort?.column === c ? "hb-sorted" : ""), children: /* @__PURE__ */ jsxs30("button", { type: "button", onClick: () => setSort(nextSort(sort, c)), children: [
        /* @__PURE__ */ jsx34("span", { children: name }),
        /* @__PURE__ */ jsx34("span", { className: "hb-sort", "aria-hidden": "true", children: sortMark(sort, c) }),
        c === bestColumn && /* @__PURE__ */ jsx34("span", { className: "hb-chip hb-chip-soft", children: "Best" })
      ] }) }, c)) }) }),
      /* @__PURE__ */ jsxs30("tbody", { children: [
        !rows.length && /* @__PURE__ */ jsx34("tr", { children: /* @__PURE__ */ jsx34("td", { className: "hb-table-empty", colSpan: columns.length, children: "No rows to show." }) }),
        order.map((r) => /* @__PURE__ */ jsx34("tr", { className: r === bestRow ? "hb-best" : void 0, children: rows[r].map((cell, c) => {
          const big = bigNumber(cell);
          const direction = change[c] ? changeOf(cell) : null;
          return /* @__PURE__ */ jsxs30("td", { className: cellClass(c, cell, direction ? `hb-${direction}` : ""), title: big?.full, children: [
            change[c] && withBars && /* @__PURE__ */ jsx34(MiniBar, { value: cellNumber(cell) ?? 0, largest: largest[c] }),
            big ? big.short : /* @__PURE__ */ jsx34(InlineText, { text: cell }),
            c === 0 && r === bestRow && /* @__PURE__ */ jsx34("span", { className: "hb-chip hb-chip-soft", children: "Best" })
          ] }, c);
        }) }, r))
      ] })
    ] }) })
  ] });
}
function MiniBar({ value, largest }) {
  const { left, width } = miniBar(value, largest);
  return /* @__PURE__ */ jsxs30("span", { className: "hb-mini", "aria-hidden": "true", children: [
    /* @__PURE__ */ jsx34("span", { className: "hb-mini-zero" }),
    /* @__PURE__ */ jsx34("span", { className: "hb-mini-bar", style: { left: `${left}%`, width: `${width}%` } })
  ] });
}
function largestChange(rows, column) {
  return Math.max(0, ...rows.map((r) => Math.abs(cellNumber(r[column]) ?? 0)));
}
function sortMark(sort, column) {
  if (!sort || sort.column !== column) return "\u2195";
  return sort.direction === "up" ? "\u2191" : "\u2193";
}
function ariaSort(sort, column) {
  if (!sort || sort.column !== column) return void 0;
  return sort.direction === "up" ? "ascending" : "descending";
}

// src/blocks/tiles/read.ts
var MAX_TILES = 8;
var SUBTITLE_MAX = 80;
var TITLE_FIELDS = ["title", "label", "name", "caption", "text"];
var MORE_FIELDS = ["subtitle", "value", "text", "caption", "note", "description"];
function readTiles(raw, here) {
  const list = firstList([raw.items, raw.tiles]);
  if (!list) return here.drop("tiles needs items");
  const items = [];
  list.forEach((item, i) => {
    const tile = readTile(item);
    if (!tile) {
      here.at("items").at(i).drop("tile has no title");
      return;
    }
    if (actsBeforeTheModel(tile.ask) || actsBeforeTheModel(tile.run)) {
      here.at("items").at(i).drop(NO_SEND);
      return;
    }
    items.push(tile);
  });
  if (!items.length) return here.drop("tiles has no item with a title");
  return { type: "tiles", items: keepFirst(items, MAX_TILES, here, "tiles") };
}
function readTile(item) {
  if (!item || typeof item !== "object") return null;
  const titleField = TITLE_FIELDS.find((f) => str(item[f]) !== void 0);
  if (!titleField) return null;
  const more = [];
  for (const f of MORE_FIELDS) {
    const text = textOrNumber(item[f], SUBTITLE_MAX);
    if (f !== titleField && text !== void 0) more.push(text);
  }
  const subtitle = more.length ? more.join(" \xB7 ").slice(0, SUBTITLE_MAX) : void 0;
  return clean({
    title: str(item[titleField], 40),
    subtitle,
    image: https(item.image),
    icon: icon(item.icon),
    ask: str(item.ask, 300),
    run: str(item.run, 300)
  });
}

// src/blocks/tiles/Tiles.tsx
import { useContext as useContext6, useState as useState23 } from "react";
import { Fragment as Fragment11, jsx as jsx35, jsxs as jsxs31 } from "react/jsx-runtime";
var WASHES = [1, 4, 8, 3, 6];
function Tiles({ items }) {
  return /* @__PURE__ */ jsx35("div", { className: "hb-tiles", children: items.map((tile, i) => /* @__PURE__ */ jsx35(Tile, { tile, wash: WASHES[i % WASHES.length] }, i)) });
}
function tapOf(tile, send, fill) {
  if (tile.run) return () => send(tile.run);
  if (tile.ask) return () => fill(tile.ask);
  return void 0;
}
function Tile({ tile, wash }) {
  const { send, fill } = useContext6(BlockActions);
  const [photoFailed, setPhotoFailed] = useState23(false);
  const tap = tapOf(tile, send, fill);
  const colour = `var(--hb-chart-${wash})`;
  const content = /* @__PURE__ */ jsxs31(Fragment11, { children: [
    tile.image && !photoFailed && /* @__PURE__ */ jsx35("img", { src: tile.image, alt: "", loading: "lazy", referrerPolicy: "no-referrer", onError: () => setPhotoFailed(true) }),
    /* @__PURE__ */ jsx35("span", { className: "hb-tile-shade" }),
    tile.icon && /* @__PURE__ */ jsx35("span", { className: "hb-tile-icon", children: /* @__PURE__ */ jsx35(Icon, { name: tile.icon, size: 18, stroke: 2.2 }) }),
    /* @__PURE__ */ jsxs31("span", { className: "hb-tile-text", children: [
      /* @__PURE__ */ jsx35("span", { className: "hb-tile-title", children: tile.title }),
      tile.subtitle && /* @__PURE__ */ jsx35("span", { className: "hb-tile-subtitle", children: tile.subtitle })
    ] })
  ] });
  const style = { background: `linear-gradient(140deg, ${colour}, color-mix(in srgb, ${colour} 55%, #140c24))` };
  return tap ? /* @__PURE__ */ jsx35("button", { type: "button", className: "hb-tile", onClick: tap, title: tile.run, style, children: content }) : /* @__PURE__ */ jsx35("div", { className: "hb-tile hb-tile-static", style, children: content });
}

// src/blocks/timeline/read.ts
var TIME_MAX = 12;
function readTimeline(raw, here) {
  const found = groupsOf(raw, here);
  if (!found) return here.drop("timeline needs groups");
  const groups = [];
  found.forEach(({ group: g, at: at2 }) => {
    const list = firstList([g?.items, g?.events, g?.stops, g?.steps]);
    if (!list) {
      at2.drop("group has no items list");
      return;
    }
    const stops = [];
    list.forEach((it, i) => {
      const stop = readStop(it);
      if (!stop) {
        at2.at("items").at(i).drop("stop has no title");
        return;
      }
      stops.push(stop);
    });
    if (!stops.length) {
      at2.drop("group has no stop with a title");
      return;
    }
    groups.push({ label: str(g.label, 50) ?? "", items: keepFirst(stops, 12, at2, "stops") });
  });
  if (!groups.length) return here.drop("timeline has no group with a stop");
  return clean({ type: "timeline", title: str(raw.title, 60), groups: keepFirst(groups, 14, here, "groups") });
}
function groupsOf(raw, here) {
  if (Array.isArray(raw.groups)) {
    return raw.groups.map((group, gi) => ({ group, at: here.at("groups").at(gi) }));
  }
  const flat = firstList([raw.events, raw.items, raw.steps, raw.stops]);
  if (!flat) return null;
  return [{ group: { label: "", items: flat }, at: here }];
}
function readStop(it) {
  if (!it || typeof it !== "object") return null;
  let title = firstText([it.title, it.name, it.label, it.activity, it.event], 80);
  let time = str(it.time, 60);
  const note = firstWords([it.note, it.text, it.description, it.detail], 160);
  if (!title && time && time.length > TIME_MAX) {
    title = time;
    time = void 0;
  }
  if (!title) return null;
  return clean({ time: time?.slice(0, TIME_MAX), title, place: firstText([it.place, it.location], 60), note, icon: icon(it.icon) });
}

// src/blocks/timeline/Timeline.tsx
import { jsx as jsx36, jsxs as jsxs32 } from "react/jsx-runtime";
function Timeline({ title, groups }) {
  return /* @__PURE__ */ jsxs32("div", { className: "hb-card hb-timeline", children: [
    title && /* @__PURE__ */ jsx36("div", { className: "hb-card-title", children: title }),
    groups.map((g, gi) => /* @__PURE__ */ jsxs32("div", { className: "hb-timeline-group", children: [
      g.label && /* @__PURE__ */ jsx36("span", { className: "hb-chip hb-chip-soft", children: g.label }),
      g.items.map((s, k) => {
        const last = k === g.items.length - 1;
        return /* @__PURE__ */ jsxs32("div", { className: "hb-stop", children: [
          /* @__PURE__ */ jsx36("span", { className: "hb-stop-time", children: s.time ?? "" }),
          /* @__PURE__ */ jsxs32("span", { className: "hb-stop-rail", children: [
            /* @__PURE__ */ jsx36("span", { className: "hb-stop-dot", children: s.icon ? /* @__PURE__ */ jsx36(Icon, { name: s.icon, size: 12, stroke: 2.4 }) : /* @__PURE__ */ jsx36("span", { className: "hb-stop-pip" }) }),
            !last && /* @__PURE__ */ jsx36("span", { className: "hb-stop-line" })
          ] }),
          /* @__PURE__ */ jsxs32("div", { className: last ? "hb-stop-body" : "hb-stop-body hb-stop-body-gap", children: [
            /* @__PURE__ */ jsx36("div", { className: "hb-stop-title", children: s.title }),
            s.place && /* @__PURE__ */ jsxs32("div", { className: "hb-stop-place", children: [
              /* @__PURE__ */ jsx36(Icon, { name: "pin", size: 12, stroke: 2.2 }),
              s.place
            ] }),
            s.note && /* @__PURE__ */ jsx36("div", { className: "hb-stop-note", children: s.note })
          ] })
        ] }, k);
      })
    ] }, gi))
  ] });
}

// src/registry.tsx
import { jsx as jsx37 } from "react/jsx-runtime";
var REGISTRY = {
  chart: { read: readChart, Component: ({ block }) => /* @__PURE__ */ jsx37(Chart, { spec: block.spec }) },
  kpis: { read: readKpis, Component: ({ block }) => /* @__PURE__ */ jsx37(Kpis, { items: block.items }) },
  source: { read: readSource, Component: ({ block }) => /* @__PURE__ */ jsx37(Source, { text: block.text, url: block.url }) },
  timeline: { read: readTimeline, Component: ({ block }) => /* @__PURE__ */ jsx37(Timeline, { ...block }) },
  images: { read: readImages, Component: ({ block }) => /* @__PURE__ */ jsx37(Images, { block }) },
  callout: { read: readCallout, Component: ({ block }) => /* @__PURE__ */ jsx37(Callout, { ...block }) },
  table: { read: readTable, Component: ({ block }) => /* @__PURE__ */ jsx37(Table, { ...block }) },
  list: { read: readList, Component: ({ block }) => /* @__PURE__ */ jsx37(List, { ...block }) },
  progress: { read: readProgress, Component: ({ block }) => /* @__PURE__ */ jsx37(Progress, { ...block }) },
  streak: { read: readStreak, Component: ({ block }) => /* @__PURE__ */ jsx37(Streak, { ...block }) },
  heatmap: { read: readHeatmap, Component: ({ block }) => /* @__PURE__ */ jsx37(Heatmap, { ...block }) },
  flip: { read: readFlip, Component: ({ block }) => /* @__PURE__ */ jsx37(Flip, { ...block }) },
  flow: { read: readFlow, Component: ({ block }) => /* @__PURE__ */ jsx37(Flow, { ...block }) },
  steps: { read: readSteps, Component: ({ block }) => /* @__PURE__ */ jsx37(Steps, { ...block }) },
  layers: { read: readLayers, Component: ({ block }) => /* @__PURE__ */ jsx37(Layers, { ...block }) },
  heading: { read: readHeading, Component: ({ block }) => /* @__PURE__ */ jsx37(Heading, { text: block.text }) },
  text: { read: readText, Component: ({ block }) => /* @__PURE__ */ jsx37(Text, { text: block.text }) },
  stat: { read: readStat, Component: ({ block }) => /* @__PURE__ */ jsx37(KpiCard, { item: block }) },
  divider: { read: readDivider, Component: () => /* @__PURE__ */ jsx37(Divider, {}) },
  badge: { read: readBadge, Component: ({ block }) => /* @__PURE__ */ jsx37(Badge, { ...block }) },
  link: { read: readLink, Component: ({ block }) => /* @__PURE__ */ jsx37(LinkLine, { ...block }) },
  image: { read: readImage, Component: ({ block }) => /* @__PURE__ */ jsx37(Picture, { ...block }) },
  bar: { read: readBar, Component: ({ block }) => /* @__PURE__ */ jsx37(Bar, { ...block }) },
  actions: { read: readActions, Component: ({ block }) => /* @__PURE__ */ jsx37(Actions, { items: block.items }) },
  button: { read: readButton, Component: ({ block }) => /* @__PURE__ */ jsx37(Button, { ...block }) },
  tiles: { read: readTiles, Component: ({ block }) => /* @__PURE__ */ jsx37(Tiles, { items: block.items }) },
  checklist: { read: readChecklist, Component: ({ block }) => /* @__PURE__ */ jsx37(Checklist, { ...block }) },
  calculator: { read: readCalculator, Component: ({ block }) => /* @__PURE__ */ jsx37(Calculator, { ...block }) },
  simulate: { read: readSimulate, Component: ({ block }) => /* @__PURE__ */ jsx37(Simulate, { ...block }) },
  form: { read: readForm, Component: ({ block }) => /* @__PURE__ */ jsx37(Form, { ...block }) },
  row: { read: readContainer, Component: ({ block, draw }) => /* @__PURE__ */ jsx37(Row, { kinds: block.children.map((c) => c.type), children: draw(block.children) }) },
  section: { read: readContainer, Component: ({ block, draw }) => /* @__PURE__ */ jsx37(Section, { title: block.title, collapsed: block.collapsed, children: draw(block.children) }) },
  grid: { read: readContainer, Component: ({ block, draw }) => /* @__PURE__ */ jsx37(Grid, { children: draw(block.children) }) },
  columns: { read: readContainer, Component: ({ block, draw }) => /* @__PURE__ */ jsx37(Columns, { children: draw(block.children) }) },
  tabs: { read: readTabs, Component: ({ block, draw }) => /* @__PURE__ */ jsx37(Tabs, { labels: block.tabs.map((t) => t.label), panel: (i) => draw(block.tabs[i].children) }) }
};

// src/core/Blocks.tsx
import { jsx as jsx38 } from "react/jsx-runtime";
function BlockView({ block }) {
  const entry = REGISTRY[block.type];
  if (!entry) return null;
  const { Component } = entry;
  return /* @__PURE__ */ jsx38(Component, { block, draw: drawAll });
}
function drawAll(blocks) {
  return blocks.map((b, i) => /* @__PURE__ */ jsx38(BlockView, { block: b }, i));
}
function Blocks({ blocks }) {
  return /* @__PURE__ */ jsx38("div", { className: "hb-blocks", children: /* @__PURE__ */ jsx38(FlowLightBoard, { children: drawAll(blocks) }) });
}

// src/core/readBlocks.ts
var BLOCK_TYPES = Object.keys(REGISTRY);
function readBlocksNoted(data) {
  let list = data;
  if (isObject(list) && Array.isArray(list.blocks)) list = list.blocks;
  if (isObject(list) && typeof list.type === "string") list = [list];
  const top = new Trail();
  const blocks = [];
  if (Array.isArray(list)) {
    list.forEach((raw, i) => {
      blocks.push(...readOne(raw, top.at(i), 0));
    });
  }
  return { blocks, dropped: top.dropped };
}
function readBlocks(data) {
  return readBlocksNoted(data).blocks;
}
function isObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}
function readOne(raw, here, depth) {
  if (!isObject(raw)) {
    here.drop("not a block object");
    return [];
  }
  const kind = raw.type;
  const entry = Object.hasOwn(REGISTRY, kind) ? REGISTRY[kind] : void 0;
  if (!entry) {
    here.drop(`unknown type "${kind}"`);
    return [];
  }
  const read = entry.read(raw, here, depth, readOne);
  if (!read) return [];
  return Array.isArray(read) ? read : [read];
}

// src/host/BlockTag.tsx
import { jsx as jsx39 } from "react/jsx-runtime";
var ID_PATTERN = /^[0-9a-f]{8}$/;
function BlockTag({ id, streaming, load }) {
  const validId = typeof id === "string" && ID_PATTERN.test(id);
  const actions = useContext7(BlockActions);
  const [state, setState] = useState24({ kind: "loading" });
  useEffect9(() => {
    if (streaming || !validId) return;
    let live = true;
    load(id).then((data) => {
      const blocks = readBlocks(data);
      if (live) setState(blocks.length ? { kind: "drawn", blocks } : { kind: "failed" });
    }).catch(() => {
      if (live) setState({ kind: "failed" });
    });
    return () => {
      live = false;
    };
  }, [id, streaming, validId]);
  if (!validId && !streaming) return /* @__PURE__ */ jsx39(Note, { text: "Couldn't load this block" });
  if (streaming || state.kind === "loading") return /* @__PURE__ */ jsx39(Note, { text: "drawing\u2026", pulse: true });
  if (state.kind === "failed") return /* @__PURE__ */ jsx39(Note, { text: "Couldn't load this block" });
  return /* @__PURE__ */ jsx39(BlockActions.Provider, { value: { ...actions, blockId: id }, children: /* @__PURE__ */ jsx39(Blocks, { blocks: state.blocks }) });
}
function Note({ text, pulse = false }) {
  return /* @__PURE__ */ jsx39("div", { className: pulse ? "hb-state hb-pulse" : "hb-state", children: text });
}

// src/styles/tokens.css
var tokens_default = `/* Hermes GenUI: every class starts with hb- so nothing leaks into the app.
   Colours come from Hermes's own theme variables, so blocks follow light and dark mode. */
.hb-blocks {
  --hb-ink: var(--foreground, #1f2328);
  --hb-ink-2: color-mix(in srgb, var(--hb-ink) 80%, transparent);
  --hb-muted: var(--ui-text-tertiary, color-mix(in srgb, var(--hb-ink) 55%, transparent));
  --hb-line: color-mix(in srgb, var(--hb-ink) 10%, transparent);
  --hb-card: color-mix(in srgb, var(--hb-ink) 3%, transparent);
  --hb-well: color-mix(in srgb, var(--hb-ink) 6%, transparent);
  --hb-accent: var(--theme-primary, #2f6fed);
  --hb-accent-soft: color-mix(in srgb, var(--hb-accent) 13%, transparent);
  --hb-accent-ink: color-mix(in srgb, var(--hb-accent) 85%, var(--hb-ink));
  --hb-good: var(--ui-success, #1a7f37);
  --hb-warn: #c2410c;
  /* The page behind the blocks, for the few marks that must hide what's under them (a progress checkpoint). */
  --hb-surface: var(--background, Canvas);
  /* A raised card (a chart's hover card). */
  --hb-shadow: 0 8px 28px rgba(15, 20, 30, 0.14), 0 1px 3px rgba(15, 20, 30, 0.1);
  /* Series colours in the order they are handed out, checked so neighbours stay apart for colour-blind readers:
     blue, amber, green, violet, cyan, red, lime, pink. */
  --hb-chart-1: #4f7cff;
  --hb-chart-2: #f59e0b;
  --hb-chart-3: #10b981;
  --hb-chart-4: #8b5cf6;
  --hb-chart-5: #06b6d4;
  --hb-chart-6: #ef4444;
  --hb-chart-7: #84cc16;
  --hb-chart-8: #ec4899;

  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 8px 0;
  /* A board stops at a comfortable reading width on a wide screen. */
  max-width: 1100px;
  color: var(--hb-ink);
  font-family: var(--dt-font-sans, inherit);
  font-size: 14px;
  line-height: 1.45;
}
/* Dark mode (Hermes puts .dark on the page): the warning orange lightened to read on a dark background, a deeper
   shadow. */
.dark .hb-blocks {
  --hb-warn: #f0883e;
  --hb-shadow: 0 8px 28px rgba(0, 0, 0, 0.5), 0 1px 3px rgba(0, 0, 0, 0.4);
}
/* A stronger line, for chart axes, checkboxes and inputs. */
.hb-blocks { --hb-line-strong: color-mix(in srgb, var(--hb-ink) 18%, transparent); }
.hb-blocks * { box-sizing: border-box; }
/* The chat wraps text "anywhere", which lets a label in a flex row shrink to one letter per line. Blocks wrap only
   between words (long words still break when they must). */
.hb-blocks { overflow-wrap: break-word; }
/* The chat's prose styles give images, figures and tables their own margins; blocks place their own. */
.hb-blocks img, .hb-blocks figure, .hb-blocks table { margin: 0; }
`;

// src/styles/shared.css
var shared_default = "/* Pieces several blocks share: cards, chips, pill buttons and the motion they use. */\n/* Cards */\n.hb-card {\n  background: var(--hb-card);\n  border: 1px solid var(--hb-line);\n  border-radius: 16px;\n  padding: 14px 16px;\n}\n.hb-card-title {\n  font-size: 16px;\n  line-height: 22px;\n  font-weight: 700;\n  letter-spacing: -0.01em;\n}\n/* Chips */\n.hb-chip {\n  display: inline-flex;\n  align-items: center;\n  align-self: flex-start;\n  gap: 4px;\n  padding: 2px 9px;\n  border-radius: 999px;\n  font-size: 12px;\n  font-weight: 600;\n  line-height: 18px;\n  font-variant-numeric: tabular-nums;\n  white-space: nowrap;\n}\n.hb-chip-soft { background: var(--hb-accent-soft); color: var(--hb-accent-ink); }\n.hb-chip-good { background: color-mix(in srgb, var(--hb-good) 14%, transparent); color: var(--hb-good); }\n.hb-chip-warn { background: color-mix(in srgb, var(--hb-warn) 13%, transparent); color: var(--hb-warn); }\n.hb-chip-plain { background: var(--hb-well); color: var(--hb-ink-2); }\n/* Pill buttons that act (actions, button, a form's Send): soft for buttons in a reply, solid for a form's Send. */\n.hb-pill {\n  display: inline-flex;\n  align-items: center;\n  gap: 6px;\n  min-height: 36px;\n  max-width: 100%;\n  padding: 7px 14px;\n  border: 0;\n  border-radius: 999px;\n  background: var(--hb-accent-soft);\n  color: var(--hb-accent-ink);\n  font: inherit;\n  font-size: 13.5px;\n  font-weight: 600;\n  line-height: 18px;\n  text-align: left;\n  text-decoration: none;\n  cursor: pointer;\n  transition: background 0.15s, transform 0.1s;\n}\n.hb-pill svg { flex: none; }\n.hb-pill:hover { background: color-mix(in srgb, var(--hb-accent) 22%, transparent); }\n.hb-pill:active { transform: scale(0.97); }\n.hb-pill:focus-visible { outline: 2px solid var(--hb-accent); outline-offset: 2px; }\n.hb-pill-solid { background: var(--hb-accent); color: #fff; }\n.hb-pill-solid:hover { background: color-mix(in srgb, var(--hb-accent) 86%, #000); }\n.hb-pill:disabled { opacity: 0.45; cursor: default; transform: none; }\n.hb-pill-solid:disabled:hover { background: var(--hb-accent); }\n/* Motion: a panel appearing (section, tabs, photo overlay) and a bar growing (bar, progress). */\n.hb-appear { animation: hb-appear 0.22s cubic-bezier(0.2, 0.8, 0.2, 1); }\n@keyframes hb-appear { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }\n@keyframes hb-grow { from { transform: scaleX(0); } }\n@media (prefers-reduced-motion: reduce) {\n  .hb-pill { transition: none; }\n  .hb-appear { animation: none; }\n}\n";

// src/host/blockTag.css
var blockTag_default = "/* The block tag's own states */\n.hb-state {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  margin: 8px 0;\n  padding: 10px 14px;\n  max-width: 100%;\n  border-radius: 14px;\n  background: color-mix(in srgb, var(--foreground, #1f2328) 5%, transparent);\n  color: var(--ui-text-tertiary, #6b7280);\n  font-size: 13px;\n}\n.hb-pulse { animation: hb-pulse 1.2s ease-in-out infinite; }\n@keyframes hb-pulse { 50% { opacity: 0.45; } }\n@media (prefers-reduced-motion: reduce) {\n  .hb-pulse { animation: none; }\n}\n";

// src/blocks/atoms/atoms.css
var atoms_default = "/* Small pieces: heading, text, divider, badge, link, image, bar */\n.hb-heading { font-size: 16px; line-height: 22px; font-weight: 700; letter-spacing: -0.01em; margin-top: 4px; }\n.hb-text { color: var(--hb-ink-2); }\n.hb-text strong { color: var(--hb-ink); font-weight: 650; }\n.hb-divider { height: 1px; background: var(--hb-line); margin: 2px 0; }\n\n.hb-badge { display: flex; align-items: center; }\n.hb-link a {\n  display: inline-flex;\n  align-items: center;\n  gap: 6px;\n  font-size: 14px;\n  font-weight: 600;\n  color: var(--hb-accent-ink);\n  text-decoration: underline;\n  text-underline-offset: 2px;\n}\n.hb-image { margin: 0; display: flex; flex-direction: column; gap: 6px; }\n.hb-image img {\n  display: block;\n  width: 100%;\n  max-height: 300px;\n  object-fit: cover;\n  border: 1px solid var(--hb-line);\n  border-radius: 16px;\n  background: var(--hb-well);\n}\n.hb-image figcaption { padding: 0 4px; font-size: 12px; line-height: 16px; color: var(--hb-muted); }\n.hb-bar { display: flex; flex-direction: column; justify-content: center; gap: 6px; padding: 11px 14px; }\n.hb-bar-head { display: flex; flex-wrap: wrap; align-items: baseline; gap: 2px 8px; font-size: 13px; }\n.hb-bar-label { flex: 1 0 auto; font-weight: 600; color: var(--hb-ink-2); }\n.hb-bar-amount { color: var(--hb-muted); font-variant-numeric: tabular-nums; white-space: nowrap; }\n.hb-bar-track { height: 8px; border-radius: 999px; background: var(--hb-accent-soft); overflow: hidden; }\n.hb-bar-fill { display: block; height: 100%; border-radius: 999px; background: var(--hb-accent); }\n.hb-bar-fill { transform-origin: left; animation: hb-grow 0.9s cubic-bezier(0.2, 0.8, 0.2, 1); }\n@media (prefers-reduced-motion: reduce) {\n  .hb-bar-fill { animation: none; }\n}\n";

// src/blocks/source/source.css
var source_default = ".hb-source { font-size: 11.5px; color: var(--hb-muted); }\n.hb-source a { color: inherit; text-decoration: underline; text-underline-offset: 2px; }\n";

// src/blocks/callout/callout.css
var callout_default = ".hb-callout strong { color: var(--hb-ink); font-weight: 650; }\n.hb-callout {\n  display: flex;\n  gap: 10px;\n  padding: 11px 14px;\n  border-radius: 14px;\n  font-size: 13.5px;\n  line-height: 19px;\n}\n.hb-callout-icon { flex: none; margin-top: 1px; }\n.hb-callout-body { min-width: 0; color: var(--hb-ink-2); }\n.hb-callout-title { font-weight: 700; color: var(--hb-ink); }\n.hb-callout-info { background: var(--hb-accent-soft); }\n.hb-callout-info .hb-callout-icon { color: var(--hb-accent-ink); }\n.hb-callout-tip { background: color-mix(in srgb, var(--hb-good) 11%, transparent); }\n.hb-callout-tip .hb-callout-icon { color: var(--hb-good); }\n.hb-callout-warn { background: color-mix(in srgb, var(--hb-warn) 10%, transparent); }\n.hb-callout-warn .hb-callout-icon { color: var(--hb-warn); }\n";

// src/blocks/kpis/kpis.css
var kpis_default = "/* Headline numbers */\n/* Cards keep a readable width (130-200px) instead of stretching across a wide chat. */\n.hb-kpis {\n  display: grid;\n  grid-template-columns: repeat(auto-fill, minmax(130px, 200px));\n  gap: 8px;\n}\n.hb-kpi { display: flex; flex-direction: column; gap: 2px; min-width: 0; padding: 10px 12px; }\n.hb-kpi-label { font-size: 12px; font-weight: 500; color: var(--hb-muted); }\n.hb-kpi-value {\n  font-size: 22px;\n  line-height: 1.2;\n  font-weight: 650;\n  letter-spacing: -0.01em;\n  font-variant-numeric: tabular-nums;\n  overflow-wrap: anywhere;\n}\n.hb-kpi-value-text { font-size: 15px; font-weight: 700; }\n.hb-kpi-change { font-size: 12px; font-weight: 600; font-variant-numeric: tabular-nums; }\n.hb-kpi-up { color: var(--hb-good); }\n.hb-kpi-down { color: var(--hb-warn); }\n.hb-kpi-flat { color: var(--hb-muted); }\n.hb-kpi-spark { display: block; width: 100%; height: 28px; margin-top: 6px; overflow: visible; }\n.hb-kpi-spark path {\n  fill: none;\n  stroke: var(--hb-chart-1);\n  stroke-width: 1.75;\n  stroke-linejoin: round;\n  stroke-linecap: round;\n  vector-effect: non-scaling-stroke;\n}\n";

// src/blocks/timeline/timeline.css
var timeline_default = "/* Timeline */\n.hb-timeline { display: flex; flex-direction: column; gap: 14px; }\n.hb-timeline-group { display: flex; flex-direction: column; }\n.hb-timeline-group > .hb-chip { margin-bottom: 10px; }\n.hb-stop { display: grid; grid-template-columns: 46px 22px 1fr; column-gap: 8px; }\n.hb-stop-time {\n  padding-top: 2px;\n  text-align: right;\n  font-size: 12.5px;\n  font-weight: 600;\n  color: var(--hb-muted);\n  font-variant-numeric: tabular-nums;\n}\n.hb-stop-rail { display: flex; flex-direction: column; align-items: center; }\n.hb-stop-dot {\n  display: grid;\n  place-items: center;\n  flex: none;\n  width: 22px;\n  height: 22px;\n  border-radius: 999px;\n  background: var(--hb-accent-soft);\n  color: var(--hb-accent-ink);\n}\n.hb-stop-pip { width: 6px; height: 6px; border-radius: 999px; background: var(--hb-accent); }\n.hb-stop-line { flex: 1; width: 1px; margin: 4px 0; background: var(--hb-line); }\n.hb-stop-body { min-width: 0; }\n.hb-stop-body-gap { padding-bottom: 14px; }\n.hb-stop-title { font-size: 14.5px; line-height: 21px; font-weight: 600; }\n.hb-stop-place {\n  display: flex;\n  align-items: center;\n  gap: 4px;\n  margin-top: 1px;\n  font-size: 12.5px;\n  color: var(--hb-muted);\n}\n.hb-stop-note { margin-top: 3px; font-size: 13px; line-height: 18px; color: var(--hb-ink-2); }\n";

// src/blocks/layout/layout.css
var layout_default = "/* Containers. A row's small cards (stats, badges) end at the same height; a tall block never sits in a row\n   (layout/read.ts draws that row as a stack). */\n.hb-row { display: flex; flex-wrap: wrap; align-items: stretch; gap: 8px; }\n.hb-row-cell { flex: 1 1 140px; min-width: 0; display: flex; flex-direction: column; }\n.hb-row-cell > * { flex: 1; }\n/* Grid: each cell keeps its block's own height, top-aligned in its row. */\n.hb-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; align-items: start; }\n.hb-grid-cell { min-width: 0; display: flex; flex-direction: column; }\n.hb-row-cell-own { flex: none; align-self: center; }\n.hb-section { display: flex; flex-direction: column; gap: 8px; }\n.hb-section-body { display: flex; flex-direction: column; gap: 10px; }\n.hb-section .hb-card { background: var(--hb-well); border-color: transparent; }\n.hb-section-toggle {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  width: 100%;\n  padding: 0;\n  border: 0;\n  background: none;\n  color: inherit;\n  font: inherit;\n  text-align: left;\n  cursor: pointer;\n}\n.hb-section-toggle .hb-card-title { flex: 1; min-width: 0; }\n.hb-chevron { flex: none; color: var(--hb-muted); transition: transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1); }\n.hb-chevron-open { transform: rotate(90deg); }\n/* Tabs: underlined tab buttons in a bar that scrolls sideways when they don't fit, above one panel of blocks. */\n.hb-tabs { display: flex; flex-direction: column; gap: 10px; min-width: 0; }\n.hb-tab-bar {\n  display: flex;\n  gap: 2px;\n  overflow-x: auto;\n  scrollbar-width: none;\n  border-bottom: 1px solid var(--hb-line);\n}\n.hb-tab-bar::-webkit-scrollbar { display: none; }\n.hb-tab {\n  flex: none;\n  margin-bottom: -1px;\n  padding: 7px 12px 8px;\n  border: 0;\n  border-bottom: 2px solid transparent;\n  border-radius: 8px 8px 0 0;\n  background: none;\n  color: var(--hb-muted);\n  font: inherit;\n  font-size: 13.5px;\n  font-weight: 600;\n  white-space: nowrap;\n  cursor: pointer;\n  transition: color 0.15s, border-color 0.15s, background 0.15s;\n}\n.hb-tab:hover { color: var(--hb-ink-2); background: var(--hb-well); }\n.hb-tab-on, .hb-tab-on:hover { color: var(--hb-accent-ink); border-bottom-color: var(--hb-accent); background: none; }\n.hb-tab:focus-visible { outline: 2px solid var(--hb-accent); outline-offset: -2px; }\n.hb-tab-panel { display: flex; flex-direction: column; gap: 10px; min-width: 0; }\n\n/* Columns: dashboards side by side, each block at its own height (a short card beside a tall one stays short). */\n.hb-columns { display: grid; grid-template-columns: repeat(auto-fit, minmax(380px, 1fr)); gap: 10px; align-items: start; }\n.hb-column { min-width: 0; display: flex; flex-direction: column; gap: 10px; }\n/* Beside other blocks a table's card fills its column or cell (on its own it hugs its columns). */\n:is(.hb-column, .hb-grid-cell) > .hb-table-card { width: auto; }\n";

// src/blocks/chart/chart.css
var chart_default = "/* Charts are drawn at their real width and fill their place inside a layout block (a column, a cell, a tab). At the\n   top of a reply they stop at 720px; a long line (60+ points) takes the board's full width. */\n.hb-chart { margin: 0; padding: 14px 16px 10px; }\n.hb-blocks > .hb-chart:not(.hb-chart-wide) { max-width: 720px; }\n.hb-chart-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }\n.hb-chart-title {\n  display: block;\n  min-width: 0;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n  font-size: 13px;\n  font-weight: 600;\n  color: var(--hb-muted);\n}\n.hb-chart-figure { display: flex; align-items: baseline; gap: 8px; margin-top: 2px; min-width: 0; }\n.hb-chart-big {\n  font-size: 28px;\n  line-height: 1.15;\n  font-weight: 800;\n  letter-spacing: -0.03em;\n  font-variant-numeric: tabular-nums;\n}\n.hb-chart-at {\n  min-width: 0;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n  font-size: 12px;\n  color: var(--hb-muted);\n  font-variant-numeric: tabular-nums;\n}\n.hb-chart-other { margin-left: 8px; }\n.hb-chart-plot { position: relative; margin-top: 8px; }\n.hb-chart-svg { display: block; width: 100%; overflow: visible; touch-action: none; user-select: none; }\n.hb-chart-svg:focus-visible, .hb-pie-svg:focus-visible, .hb-hbar-grid:focus-visible {\n  outline: 2px solid var(--hb-accent);\n  outline-offset: 4px;\n  border-radius: 4px;\n}\n.hb-chart-source { margin-top: 2px; text-align: right; font-size: 11px; color: var(--hb-muted); }\n\n/* Marks and text inside the drawings */\n.hb-chart-axis, .hb-chart-tick { font-size: 11px; fill: var(--hb-muted); font-variant-numeric: tabular-nums; }\n.hb-chart-value { font-size: 11.5px; font-weight: 500; fill: var(--hb-ink-2); font-variant-numeric: tabular-nums; }\n.hb-chart-end { font-size: 11.5px; font-weight: 600; fill: var(--hb-ink); font-variant-numeric: tabular-nums; }\n/* Text drawn over lines (a change line's Start label): a rim of the page's colour behind the letters. */\n.hb-chart-halo { paint-order: stroke; stroke: var(--hb-surface); stroke-width: 3px; stroke-linejoin: round; }\n.hb-chart-rule { stroke: var(--hb-line); }\n.hb-chart-rule-strong { stroke: var(--hb-line-strong); }\n.hb-chart-dot { stroke: var(--hb-surface); stroke-width: 2; }\n.hb-chart-svg g, .hb-hbar-bar { transition: opacity 0.15s; }\n.hb-chart-draw { animation: hb-chart-draw 1.2s cubic-bezier(0.2, 0.8, 0.2, 1) forwards; }\n@keyframes hb-chart-draw { to { stroke-dashoffset: 0; } }\n\n/* The hover card (ChartTip) */\n.hb-tip {\n  position: absolute;\n  top: 0;\n  left: 0;\n  z-index: 5;\n  display: flex;\n  flex-direction: column;\n  gap: 4px;\n  min-width: 120px;\n  padding: 8px 10px;\n  border: 1px solid var(--hb-line);\n  border-radius: 8px;\n  background: var(--hb-surface);\n  box-shadow: var(--hb-shadow);\n  color: var(--hb-ink);\n  font-size: 12.5px;\n  line-height: 1.35;\n  font-variant-numeric: tabular-nums;\n  white-space: nowrap;\n  pointer-events: none;\n  opacity: 0;\n  transition: opacity 120ms ease;\n}\n.hb-tip-on { opacity: 1; }\n.hb-tip-title, .hb-tip-note { font-size: 11.5px; color: var(--hb-muted); }\n.hb-tip-row { display: flex; align-items: center; gap: 8px; }\n.hb-tip-row i { flex: none; width: 8px; height: 8px; border-radius: 2px; }\n.hb-tip-name { flex: 1; color: var(--hb-ink-2); }\n.hb-tip-value { margin-left: 12px; font-weight: 600; }\n\n@media (prefers-reduced-motion: reduce) {\n  .hb-chart-draw { animation: none; stroke-dashoffset: 0; }\n  .hb-tip, .hb-chart-svg g, .hb-hbar-bar, .hb-slice, .hb-pie-legend tr { transition: none; }\n}\n\n.hb-legend {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 4px 12px;\n  margin-top: 6px;\n  font-size: 12px;\n  line-height: 16px;\n  color: var(--hb-muted);\n}\n.hb-legend-item { display: inline-flex; align-items: center; gap: 6px; }\n.hb-legend-dot { flex: none; width: 10px; height: 10px; border-radius: 999px; }\n.hb-legend-value { color: var(--hb-ink-2); font-variant-numeric: tabular-nums; }\n\n/* Pie and donut: the legend sits beside the drawing from 440px wide, below it when narrower. It stops at 420px so\n   amounts stay near their names when the donut fills a wide section. */\n.hb-pie { container-type: inline-size; }\n.hb-pie-body { position: relative; display: flex; flex-direction: column; gap: 14px; margin-top: 10px; }\n@container (min-width: 440px) {\n  .hb-pie-body { flex-direction: row; align-items: center; gap: 20px; }\n  .hb-pie-body .hb-pie-svg { margin: 0; }\n}\n.hb-pie-svg { display: block; flex: none; margin: 0 auto; user-select: none; }\n.hb-pie-total { font-size: 17px; font-weight: 650; fill: var(--hb-ink); font-variant-numeric: tabular-nums; }\n.hb-slice { cursor: pointer; stroke: var(--hb-surface); stroke-width: 2; stroke-linejoin: round; transition: opacity 0.15s; }\n.hb-pie-legend { flex: 1; min-width: 0; max-width: 420px; border-collapse: collapse; font-size: 13px; line-height: 18px; font-variant-numeric: tabular-nums; }\n.hb-pie-legend tr { cursor: pointer; transition: opacity 0.15s; }\n.hb-pie-legend td { padding: 3px 12px 3px 0; vertical-align: top; }\n.hb-pie-legend td:last-child { padding-right: 0; }\n.hb-pie-swatch { width: 10px; }\n.hb-pie-swatch i { display: block; width: 10px; height: 10px; margin-top: 4px; border-radius: 3px; }\n.hb-pie-name { width: 100%; color: var(--hb-ink-2); overflow-wrap: anywhere; }\n.hb-pie-value { text-align: right; font-weight: 600; white-space: nowrap; }\n.hb-pie-share { text-align: right; color: var(--hb-muted); white-space: nowrap; }\n\n/* Horizontal bars: label | bar | value on each row. */\n.hb-hbar-box { position: relative; margin: 10px 0 4px; }\n.hb-hbar-grid {\n  display: grid;\n  grid-template-columns: fit-content(40%) minmax(0, 1fr) max-content;\n  gap: 8px 12px;\n  align-items: center;\n  font-size: 13px;\n}\n.hb-hbar-label { min-width: 64px; line-height: 17px; color: var(--hb-ink-2); }\n.hb-hbar-tracks, .hb-hbar-values { display: flex; flex-direction: column; gap: 4px; }\n.hb-hbar-track { position: relative; height: 14px; }\n.hb-hbar-zero { position: absolute; top: -4px; bottom: -4px; width: 1px; background: var(--hb-line-strong); }\n.hb-hbar-bar { position: absolute; top: 0; bottom: 0; border-radius: 3px; }\n.hb-hbar-value { line-height: 14px; text-align: right; font-weight: 600; font-variant-numeric: tabular-nums; white-space: nowrap; }\n.hb-hbar-many .hb-hbar-track { height: 12px; }\n.hb-hbar-many .hb-hbar-value { font-size: 12px; line-height: 12px; }\n.hb-hbar-up { color: var(--hb-good); }\n.hb-hbar-down { color: var(--hb-warn); }\n";

// src/blocks/images/images.css
var images_default = "/* Photos */\n.hb-photos { margin: 0; display: flex; flex-direction: column; gap: 8px; }\n.hb-photo-strip {\n  display: flex;\n  gap: 10px;\n  overflow-x: auto;\n  padding-bottom: 6px;\n  scroll-snap-type: x mandatory;\n  scrollbar-width: thin;\n}\n.hb-photo {\n  flex: 0 0 220px;\n  display: flex;\n  flex-direction: column;\n  justify-content: flex-start;\n  align-items: stretch;\n  height: auto;\n  margin: 0;\n  padding: 0;\n  overflow: hidden;\n  border: 1px solid var(--hb-line);\n  border-radius: 14px;\n  background: var(--hb-card);\n  color: inherit;\n  font: inherit;\n  text-align: left;\n  cursor: zoom-in;\n  scroll-snap-align: start;\n}\n.hb-photo img { display: block; width: 100%; height: 150px; object-fit: cover; background: var(--hb-well); }\n.hb-photo-text { display: flex; flex-direction: column; gap: 2px; padding: 8px 10px 10px; }\n.hb-photo-caption {\n  display: -webkit-box;\n  -webkit-line-clamp: 2;\n  -webkit-box-orient: vertical;\n  overflow: hidden;\n  font-size: 13px;\n  line-height: 17px;\n  font-weight: 600;\n}\n.hb-photo-source { font-size: 11.5px; color: var(--hb-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }\n.hb-photo-overlay {\n  position: fixed;\n  inset: 0;\n  z-index: 2147483000;\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  justify-content: center;\n  gap: 12px;\n  padding: 32px;\n  background: rgba(0, 0, 0, 0.82);\n  cursor: zoom-out;\n  animation: hb-appear 0.18s ease-out;\n}\n.hb-photo-overlay img { margin: 0; max-width: 100%; max-height: calc(100% - 48px); border-radius: 10px; object-fit: contain; }\n.hb-photo-overlay-text { max-width: 720px; text-align: center; font-size: 14px; color: rgba(255, 255, 255, 0.92); }\n.hb-photo-overlay-text span { color: rgba(255, 255, 255, 0.6); }\n";

// src/blocks/table/table.css
var table_default = "/* Tables */\n/* A table keeps its natural width (columns close together); the card hugs it. It scrolls inside the card: sideways\n   when wider than the chat, down past 520px with the header kept in view. */\n.hb-table-card { width: fit-content; max-width: 100%; padding: 4px 0 0; overflow: hidden; }\n.hb-table-caption { padding: 10px 16px 2px; }\n.hb-table-scroll { max-height: 520px; overflow: auto; overscroll-behavior: contain; }\n.hb-table {\n  border-collapse: separate;\n  border-spacing: 0;\n  font-size: 13.5px;\n  line-height: 20px;\n  font-variant-numeric: tabular-nums;\n}\n/* With 3 or more columns, a narrow chat scrolls the table rather than squeezing every column. */\n.hb-table-wide { min-width: 420px; }\n.hb-table th, .hb-table td {\n  height: 36px;\n  padding: 8px 12px;\n  border: 0;\n  border-bottom: 1px solid var(--hb-line);\n  background: none;\n  text-align: left;\n  vertical-align: middle;\n  white-space: nowrap;\n}\n/* The header stays in view as the rows scroll; it is painted like the card so rows don't show through. */\n.hb-table th {\n  position: sticky;\n  top: 0;\n  z-index: 1;\n  height: 34px;\n  padding: 0;\n  border-bottom-color: var(--hb-line-strong);\n  background: linear-gradient(var(--hb-card), var(--hb-card)), var(--hb-surface);\n}\n.hb-table th button {\n  display: flex;\n  align-items: center;\n  gap: 4px;\n  width: 100%;\n  height: 34px;\n  padding: 0 12px;\n  border: 0;\n  background: none;\n  color: var(--hb-muted);\n  font: inherit;\n  font-size: 11.5px;\n  font-weight: 600;\n  letter-spacing: 0.04em;\n  text-transform: uppercase;\n  white-space: nowrap;\n  cursor: pointer;\n}\n.hb-table th.hb-num button { justify-content: flex-end; }\n.hb-table .hb-first, .hb-table th.hb-first button { padding-left: 16px; }\n.hb-table td:last-child, .hb-table th:last-child button { padding-right: 16px; }\n.hb-table tbody tr:last-child td { border-bottom: 0; }\n.hb-table td.hb-first { font-weight: 600; }\n.hb-table td.hb-num { text-align: right; }\n.hb-table td.hb-wrap { min-width: 180px; white-space: normal; }\n/* Sorting: a faint \u2195 on the header under the pointer, \u2191 or \u2193 on the sorted one. */\n.hb-sort { opacity: 0; font-weight: 400; letter-spacing: 0; transition: opacity 0.12s; }\n.hb-table th:hover .hb-sort, .hb-table th button:focus-visible .hb-sort { opacity: 0.6; }\n.hb-table th.hb-sorted .hb-sort { opacity: 1; color: var(--hb-ink-2); }\n/* The best row: an accent edge on its first cell and a chip; the best column: an accent line under its header. */\n.hb-table tr.hb-best td.hb-first { box-shadow: inset 3px 0 0 var(--hb-accent); }\n.hb-table th.hb-best-col { box-shadow: inset 0 -2px 0 var(--hb-accent); }\n.hb-table .hb-chip { margin-left: 8px; vertical-align: 1px; padding: 0 7px; font-size: 11px; line-height: 16px; letter-spacing: 0; text-transform: none; }\n.hb-table th .hb-chip { margin-left: 4px; }\n/* Changes: green for a rise, orange for a fall, with a small bar growing from the middle. */\n.hb-table td.hb-up { color: var(--hb-good); }\n.hb-table td.hb-down { color: var(--hb-warn); }\n.hb-mini { display: inline-block; position: relative; width: 56px; height: 8px; margin-right: 8px; vertical-align: 0; }\n.hb-mini-zero { position: absolute; top: -3px; bottom: -3px; left: 50%; width: 1px; background: var(--hb-line-strong); }\n.hb-mini-bar { position: absolute; top: 0; bottom: 0; border-radius: 2px; background: currentColor; }\n.hb-table td.hb-table-empty { color: var(--hb-muted); font-weight: 400; text-align: center; }\n@media (prefers-reduced-motion: reduce) { .hb-sort { transition: none; } }\n.hb-section .hb-table-card { background: none; border: 0; }\n";

// src/blocks/list/list.css
var list_default = "/* List */\n.hb-list { padding: 4px 0; overflow: hidden; }\n.hb-list-heading { padding: 8px 16px 2px; font-size: 13px; font-weight: 700; color: var(--hb-muted); }\n.hb-list-row {\n  display: flex;\n  align-items: center;\n  gap: 12px;\n  padding: 10px 16px;\n  border-top: 1px solid var(--hb-line);\n  color: inherit;\n  text-decoration: none;\n}\n.hb-list > .hb-list-row:first-child, .hb-list-heading + .hb-list-row { border-top: 0; }\n.hb-list-link { cursor: pointer; transition: background 0.15s; }\n.hb-list-link:hover { background: var(--hb-well); }\n.hb-list-rank {\n  flex: none;\n  display: grid;\n  place-items: center;\n  width: 28px;\n  height: 28px;\n  border-radius: 999px;\n  background: var(--hb-accent-soft);\n  color: var(--hb-accent-ink);\n  font-size: 13px;\n  font-weight: 700;\n  font-variant-numeric: tabular-nums;\n}\n.hb-list-photo { flex: none; width: 44px; height: 44px; border-radius: 12px; object-fit: cover; background: var(--hb-well); }\n.hb-list-icon {\n  flex: none;\n  display: grid;\n  place-items: center;\n  width: 36px;\n  height: 36px;\n  border-radius: 12px;\n  background: var(--hb-accent-soft);\n  color: var(--hb-accent-ink);\n}\n.hb-list-initial {\n  flex: none;\n  display: grid;\n  place-items: center;\n  width: 36px;\n  height: 36px;\n  border-radius: 999px;\n  color: #fff;\n  font-size: 15px;\n  font-weight: 700;\n}\n.hb-list-body { flex: 1; min-width: 0; display: flex; flex-direction: column; }\n.hb-list-title { font-size: 14.5px; line-height: 20px; font-weight: 600; overflow-wrap: anywhere; }\n.hb-list-subtitle {\n  display: -webkit-box;\n  -webkit-line-clamp: 2;\n  -webkit-box-orient: vertical;\n  overflow: hidden;\n  margin-top: 1px;\n  font-size: 13px;\n  line-height: 18px;\n  color: var(--hb-muted);\n}\n.hb-list-value { flex: none; font-size: 14px; font-weight: 700; font-variant-numeric: tabular-nums; white-space: nowrap; }\n.hb-list-chevron { flex: none; color: var(--hb-muted); }\n.hb-section .hb-list { padding: 0; }\n\n/* List rows that send a message when tapped */\n.hb-list-button {\n  width: 100%;\n  margin: 0;\n  border: 0;\n  border-top: 1px solid var(--hb-line);\n  background: none;\n  font: inherit;\n  text-align: left;\n}\n.hb-list-button:focus-visible { outline: 2px solid var(--hb-accent); outline-offset: -2px; }\n";

// src/blocks/heatmap/heatmap.css
var heatmap_default = "/* Heatmap */\n.hb-heatmap { display: flex; flex-direction: column; gap: 8px; }\n.hb-heat-grid { display: grid; gap: 4px; align-items: center; }\n.hb-heat-col {\n  overflow: hidden;\n  text-align: center;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n  font-size: 11px;\n  font-weight: 600;\n  color: var(--hb-muted);\n}\n.hb-heat-row {\n  max-width: 96px;\n  padding-right: 6px;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n  font-size: 12px;\n  font-weight: 600;\n}\n.hb-heat-cell {\n  display: grid;\n  place-items: center;\n  min-width: 0;\n  height: 32px;\n  margin: 0;\n  padding: 0 2px;\n  overflow: hidden;\n  border: 0;\n  border-radius: 8px;\n  color: var(--hb-ink);\n  font: inherit;\n  font-size: 11.5px;\n  font-weight: 600;\n  line-height: 1;\n  font-variant-numeric: tabular-nums;\n  cursor: pointer;\n}\n.hb-heat-cell:focus-visible { outline: 2px solid var(--hb-accent); outline-offset: 1px; }\n.hb-heat-picked { font-size: 12.5px; color: var(--hb-muted); font-variant-numeric: tabular-nums; }\n.hb-heat-picked b { font-weight: 600; color: var(--hb-ink); }\n";

// src/blocks/flip/flip.css
var flip_default = "/* Flash cards: a grid of cards, each turning over in 3D on a tap to a softly tinted answer. A card grows with its\n   text: both faces sit in one grid cell, so the longer side sets its height, and the cards in a row share the row's. */\n.hb-flip { display: flex; flex-direction: column; gap: 8px; }\n/* At most --hb-flip-cols columns (set from the card count so the last row isn't a lone card), at least 200px each. */\n.hb-flip-grid {\n  display: grid;\n  grid-template-columns: repeat(auto-fill, minmax(max(200px, calc((100% - (var(--hb-flip-cols, 4) - 1) * 10px) / var(--hb-flip-cols, 4))), 1fr));\n  gap: 10px;\n}\n.hb-flip-card {\n  display: grid;\n  grid-template-columns: minmax(0, 1fr);\n  min-width: 0;\n  margin: 0;\n  padding: 0;\n  border: 0;\n  background: none;\n  color: inherit;\n  font: inherit;\n  text-align: left;\n  cursor: pointer;\n  perspective: 1000px;\n}\n.hb-flip-inner {\n  display: grid;\n  grid-template-columns: minmax(0, 1fr);\n  min-height: 150px;\n  transform-style: preserve-3d;\n  transition: transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1);\n}\n/* A photo on any card makes every card at least as tall as a photo card needs, so the rows stay even. */\n.hb-flip-tall .hb-flip-inner { min-height: 220px; }\n.hb-flip-turned { transform: rotateY(180deg); }\n.hb-flip-face {\n  grid-area: 1 / 1;\n  display: flex;\n  flex-direction: column;\n  gap: 6px;\n  overflow: hidden;\n  padding: 12px 14px;\n  border-radius: 12px;\n  border: 1px solid var(--hb-line);\n  backface-visibility: hidden;\n  -webkit-backface-visibility: hidden;\n}\n.hb-flip-front { background: var(--hb-card); }\n.hb-flip-card:hover .hb-flip-front { border-color: var(--hb-line-strong); }\n/* The answer side: a soft wash of the accent over the page colour, text in the normal ink. */\n.hb-flip-back {\n  transform: rotateY(180deg);\n  background: linear-gradient(var(--hb-accent-soft), var(--hb-accent-soft)), var(--hb-surface);\n  border-color: color-mix(in srgb, var(--hb-accent) 30%, transparent);\n}\n.hb-flip-card:focus-visible .hb-flip-face { outline: 2px solid var(--hb-accent); outline-offset: 2px; }\n.hb-flip-label {\n  font-size: 11px;\n  font-weight: 600;\n  letter-spacing: 0.06em;\n  text-transform: uppercase;\n  color: var(--hb-muted);\n  font-variant-numeric: tabular-nums;\n}\n.hb-flip-back .hb-flip-label { color: var(--hb-accent-ink); }\n.hb-flip-question, .hb-flip-answer { flex: 1; display: flex; align-items: center; min-height: 0; }\n.hb-flip-question { font-size: 14.5px; line-height: 1.35; font-weight: 600; }\n.hb-flip-answer { font-size: 13.5px; line-height: 1.45; }\n.hb-flip-foot { display: flex; justify-content: space-between; font-size: 11.5px; color: var(--hb-muted); }\n.hb-flip-back img { display: block; flex: none; width: calc(100% + 28px); height: 96px; margin: -12px -14px 4px; object-fit: cover; }\n@media (prefers-reduced-motion: reduce) {\n  .hb-flip-inner, .hb-flip-turned { transition: none; transform: none; }\n  .hb-flip-face, .hb-flip-back { transform: none; backface-visibility: visible; -webkit-backface-visibility: visible; transition: opacity 0.2s; }\n  .hb-flip-inner:not(.hb-flip-turned) .hb-flip-back, .hb-flip-turned .hb-flip-front { opacity: 0; }\n}\n";

// src/blocks/flow/flow.css
var flow_default = "/* Flow: boxes joined by arrows, left to right (.hb-flow-right) or top to bottom (.hb-flow-down). A group is a dashed\n   frame with its label (and count) on top; the lit box (from a steps block) gets the accent outline; boxes a walk\n   hasn't reached are dimmed; a box's chips fade in when they change; a tapped box's note opens in a panel under the\n   diagram. */\n.hb-flow { display: flex; flex-direction: column; gap: 10px; }\n.hb-flow-box { position: relative; width: 100%; min-width: 0; }\n.hb-flow-chain { display: flex; margin: 0; padding: 0; list-style: none; }\n.hb-flow-step { display: flex; align-items: center; min-width: 0; }\n.hb-flow-right { flex-direction: row; align-items: stretch; }\n.hb-flow-right .hb-flow-chain { flex-direction: row; }\n.hb-flow-right .hb-flow-step { flex: 1 1 0; align-items: stretch; }\n.hb-flow-right .hb-flow-arrow { align-self: center; }\n.hb-flow-down, .hb-flow-down .hb-flow-chain { flex-direction: column; align-items: stretch; }\n.hb-flow-down .hb-flow-step { flex-direction: column; align-items: stretch; }\n.hb-flow-arrow { display: grid; place-items: center; flex: none; width: 24px; color: var(--hb-muted); }\n.hb-flow-down .hb-flow-arrow { width: auto; height: 22px; }\n.hb-flow-down .hb-flow-arrow svg { transform: rotate(90deg); }\n.hb-flow-node {\n  position: relative;\n  display: flex;\n  flex: 1;\n  align-items: center;\n  gap: 6px;\n  min-width: 0;\n  min-height: 44px;\n  margin: 0;\n  padding: 8px 10px;\n  border: 1px solid var(--hb-line-strong);\n  border-radius: 10px;\n  background: var(--hb-surface);\n  color: inherit;\n  font: inherit;\n  font-size: 13px;\n  line-height: 1.3;\n  font-weight: 600;\n  text-align: left;\n  transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;\n}\n.hb-flow-right .hb-flow-node { flex-direction: column; justify-content: center; text-align: center; }\nbutton.hb-flow-node { cursor: pointer; }\nbutton.hb-flow-node:hover { border-color: var(--hb-accent); }\nbutton.hb-flow-node:focus-visible { outline: 2px solid var(--hb-accent); outline-offset: 2px; }\n.hb-flow-open { background: var(--hb-accent-soft); border-color: color-mix(in srgb, var(--hb-accent) 45%, transparent); }\n.hb-flow-lit { border-color: var(--hb-accent); box-shadow: 0 0 0 2px var(--hb-accent); }\n.hb-flow-icon {\n  display: grid;\n  place-items: center;\n  flex: none;\n  width: 24px;\n  height: 24px;\n  border-radius: 999px;\n  background: var(--hb-accent-soft);\n  color: var(--hb-accent-ink);\n}\n.hb-flow-label { min-width: 0; }\n.hb-flow-more { margin-left: auto; color: var(--hb-muted); font-weight: 400; }\n.hb-flow-right .hb-flow-more { position: absolute; top: 2px; right: 6px; font-size: 12px; }\n.hb-flow-group {\n  display: flex;\n  flex: 1;\n  flex-direction: column;\n  gap: 6px;\n  min-width: 0;\n  padding: 6px;\n  border: 1px dashed var(--hb-line-strong);\n  border-radius: 12px;\n  background: var(--hb-card);\n}\n.hb-flow-group-head { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 6px; }\n.hb-flow-down .hb-flow-group-head { justify-content: flex-start; }\n.hb-flow-group-label { font-size: 11.5px; font-weight: 600; color: var(--hb-muted); text-align: center; }\n.hb-flow-down .hb-flow-group-label { text-align: left; }\n.hb-flow-down .hb-flow-node { flex-wrap: wrap; }\n.hb-flow-holds { display: flex; flex-wrap: wrap; gap: 3px; animation: hb-flow-fade 0.2s ease-out; }\n.hb-flow-right .hb-flow-holds { justify-content: center; }\n.hb-flow-down .hb-flow-holds { flex-basis: 100%; }\n@keyframes hb-flow-fade { from { opacity: 0; } }\n.hb-flow-chip {\n  padding: 1px 6px;\n  border: 1px solid transparent;\n  border-radius: 6px;\n  background: var(--hb-well);\n  color: var(--hb-ink-2);\n  font: 11.5px/16px ui-monospace, SFMono-Regular, Menlo, monospace;\n  font-weight: 400;\n  white-space: nowrap;\n}\n.hb-flow-chip-accent { background: var(--hb-accent-soft); color: var(--hb-accent-ink); font-weight: 700; }\n/* A box the pass hasn't reached yet: faint, its chips only outlined. */\n.hb-flow-idle { color: var(--hb-muted); }\n.hb-flow-idle .hb-flow-holds { opacity: 0.6; }\n.hb-flow-idle .hb-flow-chip { border-style: dashed; border-color: var(--hb-line-strong); background: none; color: var(--hb-muted); font-family: inherit; }\n.hb-flow-packet {\n  position: absolute;\n  top: 0;\n  left: 0;\n  z-index: 3;\n  width: 12px;\n  height: 12px;\n  margin: -6px 0 0 -6px;\n  border-radius: 999px;\n  background: var(--hb-accent);\n  box-shadow: 0 0 0 4px var(--hb-accent-soft), 0 0 14px var(--hb-accent);\n  opacity: 0;\n  pointer-events: none;\n}\n.hb-flow-right .hb-flow-group > .hb-flow-chain { flex: 1; }\n.hb-flow-panel {\n  padding: 10px 12px;\n  border-radius: 10px;\n  background: linear-gradient(var(--hb-accent-soft), var(--hb-accent-soft)), var(--hb-surface);\n  border: 1px solid color-mix(in srgb, var(--hb-accent) 30%, transparent);\n}\n.hb-flow-panel-title { font-size: 13px; font-weight: 700; color: var(--hb-accent-ink); }\n.hb-flow-note { margin: 2px 0 0; font-size: 13.5px; line-height: 1.5; }\n@media (prefers-reduced-motion: reduce) {\n  .hb-flow-node { transition: none; }\n  .hb-flow-holds { animation: none; }\n}\n";

// src/blocks/steps/steps.css
var steps_default = `/* Steps: one step at a time; its place top right, the step's title and text, an optional photo, then a row of dots
   and Back / Next. */
.hb-steps { display: flex; flex-direction: column; gap: 10px; }
.hb-steps-head { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; }
.hb-steps-place {
  margin-left: auto;
  font-size: 12px;
  font-weight: 600;
  color: var(--hb-muted);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.hb-steps-body { display: flex; flex-direction: column; gap: 4px; min-height: 64px; }
.hb-steps-title { font-size: 15px; line-height: 21px; font-weight: 650; }
.hb-steps-text { margin: 0; font-size: 14px; line-height: 1.5; color: var(--hb-ink-2); }
.hb-steps-photo { display: block; width: 100%; max-height: 220px; margin-top: 6px; border-radius: 10px; object-fit: cover; }
.hb-steps-foot { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; }
.hb-steps-dots { display: flex; flex-wrap: wrap; gap: 2px; }
/* Each dot is a 24px target with a small mark inside. */
.hb-steps-dot {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  margin: 0;
  padding: 0;
  border: 0;
  background: none;
  cursor: pointer;
}
.hb-steps-dot::after {
  content: "";
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: var(--hb-line-strong);
  transition: background 0.15s, width 0.15s;
}
.hb-steps-dot-on::after { width: 18px; background: var(--hb-accent); }
.hb-steps-dot:focus-visible { outline: 2px solid var(--hb-accent); outline-offset: -2px; border-radius: 999px; }
.hb-steps-moves { display: flex; gap: 6px; margin-left: auto; }
@media (prefers-reduced-motion: reduce) {
  .hb-steps-dot::after { transition: none; }
}
`;

// src/blocks/layers/layers.css
var layers_default = `/* Layers: the stack on a canvas beside the slab's note, Back / Next and the slab list (side by side when there is
   room, else the list under the drawing). The note and Back / Next use the steps block's classes. */
.hb-layers { display: flex; flex-direction: column; gap: 10px; container-type: inline-size; }
.hb-layers-body { display: grid; gap: 14px; }
@container (min-width: 640px) { .hb-layers-body { grid-template-columns: minmax(0, 1fr) 230px; align-items: start; } }
.hb-layers-stage { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.hb-layers-canvas {
  display: block;
  width: 100%;
  height: clamp(280px, 52cqi, 440px);
  border: 1px solid var(--hb-line);
  border-radius: 12px;
  background: var(--hb-surface);
  cursor: grab;
  touch-action: pan-y;
}
.hb-layers-canvas:active { cursor: grabbing; }
.hb-layers-canvas:focus-visible { outline: 2px solid var(--hb-accent); outline-offset: 2px; }
.hb-layers-hint, .hb-layers-caption { margin: 0; font-size: 12px; color: var(--hb-muted); }
.hb-layers-caption { font-size: 12.5px; color: var(--hb-ink-2); }
.hb-layers-side { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
/* Top slab first, as in the drawing. */
.hb-layers-list { display: flex; flex-direction: column-reverse; gap: 4px; margin: 0; padding: 0; list-style: none; }
.hb-layers-slab {
  width: 100%;
  min-height: 32px;
  padding: 5px 10px;
  border: 1px solid var(--hb-line-strong);
  border-radius: 8px;
  background: var(--hb-surface);
  color: var(--hb-ink-2);
  font: inherit;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
}
.hb-layers-slab[aria-pressed="true"] { border-color: var(--hb-accent); background: var(--hb-accent-soft); color: var(--hb-accent-ink); font-weight: 650; }
.hb-layers-slab:focus-visible { outline: 2px solid var(--hb-accent); outline-offset: 2px; }
`;

// src/blocks/progress/progress.css
var progress_default = "/* Progress: a track toward a goal, with checkpoints */\n.hb-progress {\n  background: color-mix(in srgb, var(--hb-good) 9%, transparent);\n  border-color: color-mix(in srgb, var(--hb-good) 22%, transparent);\n}\n.hb-progress-head { display: flex; align-items: center; gap: 8px; }\n.hb-progress-head .hb-card-title { min-width: 0; }\n.hb-progress-icon { display: flex; color: var(--hb-good); }\n.hb-progress-amount {\n  display: flex;\n  align-items: center;\n  gap: 4px;\n  margin-left: auto;\n  font-size: 14px;\n  font-weight: 600;\n  color: var(--hb-ink-2);\n  font-variant-numeric: tabular-nums;\n  white-space: nowrap;\n}\n.hb-progress-amount svg { color: var(--hb-good); }\n.hb-progress-track {\n  display: block;\n  height: 8px;\n  margin: 16px 0 4px;\n  overflow: hidden;\n  border-radius: 999px;\n  background: color-mix(in srgb, var(--hb-good) 20%, transparent);\n}\n.hb-progress-fill { transform-origin: left; animation: hb-grow 0.9s cubic-bezier(0.2, 0.8, 0.2, 1); }\n.hb-progress-fill { display: block; height: 100%; border-radius: 999px; background: var(--hb-good); }\n.hb-progress-nodes { position: relative; height: 24px; margin-top: 16px; }\n.hb-progress-track-steps { position: absolute; top: 8px; margin: 0; }\n.hb-progress-fill-steps { position: absolute; top: 8px; height: 8px; }\n.hb-progress-node {\n  position: absolute;\n  top: 0;\n  display: grid;\n  place-items: center;\n  width: 32px;\n  height: 24px;\n  margin-left: -16px;\n  border: 2px solid color-mix(in srgb, var(--hb-good) 35%, var(--hb-surface));\n  border-radius: 999px;\n  background: var(--hb-surface);\n  color: color-mix(in srgb, var(--hb-good) 75%, var(--hb-surface));\n}\n.hb-progress-node-done { border-color: var(--hb-good); background: var(--hb-good); color: #fff; }\n.hb-progress-labels { display: grid; margin-top: 8px; }\n.hb-progress-labels span {\n  display: -webkit-box;\n  -webkit-line-clamp: 2;\n  -webkit-box-orient: vertical;\n  overflow: hidden;\n  padding: 0 2px;\n  text-align: center;\n  font-size: 11.5px;\n  line-height: 14px;\n  font-weight: 500;\n  color: var(--hb-muted);\n  overflow-wrap: anywhere;\n}\n@media (prefers-reduced-motion: reduce) {\n  .hb-progress-fill { animation: none; }\n}\n";

// src/blocks/streak/streak.css
var streak_default = "/* Streak */\n.hb-streak { padding: 0; overflow: hidden; }\n.hb-streak-head { display: flex; align-items: center; gap: 12px; padding: 14px 16px 12px; }\n.hb-streak-label {\n  font-size: 12px;\n  font-weight: 600;\n  letter-spacing: 0.06em;\n  text-transform: uppercase;\n  color: var(--hb-accent-ink);\n}\n.hb-streak-count {\n  font-size: 32px;\n  line-height: 38px;\n  font-weight: 800;\n  letter-spacing: -0.03em;\n  font-variant-numeric: tabular-nums;\n}\n.hb-streak-count span { text-transform: capitalize; }\n.hb-streak-medal {\n  flex: none;\n  display: grid;\n  place-items: center;\n  width: 56px;\n  height: 56px;\n  margin-left: auto;\n  border-radius: 999px;\n  color: #fff;\n  background: radial-gradient(circle at 35% 30%, color-mix(in srgb, var(--hb-chart-2) 45%, #fff), var(--hb-chart-2) 55%,\n    color-mix(in srgb, var(--hb-chart-2) 75%, #000));\n  box-shadow: 0 8px 20px -8px color-mix(in srgb, var(--hb-chart-2) 70%, transparent);\n}\n.hb-streak-week { display: grid; padding: 12px 8px; border-top: 1px solid var(--hb-line); }\n.hb-streak-day { display: flex; flex-direction: column; align-items: center; gap: 6px; }\n.hb-streak-day-label { font-size: 12.5px; color: var(--hb-muted); }\n.hb-streak-done {\n  display: grid;\n  place-items: center;\n  width: 32px;\n  height: 32px;\n  border-radius: 999px;\n  background: var(--hb-accent-soft);\n  color: var(--hb-accent-ink);\n}\n.hb-streak-date {\n  display: grid;\n  place-items: center;\n  width: 32px;\n  height: 32px;\n  font-size: 16px;\n  color: var(--hb-muted);\n  font-variant-numeric: tabular-nums;\n}\n.hb-streak-dot { width: 4px; height: 4px; border-radius: 999px; }\n.hb-streak-today .hb-streak-day-label, .hb-streak-today .hb-streak-date { font-weight: 700; color: var(--hb-ink); }\n.hb-streak-today .hb-streak-dot { background: var(--hb-ink-2); }\n";

// src/blocks/actions/actions.css
var actions_default = "/* A row of pill buttons (the pills themselves are in styles/shared.css). */\n.hb-actions { display: flex; flex-wrap: wrap; gap: 8px; }\n";

// src/blocks/tiles/tiles.css
var tiles_default = "/* Tiles: cover cards */\n.hb-tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; }\n.hb-tile {\n  position: relative;\n  display: block;\n  aspect-ratio: 1 / 1.05;\n  margin: 0;\n  padding: 0;\n  overflow: hidden;\n  border: 0;\n  border-radius: 20px;\n  color: #fff;\n  font: inherit;\n  text-align: left;\n  cursor: pointer;\n  transition: transform 0.15s cubic-bezier(0.2, 0.8, 0.2, 1);\n}\n.hb-tile:hover { transform: translateY(-1px); }\n.hb-tile:active { transform: scale(0.98); }\n.hb-tile:disabled { cursor: default; transform: none; }\n.hb-tile-static { cursor: default; }\n.hb-tile-static:hover,\n.hb-tile-static:active { transform: none; }\n.hb-tile:focus-visible { outline: 2px solid var(--hb-accent); outline-offset: 2px; }\n.hb-tile img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }\n.hb-tile-shade { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(0, 0, 0, 0) 35%, rgba(12, 8, 24, 0.66) 100%); }\n.hb-tile-icon {\n  position: absolute;\n  top: 12px;\n  left: 12px;\n  display: grid;\n  place-items: center;\n  width: 36px;\n  height: 36px;\n  border: 1px solid rgba(255, 255, 255, 0.35);\n  border-radius: 12px;\n  background: rgba(255, 255, 255, 0.22);\n  backdrop-filter: blur(8px);\n}\n.hb-tile-text { position: absolute; left: 14px; right: 12px; bottom: 12px; display: flex; flex-direction: column; gap: 3px; }\n.hb-tile-title { font-size: 15.5px; line-height: 20px; font-weight: 700; letter-spacing: -0.01em; text-shadow: 0 1px 8px rgba(0, 0, 0, 0.3); }\n.hb-tile-subtitle {\n  display: -webkit-box;\n  -webkit-line-clamp: 2;\n  -webkit-box-orient: vertical;\n  overflow: hidden;\n  font-size: 12.5px;\n  line-height: 16px;\n  color: rgba(255, 255, 255, 0.88);\n}\n@media (prefers-reduced-motion: reduce) {\n  .hb-tile { transition: none; }\n}\n";

// src/blocks/checklist/checklist.css
var checklist_default = "/* Checklist */\n.hb-checklist { display: flex; flex-direction: column; }\n.hb-checklist-head { display: flex; align-items: baseline; gap: 8px; }\n.hb-checklist-head .hb-card-title { flex: 1; min-width: 0; }\n.hb-checklist-count {\n  margin-left: auto;\n  font-size: 12.5px;\n  font-weight: 600;\n  color: var(--hb-muted);\n  font-variant-numeric: tabular-nums;\n  white-space: nowrap;\n}\n.hb-checklist-count-done { color: var(--hb-good); }\n.hb-checklist-track { display: block; height: 6px; margin: 8px 0 4px; overflow: hidden; border-radius: 999px; background: var(--hb-well); }\n.hb-checklist-fill { display: block; height: 100%; border-radius: 999px; background: var(--hb-good); transition: width 0.3s ease; }\n.hb-checklist-group { padding: 10px 0 2px; font-size: 12px; font-weight: 700; color: var(--hb-muted); }\n.hb-check {\n  display: flex;\n  align-items: flex-start;\n  gap: 12px;\n  width: 100%;\n  margin: 0;\n  padding: 7px 0;\n  border: 0;\n  background: none;\n  color: inherit;\n  font: inherit;\n  text-align: left;\n  cursor: pointer;\n}\n.hb-check:focus-visible { outline: 2px solid var(--hb-accent); outline-offset: 2px; border-radius: 8px; }\n.hb-check-mark {\n  flex: none;\n  display: grid;\n  place-items: center;\n  width: 22px;\n  height: 22px;\n  margin-top: 0.5px;\n  border: 2px solid var(--hb-line-strong);\n  border-radius: 999px;\n  color: var(--hb-muted);\n  font-size: 11px;\n  font-weight: 700;\n  font-variant-numeric: tabular-nums;\n  transition: background 0.15s, border-color 0.15s;\n}\n.hb-check-on .hb-check-mark { border-color: var(--hb-good); background: var(--hb-good); color: #fff; }\n.hb-check-text { flex: 1; min-width: 0; font-size: 14.5px; line-height: 21px; transition: color 0.15s; }\n.hb-check-on .hb-check-text { color: var(--hb-muted); text-decoration: line-through; text-decoration-thickness: 1px; }\n@media (prefers-reduced-motion: reduce) {\n  .hb-checklist-fill, .hb-check-mark, .hb-check-text { transition: none; }\n}\n";

// src/blocks/calculator/calculator.css
var calculator_default = "/* Calculator; a form's slider uses the same .hb-calc-head, .hb-calc-label, .hb-calc-value and .hb-range. */\n.hb-calc { display: flex; flex-direction: column; }\n/* At the top of a reply sliders stop at 720px rather than stretching across a wide board; in a layout block they fill\n   their place. */\n.hb-blocks > .hb-calc { max-width: 720px; }\n.hb-calc-slider { display: block; padding: 8px 0; }\n.hb-calc-head { display: flex; align-items: baseline; gap: 8px; }\n.hb-calc-label { flex: 1; min-width: 0; font-size: 13.5px; font-weight: 600; color: var(--hb-ink-2); }\n.hb-calc-value { font-size: 15px; font-weight: 700; font-variant-numeric: tabular-nums; white-space: nowrap; }\n.hb-range { display: block; width: 100%; margin: 8px 0 0; accent-color: var(--hb-accent); cursor: pointer; }\n.hb-calc-ends { display: flex; justify-content: space-between; font-size: 11px; color: var(--hb-muted); font-variant-numeric: tabular-nums; }\n.hb-calc-results { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 8px; margin-top: 8px; }\n/* A calculator's live chart sits in the calculator's card, so it drops its own card look. */\n.hb-calc > .hb-chart { margin-top: 10px; padding: 10px 0 0; border: 0; border-top: 1px solid var(--hb-line); border-radius: 0; background: none; }\n.hb-calc-result { min-width: 0; padding: 10px 14px; border-radius: 14px; background: var(--hb-accent-soft); }\n.hb-calc-result-label { font-size: 12px; font-weight: 600; color: var(--hb-accent-ink); }\n.hb-calc-result-value {\n  margin-top: 2px;\n  font-size: 20px;\n  line-height: 1.2;\n  font-weight: 800;\n  letter-spacing: -0.02em;\n  font-variant-numeric: tabular-nums;\n  overflow-wrap: anywhere;\n}\n";

// src/blocks/simulate/simulate.css
var simulate_default = `/* Simulation: a title with the view switch, then Play, the time scrubber and the sliders, then the piles of dots or
   the line chart. The sliders use the calculator's .hb-calc-slider and .hb-range; the legend the chart's. */
.hb-sim { display: flex; flex-direction: column; gap: 12px; container-type: inline-size; }
.hb-blocks > .hb-sim { max-width: 720px; }
.hb-sim-head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 12px; }
.hb-sim-switch { display: inline-flex; gap: 2px; padding: 3px; border-radius: 999px; background: var(--hb-well); }
.hb-sim-switch button {
  min-height: 30px;
  padding: 5px 12px;
  border: 0;
  border-radius: 999px;
  background: none;
  color: var(--hb-ink-2);
  font: inherit;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
}
.hb-sim-switch button[aria-pressed="true"] { background: var(--hb-surface); color: var(--hb-ink); box-shadow: 0 1px 2px var(--hb-line-strong); }
.hb-sim-switch button:focus-visible { outline: 2px solid var(--hb-accent); outline-offset: 1px; }
.hb-sim-controls { display: grid; grid-template-columns: 1fr; gap: 0 18px; align-items: center; }
@container (min-width: 560px) { .hb-sim-controls { grid-template-columns: auto 1fr 1fr; } }
.hb-sim-play { justify-self: start; }
.hb-sim-piles { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; }
.hb-sim-pile { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.hb-sim-pile-name { font-size: 12.5px; font-weight: 600; color: var(--hb-ink-2); }
.hb-sim-amount { font-size: 20px; font-weight: 700; letter-spacing: -0.01em; font-variant-numeric: tabular-nums; }
.hb-sim-canvas { display: block; width: 100%; border-bottom: 1px solid var(--hb-line-strong); }
.hb-sim-chart { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.hb-sim-chart svg { display: block; overflow: visible; }
.hb-sim-chart text { font-size: 11px; fill: var(--hb-muted); font-variant-numeric: tabular-nums; }
.hb-sim-grid { stroke: var(--hb-line); }
.hb-sim-line { fill: none; stroke: currentColor; stroke-width: 2.5; stroke-linejoin: round; stroke-linecap: round; }
.hb-sim-point { fill: currentColor; stroke: var(--hb-surface); stroke-width: 2; }
`;

// src/blocks/form/form.css
var form_default = "/* Form: at most 720px wide at the top of a reply (like a calculator), filling its place in a layout block. */\n.hb-blocks > .hb-form { max-width: 720px; }\n.hb-form-field { display: block; padding: 8px 0; }\n.hb-form fieldset { min-width: 0; margin: 0; padding: 0; border: 0; }\n.hb-form-sent fieldset { opacity: 0.6; }\n.hb-form-label { display: block; margin-bottom: 6px; font-size: 13.5px; font-weight: 600; color: var(--hb-ink-2); }\n.hb-input {\n  display: block;\n  width: 100%;\n  min-width: 0;\n  height: 38px;\n  padding: 0 12px;\n  border: 1px solid var(--hb-line-strong);\n  border-radius: 12px;\n  background: var(--hb-surface);\n  color: var(--hb-ink);\n  font: inherit;\n  font-size: 14px;\n  color-scheme: light dark;\n}\ntextarea.hb-input { height: auto; padding: 8px 12px; line-height: 20px; resize: vertical; }\n.hb-input:focus { outline: 2px solid var(--hb-accent); outline-offset: -1px; }\n.hb-input::placeholder { color: var(--hb-muted); }\n.hb-options { display: flex; flex-wrap: wrap; gap: 8px; }\n.hb-option {\n  min-height: 34px;\n  max-width: 100%;\n  margin: 0;\n  padding: 6px 14px;\n  border: 1px solid var(--hb-line-strong);\n  border-radius: 999px;\n  background: none;\n  color: var(--hb-ink);\n  font: inherit;\n  font-size: 13.5px;\n  line-height: 18px;\n  text-align: left;\n  cursor: pointer;\n  transition: background 0.15s, border-color 0.15s;\n}\n.hb-option:hover { background: var(--hb-well); }\n.hb-option-on, .hb-option-on:hover { border-color: var(--hb-accent); background: var(--hb-accent-soft); color: var(--hb-accent-ink); font-weight: 600; }\n.hb-option:focus-visible { outline: 2px solid var(--hb-accent); outline-offset: 2px; }\n.hb-option:disabled { cursor: default; }\n.hb-form-foot { display: flex; align-items: center; justify-content: flex-end; gap: 12px; margin-top: 8px; }\n.hb-form-done { flex: 1; font-size: 12.5px; font-weight: 600; color: var(--hb-good); }\n/* Form extras: group headings, option notes, a select's note and a slider's end words */\n.hb-form-group { padding: 12px 0 0; font-size: 12px; font-weight: 700; color: var(--hb-muted); }\n.hb-option-note { display: block; font-size: 11.5px; line-height: 15px; font-weight: 400; color: var(--hb-muted); }\n.hb-option-on .hb-option-note { color: var(--hb-accent-ink); }\n.hb-form-note { display: block; margin-top: 4px; font-size: 12px; line-height: 16px; color: var(--hb-muted); }\n.hb-form-ends { display: flex; justify-content: space-between; gap: 8px; margin-top: 2px; font-size: 11px; color: var(--hb-muted); }\n@media (prefers-reduced-motion: reduce) {\n  .hb-option { transition: none; }\n}\n";

// src/styles/index.ts
var STYLE_PARTS = [
  tokens_default,
  shared_default,
  blockTag_default,
  atoms_default,
  source_default,
  callout_default,
  kpis_default,
  timeline_default,
  layout_default,
  chart_default,
  images_default,
  table_default,
  list_default,
  heatmap_default,
  flip_default,
  flow_default,
  steps_default,
  layers_default,
  progress_default,
  streak_default,
  actions_default,
  tiles_default,
  checklist_default,
  calculator_default,
  simulate_default,
  form_default
];
var styles_default = STYLE_PARTS.join("\n");

// src/plugin.tsx
import { jsx as jsx40 } from "react/jsx-runtime";
var ID4 = "hermes-genui";
var STYLE_ID = "hermes-genui-css";
function injectStyles() {
  let el = document.getElementById(STYLE_ID);
  if (!el) {
    el = document.createElement("style");
    el.id = STYLE_ID;
    document.head.appendChild(el);
  }
  el.textContent = styles_default;
}
var plugin_default = {
  id: ID4,
  name: "Hermes GenUI",
  register(ctx) {
    injectStyles();
    const load = (blockId) => ctx.rest(`/blocks/${blockId}`);
    const rest = (path, init) => ctx.rest(path, init);
    const send = (text) => composerActions(host?.composer).send(text);
    const fill = (text) => composerActions(host?.composer).fill(text);
    ctx.register({
      id: "hermes-genui-tag",
      area: TRANSCRIPT_DIRECTIVE_AREA,
      data: {
        name: "blocks",
        render: ({ attrs, streaming }) => /* @__PURE__ */ jsx40(BlockActions.Provider, { value: { send, fill, rest, blockId: attrs?.id }, children: /* @__PURE__ */ jsx40(BlockTag, { id: attrs?.id, streaming: Boolean(streaming), load }) })
      }
    });
  }
};
export {
  plugin_default as default
};

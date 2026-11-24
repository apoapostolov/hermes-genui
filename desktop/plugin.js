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
function boardId(v) {
  return typeof v === "string" && /^[0-9a-f]{8}$/.test(v) ? v : void 0;
}
function version(v) {
  if (typeof v !== "number" || !Number.isInteger(v) || v < 1 || v > 9999) return void 0;
  return v;
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
import { useContext as useContext14, useEffect as useEffect10, useLayoutEffect as useLayoutEffect4, useReducer, useRef as useRef15, useState as useState28 } from "react";

// src/core/Blocks.tsx
import { Component as ReactComponent, useContext as useContext12 } from "react";

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
  const parts2 = [];
  const pattern = /\*\*(.+?)\*\*/g;
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > last) parts2.push(text.slice(last, match.index));
    parts2.push(/* @__PURE__ */ jsx4("strong", { children: match[1] }, match.index));
    last = match.index + match[0].length;
  }
  if (last < text.length) parts2.push(text.slice(last));
  return /* @__PURE__ */ jsx4(Fragment, { children: parts2 });
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
function Badge({ text, tone: tone2 }) {
  return /* @__PURE__ */ jsx5("div", { className: "hb-badge", children: /* @__PURE__ */ jsx5("span", { className: `hb-chip hb-chip-${tone2 ?? "plain"}`, children: text }) });
}
function LinkLine({ text, url }) {
  return /* @__PURE__ */ jsx5("div", { className: "hb-link", children: /* @__PURE__ */ jsxs2("a", { href: url, target: "_blank", rel: "noreferrer", children: [
    /* @__PURE__ */ jsx5(Icon, { name: "globe", size: 14, stroke: 2.2 }),
    text
  ] }) });
}
function Picture({ url, caption: caption2 }) {
  const [failed, setFailed] = useState2(false);
  if (failed) return null;
  return /* @__PURE__ */ jsxs2("figure", { className: "hb-image", children: [
    /* @__PURE__ */ jsx5("img", { src: url, alt: caption2 ?? "", loading: "lazy", referrerPolicy: "no-referrer", onError: () => setFailed(true) }),
    caption2 && /* @__PURE__ */ jsx5("figcaption", { children: caption2 })
  ] });
}
function barAmount(value, max, unit) {
  if (value === null) return "no data";
  if (max === 100 && !unit) return `${value}%`;
  const money = formatAmount(value, unit);
  if (money !== null) return `${money} / ${formatAmount(max, unit)}`;
  const amount = `${formatNumber(value, { digits: 3 })} / ${formatNumber(max, { digits: 3 })}`;
  return unit ? `${amount} ${unit}` : amount;
}
function Bar({ label, value, max, unit }) {
  const share = value === null ? 0 : Math.max(0, Math.min(1, value / max));
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
  if (value === null && raw.value !== null) return here.drop("bar needs a numeric value");
  let max = num(raw.max) ?? num(raw.goal) ?? num(raw.total) ?? 100;
  if (max <= 0) max = 100;
  return clean({ type: "bar", label, value, max, unit: str(raw.unit, 12) });
}

// src/blocks/calculator/Calculator.tsx
import { useMemo as useMemo5 } from "react";

// src/core/blockState.ts
import { createContext as createContext3, useContext as useContext3, useEffect, useRef, useState as useState3 } from "react";

// src/core/living-identity.ts
var POSITIONAL_PATH = /^\d+(?:\.[A-Za-z_]+(?:\.\d+)*)*$/;
var DESCENDANTS = "\u25C7";
function holdsBlocks(v) {
  if (Array.isArray(v)) return v.some(holdsBlocks);
  if (v === null || typeof v !== "object") return false;
  if (typeof v.type === "string") return true;
  return Object.values(v).some(holdsBlocks);
}
function canonicalize(v, root) {
  if (!root && holdsBlocks(v)) return DESCENDANTS;
  if (v === null || typeof v !== "object") return JSON.stringify(v) ?? "null";
  if (Array.isArray(v)) return `[${v.map((e) => canonicalize(e, false)).join(",")}]`;
  const o = v;
  const positional = typeof o.type === "string" && typeof o.path === "string" && POSITIONAL_PATH.test(o.path);
  const keys = Object.keys(o).filter((k) => !(positional && k === "path")).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalize(o[k], false)}`).join(",")}}`;
}
function identityOf(block) {
  const json = canonicalize(block, true);
  let h = 2166136261;
  for (let i = 0; i < json.length; i++) {
    h ^= json.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(16);
}
var freshSeq = 0;
var mintOf = (b) => `${identityOf(b)}:~${freshSeq += 1}`;
var mounted = /* @__PURE__ */ new WeakMap();
var carried = /* @__PURE__ */ new WeakMap();
function noteMounted(block, key) {
  mounted.set(block, key);
}
function carriedKey(block) {
  return carried.get(block);
}
function mintKey(block) {
  return mintOf(block);
}
function existingKey(obj) {
  return carried.get(obj) ?? mounted.get(obj) ?? mintOf(obj);
}
var isBlock = (v) => typeof v === "object" && v !== null && !Array.isArray(v) && typeof v.type === "string";
function overlap(a, b) {
  const pool = /* @__PURE__ */ new Map();
  for (const x of a) pool.set(x, (pool.get(x) ?? 0) + 1);
  let n = 0;
  for (const y of b) {
    const c = pool.get(y) ?? 0;
    if (c > 0) {
      pool.set(y, c - 1);
      n += 1;
    }
  }
  return n;
}
function signatures(obj) {
  const exact = [];
  const kinds = [];
  const walkKinds = (v) => {
    if (Array.isArray(v)) {
      v.forEach(walkKinds);
      return;
    }
    if (v === null || typeof v !== "object") return;
    const t = v.type;
    if (typeof t === "string") {
      kinds.push(t);
      return;
    }
    Object.values(v).forEach(walkKinds);
  };
  for (const value of Object.values(obj)) {
    if (!holdsBlocks(value)) continue;
    if (Array.isArray(value)) {
      for (const item of value) {
        if (isBlock(item)) exact.push(identityOf(item));
      }
    }
    walkKinds(value);
  }
  return { exact, kinds };
}
function carryBlocks(prev, next) {
  carryList(prev ?? [], next);
}
function carryList(prev, next) {
  const cands = [];
  const nextSig = next.map((b) => signatures(b));
  const prevSig = prev.map((b) => signatures(b));
  for (let n = 0; n < next.length; n++) {
    if (!holdsOwnIdentity(next[n])) continue;
    for (let p = 0; p < prev.length; p++) {
      if (!holdsOwnIdentity(prev[p]) || identityOf(prev[p]) !== identityOf(next[n])) continue;
      const score = 2 * overlap(nextSig[n].exact, prevSig[p].exact) + overlap(nextSig[n].kinds, prevSig[p].kinds);
      cands.push({ n, p, score });
    }
  }
  cands.sort((a, b) => b.score - a.score || Math.abs(a.n - a.p) - Math.abs(b.n - b.p) || a.p - b.p || a.n - b.n);
  const pairOf = /* @__PURE__ */ new Map();
  const prevTaken = /* @__PURE__ */ new Set();
  for (const c of cands) {
    if (pairOf.has(c.n) || prevTaken.has(c.p)) continue;
    pairOf.set(c.n, c.p);
    prevTaken.add(c.p);
  }
  const assigned = /* @__PURE__ */ new Set();
  for (let n = 0; n < next.length; n++) {
    const item = next[n];
    if (typeof item !== "object" || item === null) continue;
    const p = pairOf.get(n);
    let key = p === void 0 ? void 0 : existingKey(prev[p]);
    if (key !== void 0 && assigned.has(key)) key = void 0;
    if (key === void 0) key = mintOf(item);
    else if (p !== void 0) carriedFrom.set(item, prev[p]);
    assigned.add(key);
    carried.set(item, key);
  }
  for (let n = 0; n < next.length; n++) {
    const p = pairOf.get(n);
    carryFields(p === void 0 ? null : prev[p], next[n]);
  }
}
function holdsOwnIdentity(v) {
  return isBlock(v) || isHolderWithBlocks(v);
}
function carryFields(pv, nv) {
  if (typeof nv !== "object" || nv === null) return;
  const po = typeof pv === "object" && pv !== null && !Array.isArray(pv) ? pv : {};
  for (const [k, value] of Object.entries(nv)) {
    if (!holdsBlocks(value)) continue;
    const before = po[k];
    if (Array.isArray(value)) {
      carryList(Array.isArray(before) ? before : [], value);
    } else if (isBlock(value)) {
      carryList(before !== void 0 && holdsBlocks(before) ? [before] : [], [value]);
    } else {
      carryFields(isHolderWithBlocks(before) ? before : null, value);
    }
  }
}
function isHolderWithBlocks(v) {
  return typeof v === "object" && v !== null && !Array.isArray(v) && holdsBlocks(v);
}
function kkey(slot) {
  return `k:${slot}`;
}
function eachSlot(root, visit, prefix = "") {
  slotList(root, visit, prefix);
}
function slotList(list, visit, prefix) {
  const seen = /* @__PURE__ */ new Map();
  for (const item of list) {
    if (typeof item !== "object" || item === null) continue;
    const id = identityOf(item);
    const n = seen.get(id) ?? 0;
    seen.set(id, n + 1);
    const flat = `${id}:${n}`;
    const full = prefix === "" ? flat : `${prefix}/${flat}`;
    const block = isBlock(item);
    if (block) visit(item, full, flat);
    slotDescend(item, visit, block ? full : prefix);
  }
}
function slotDescend(block, visit, full) {
  if (typeof block !== "object" || block === null) return;
  for (const value of Object.values(block)) slotValue(value, visit, full);
}
function slotValue(value, visit, full) {
  if (!holdsBlocks(value)) return;
  if (Array.isArray(value)) {
    slotList(value, visit, full);
    return;
  }
  if (isBlock(value)) {
    slotList([value], visit, full);
    return;
  }
  slotDescend(value, visit, full);
}
var carriedFrom = /* @__PURE__ */ new WeakMap();
function carrySource(block) {
  return carriedFrom.get(block);
}

// src/blocks/checklist/savedState.ts
var boards = /* @__PURE__ */ new Map();
var living = /* @__PURE__ */ new Set();
var migratedWalk = /* @__PURE__ */ new Map();
var stored = /* @__PURE__ */ new Map();
var queued = /* @__PURE__ */ new Map();
var timers = /* @__PURE__ */ new Map();
var DOOR_DELAY = 150;
function stateIn(answer) {
  const state = answer?.state;
  if (state && typeof state === "object" && !Array.isArray(state)) return { ...state };
  return {};
}
function loadBoardState(rest, blockId) {
  const known = boards.get(blockId);
  if (known) return known.loaded;
  const board = { state: {}, loaded: Promise.resolve({}), saving: Promise.resolve(), ready: false };
  board.loaded = rest(`/blocks/${blockId}/state`).then(
    (answer) => {
      Object.assign(board.state, stateIn(answer));
      board.ready = true;
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
function peekState(blockId) {
  const board = boards.get(blockId);
  return board !== void 0 && board.ready ? board.state : null;
}
async function saveBoardValue(rest, blockId, key, value) {
  await loadBoardState(rest, blockId);
  const board = boards.get(blockId);
  if (!board) return;
  board.state[key] = value;
  const snapshot = { ...board.state };
  board.saving = board.saving.then(() => rest(`/blocks/${blockId}/state`, { method: "PUT", body: { state: snapshot } })).then(() => {
  }, () => {
  });
  await board.saving;
}
function markLiving(blockId) {
  living.add(blockId);
}
function isLiving(blockId) {
  return living.has(blockId);
}
function seedValue(state, key) {
  return state[key];
}
function peekStored(blockId, cacheKey) {
  const key = `${blockId}\0${cacheKey}`;
  return stored.has(key) ? { value: stored.get(key) } : void 0;
}
function recordValue(rest, blockId, cacheKey, doorKey, value, door) {
  if (cacheKey !== null) stored.set(`${blockId}\0${cacheKey}`, value);
  const state = peekState(blockId);
  if (state !== null && door !== "never") state[doorKey] = value;
  if (!rest || door === "never") return;
  if (door === "now") {
    void saveBoardValue(rest, blockId, doorKey, value);
    return;
  }
  const key = `${blockId}\0${doorKey}`;
  queued.set(key, { rest, value });
  if (!timers.has(key)) {
    timers.set(key, setTimeout(() => {
      timers.delete(key);
      const pending = queued.get(key);
      if (pending !== void 0) {
        queued.delete(key);
        const at2 = key.indexOf("\0");
        void saveBoardValue(pending.rest, key.slice(0, at2), key.slice(at2 + 1), pending.value);
      }
    }, DOOR_DELAY));
  }
}
function forgetBlock(blockId) {
  const prefix = `${blockId}\0`;
  for (const [key, item] of [...queued]) {
    if (!key.startsWith(prefix)) continue;
    queued.delete(key);
    const timer = timers.get(key);
    if (timer !== void 0) clearTimeout(timer);
    timers.delete(key);
    void saveBoardValue(item.rest, blockId, key.slice(prefix.length), item.value);
  }
  living.delete(blockId);
  migratedWalk.delete(blockId);
}
function trailsFrom(prev, next) {
  const trails = /* @__PURE__ */ new Map();
  if (prev === null) return trails;
  const prevFull = /* @__PURE__ */ new Map();
  const prevFlat = /* @__PURE__ */ new Map();
  eachSlot(prev, (block, full, flat) => {
    prevFull.set(block, full);
    const position = block.path;
    const seen = prevFlat.get(flat);
    if (seen === void 0) {
      prevFlat.set(flat, { from: full, position: typeof position === "string" ? position : void 0, count: 1 });
    } else {
      seen.count += 1;
    }
  });
  eachSlot(next, (block, full, flat) => {
    const src = carrySource(block);
    if (src !== void 0) {
      const was = prevFull.get(src);
      if (was !== void 0) {
        const position = src.path;
        trails.set(block, { from: was, position: typeof position === "string" ? position : void 0 });
      }
      return;
    }
    const cand = prevFlat.get(flat);
    if (cand !== void 0 && cand.count === 1 && cand.from !== full) {
      trails.set(block, { from: cand.from, position: cand.position });
    }
  });
  return trails;
}
async function promoteOnUpdate(rest, blockId, prev, next) {
  living.add(blockId);
  const trails = trailsFrom(prev, next);
  eachSlot(next, (block, full) => {
    const came = trails.get(block);
    if (came === void 0 || came.from === full) return;
    const from = `${blockId}\0${came.from}`;
    for (const [key, value] of [...stored]) {
      if (!key.startsWith(from)) continue;
      const suffix = key.slice(from.length);
      if (suffix !== "" && suffix[0] !== "/" && suffix[0] !== "~") continue;
      const target = `${blockId}\0${full}${suffix}`;
      if (!stored.has(target)) stored.set(target, value);
    }
  });
  if (rest === void 0) return;
  const board = boards.get(blockId);
  if (board !== void 0 && board.ready) {
    fileDoor(board, blockId, rest, next, trails);
    return;
  }
  await loadBoardState(rest, blockId);
  const now = boards.get(blockId);
  if (now !== void 0) fileDoor(now, blockId, rest, next, trails);
}
function fileDoor(board, blockId, rest, next, trails) {
  const state = board.state;
  const claimed = /* @__PURE__ */ new Set();
  let dirty = false;
  const prefix = `${blockId}\0`;
  for (const [key, value] of stored) {
    if (!key.startsWith(prefix)) continue;
    const dk = kkey(key.slice(prefix.length));
    if (state[dk] === void 0) {
      state[dk] = value;
      dirty = true;
    }
  }
  eachSlot(next, (block, full) => {
    const key = kkey(full);
    if (state[key] !== void 0) return;
    const came = trails.get(block);
    if (came === void 0) return;
    const moved = came.from === full ? void 0 : state[kkey(came.from)];
    if (moved !== void 0) {
      state[key] = moved;
      dirty = true;
      return;
    }
    if (came.position !== void 0 && state[came.position] !== void 0 && !claimed.has(came.position)) {
      state[key] = state[came.position];
      claimed.add(came.position);
      dirty = true;
    }
  });
  if (!dirty) return;
  const snapshot = { ...state };
  board.saving = board.saving.then(() => rest(`/blocks/${blockId}/state`, { method: "PUT", body: { state: snapshot } })).then(() => {
  }, () => {
  });
}
var POSITION_KEY = /^\d+(?:\.[A-Za-z_]+(?:\.\d+)*)*$/;
function splitKKey(key) {
  const slot = key.slice(2);
  const tilde = slot.indexOf("~");
  return tilde < 0 ? { chain: slot, field: "" } : { chain: slot.slice(0, tilde), field: slot.slice(tilde) };
}
async function migrateArchived(rest, blockId, loadVersion, next, version2) {
  living.add(blockId);
  if (rest === void 0 || version2 < 2) return;
  if ((migratedWalk.get(blockId) ?? 0) >= version2) return;
  migratedWalk.set(blockId, version2);
  await loadBoardState(rest, blockId);
  const board = boards.get(blockId);
  if (board === void 0 || !board.ready) return;
  const state = board.state;
  const here = /* @__PURE__ */ new Set();
  eachSlot(next, (_block, full) => here.add(full));
  const orphans = [];
  for (const key of Object.keys(state)) {
    if (POSITION_KEY.test(key)) {
      orphans.push(key);
    } else if (key.startsWith("k:")) {
      if (!here.has(splitKKey(key).chain)) orphans.push(key);
    }
  }
  if (orphans.length === 0) return;
  const specs = /* @__PURE__ */ new Map([[version2, next]]);
  const specOf2 = async (v) => {
    if (!specs.has(v)) {
      let read = null;
      try {
        const answer = await loadVersion(v);
        if (answer !== null && answer.length > 0) read = answer;
      } catch {
        read = null;
      }
      specs.set(v, read);
    }
    return specs.get(v) ?? null;
  };
  const chainsAt = async (v) => {
    const spec = await specOf2(v);
    if (spec === null) return null;
    const set = /* @__PURE__ */ new Set();
    eachSlot(spec, (_block, full) => set.add(full));
    return set;
  };
  const stepMap = async (from, to) => {
    const prev = await specOf2(from);
    const nx = await specOf2(to);
    if (prev === null || nx === null) return null;
    const trails = trailsFrom(prev, nx);
    const map = /* @__PURE__ */ new Map();
    eachSlot(nx, (block, full) => {
      const came = trails.get(block);
      if (came !== void 0) map.set(came.from, full);
    });
    return map;
  };
  let position1;
  const positionsOfV1 = async () => {
    if (position1 === void 0) {
      const spec = await specOf2(1);
      position1 = spec === null ? null : (() => {
        const map = /* @__PURE__ */ new Map();
        eachSlot(spec, (block, full) => {
          const at2 = block.path;
          if (typeof at2 === "string") map.set(at2, full);
        });
        return map;
      })();
    }
    return position1;
  };
  let dirty = false;
  for (const key of orphans) {
    const value = state[key];
    let chain;
    let field = "";
    let origin;
    if (key.startsWith("k:")) {
      const parts2 = splitKKey(key);
      chain = parts2.chain;
      field = parts2.field;
      origin = -1;
      for (let v = version2 - 1; v >= 1; v--) {
        const at2 = await chainsAt(v);
        if (at2 !== null && at2.has(chain)) {
          origin = v;
          break;
        }
      }
      if (origin < 0) continue;
    } else {
      const slots = await positionsOfV1();
      if (slots === null) continue;
      const from = slots.get(key);
      if (from === void 0) continue;
      chain = from;
      origin = 1;
    }
    let cur = chain;
    let lost = false;
    for (let v = origin + 1; v <= version2; v++) {
      const at2 = await chainsAt(v);
      if (at2 === null) {
        lost = true;
        break;
      }
      if (at2.has(cur)) continue;
      const moved = (await stepMap(v - 1, v))?.get(cur);
      if (moved === void 0) {
        lost = true;
        break;
      }
      cur = moved;
    }
    if (lost || !here.has(cur)) continue;
    const target = kkey(cur + field);
    if (state[target] === void 0) {
      state[target] = value;
      dirty = true;
    }
  }
  if (!dirty) return;
  const snapshot = { ...state };
  board.saving = board.saving.then(() => rest(`/blocks/${blockId}/state`, { method: "PUT", body: { state: snapshot } })).then(() => {
  }, () => {
  });
}
function toggleTick(ticks, i) {
  if (ticks.includes(i)) return ticks.filter((t) => t !== i);
  return [...ticks, i].sort((a, b) => a - b);
}
function readTicks(saved, count2) {
  if (!Array.isArray(saved)) return null;
  const ticks = /* @__PURE__ */ new Set();
  for (const t of saved) {
    if (Number.isInteger(t) && t >= 0 && t < count2) ticks.add(t);
  }
  return [...ticks].sort((a, b) => a - b);
}

// src/core/blockState.ts
var BlockSlot = createContext3(null);
function useStoredValue(spec) {
  const { rest, blockId } = useContext3(BlockActions);
  const chain = useContext3(BlockSlot);
  const living2 = blockId !== void 0 && chain !== null && isLiving(blockId);
  const idKey = chain === null ? null : `${chain}${spec.field ?? ""}`;
  const legacy = `${spec.path ?? ""}${spec.field ?? ""}`;
  const transient = spec.door === "identity";
  const byIdentity = transient ? idKey !== null : living2 && idKey !== null;
  const doorKey = byIdentity && idKey !== null ? kkey(idKey) : legacy;
  const touched = useRef(false);
  const [value, setValue] = useState3(() => {
    if (blockId === void 0 || idKey === null) return spec.initial();
    if (!byIdentity) return spec.initial();
    const held = peekStored(blockId, idKey);
    if (held === void 0) return spec.initial();
    return spec.revive(held.value) ?? spec.initial();
  });
  useEffect(() => {
    if (!rest || blockId === void 0) return;
    if (transient && idKey === null) return;
    let live = true;
    void loadBoardState(rest, blockId).then((state) => {
      if (!live || touched.current || (spec.skip?.() ?? false)) return;
      const saved = seedValue(state, doorKey);
      if (saved === void 0) return;
      const revived = spec.revive(saved);
      if (revived !== null) setValue(revived);
    });
    return () => {
      live = false;
    };
  }, [rest, blockId, doorKey, living2]);
  const commit = (next, isTouched = true) => {
    if (isTouched) touched.current = true;
    setValue(next);
    if (blockId === void 0) return;
    if (!isTouched) return;
    if (transient && idKey === null) return;
    const door = !rest ? "never" : spec.door === "always" ? "now" : "coalesce";
    recordValue(rest, blockId, idKey, doorKey, spec.stored(next), door);
  };
  return [value, commit];
}

// src/blocks/chart/chartData.ts
var CHART_KINDS = ["line", "bar", "area", "stacked", "hbar", "combo", "pie", "donut", "scatter", "waterfall"];
var KIND_ALIASES = { doughnut: "donut", stackedbar: "stacked", horizontalbar: "hbar", barh: "hbar" };
function chartKind(name) {
  if (typeof name !== "string") return "line";
  const plain2 = name.toLowerCase().replace(/[\s_-]/g, "");
  const known = CHART_KINDS.find((k) => k === plain2);
  if (known) return known;
  return KIND_ALIASES[plain2] ?? "line";
}
function maxSeries(kind) {
  if (kind === "stacked" || kind === "area") return 6;
  if (kind === "scatter") return 2;
  if (kind === "waterfall") return 1;
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
function chartLabel(spec) {
  const drawn2 = kindToDraw(spec);
  const parts2 = [spec.title?.trim() || spec.series[0].name || "Chart", `${drawn2} chart`];
  const axis = drawn2 !== "pie" && drawn2 !== "donut" && drawn2 !== "hbar";
  if (spec.xLabel && (axis || drawn2 === "hbar")) parts2.push(`${spec.xLabel}${axis ? " along the bottom" : " along the bars"}`);
  if (spec.yLabel && axis) parts2.push(`${spec.yLabel} up the side`);
  const unit = spec.series[0].unit ?? spec.unit;
  const values = spec.series[0].data.filter((v) => v !== null);
  if (values.length && drawn2 !== "pie" && drawn2 !== "donut") {
    const pct = changePct(spec.series[0].data);
    const direction = pct === null ? "" : `, ${pct >= 0 ? "up" : "down"} ${Math.abs(pct).toFixed(1)}%`;
    parts2.push(`${fmt(values[0], unit)} to ${fmt(values[values.length - 1], unit)}${direction}`);
  }
  const gaps = missingLabels(spec);
  if (gaps.length) parts2.push(gaps.length <= 4 ? `${gaps.join(", ")} no data` : `${gaps.length} of ${spec.x.length} labels with no data`);
  if (spec.caveat) parts2.push(spec.caveat);
  return parts2.join(". ");
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
  const shown2 = slices.filter((s) => kept.has(s));
  let other = 0;
  for (const s of slices) if (!kept.has(s)) other += s.value;
  return { x: [...shown2.map((s) => s.label), "Other"], data: [...shown2.map((s) => s.value), other] };
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
function scatterPoints(series) {
  const drawn2 = [];
  series.forEach((s, k) => {
    for (const point of s.points ?? []) {
      if (numOrNull(point.x) === null || numOrNull(point.y) === null) continue;
      drawn2.push({ series: k, point, x: point.x, y: point.y });
    }
  });
  return drawn2.sort((a, b) => a.x - b.x || a.y - b.y || a.series - b.series);
}
var numOrNull = (v) => typeof v === "number" && isFinite(v) ? v : null;
function waterfallBars(points) {
  let balance2 = 0;
  let broken = false;
  let moved = false;
  return points.map((point) => {
    if (broken) return null;
    if (point.total === true) {
      const opening = numOrNull(point.value);
      if (!moved && opening !== null) balance2 = opening;
      return { label: point.label, from: 0, to: balance2, total: true };
    }
    const value = numOrNull(point.value);
    if (value === null) {
      broken = true;
      return null;
    }
    const bar = { label: point.label, from: balance2, to: balance2 + value, total: false };
    balance2 += value;
    moved = true;
    return bar;
  });
}
var AGAINST = /^(.+?)\s+(?:against|by|vs\.?)\s+(.+)$/i;
function axisNames(title) {
  const match = typeof title === "string" ? AGAINST.exec(title.trim()) : null;
  if (!match) return {};
  const y = axisWord(match[1]), x = axisWord(match[2]);
  return x && y ? { x, y } : {};
}
function axisWord(text) {
  const word = text.trim().toLowerCase().replace(/[\s:,.?!]+$/, "");
  return word || void 0;
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
function missingLabels(spec) {
  return spec.x.filter((_, i) => spec.series.every((s) => s.data[i] === null || s.data[i] === void 0)).map(String);
}
function chartScales(spec, bands) {
  if (spec.type === "scatter") {
    const drawn2 = scatterPoints(spec.series);
    return {
      left: scaleFor(drawn2.map((p) => p.y), false),
      right: null,
      x: scaleFor(drawn2.map((p) => p.x), false)
    };
  }
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
  const short2 = !full && abs >= SHORT_FROM;
  const digits = abs >= 1e3 ? 0 : 2;
  const s = short2 ? formatCompact(abs, rupees || usesLakhCrore() ? "en-IN" : void 0) : rupees ? formatIndian(abs, digits) : formatNumber(abs, { digits });
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
  const place2 = `{${name}}`;
  const placeholders = label.match(/\{[^{}]*\}/g) ?? [];
  const named = placeholders.length === 1 ? label.replace(placeholders[0], place2) : label;
  return named.split(place2).map((part) => part.replace(/[{}]/g, "")).join(place2).trim() || void 0;
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
  const count2 = (s2) => Math.floor((to - from) / s2 + 1e-9) + 1;
  let s = step;
  if (count2(s) > MAX_POINTS) s = step * Math.ceil(count2(s) / MAX_POINTS);
  if (!Number.isFinite(count2(s))) return [];
  const n = Math.min(count2(s), MAX_POINTS);
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
import { useId, useMemo as useMemo4, useRef as useRef7, useState as useState10 } from "react";

// src/blocks/chart/geometry.ts
function textWidth(text, size = 11) {
  return text.length * size * 0.6;
}
function xLabelsShown(n, step, minGap) {
  if (n <= 1 || step <= 0) return [0];
  const every = Math.max(1, Math.ceil(minGap / step));
  const shown2 = [];
  for (let i = 0; i < n; i += every) shown2.push(i);
  return shown2;
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
function lineRuns(pts) {
  const runs = [];
  let run = null;
  pts.forEach((p, i) => {
    if (p === null) {
      run = null;
      return;
    }
    if (!run) {
      run = { from: i, pts: [] };
      runs.push(run);
    }
    run.pts.push(p);
  });
  return runs;
}
function linePath(pts, stepped = false) {
  if (stepped) return steppedPath(pts);
  if (pts.length > STRAIGHT_UP_TO) return smoothPath(pts);
  const f = (n) => +n.toFixed(1);
  return pts.map(([x, y], i) => `${i ? "L" : "M"}${f(x)},${f(y)}`).join("");
}
function steppedPath(pts) {
  if (!pts.length) return "";
  const f = (n) => +n.toFixed(1);
  let d = `M${f(pts[0][0])},${f(pts[0][1])}`;
  for (let i = 1; i < pts.length; i++) d += `L${f(pts[i][0])},${f(pts[i - 1][1])}L${f(pts[i][0])},${f(pts[i][1])}`;
  return d;
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
function spreadLabels(ys, gap2 = 14, bottom = Infinity) {
  const order = ys.map((_, i) => i).sort((a, b) => ys[a] - ys[b]);
  const placed = order.map((i) => ys[i]);
  for (let k = 1; k < placed.length; k++) placed[k] = Math.max(placed[k], placed[k - 1] + gap2);
  if (placed.length && placed[placed.length - 1] > bottom) {
    placed[placed.length - 1] = bottom;
    for (let k = placed.length - 2; k >= 0; k--) placed[k] = Math.min(placed[k], placed[k + 1] - gap2);
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
var X_TITLE_ROOM = 16;
var Y_TITLE_ROOM = 14;
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
  const drawn2 = kindToDraw(spec);
  const hasAxis = drawn2 !== "hbar" && drawn2 !== "pie" && drawn2 !== "donut";
  const xRoom = hasAxis && spec.xLabel ? X_TITLE_ROOM : 0;
  const yRoom = hasAxis && spec.yLabel ? Y_TITLE_ROOM : 0;
  const H = (spec.height ?? (slotted ? COLUMNS_H : LINES_H)) + xRoom + yRoom;
  const base = H - BOTTOM - xRoom;
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
  const top = TOP + (valueLabels ? VALUE_ROOM : 0) + yRoom;
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
  return { x: layout.xAt(i), y, title: String(spec.x[i]), rows, note: rows.length ? tipNote(spec, i) : "no data" };
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
var SCATTER_H = 230;
var SCATTER_BOTTOM = 30;
function ticksOf(scale) {
  return niceTicks(scale.min, scale.max);
}
function scatterLayout(spec, width, scales) {
  const xTicks = ticksOf(scales.x ?? { min: 0, max: 1 });
  const yTicks = ticksOf(scales.left);
  const H = SCATTER_H;
  const base = H - SCATTER_BOTTOM;
  const top = TOP + 6;
  const tickRoom = yTicks.length ? TICK_GAP + Math.max(...yTicks.map((t) => textWidth(fmt(t, spec.unit)))) : 0;
  const left = SIDE + tickRoom;
  const right = width - SIDE;
  const x0 = xTicks[0] ?? 0, x1 = xTicks[xTicks.length - 1] ?? 1;
  const y0 = yTicks[0] ?? 0, y1 = yTicks[yTicks.length - 1] ?? 1;
  const xAt = (v) => left + (right - left) * (v - x0) / (x1 - x0 || 1);
  const yAt = (v) => base - (base - top) * (v - y0) / (y1 - y0 || 1);
  const dots = scatterPoints(spec.series).map((p) => ({ ...p, cx: xAt(p.x), cy: yAt(p.y) }));
  return { W: width, H, left, right, top, base, xAt, yAt, xTicks, yTicks, dots };
}
function scatterTip(spec, i, layout) {
  const dot = layout.dots[i];
  const names = axisNames(spec.title);
  const unit = spec.series[dot.series].unit ?? spec.unit;
  return {
    x: dot.cx,
    y: dot.cy,
    title: dot.point.label ?? seriesName(spec.series, dot.series),
    rows: [{
      colour: partColour(dot.series),
      name: `${names.x ?? "x"} ${fmt(dot.x)}`,
      value: `${names.y ?? "y"} ${fmt(dot.y, unit, { full: true })}`
    }]
  };
}
var WATERFALL_VALUE_LABELS = 8;
function waterfallLayout(spec, width) {
  const bars = waterfallBars(spec.series[0]?.points ?? []);
  const n = bars.length;
  const ends = bars.flatMap((b) => b === null ? [] : [b.from, b.to]);
  const ticks = ends.length ? niceTicks(Math.min(0, ...ends), Math.max(0, ...ends)) : [0];
  const H = COLUMNS_H;
  const base = H - BOTTOM;
  const tickRoom = TICK_GAP + Math.max(...ticks.map((t) => textWidth(fmt(t, spec.unit))));
  const left = 4 + tickRoom;
  const right = width - 4;
  const columns = columnLayout(right - left, n, 1);
  const xAt = (i) => left + columns.start + columns.slot * (i + 0.5);
  const drawn2 = bars.filter((b) => b !== null);
  const values = drawn2.map((b) => waterfallValue(b, spec.unit));
  const valueLabels = drawn2.length <= WATERFALL_VALUE_LABELS && values.every((v) => textWidth(v, 11.5) <= columns.slot - 4);
  const top = TOP + (valueLabels ? VALUE_ROOM : 0);
  const yAt = (v) => base - (base - top) * (v - ticks[0]) / (ticks[ticks.length - 1] - ticks[0] || 1);
  const labels2 = spec.x.map((label) => cutAtWord(String(label), Math.max(6, Math.floor((columns.slot - 6) / (11 * 0.6)))));
  return {
    W: width,
    H,
    left,
    right,
    top,
    base,
    slot: columns.slot,
    bar: columns.bar,
    xAt,
    yAt,
    ticks,
    valueLabels,
    labels: labels2,
    bars
  };
}
function waterfallValue(bar, unit) {
  if (bar.total) return fmt(bar.to, unit);
  const step = bar.to - bar.from;
  return `${step > 0 ? "+" : ""}${fmt(step, unit)}`;
}
function waterfallTip(spec, i, layout) {
  const bar = layout.bars[i];
  const unit = spec.series[0]?.unit ?? spec.unit;
  const step = bar.to - bar.from;
  const rise = step >= 0;
  return {
    x: layout.xAt(i),
    y: layout.yAt(Math.max(bar.from, bar.to)),
    title: String(spec.x[i]),
    rows: [{
      colour: bar.total ? partColour(0) : rise ? "var(--hb-good)" : "var(--hb-warn)",
      name: bar.total ? "Total" : rise ? "\u25B2 increase" : "\u25BC decrease",
      value: waterfallValue(bar, unit)
    }],
    note: `balance ${fmt(bar.to, unit, { full: true })}`
  };
}

// src/blocks/chart/useWidth.ts
import { useLayoutEffect, useState as useState4 } from "react";
var UNMEASURED_WIDTH = 560;
function useWidth(ref) {
  const [width, setWidth] = useState4(0);
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
import { useLayoutEffect as useLayoutEffect2, useRef as useRef2, useState as useState5 } from "react";
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
  const card = useRef2(null);
  const [kept, setKept] = useState5(tip);
  if (tip && tip !== kept) setKept(tip);
  const shown2 = tip ?? kept;
  useLayoutEffect2(() => {
    const el = card.current;
    if (!el || !tip) return;
    const box = el.offsetParent;
    const { left, top } = tipPlace(tip.x, tip.y, el.offsetWidth, el.offsetHeight, box?.clientWidth ?? 0);
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
  }, [tip]);
  return /* @__PURE__ */ jsx6("div", { ref: card, className: `hb-tip${tip ? " hb-tip-on" : ""}`, role: "status", "aria-live": "polite", children: shown2 && /* @__PURE__ */ jsxs3(Fragment2, { children: [
    /* @__PURE__ */ jsx6("div", { className: "hb-tip-title", children: shown2.title }),
    shown2.rows.map((row, k) => /* @__PURE__ */ jsxs3("div", { className: "hb-tip-row", children: [
      /* @__PURE__ */ jsx6("i", { style: { background: row.colour } }),
      /* @__PURE__ */ jsx6("span", { className: "hb-tip-name", children: row.name }),
      /* @__PURE__ */ jsx6("b", { className: "hb-tip-value", children: row.value })
    ] }, k)),
    shown2.note && /* @__PURE__ */ jsx6("div", { className: "hb-tip-note", children: shown2.note })
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
      const runs = lineRuns(slotsOf(s.data, layout));
      if (!runs.length) return null;
      const stroke = start !== null ? `url(#change-${gid})` : partColour(k);
      const end = seriesEnds(s.data).last;
      return /* @__PURE__ */ jsxs5("g", { children: [
        runs.filter((r) => r.pts.length > 1).map((r, j) => /* @__PURE__ */ jsx8(
          "path",
          {
            d: linePath(r.pts, spec.stepped),
            fill: "none",
            stroke,
            strokeWidth: one ? 2.25 : 1.75,
            strokeLinejoin: "round",
            strokeLinecap: "round",
            pathLength: 1,
            strokeDasharray: "1",
            strokeDashoffset: "1",
            className: "hb-chart-line hb-chart-draw"
          },
          j
        )),
        runs.filter((r) => r.pts.length === 1 && r.from !== end).map((r, j) => /* @__PURE__ */ jsx8("circle", { cx: r.pts[0][0], cy: r.pts[0][1], r: "2.5", fill: stroke, className: "hb-chart-dot" }, j))
      ] }, k);
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
function slotsOf(data, { xAt, yAt }) {
  return data.map((v, i) => v === null ? null : [xAt(i), yAt(v)]);
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
function GapTick({ x, width, zero }) {
  const w = Math.min(4, width);
  return /* @__PURE__ */ jsx9("rect", { x: x + (width - w) / 2, y: zero - 4, width: w, height: 8, rx: "1", className: "hb-chart-gap" });
}
function Baseline({ layout }) {
  const y = layout.yAt(0);
  return /* @__PURE__ */ jsx9("line", { x1: layout.left, x2: layout.right, y1: y, y2: y, className: "hb-chart-rule-strong" });
}
function BarMarks({ spec, layout, hover }) {
  const { xAt, yAt, bar } = layout;
  const count2 = spec.series.length;
  const zero = yAt(0);
  return /* @__PURE__ */ jsxs6("g", { children: [
    spec.series.map((s, k) => s.data.map((v, i) => {
      const x = xAt(i) - bar * count2 / 2 + k * bar;
      const width = count2 > 1 ? bar - SERIES_GAP : bar;
      if (v === null) {
        return /* @__PURE__ */ jsx9("g", { opacity: shade(hover, i), children: /* @__PURE__ */ jsx9(GapTick, { x, width, zero }) }, `${k}-${i}`);
      }
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
    spec.series[0].data.map((v, i) => v === null ? /* @__PURE__ */ jsx9("g", { opacity: shade(hover, i), children: /* @__PURE__ */ jsx9(GapTick, { x: xAt(i) - bar / 2, width: bar, zero }) }, i) : /* @__PURE__ */ jsx9("path", { d: barPath(xAt(i) - bar / 2, bar, zero, yAt(v)), fill: partColour(0), opacity: shade(hover, i), className: "hb-chart-bar" }, i)),
    /* @__PURE__ */ jsx9(Baseline, { layout }),
    spec.series.slice(1).map((s, j) => {
      const y = layout.yOf(s);
      const slots = s.data.map((v, i) => v === null ? null : [xAt(i), y(v)]);
      const runs = lineRuns(slots);
      if (!runs.length) return null;
      const colour = partColour(j + 1);
      return /* @__PURE__ */ jsxs6("g", { children: [
        runs.filter((r) => r.pts.length > 1).map((r, x) => /* @__PURE__ */ jsx9("path", { d: linePath(r.pts, spec.stepped), fill: "none", stroke: colour, strokeWidth: "2.25", strokeLinejoin: "round", strokeLinecap: "round" }, x)),
        runs.flatMap((r) => r.pts).map(([cx, cy], i) => /* @__PURE__ */ jsx9("circle", { cx, cy, r: "3.5", fill: colour, className: "hb-chart-dot" }, i))
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
  const tops = bands.map((b, i) => b === null ? null : [layout.xAt(i), layout.yAt(b.to)]);
  return /* @__PURE__ */ jsx10("g", { children: lineRuns(tops).filter((run) => run.pts.length > 1).map((run, j) => {
    const bottoms = run.pts.map((_, k) => layout.yAt(bands[run.from + k].from));
    const backAlongBottom = linePath(run.pts.map(([x], k) => [x, bottoms[k]]).reverse()).replace(/^M/, "L");
    const topEdge = linePath(run.pts);
    return /* @__PURE__ */ jsxs7("g", { children: [
      /* @__PURE__ */ jsx10("path", { d: `${topEdge} ${backAlongBottom} Z`, fill: colour, fillOpacity: ".3" }),
      /* @__PURE__ */ jsx10("path", { d: topEdge, fill: "none", stroke: colour, strokeWidth: "2", strokeLinejoin: "round", strokeLinecap: "round" })
    ] }, j);
  }) });
}

// src/blocks/chart/HBarChart.tsx
import { Fragment as Fragment3, useRef as useRef3, useState as useState6 } from "react";
import { jsx as jsx11, jsxs as jsxs8 } from "react/jsx-runtime";
function HBarChart({ spec }) {
  const [tip, setTip] = useState6(null);
  const [picked, setPicked] = useState6(null);
  const box = useRef3(null);
  const tracks = useRef3([]);
  const values = spec.series.flatMap((s) => s.data.filter((v) => v !== null));
  const lo = Math.min(0, ...values);
  const hi = Math.max(0, ...values);
  const span = hi - lo || 1;
  const zeroAt = -lo / span * 100;
  const single = spec.series.length === 1;
  const signed = lo < 0;
  const colourOf3 = (k, v) => {
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
      rows.push({ colour: colourOf3(k, v), name: seriesName(spec.series, k), value: fmt(v, unitOf2(k), { full: true }) });
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
          "aria-label": chartLabel(spec),
          style: spec.height ? { minHeight: spec.height } : void 0,
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
                  background: colourOf3(k, v),
                  opacity: shade2(i)
                } })
              ] }, k);
            }) }),
            /* @__PURE__ */ jsx11("div", { className: "hb-hbar-values", ...rowEvents(i), children: spec.series.map((s, k) => {
              const v = s.data[i] ?? null;
              const tone2 = single && signed && v !== null ? v >= 0 ? " hb-hbar-up" : " hb-hbar-down" : "";
              return /* @__PURE__ */ jsx11("span", { className: `hb-hbar-value${tone2}`, children: v === null ? "\u2013" : fmt(v, unitOf2(k)) }, k);
            }) })
          ] }, i))
        }
      ),
      /* @__PURE__ */ jsx11(ChartTip, { tip })
    ] }),
    spec.xLabel && /* @__PURE__ */ jsx11("div", { className: "hb-chart-axis-note", children: spec.xLabel }),
    spec.caveat && /* @__PURE__ */ jsx11("div", { className: "hb-chart-caveat", children: spec.caveat }),
    spec.source && /* @__PURE__ */ jsx11("div", { className: "hb-chart-source", children: spec.source })
  ] });
}

// src/blocks/chart/PieChart.tsx
import { useRef as useRef4, useState as useState7 } from "react";
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
  const [picked, setPicked] = useState7(null);
  const [tip, setTip] = useState7(null);
  const svg = useRef4(null);
  const box = spec.height ?? BOX;
  const scale = box / BOX;
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
      x: drawing.left - around.left + x * scale,
      y: drawing.top - around.top + y * scale,
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
          width: box,
          height: box,
          viewBox: `0 0 ${BOX} ${BOX}`,
          className: "hb-pie-svg",
          role: "img",
          "aria-label": chartLabel(spec),
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
    spec.caveat && /* @__PURE__ */ jsx12("div", { className: "hb-chart-caveat", children: spec.caveat }),
    spec.source && /* @__PURE__ */ jsx12("div", { className: "hb-chart-source", children: spec.source })
  ] });
}

// src/blocks/chart/ScatterChart.tsx
import { useMemo as useMemo2, useRef as useRef5, useState as useState8 } from "react";
import { jsx as jsx13, jsxs as jsxs10 } from "react/jsx-runtime";
var PICK_RADIUS = 28;
function ScatterChart({ spec }) {
  const plot = useRef5(null);
  const svg = useRef5(null);
  const width = useWidth(plot);
  const [hover, setHover] = useState8(null);
  const scales = useMemo2(() => chartScales(spec, null), [spec]);
  const layout = useMemo2(() => scatterLayout(spec, width, scales), [spec, width, scales]);
  const tip = useMemo2(
    () => hover === null || !layout.dots[hover] ? null : scatterTip(spec, hover, layout),
    [spec, hover, layout]
  );
  function pickAt(e) {
    const r = svg.current?.getBoundingClientRect();
    if (!r || !r.width) return;
    const x = (e.clientX - r.left) / r.width * layout.W;
    const y = (e.clientY - r.top) / r.height * layout.H;
    let best = -1;
    let near = PICK_RADIUS;
    layout.dots.forEach((dot, i) => {
      const away = Math.hypot(dot.cx - x, dot.cy - y);
      if (away <= near) [best, near] = [i, away];
    });
    setHover(best < 0 ? null : best);
  }
  return /* @__PURE__ */ jsxs10("figure", { className: "hb-card hb-chart", children: [
    /* @__PURE__ */ jsx13("figcaption", { className: "hb-chart-head", children: /* @__PURE__ */ jsx13("span", { className: "hb-chart-title", children: spec.title ?? spec.series[0]?.name ?? "Scatter" }) }),
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
          "aria-label": nameOf(spec, layout),
          ...pickKeys(layout.dots.length, hover, setHover),
          onPointerDown: pickAt,
          onPointerMove: (e) => (e.buttons || e.pointerType === "mouse") && pickAt(e),
          onPointerLeave: () => setHover(null),
          children: [
            /* @__PURE__ */ jsx13(Axis, { spec, layout }),
            layout.dots.map((dot, i) => /* @__PURE__ */ jsx13(
              "circle",
              {
                cx: dot.cx,
                cy: dot.cy,
                r: "4",
                fill: partColour(dot.series),
                opacity: hover === null || hover === i ? 1 : 0.55,
                className: "hb-chart-dot",
                children: /* @__PURE__ */ jsx13("title", { children: dotText(spec, dot) })
              },
              `${dot.series}-${i}`
            ))
          ]
        }
      ),
      /* @__PURE__ */ jsx13(ChartTip, { tip })
    ] }),
    spec.series.length > 1 && /* @__PURE__ */ jsx13(ChartLegend, { series: spec.series }),
    spec.source && /* @__PURE__ */ jsx13("div", { className: "hb-chart-source", children: spec.source })
  ] });
}
function Axis({ spec, layout }) {
  return /* @__PURE__ */ jsxs10("g", { "aria-hidden": "true", children: [
    layout.yTicks.map((t) => /* @__PURE__ */ jsxs10("g", { children: [
      /* @__PURE__ */ jsx13("line", { x1: layout.left, x2: layout.right, y1: layout.yAt(t), y2: layout.yAt(t), className: "hb-chart-rule" }),
      /* @__PURE__ */ jsx13("text", { x: layout.left - TICK_GAP, y: layout.yAt(t) + 4, textAnchor: "end", className: "hb-chart-tick", children: fmt(t, spec.unit) })
    ] }, t)),
    /* @__PURE__ */ jsx13("line", { x1: layout.left, x2: layout.right, y1: layout.base, y2: layout.base, className: "hb-chart-rule" }),
    layout.xTicks.map((t) => /* @__PURE__ */ jsx13("text", { x: layout.xAt(t), y: layout.H - 8, textAnchor: "middle", className: "hb-chart-axis", children: fmt(t) }, t))
  ] });
}
function dotText(spec, dot) {
  const names = axisNames(spec.title);
  const where = `${names.x ?? "x"} ${fmt(dot.x)}, ${names.y ?? "y"} ${fmt(dot.y)}`;
  return dot.point.label ? `${where}, ${dot.point.label}` : where;
}
function nameOf(spec, layout) {
  const title = spec.title ?? "Scatter";
  const dots = layout.dots;
  if (!dots.length) return `${title}: no points with two numbers`;
  const names = axisNames(spec.title);
  const spread = (values) => {
    const lo = Math.min(...values), hi = Math.max(...values);
    return lo === hi ? fmt(lo) : `${fmt(lo)} to ${fmt(hi)}`;
  };
  const count2 = `${dots.length} point${dots.length === 1 ? "" : "s"}`;
  return `${title}: ${names.x ?? "x"} ${spread(dots.map((d) => d.x))}, ${names.y ?? "y"} ${spread(dots.map((d) => d.y))}, ${count2}`;
}

// src/blocks/chart/WaterfallChart.tsx
import { useMemo as useMemo3, useRef as useRef6, useState as useState9 } from "react";
import { jsx as jsx14, jsxs as jsxs11 } from "react/jsx-runtime";
function WaterfallChart({ spec }) {
  const plot = useRef6(null);
  const svg = useRef6(null);
  const width = useWidth(plot);
  const [hover, setHover] = useState9(null);
  const layout = useMemo3(() => waterfallLayout(spec, width), [spec, width]);
  const tip = hover === null || !layout.bars[hover] ? null : waterfallTip(spec, hover, layout);
  const unit = spec.series[0]?.unit ?? spec.unit;
  const last = layout.bars.length - 1;
  const shown2 = hover ?? (layout.bars[last] ? last : null);
  const bar = shown2 === null ? null : layout.bars[shown2];
  function pickAt(e) {
    const r = svg.current?.getBoundingClientRect();
    if (!r || !r.width) return;
    const x = (e.clientX - r.left) / r.width * layout.W;
    let best = -1;
    let near = layout.slot / 2;
    layout.bars.forEach((b, i) => {
      if (b === null) return;
      const away = Math.abs(layout.xAt(i) - x);
      if (away <= near) [best, near] = [i, away];
    });
    setHover(best < 0 ? null : best);
  }
  return /* @__PURE__ */ jsxs11("figure", { className: "hb-card hb-chart", children: [
    /* @__PURE__ */ jsx14("figcaption", { className: "hb-chart-head", children: /* @__PURE__ */ jsx14("span", { className: "hb-chart-title", children: spec.title ?? spec.series[0]?.name ?? "Waterfall" }) }),
    spec.figure !== false && bar !== null && /* @__PURE__ */ jsxs11("div", { className: "hb-chart-figure", children: [
      /* @__PURE__ */ jsx14("span", { className: "hb-chart-big", children: fmt(bar.to, unit) }),
      /* @__PURE__ */ jsx14("span", { className: "hb-chart-at", children: spec.x[shown2] })
    ] }),
    /* @__PURE__ */ jsxs11("div", { ref: plot, className: "hb-chart-plot", children: [
      /* @__PURE__ */ jsxs11(
        "svg",
        {
          ref: svg,
          width: "100%",
          height: layout.H,
          viewBox: `0 0 ${layout.W} ${layout.H}`,
          className: "hb-chart-svg",
          role: "img",
          "aria-label": nameOf2(spec, layout),
          ...pickKeys(layout.bars.length, hover, setHover),
          onPointerDown: pickAt,
          onPointerMove: (e) => (e.buttons || e.pointerType === "mouse") && pickAt(e),
          onPointerLeave: () => setHover(null),
          children: [
            /* @__PURE__ */ jsx14(Axis2, { spec, layout }),
            /* @__PURE__ */ jsx14("g", { "aria-hidden": "true", children: layout.bars.map((b, i) => {
              const prev = i ? layout.bars[i - 1] : null;
              if (!b || !prev) return null;
              const y = layout.yAt(prev.to);
              return /* @__PURE__ */ jsx14(
                "line",
                {
                  x1: layout.xAt(i - 1) + layout.bar / 2,
                  x2: layout.xAt(i) - layout.bar / 2,
                  y1: y,
                  y2: y,
                  className: "hb-waterfall-link"
                },
                i
              );
            }) }),
            layout.bars.map((b, i) => b === null ? null : /* @__PURE__ */ jsx14(
              "path",
              {
                d: barPath(layout.xAt(i) - layout.bar / 2, layout.bar, layout.yAt(b.from), layout.yAt(b.to)),
                fill: colourOf(b),
                opacity: hover === null || hover === i ? 1 : 0.55,
                className: "hb-chart-bar",
                children: /* @__PURE__ */ jsx14("title", { children: barText(b, String(spec.x[i]), unit) })
              },
              i
            )),
            layout.valueLabels && layout.bars.map((b, i) => b === null ? null : /* @__PURE__ */ jsx14(
              "text",
              {
                x: layout.xAt(i),
                y: b.to >= b.from ? layout.yAt(b.to) - 6 : layout.yAt(b.to) + 14,
                textAnchor: "middle",
                className: "hb-chart-value",
                children: waterfallValue(b, unit)
              },
              i
            )),
            /* @__PURE__ */ jsx14("g", { "aria-hidden": "true", children: layout.labels.map((label, i) => /* @__PURE__ */ jsx14("text", { x: layout.xAt(i), y: layout.H - 7, textAnchor: "middle", className: "hb-chart-axis", children: label }, i)) })
          ]
        }
      ),
      /* @__PURE__ */ jsx14(ChartTip, { tip })
    ] }),
    spec.source && /* @__PURE__ */ jsx14("div", { className: "hb-chart-source", children: spec.source })
  ] });
}
function colourOf(bar) {
  if (bar.total) return partColour(0);
  return bar.to >= bar.from ? "var(--hb-good)" : "var(--hb-warn)";
}
function Axis2({ spec, layout }) {
  return /* @__PURE__ */ jsxs11("g", { "aria-hidden": "true", children: [
    layout.ticks.map((t) => /* @__PURE__ */ jsxs11("g", { children: [
      /* @__PURE__ */ jsx14("line", { x1: layout.left, x2: layout.right, y1: layout.yAt(t), y2: layout.yAt(t), className: "hb-chart-rule" }),
      /* @__PURE__ */ jsx14("text", { x: layout.left - TICK_GAP, y: layout.yAt(t) + 4, textAnchor: "end", className: "hb-chart-tick", children: fmt(t, spec.unit) })
    ] }, t)),
    /* @__PURE__ */ jsx14("line", { x1: layout.left, x2: layout.right, y1: layout.yAt(0), y2: layout.yAt(0), className: "hb-chart-rule-strong" })
  ] });
}
function barText(bar, label, unit) {
  if (bar.total) return `${label}, total ${fmt(bar.to, unit)}`;
  const step = bar.to - bar.from;
  return `${label}, ${step < 0 ? "minus" : "plus"} ${fmt(Math.abs(step), unit)}, balance ${fmt(bar.to, unit)}`;
}
function nameOf2(spec, layout) {
  const drawn2 = layout.bars.filter((b) => b !== null);
  const title = spec.title ?? "Waterfall";
  if (!drawn2.length) return `${title}: no point with a value`;
  const unit = spec.series[0]?.unit ?? spec.unit;
  return `${title}: ${drawn2.length} of ${spec.x.length} bars, balance ${fmt(drawn2[drawn2.length - 1].to, unit)}`;
}

// src/blocks/chart/Chart.tsx
import { Fragment as Fragment4, jsx as jsx15, jsxs as jsxs12 } from "react/jsx-runtime";
var WIDE_FROM = 60;
function Chart({ spec }) {
  if (spec.type === "pie" || spec.type === "donut") return /* @__PURE__ */ jsx15(PieChart, { spec });
  if (spec.type === "scatter") return /* @__PURE__ */ jsx15(ScatterChart, { spec });
  if (spec.type === "waterfall") return /* @__PURE__ */ jsx15(WaterfallChart, { spec });
  if (kindToDraw(spec) === "hbar") return /* @__PURE__ */ jsx15(HBarChart, { spec });
  return /* @__PURE__ */ jsx15(XYChart, { spec });
}
function XYChart({ spec }) {
  const plot = useRef7(null);
  const svg = useRef7(null);
  const width = useWidth(plot);
  const [hover, setHover] = useState10(null);
  const gid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const n = spec.x.length;
  const piled = spec.type === "stacked" || spec.type === "area";
  const bands = useMemo4(() => piled ? stackSeries(spec.series, n) : null, [spec, n, piled]);
  const scales = useMemo4(() => chartScales(spec, bands), [spec, bands]);
  const layout = useMemo4(() => xyLayout(spec, width, scales), [spec, width, scales]);
  const tip = useMemo4(() => hover === null ? null : xyTip(spec, hover, layout), [spec, hover, layout]);
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
  return /* @__PURE__ */ jsxs12("figure", { className: `hb-card hb-chart${wide ? " hb-chart-wide" : ""}`, children: [
    /* @__PURE__ */ jsx15(Headline, { spec, hover }),
    /* @__PURE__ */ jsxs12("div", { ref: plot, className: "hb-chart-plot", children: [
      /* @__PURE__ */ jsxs12(
        "svg",
        {
          ref: svg,
          width: "100%",
          height: layout.H,
          viewBox: `0 0 ${layout.W} ${layout.H}`,
          className: "hb-chart-svg",
          role: "img",
          "aria-label": chartLabel(spec),
          ...pickKeys(n, hover, setHover),
          onPointerDown: pickAt,
          onPointerMove: (e) => (e.buttons || e.pointerType === "mouse") && pickAt(e),
          onPointerLeave: () => setHover(null),
          children: [
            /* @__PURE__ */ jsx15(XLabels, { spec, layout }),
            /* @__PURE__ */ jsx15(AxisTitles, { spec, layout }),
            spec.type === "line" && /* @__PURE__ */ jsx15(LineMarks, { spec, layout, gid, hover }),
            spec.type === "bar" && /* @__PURE__ */ jsx15(BarMarks, { spec, layout, hover }),
            spec.type === "stacked" && bands && /* @__PURE__ */ jsx15(StackMarks, { bands, layout, hover }),
            spec.type === "area" && bands && /* @__PURE__ */ jsx15(AreaMarks, { bands, layout }),
            spec.type === "combo" && /* @__PURE__ */ jsx15(ComboMarks, { spec, layout, hover }),
            (spec.type === "area" || spec.type === "combo") && hover !== null && /* @__PURE__ */ jsx15(Crosshair, { layout, at: hover })
          ]
        }
      ),
      /* @__PURE__ */ jsx15(ChartTip, { tip })
    ] }),
    multiLegend && /* @__PURE__ */ jsx15(ChartLegend, { series: spec.series }),
    piled && spec.series.length > 1 && /* @__PURE__ */ jsx15(ChartLegend, { series: spec.series, at: hover ?? lastIndex(spec), unit: spec.unit }),
    spec.caveat && /* @__PURE__ */ jsx15("div", { className: "hb-chart-caveat", children: spec.caveat }),
    spec.source && /* @__PURE__ */ jsx15("div", { className: "hb-chart-source", children: spec.source })
  ] });
}
function lastIndex(spec) {
  const { last } = seriesEnds(spec.series[0].data);
  return last < 0 ? spec.x.length - 1 : last;
}
function Headline({ spec, hover }) {
  const piled = spec.type === "stacked" || spec.type === "area";
  const pct = spec.type === "line" ? changePct(spec.series[0].data) : null;
  const shown2 = hover ?? lastIndex(spec);
  const big = piled ? totalAt(spec.series, shown2) : spec.series[0].data[shown2] ?? null;
  const bigUnit = piled ? spec.unit : spec.series[0].unit ?? spec.unit;
  const listed2 = piled ? [] : spec.series.slice(1);
  const withFigure = spec.figure !== false;
  return /* @__PURE__ */ jsxs12(Fragment4, { children: [
    /* @__PURE__ */ jsxs12("figcaption", { className: "hb-chart-head", children: [
      /* @__PURE__ */ jsx15("span", { className: "hb-chart-title", children: spec.title ?? spec.series[0].name ?? "Chart" }),
      pct !== null && withFigure && /* @__PURE__ */ jsxs12("span", { className: `hb-chip ${pct >= 0 ? "hb-chip-good" : "hb-chip-warn"}`, children: [
        pct >= 0 ? "\u25B2" : "\u25BC",
        " ",
        Math.abs(pct).toFixed(1),
        "%"
      ] })
    ] }),
    withFigure && /* @__PURE__ */ jsxs12("div", { className: "hb-chart-figure", children: [
      /* @__PURE__ */ jsx15("span", { className: "hb-chart-big", children: big === null ? "\u2013" : fmt(big, bigUnit) }),
      /* @__PURE__ */ jsxs12("span", { className: "hb-chart-at", children: [
        hover !== null ? spec.x[shown2] : "",
        listed2.map((s, k) => {
          const v = s.data[shown2] ?? null;
          return v === null ? null : /* @__PURE__ */ jsxs12("span", { className: "hb-chart-other", children: [
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
  return /* @__PURE__ */ jsx15("g", { children: layout.xLabels.map((i) => /* @__PURE__ */ jsx15("text", { x: layout.xAt(i), y: layout.base + 19, textAnchor: anchor(i), className: "hb-chart-axis", children: String(spec.x[i]) }, i)) });
}
function AxisTitles({ spec, layout }) {
  return /* @__PURE__ */ jsxs12("g", { children: [
    spec.yLabel && /* @__PURE__ */ jsx15("text", { x: layout.left, y: layout.top - 6, className: "hb-chart-axis", children: spec.yLabel }),
    spec.xLabel && /* @__PURE__ */ jsx15("text", { x: layout.left, y: layout.H - 2, className: "hb-chart-axis", children: spec.xLabel })
  ] });
}

// src/blocks/calculator/Calculator.tsx
import { jsx as jsx16, jsxs as jsxs13 } from "react/jsx-runtime";
function Calculator({ title, inputs, outputs, chart }) {
  const [answers, write] = useStoredValue({
    door: "identity",
    initial: () => Object.fromEntries(inputs.map((x) => [x.id, x.value])),
    revive: (saved) => {
      if (!saved || typeof saved !== "object" || Array.isArray(saved)) return null;
      const known = new Set(inputs.map((x) => x.id));
      const out = {};
      for (const [id, v] of Object.entries(saved)) {
        if (known.has(id) && typeof v === "number" && isFinite(v)) out[id] = v;
      }
      return out;
    },
    stored: (value) => value
  });
  const values = useMemo5(() => new Map(inputs.map((x) => [x.id, answers[x.id] ?? x.value])), [inputs, answers]);
  const move = (id, v) => write({ ...answers, [id]: v });
  const spec = useMemo5(() => chart ? calcChartSpec(chart, values) : null, [chart, values]);
  return /* @__PURE__ */ jsxs13("div", { className: "hb-card hb-calc", children: [
    title && /* @__PURE__ */ jsx16("div", { className: "hb-card-title", children: /* @__PURE__ */ jsx16(InlineText, { text: title }) }),
    inputs.map((input) => /* @__PURE__ */ jsx16(Slider, { input, value: values.get(input.id) ?? input.value, onMove: (v) => move(input.id, v) }, input.id)),
    outputs.length > 0 && /* @__PURE__ */ jsx16("div", { className: "hb-calc-results", children: outputs.map((o, i) => /* @__PURE__ */ jsx16(Result, { output: o, values }, i)) }),
    spec && /* @__PURE__ */ jsx16(Chart, { spec })
  ] });
}
function Slider({ input, value, onMove }) {
  return /* @__PURE__ */ jsxs13("label", { className: "hb-calc-slider", children: [
    /* @__PURE__ */ jsxs13("span", { className: "hb-calc-head", children: [
      /* @__PURE__ */ jsx16("span", { className: "hb-calc-label", children: /* @__PURE__ */ jsx16(InlineText, { text: input.label }) }),
      /* @__PURE__ */ jsx16("span", { className: "hb-calc-value", children: formatWithUnit(value, input.unit) })
    ] }),
    /* @__PURE__ */ jsx16(
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
    /* @__PURE__ */ jsxs13("span", { className: "hb-calc-ends", children: [
      /* @__PURE__ */ jsx16("span", { children: formatWithUnit(input.min, input.unit) }),
      /* @__PURE__ */ jsx16("span", { children: formatWithUnit(input.max, input.unit) })
    ] })
  ] });
}
function Result({ output, values }) {
  const value = evaluate(output.formula, values);
  return /* @__PURE__ */ jsxs13("div", { className: "hb-calc-result", children: [
    /* @__PURE__ */ jsx16("div", { className: "hb-calc-result-label", children: /* @__PURE__ */ jsx16(InlineText, { text: output.label }) }),
    /* @__PURE__ */ jsx16("div", { className: "hb-calc-result-value", "aria-live": "polite", children: value === null ? "\u2013" : formatWithUnit(value, output.unit) })
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

// src/blocks/calendar/Calendar.tsx
import { useContext as useContext4 } from "react";
import { jsx as jsx17, jsxs as jsxs14 } from "react/jsx-runtime";
var parts = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};
var sameDay = (a, b) => a.toDateString() === b.toDateString();
function relativeDay(iso, now) {
  const day = parts(iso);
  if (sameDay(day, now)) return "Today";
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  if (sameDay(day, tomorrow)) return "Tomorrow";
  const days = (day.getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / 864e5;
  if (days > 0 && days < 7) return day.toLocaleDateString("en-GB", { weekday: "long" });
  return `${day.toLocaleDateString("en-GB", { weekday: "short" })} ${day.getDate()} ` + day.toLocaleDateString("en-GB", { month: "short" });
}
function nextEvent(events, iso, now) {
  if (!sameDay(parts(iso), now)) return events[0];
  const hm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  return events.find((e) => (e.end ?? e.start) > hm) ?? events.at(-1);
}
function Calendar({ date, title, events, week, ask }) {
  const { fill } = useContext4(BlockActions);
  const now = /* @__PURE__ */ new Date();
  const day = parts(date);
  const next = nextEvent(events, date, now);
  return /* @__PURE__ */ jsxs14("div", { className: "hb-card hb-cal", children: [
    /* @__PURE__ */ jsxs14("div", { className: "hb-cal-date", children: [
      /* @__PURE__ */ jsx17("span", { className: "hb-cal-weekday", children: day.toLocaleDateString("en-GB", { weekday: "long" }) }),
      /* @__PURE__ */ jsx17("span", { className: "hb-cal-day", children: day.getDate() }),
      /* @__PURE__ */ jsx17("span", { className: "hb-cal-month", children: day.toLocaleDateString("en-GB", { month: "long", year: "numeric" }) })
    ] }),
    /* @__PURE__ */ jsxs14("div", { className: "hb-cal-mid", children: [
      /* @__PURE__ */ jsxs14("div", { className: "hb-cal-next-row", children: [
        title && /* @__PURE__ */ jsx17("span", { className: "hb-cal-title", children: title }),
        next && /* @__PURE__ */ jsxs14("span", { className: "hb-cal-next", children: [
          /* @__PURE__ */ jsx17("span", { className: "hb-cal-next-when", children: relativeDay(date, now) }),
          /* @__PURE__ */ jsx17("span", { className: "hb-cal-next-time", children: next.end ? `${next.start}\u2013${next.end}` : next.start }),
          /* @__PURE__ */ jsx17("span", { className: "hb-cal-next-title", children: next.title })
        ] }),
        ask && /* @__PURE__ */ jsxs14("button", { type: "button", className: "hb-cal-ask", onClick: () => fill(ask), children: [
          /* @__PURE__ */ jsx17(Icon, { name: "spark", size: 14 }),
          " Ask about it"
        ] })
      ] }),
      events.length ? /* @__PURE__ */ jsx17("ul", { className: "hb-cal-events", children: events.map((e, i) => /* @__PURE__ */ jsxs14("li", { title: e.place, children: [
        /* @__PURE__ */ jsx17("span", { className: "hb-cal-event-time", children: e.start }),
        /* @__PURE__ */ jsx17("span", { className: "hb-cal-event-title", children: e.title })
      ] }, i)) }) : /* @__PURE__ */ jsx17("div", { className: "hb-cal-empty", children: "Nothing planned" })
    ] }),
    week.length > 0 && /* @__PURE__ */ jsx17("ul", { className: "hb-cal-week", "aria-label": "This week", children: week.map((d) => {
      const wd = parts(d.date);
      const cls = [d.date === date ? "is-selected" : "", d.count > 0 ? "has-events" : ""].filter(Boolean).join(" ");
      return /* @__PURE__ */ jsxs14(
        "li",
        {
          className: cls,
          "aria-label": `${wd.toLocaleDateString("en-GB", { weekday: "long", day: "numeric" })}: ${d.count} events`,
          children: [
            /* @__PURE__ */ jsx17("span", { children: wd.toLocaleDateString("en-GB", { weekday: "narrow" }) }),
            /* @__PURE__ */ jsx17("b", { children: wd.getDate() }),
            /* @__PURE__ */ jsx17("i", { "aria-hidden": "true" })
          ]
        },
        d.date
      );
    }) })
  ] });
}

// src/blocks/calendar/read.ts
var DAY = /^\d{4}-\d{2}-\d{2}$/;
function hhmm(v) {
  const text = firstText([v], 40);
  if (!text) return void 0;
  const m = /(?:T|^)(\d{1,2}):(\d{2})/.exec(text);
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : void 0;
}
var dayOf = (v) => {
  const text = firstText([v], 40)?.slice(0, 10);
  return text && DAY.test(text) ? text : void 0;
};
function readCalendar(raw, here) {
  const date = dayOf(raw.date ?? raw.day);
  if (!date) return here.drop("calendar needs date as YYYY-MM-DD");
  const events = [];
  (firstList([raw.events, raw.items]) ?? []).forEach((e, i) => {
    const title = firstText([e?.title, e?.name], 80);
    const start = hhmm(e?.start ?? e?.time);
    if (!title || !start) {
      here.at("events").at(i).drop("event needs a title and a start");
      return;
    }
    events.push(clean({ title, start, end: hhmm(e?.end), place: firstText([e?.place, e?.location], 60) }));
  });
  const week = [];
  (firstList([raw.week]) ?? []).forEach((d) => {
    const day = dayOf(d?.date);
    if (day) week.push({ date: day, count: Math.max(0, num(d?.count) ?? 0) });
  });
  return clean({
    type: "calendar",
    date,
    title: firstText([raw.title], 60),
    events: keepFirst(events.sort((a, b) => a.start.localeCompare(b.start)), 12, here, "events"),
    week: keepFirst(week, 7, here, "week"),
    ask: firstText([raw.ask], 120)
  });
}

// src/blocks/callout/Callout.tsx
import { jsx as jsx18, jsxs as jsxs15 } from "react/jsx-runtime";
var TONE_ICON = { info: "info", tip: "spark", warn: "alert" };
function Callout({ tone: tone2, title, text }) {
  return /* @__PURE__ */ jsxs15("div", { className: `hb-callout hb-callout-${tone2}`, children: [
    /* @__PURE__ */ jsx18("span", { className: "hb-callout-icon", children: /* @__PURE__ */ jsx18(Icon, { name: TONE_ICON[tone2], size: 17, stroke: 2.2 }) }),
    /* @__PURE__ */ jsxs15("div", { className: "hb-callout-body", children: [
      title && /* @__PURE__ */ jsx18("div", { className: "hb-callout-title", children: /* @__PURE__ */ jsx18(InlineText, { text: title }) }),
      /* @__PURE__ */ jsx18("div", { children: /* @__PURE__ */ jsx18(InlineText, { text }) })
    ] })
  ] });
}

// src/blocks/upnext/UpNext.tsx
import { useContext as useContext5 } from "react";

// src/lib/EventArt.tsx
import { useId as useId2 } from "react";
import { jsx as jsx19, jsxs as jsxs16 } from "react/jsx-runtime";
var KIND_BG = {
  medical: { day: ["#d9f4ee", "#c4e2f4"], night: ["#12403f", "#183a5c"] },
  meeting: { day: ["#e4e7ff", "#ccd6ff"], night: ["#23285e", "#2e2f72"] },
  call: { day: ["#dcebff", "#cbe3ff"], night: ["#173a63", "#1c4f7a"] },
  birthday: { day: ["#ffe2ea", "#ffd6bd"], night: ["#5a2236", "#6b3426"] },
  celebration: { day: ["#ffe6f1", "#e8daff"], night: ["#4f2347", "#3a2a6b"] },
  travel: { day: ["#d8edff", "#ffe6cc"], night: ["#173a63", "#5b3a24"] },
  meal: { day: ["#ffecd8", "#ffd9c4"], night: ["#5a3320", "#5a2a2a"] },
  fitness: { day: ["#e0f6e3", "#cdeef0"], night: ["#164a35", "#154548"] },
  card: { day: ["#ece6ff", "#fbe1ea"], night: ["#34296b", "#5a2440"] },
  bill: { day: ["#efe9ff", "#e2ecff"], night: ["#2f2a66", "#23366b"] },
  insurance: { day: ["#dff2eb", "#e6ecff"], night: ["#144636", "#263a66"] },
  delivery: { day: ["#fff0d6", "#f4e1c8"], night: ["#4f3a18", "#4a3423"] },
  school: { day: ["#fff4cc", "#e0eeff"], night: ["#4d4314", "#1f3b63"] },
  show: { day: ["#f3dcff", "#ffd8e8"], night: ["#4a2268", "#5c2242"] },
  general: { day: ["#eef0f6", "#e5e0f5"], night: ["#2a2d3e", "#332c4a"] }
};
function kindVars(kind) {
  const k = KIND_BG[kind] ?? KIND_BG.general;
  return { "--ka": k.day[0], "--kb": k.day[1], "--kda": k.night[0], "--kdb": k.night[1] };
}
function EventArt({ kind, size = 120 }) {
  const id = useId2().replace(/[^a-zA-Z0-9]/g, "");
  const g = (n) => `url(#${id}${n})`;
  return /* @__PURE__ */ jsxs16("svg", { width: size, height: size, viewBox: "0 0 120 120", "aria-hidden": "true", children: [
    /* @__PURE__ */ jsxs16("defs", { children: [
      /* @__PURE__ */ jsxs16("linearGradient", { id: `${id}a`, x1: "0", y1: "0", x2: "1", y2: "1", children: [
        /* @__PURE__ */ jsx19("stop", { offset: "0", stopColor: "#ffffff" }),
        /* @__PURE__ */ jsx19("stop", { offset: "1", stopColor: "#dfe3ee" })
      ] }),
      /* @__PURE__ */ jsxs16("linearGradient", { id: `${id}teal`, x1: "0", y1: "0", x2: "1", y2: "1", children: [
        /* @__PURE__ */ jsx19("stop", { offset: "0", stopColor: "#5fd3c4" }),
        /* @__PURE__ */ jsx19("stop", { offset: "1", stopColor: "#2a8fb0" })
      ] }),
      /* @__PURE__ */ jsxs16("linearGradient", { id: `${id}metal`, x1: "0", y1: "0", x2: "1", y2: "1", children: [
        /* @__PURE__ */ jsx19("stop", { offset: "0", stopColor: "#f4f6fa" }),
        /* @__PURE__ */ jsx19("stop", { offset: ".5", stopColor: "#b9c1cf" }),
        /* @__PURE__ */ jsx19("stop", { offset: "1", stopColor: "#7f8898" })
      ] }),
      /* @__PURE__ */ jsxs16("linearGradient", { id: `${id}navy`, x1: "0", y1: "0", x2: "0", y2: "1", children: [
        /* @__PURE__ */ jsx19("stop", { offset: "0", stopColor: "#5a6ad8" }),
        /* @__PURE__ */ jsx19("stop", { offset: "1", stopColor: "#2f3a8f" })
      ] }),
      /* @__PURE__ */ jsxs16("linearGradient", { id: `${id}pink`, x1: "0", y1: "0", x2: "0", y2: "1", children: [
        /* @__PURE__ */ jsx19("stop", { offset: "0", stopColor: "#ffb6c8" }),
        /* @__PURE__ */ jsx19("stop", { offset: "1", stopColor: "#f07a9b" })
      ] }),
      /* @__PURE__ */ jsxs16("linearGradient", { id: `${id}cream`, x1: "0", y1: "0", x2: "0", y2: "1", children: [
        /* @__PURE__ */ jsx19("stop", { offset: "0", stopColor: "#fff6e6" }),
        /* @__PURE__ */ jsx19("stop", { offset: "1", stopColor: "#f6dcb8" })
      ] }),
      /* @__PURE__ */ jsxs16("linearGradient", { id: `${id}gold`, x1: "0", y1: "0", x2: "1", y2: "1", children: [
        /* @__PURE__ */ jsx19("stop", { offset: "0", stopColor: "#ffe08a" }),
        /* @__PURE__ */ jsx19("stop", { offset: "1", stopColor: "#f2a33a" })
      ] }),
      /* @__PURE__ */ jsxs16("linearGradient", { id: `${id}sky`, x1: "0", y1: "0", x2: "1", y2: "1", children: [
        /* @__PURE__ */ jsx19("stop", { offset: "0", stopColor: "#7cc4ff" }),
        /* @__PURE__ */ jsx19("stop", { offset: "1", stopColor: "#3f7de0" })
      ] }),
      /* @__PURE__ */ jsxs16("linearGradient", { id: `${id}violet`, x1: "0", y1: "0", x2: "1", y2: "1", children: [
        /* @__PURE__ */ jsx19("stop", { offset: "0", stopColor: "#b7a3ff" }),
        /* @__PURE__ */ jsx19("stop", { offset: "1", stopColor: "#6f5ae6" })
      ] }),
      /* @__PURE__ */ jsxs16("linearGradient", { id: `${id}green`, x1: "0", y1: "0", x2: "1", y2: "1", children: [
        /* @__PURE__ */ jsx19("stop", { offset: "0", stopColor: "#8be0a4" }),
        /* @__PURE__ */ jsx19("stop", { offset: "1", stopColor: "#2fae86" })
      ] }),
      /* @__PURE__ */ jsxs16("linearGradient", { id: `${id}kraft`, x1: "0", y1: "0", x2: "1", y2: "1", children: [
        /* @__PURE__ */ jsx19("stop", { offset: "0", stopColor: "#e9c592" }),
        /* @__PURE__ */ jsx19("stop", { offset: "1", stopColor: "#c08a52" })
      ] }),
      /* @__PURE__ */ jsxs16("linearGradient", { id: `${id}coral`, x1: "0", y1: "0", x2: "1", y2: "1", children: [
        /* @__PURE__ */ jsx19("stop", { offset: "0", stopColor: "#ffb08a" }),
        /* @__PURE__ */ jsx19("stop", { offset: "1", stopColor: "#f0636b" })
      ] })
    ] }),
    /* @__PURE__ */ jsx19("ellipse", { cx: "60", cy: "108", rx: "34", ry: "5", fill: "rgba(40,30,60,.12)" }),
    art(kind, g)
  ] });
}
function art(kind, g) {
  switch (kind) {
    case "medical":
      return /* @__PURE__ */ jsxs16("g", { children: [
        /* @__PURE__ */ jsx19("path", { d: "M36 18 C30 40 34 56 52 60 C70 56 74 40 68 18", fill: "none", stroke: g("teal"), strokeWidth: "6", strokeLinecap: "round" }),
        /* @__PURE__ */ jsx19("circle", { cx: "36", cy: "16", r: "5", fill: g("metal") }),
        /* @__PURE__ */ jsx19("circle", { cx: "68", cy: "16", r: "5", fill: g("metal") }),
        /* @__PURE__ */ jsx19("path", { d: "M52 60 C52 76 58 88 76 88", fill: "none", stroke: g("teal"), strokeWidth: "6", strokeLinecap: "round" }),
        /* @__PURE__ */ jsx19("circle", { cx: "84", cy: "86", r: "14", fill: g("metal") }),
        /* @__PURE__ */ jsx19("circle", { cx: "84", cy: "86", r: "8", fill: "#dfe6ef", stroke: "#9aa4b4", strokeWidth: "1.5" }),
        /* @__PURE__ */ jsx19("circle", { cx: "80", cy: "82", r: "2.5", fill: "#fff", opacity: ".9" })
      ] });
    case "meeting":
      return /* @__PURE__ */ jsxs16("g", { children: [
        /* @__PURE__ */ jsx19("rect", { x: "46", y: "22", width: "28", height: "16", rx: "6", fill: "none", stroke: "#3a4594", strokeWidth: "5" }),
        /* @__PURE__ */ jsx19("rect", { x: "20", y: "34", width: "80", height: "58", rx: "12", fill: g("navy") }),
        /* @__PURE__ */ jsx19("rect", { x: "20", y: "34", width: "80", height: "22", rx: "12", fill: "#6c7ce6", opacity: ".55" }),
        /* @__PURE__ */ jsx19("rect", { x: "53", y: "52", width: "14", height: "12", rx: "3", fill: g("gold") }),
        /* @__PURE__ */ jsx19("path", { d: "M26 40 h68", stroke: "#fff", strokeOpacity: ".35", strokeWidth: "2", strokeLinecap: "round" })
      ] });
    case "call":
      return /* @__PURE__ */ jsxs16("g", { children: [
        /* @__PURE__ */ jsx19("rect", { x: "16", y: "36", width: "64", height: "48", rx: "12", fill: g("sky") }),
        /* @__PURE__ */ jsx19("path", { d: "M80 52 L104 38 V82 L80 68 Z", fill: "#2f63c4" }),
        /* @__PURE__ */ jsx19("circle", { cx: "34", cy: "50", r: "5", fill: "#fff", opacity: ".85" }),
        /* @__PURE__ */ jsx19("path", { d: "M24 44 h22", stroke: "#fff", strokeOpacity: ".4", strokeWidth: "2", strokeLinecap: "round" })
      ] });
    case "birthday":
      return /* @__PURE__ */ jsxs16("g", { children: [
        /* @__PURE__ */ jsx19("rect", { x: "26", y: "66", width: "68", height: "30", rx: "8", fill: g("pink") }),
        /* @__PURE__ */ jsx19("path", { d: "M26 72 q8 8 17 0 t17 0 t17 0 t17 0", fill: "#fff4f7" }),
        /* @__PURE__ */ jsx19("rect", { x: "36", y: "44", width: "48", height: "24", rx: "7", fill: g("cream") }),
        /* @__PURE__ */ jsx19("path", { d: "M36 50 q6 6 12 0 t12 0 t12 0 t12 0", fill: "#fff" }),
        [48, 60, 72].map((x) => /* @__PURE__ */ jsxs16("g", { children: [
          /* @__PURE__ */ jsx19("rect", { x: x - 2.5, y: "28", width: "5", height: "16", rx: "2", fill: x === 60 ? "#7cc4ff" : "#b7a3ff" }),
          /* @__PURE__ */ jsx19("path", { d: `M${x} 18 q4 5 0 9 q-4 -4 0 -9`, fill: g("gold") })
        ] }, x)),
        /* @__PURE__ */ jsxs16("g", { transform: "translate(96 32)", children: [
          [0, 72, 144, 216, 288].map((r) => /* @__PURE__ */ jsx19("ellipse", { cx: "0", cy: "-7", rx: "4.5", ry: "7", fill: "#ff8fb0", transform: `rotate(${r})` }, r)),
          /* @__PURE__ */ jsx19("circle", { r: "4", fill: g("gold") })
        ] })
      ] });
    case "celebration":
      return /* @__PURE__ */ jsxs16("g", { children: [
        /* @__PURE__ */ jsx19("rect", { x: "24", y: "50", width: "72", height: "46", rx: "8", fill: g("violet") }),
        /* @__PURE__ */ jsx19("rect", { x: "20", y: "38", width: "80", height: "18", rx: "6", fill: "#9b86f5" }),
        /* @__PURE__ */ jsx19("rect", { x: "55", y: "38", width: "10", height: "58", fill: g("gold") }),
        /* @__PURE__ */ jsx19("path", { d: "M60 38 C44 18 30 30 46 38 Z M60 38 C76 18 90 30 74 38 Z", fill: g("gold") })
      ] });
    case "travel":
      return /* @__PURE__ */ jsxs16("g", { children: [
        /* @__PURE__ */ jsx19("path", { d: "M20 86 a14 14 0 0 1 22 -12 a18 18 0 0 1 34 4 a12 12 0 0 1 4 24 H26 a12 12 0 0 1 -6 -16 z", fill: "#ffffff", opacity: ".95" }),
        /* @__PURE__ */ jsxs16("g", { transform: "rotate(-18 60 46)", children: [
          /* @__PURE__ */ jsx19("path", { d: "M14 50 C40 44 80 44 104 48 C110 50 110 54 104 56 C80 60 40 60 14 54 Z", fill: g("sky") }),
          /* @__PURE__ */ jsx19("path", { d: "M54 50 L40 24 L50 24 L74 50 Z M54 56 L44 76 L54 76 L72 56 Z", fill: "#2f63c4" }),
          /* @__PURE__ */ jsx19("path", { d: "M18 50 L10 38 L18 38 L28 50 Z", fill: "#2f63c4" }),
          [66, 74, 82, 90].map((x) => /* @__PURE__ */ jsx19("circle", { cx: x, cy: "50", r: "2", fill: "#fff" }, x))
        ] })
      ] });
    case "meal":
      return /* @__PURE__ */ jsxs16("g", { children: [
        /* @__PURE__ */ jsx19("path", { d: "M28 50 h56 v26 a22 22 0 0 1 -22 22 h-12 a22 22 0 0 1 -22 -22 z", fill: g("coral") }),
        /* @__PURE__ */ jsx19("path", { d: "M84 56 a12 12 0 0 1 0 24", fill: "none", stroke: "#e5556a", strokeWidth: "6" }),
        /* @__PURE__ */ jsx19("ellipse", { cx: "56", cy: "50", rx: "28", ry: "5", fill: "#7a3b2a", opacity: ".8" }),
        [44, 56, 68].map((x) => /* @__PURE__ */ jsx19("path", { d: `M${x} 40 q-6 -8 0 -14 q6 -6 0 -14`, fill: "none", stroke: "#c9b6d8", strokeWidth: "3", strokeLinecap: "round" }, x))
      ] });
    case "fitness":
      return /* @__PURE__ */ jsxs16("g", { transform: "rotate(-20 60 60)", children: [
        /* @__PURE__ */ jsx19("rect", { x: "34", y: "56", width: "52", height: "8", rx: "4", fill: g("metal") }),
        /* @__PURE__ */ jsx19("rect", { x: "18", y: "40", width: "16", height: "40", rx: "5", fill: g("green") }),
        /* @__PURE__ */ jsx19("rect", { x: "86", y: "40", width: "16", height: "40", rx: "5", fill: g("green") }),
        /* @__PURE__ */ jsx19("rect", { x: "10", y: "48", width: "10", height: "24", rx: "4", fill: "#2a9e7b" }),
        /* @__PURE__ */ jsx19("rect", { x: "100", y: "48", width: "10", height: "24", rx: "4", fill: "#2a9e7b" })
      ] });
    case "card":
      return /* @__PURE__ */ jsxs16("g", { children: [
        /* @__PURE__ */ jsx19("path", { d: "M58 16 h36 v70 l-6 -4 l-6 4 l-6 -4 l-6 4 l-6 -4 l-6 4 z", fill: "#fff", stroke: "#e3dcf2" }),
        [30, 40, 50].map((y) => /* @__PURE__ */ jsx19("path", { d: `M64 ${y} h24`, stroke: "#c9c1e0", strokeWidth: "3", strokeLinecap: "round" }, y)),
        /* @__PURE__ */ jsxs16("g", { transform: "rotate(-12 50 70)", children: [
          /* @__PURE__ */ jsx19("rect", { x: "12", y: "50", width: "78", height: "48", rx: "9", fill: g("violet") }),
          /* @__PURE__ */ jsx19("rect", { x: "12", y: "62", width: "78", height: "9", fill: "#4a3bb0", opacity: ".7" }),
          /* @__PURE__ */ jsx19("rect", { x: "22", y: "78", width: "16", height: "11", rx: "2.5", fill: g("gold") }),
          /* @__PURE__ */ jsx19("path", { d: "M56 86 h24", stroke: "#fff", strokeOpacity: ".7", strokeWidth: "3", strokeLinecap: "round" })
        ] })
      ] });
    case "bill":
      return /* @__PURE__ */ jsxs16("g", { children: [
        /* @__PURE__ */ jsx19("path", { d: "M30 14 h60 v84 l-7.5 -6 l-7.5 6 l-7.5 -6 l-7.5 6 l-7.5 -6 l-7.5 6 l-7.5 -6 l-7.5 6 z", fill: "#fff", stroke: "#dfe3f0" }),
        /* @__PURE__ */ jsx19("circle", { cx: "60", cy: "40", r: "15", fill: g("violet") }),
        /* @__PURE__ */ jsx19("path", { d: "M60 30 v20 M65 35.5 c0 -2.5 -2.2 -3.5 -5 -3.5 c-3 0 -5 1.5 -5 3.8 c0 5.7 10 2.7 10 8.4 c0 2.4 -2.2 3.8 -5 3.8 c-2.8 0 -5 -1.1 -5 -3.6", fill: "none", stroke: "#fff", strokeWidth: "2.5", strokeLinecap: "round", strokeLinejoin: "round" }),
        [64, 72, 80].map((y, i) => /* @__PURE__ */ jsx19("path", { d: `M40 ${y} h${i === 2 ? 22 : 40}`, stroke: "#cfd4e6", strokeWidth: "3", strokeLinecap: "round" }, y))
      ] });
    case "insurance":
      return /* @__PURE__ */ jsxs16("g", { children: [
        /* @__PURE__ */ jsx19("path", { d: "M60 14 L94 26 V54 C94 78 78 94 60 102 C42 94 26 78 26 54 V26 Z", fill: g("green") }),
        /* @__PURE__ */ jsx19("path", { d: "M60 22 L86 31 V54 C86 73 74 86 60 93 Z", fill: "#fff", opacity: ".18" }),
        /* @__PURE__ */ jsx19("path", { d: "M44 58 L56 70 L78 46", fill: "none", stroke: "#fff", strokeWidth: "7", strokeLinecap: "round", strokeLinejoin: "round" })
      ] });
    case "delivery":
      return /* @__PURE__ */ jsxs16("g", { children: [
        /* @__PURE__ */ jsx19("path", { d: "M60 18 L100 36 V82 L60 100 L20 82 V36 Z", fill: g("kraft") }),
        /* @__PURE__ */ jsx19("path", { d: "M20 36 L60 54 L100 36", fill: "none", stroke: "#a86f3a", strokeWidth: "2" }),
        /* @__PURE__ */ jsx19("path", { d: "M60 54 V100", stroke: "#a86f3a", strokeWidth: "2" }),
        /* @__PURE__ */ jsx19("path", { d: "M40 27 L80 45 V60 L72 56 V49 L33 31 Z", fill: "#f6e2bf" })
      ] });
    case "school":
      return /* @__PURE__ */ jsxs16("g", { children: [
        /* @__PURE__ */ jsx19("path", { d: "M60 24 L108 44 L60 64 L12 44 Z", fill: g("navy") }),
        /* @__PURE__ */ jsx19("path", { d: "M32 54 V76 C32 84 88 84 88 76 V54 L60 66 Z", fill: "#3a4594" }),
        /* @__PURE__ */ jsx19("path", { d: "M100 47 V74", stroke: g("gold"), strokeWidth: "3" }),
        /* @__PURE__ */ jsx19("circle", { cx: "100", cy: "78", r: "5", fill: g("gold") })
      ] });
    case "show":
      return /* @__PURE__ */ jsxs16("g", { transform: "rotate(-10 60 60)", children: [
        /* @__PURE__ */ jsx19("path", { d: "M14 36 h92 v14 a10 10 0 0 0 0 20 v14 h-92 v-14 a10 10 0 0 0 0 -20 z", fill: g("coral") }),
        /* @__PURE__ */ jsx19("path", { d: "M78 38 v44", stroke: "#fff", strokeOpacity: ".7", strokeWidth: "2.5", strokeDasharray: "4 5" }),
        /* @__PURE__ */ jsx19("path", { d: "M30 52 h36 M30 64 h24", stroke: "#fff", strokeOpacity: ".85", strokeWidth: "4", strokeLinecap: "round" }),
        /* @__PURE__ */ jsx19("path", { d: "M92 52 l3 6 6 1 -4.5 4 1 6 -5.5 -3 -5.5 3 1 -6 -4.5 -4 6 -1 z", fill: g("gold") })
      ] });
    default:
      return /* @__PURE__ */ jsxs16("g", { children: [
        /* @__PURE__ */ jsx19("rect", { x: "22", y: "24", width: "76", height: "74", rx: "14", fill: "#fff", stroke: "#e1e4ef" }),
        /* @__PURE__ */ jsx19("path", { d: "M22 38 a14 14 0 0 1 14 -14 h48 a14 14 0 0 1 14 14 v8 h-76 z", fill: g("coral") }),
        /* @__PURE__ */ jsx19("rect", { x: "38", y: "16", width: "6", height: "16", rx: "3", fill: "#8a91a6" }),
        /* @__PURE__ */ jsx19("rect", { x: "76", y: "16", width: "6", height: "16", rx: "3", fill: "#8a91a6" }),
        [0, 1, 2].map((r) => [0, 1, 2, 3].map((c) => /* @__PURE__ */ jsx19("rect", { x: 34 + c * 14, y: 56 + r * 12, width: "8", height: "6", rx: "2", fill: r === 1 && c === 2 ? "#f0636b" : "#d8dceb" }, `${r}${c}`)))
      ] });
  }
}

// src/blocks/upnext/UpNext.tsx
import { jsx as jsx20, jsxs as jsxs17 } from "react/jsx-runtime";
var dayOf2 = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};
function Card({ item, compact }) {
  const { fill } = useContext5(BlockActions);
  const day = dayOf2(item.date);
  return /* @__PURE__ */ jsxs17(
    "button",
    {
      type: "button",
      className: "hb-up-card",
      style: kindVars(item.kind),
      onClick: () => fill(item.ask ?? `Tell me about ${item.title}`),
      children: [
        /* @__PURE__ */ jsxs17("span", { className: "hb-up-top", children: [
          /* @__PURE__ */ jsxs17("span", { children: [
            /* @__PURE__ */ jsxs17("span", { className: "hb-up-weekday", children: [
              day.toLocaleDateString("en-GB", { weekday: "short" }),
              item.source && /* @__PURE__ */ jsx20("span", { className: "hb-up-source", title: item.source === "mail" ? "From mail" : "From calendar", children: /* @__PURE__ */ jsx20(Icon, { name: item.source === "mail" ? "mail" : "cal", size: 11, stroke: 2.4 }) })
            ] }),
            /* @__PURE__ */ jsx20("span", { className: "hb-up-day", children: day.getDate() })
          ] }),
          /* @__PURE__ */ jsx20(EventArt, { kind: item.kind, size: compact ? 36 : 56 })
        ] }),
        /* @__PURE__ */ jsx20("span", { className: "hb-up-title", children: item.title }),
        item.state && item.stateText && /* @__PURE__ */ jsx20("span", { className: `hb-up-state hb-up-state-${item.state}`, children: item.stateText }),
        (item.time || item.amount) && /* @__PURE__ */ jsx20("span", { className: "hb-up-meta", children: item.time ?? item.amount })
      ]
    }
  );
}
function UpNext({ title, items, compact }) {
  return /* @__PURE__ */ jsxs17("div", { className: "hb-up", children: [
    title && /* @__PURE__ */ jsx20("div", { className: "hb-up-heading", children: title }),
    /* @__PURE__ */ jsx20("div", { className: compact ? "hb-up-row hb-up-compact" : "hb-up-row", children: items.map((item, i) => /* @__PURE__ */ jsx20(Card, { item, compact }, i)) })
  ] });
}

// src/blocks/upnext/read.ts
var STATES = ["overdue", "today", "soon"];
var ALIASES = {
  flight: "travel",
  trip: "travel",
  train: "travel",
  appointment: "medical",
  dentist: "medical",
  doctor: "medical",
  order: "delivery",
  package: "delivery",
  parcel: "delivery",
  shopping: "delivery",
  payment: "bill",
  invoice: "bill",
  dinner: "meal",
  lunch: "meal",
  brunch: "meal",
  gym: "fitness",
  workout: "fitness",
  run: "fitness",
  wedding: "celebration",
  party: "celebration",
  concert: "show",
  event: "show",
  class: "school"
};
function kindOf(v) {
  const word = firstText([v], 30)?.toLowerCase() ?? "";
  if (word in KIND_BG) return word;
  return ALIASES[word] ?? "general";
}
function readUpNext(raw, here) {
  const items = [];
  (firstList([raw.items, raw.events]) ?? []).forEach((it, i) => {
    const date = firstText([it?.date], 40)?.slice(0, 10);
    const title = firstText([it?.title, it?.name], 80);
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !title) {
      here.at("items").at(i).drop("item needs a date and a title");
      return;
    }
    const source = it?.source === "mail" || it?.source === "calendar" ? it.source : void 0;
    const state = STATES.includes(it?.state) ? it.state : void 0;
    items.push(clean({
      date,
      title,
      kind: kindOf(it?.kind),
      time: firstText([it?.time], 20),
      amount: firstTextOrNumber([it?.amount], 20),
      source,
      ask: firstText([it?.ask], 160),
      state,
      stateText: state ? firstText([it?.stateText], 40) : void 0
    }));
  });
  if (!items.length) return here.drop("upnext has no item with a date and a title");
  return clean({
    type: "upnext",
    title: firstText([raw.title], 60),
    items: keepFirst(items, 12, here, "items"),
    compact: raw.compact === true ? true : void 0
  });
}

// src/blocks/weather/Weather.tsx
import { jsx as jsx21, jsxs as jsxs18 } from "react/jsx-runtime";
var deg = (v) => `${Math.round(v)}\xB0`;
function Weather({ temp, place: place2, condition, high, low }) {
  const range = [high !== void 0 ? `High ${deg(high)}` : null, low !== void 0 ? `${deg(low)} tonight` : null].filter(Boolean).join(" \xB7 ");
  return /* @__PURE__ */ jsxs18("div", { className: "hb-card hb-weather", children: [
    /* @__PURE__ */ jsx21("span", { className: "hb-weather-temp", children: deg(temp) }),
    /* @__PURE__ */ jsxs18("span", { className: "hb-weather-text", children: [
      /* @__PURE__ */ jsx21("span", { className: "hb-weather-where", children: condition ? `${condition} in ${place2}` : place2 }),
      range && /* @__PURE__ */ jsx21("span", { className: "hb-weather-range", children: range })
    ] })
  ] });
}

// src/blocks/weather/read.ts
function readWeather(raw, here) {
  const temp = num(raw.temp);
  const place2 = firstText([raw.place, raw.city], 80);
  if (temp === null || !place2) {
    here.drop("weather needs a temp and a place");
    return null;
  }
  return clean({
    type: "weather",
    temp,
    place: place2,
    condition: firstText([raw.condition, raw.sky], 40),
    high: num(raw.high) ?? void 0,
    low: num(raw.low) ?? void 0
  });
}

// src/blocks/widget/Widget.tsx
import { Fragment as Fragment5, useContext as useContext6, useId as useId3, useMemo as useMemo7, useState as useState13 } from "react";

// src/blocks/kpis/Kpis.tsx
import { jsx as jsx22, jsxs as jsxs19 } from "react/jsx-runtime";
function isYear(k) {
  return typeof k.value === "number" && !k.unit && Number.isInteger(k.value) && k.value >= 1800 && k.value <= 2100;
}
var CURRENCY = /^[$₹€£¥]$/;
function kpiValue(k, { full = false } = {}) {
  if (k.value === null) return "no data";
  if (typeof k.value === "string") return k.value;
  if (isYear(k)) return String(k.value);
  const short2 = !full && Math.abs(k.value) >= SHORT_FROM;
  if (short2 && k.unit && CURRENCY.test(k.unit)) return fmt(k.value, k.unit);
  const money = formatAmount(k.value, k.unit);
  if (money !== null) return money;
  const plain2 = short2 ? fmt(k.value) : formatNumber(k.value, { digits: Math.abs(k.value) >= 1e3 ? 0 : 1 });
  const attached = k.unit === "%" || k.unit?.startsWith("/");
  return attached ? `${plain2}${k.unit}` : k.unit ? `${plain2} ${k.unit}` : plain2;
}
function KpiCard({ item, trendColour }) {
  const shown2 = kpiValue(item);
  const full = kpiValue(item, { full: true });
  const change = formatChange(item.change, item.change_unit);
  const isText = typeof item.value === "string";
  const empty = item.value === null;
  const valueClass = ["hb-kpi-value", isText ? "hb-kpi-value-text" : "", empty ? "hb-kpi-value-empty" : ""].filter(Boolean).join(" ");
  return /* @__PURE__ */ jsxs19("div", { className: "hb-card hb-kpi", children: [
    /* @__PURE__ */ jsx22("div", { className: "hb-kpi-label", children: item.label }),
    /* @__PURE__ */ jsx22("div", { className: valueClass, title: full !== shown2 ? full : void 0, children: shown2 }),
    change && /* @__PURE__ */ jsx22("div", { className: changeClass(item), children: change }),
    item.trend && /* @__PURE__ */ jsx22(Sparkline, { values: item.trend, colour: trendColour })
  ] });
}
function Kpis({ items }) {
  const several = items.filter((k) => k.trend).length >= 2;
  return /* @__PURE__ */ jsx22("div", { className: "hb-kpis", children: items.map((k, i) => /* @__PURE__ */ jsx22(KpiCard, { item: k, trendColour: several ? partColour(i) : void 0 }, i)) });
}
function changeClass(item) {
  const change = item.change ?? 0;
  const direction = change > 0 ? "hb-kpi-up" : change < 0 ? "hb-kpi-down" : "hb-kpi-flat";
  return `hb-kpi-change ${direction}${item.invert_tone ? " hb-kpi-invert" : ""}`;
}
var SPARK_W = 120;
var SPARK_H = 28;
var SPARK_PAD = 2;
function Sparkline({ values, colour }) {
  return /* @__PURE__ */ jsx22("svg", { className: "hb-kpi-spark", viewBox: `0 0 ${SPARK_W} ${SPARK_H}`, preserveAspectRatio: "none", "aria-hidden": "true", children: /* @__PURE__ */ jsx22("path", { d: sparkPath(values), style: colour ? { stroke: colour } : void 0 }) });
}
function sparkPath(values) {
  const known = values.filter((v) => v !== null);
  if (!known.length) return "";
  const lo = Math.min(...known);
  const hi = Math.max(...known);
  const span = SPARK_H - 2 * SPARK_PAD;
  const y = (v) => hi === lo ? SPARK_H / 2 : SPARK_PAD + (1 - (v - lo) / (hi - lo)) * span;
  const x = (i) => i / (values.length - 1) * SPARK_W;
  let d = "";
  let pen = false;
  values.forEach((v, i) => {
    if (v === null) {
      pen = false;
      return;
    }
    d += `${pen ? "L" : "M"}${round(x(i))} ${round(y(v))}`;
    pen = true;
  });
  return d;
}
function round(n) {
  return Math.round(n * 10) / 10;
}

// src/blocks/source/Source.tsx
import { jsx as jsx23, jsxs as jsxs20 } from "react/jsx-runtime";
function Row({ item, index }) {
  const name = item.url ? /* @__PURE__ */ jsx23("a", { href: item.url, target: "_blank", rel: "noreferrer", children: item.label }) : /* @__PURE__ */ jsx23("span", { children: item.label });
  return /* @__PURE__ */ jsxs20("li", { className: "hb-source-row", children: [
    /* @__PURE__ */ jsx23("span", { className: "hb-source-n", "aria-hidden": "true", children: index + 1 }),
    name,
    item.kind && /* @__PURE__ */ jsx23("span", { className: `hb-source-kind hb-source-kind-${item.kind}`, children: item.kind }),
    item.accessed && /* @__PURE__ */ jsxs20("span", { className: "hb-source-accessed", children: [
      "accessed ",
      item.accessed
    ] }),
    item.note && /* @__PURE__ */ jsx23("span", { className: "hb-source-note", children: item.note })
  ] });
}
function Source({ text, url, title, items }) {
  if (items?.length) {
    return /* @__PURE__ */ jsxs20("div", { className: "hb-source hb-source-list", children: [
      title && /* @__PURE__ */ jsx23("div", { className: "hb-source-head", children: title }),
      /* @__PURE__ */ jsx23("ol", { className: "hb-source-rows", children: items.map((item, i) => /* @__PURE__ */ jsx23(Row, { item, index: i }, `${item.label}-${i}`)) })
    ] });
  }
  if (!text) return null;
  if (!url) return /* @__PURE__ */ jsx23("div", { className: "hb-source", children: text });
  return /* @__PURE__ */ jsx23("div", { className: "hb-source", children: /* @__PURE__ */ jsx23("a", { href: url, target: "_blank", rel: "noreferrer", children: text }) });
}

// src/blocks/table/Table.tsx
import { useState as useState12 } from "react";

// src/blocks/table/StructuredTable.tsx
import { useMemo as useMemo6, useState as useState11 } from "react";
import { jsx as jsx24, jsxs as jsxs21 } from "react/jsx-runtime";
var PAGE = 10;
function shown(cell, column) {
  if (!cell) return "\u2013";
  if (cell.value === void 0) return cell.text;
  if (column.kind === "currency") return formatAmount(cell.value, column.unit) ?? formatNumber(cell.value);
  if (column.kind === "percent") return formatPercent(cell.value);
  if (column.kind === "number" || column.kind === "bar") return formatNumber(cell.value);
  return cell.text;
}
function aggregateValue(rows, a) {
  const values = rows.map((r) => r.cells[a.column]?.value).filter((v) => v !== void 0);
  if (a.op === "count") return values.length;
  if (!values.length) return null;
  if (a.op === "sum") return values.reduce((s, v) => s + v, 0);
  if (a.op === "avg") return values.reduce((s, v) => s + v, 0) / values.length;
  if (a.op === "min") return Math.min(...values);
  return Math.max(...values);
}
function aggregateLabel(op) {
  return { sum: "Total", avg: "Average", min: "Lowest", max: "Highest", count: "Count" }[op];
}
function StructuredTable({ caption: caption2, columns, rows, filterable, page, aggregates }) {
  const [query, setQuery] = useState11("");
  const [at2, setAt] = useState11(page);
  const needle = query.trim().toLowerCase();
  const filtered = useMemo6(() => {
    if (!needle) return rows;
    return rows.filter((row) => columns.some((c) => {
      const cell = row.cells[c.id];
      return `${cell?.text ?? ""} ${row.sources.map((s) => s.label).join(" ")}`.toLowerCase().includes(needle);
    }));
  }, [rows, columns, needle]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const current = Math.min(at2, pages);
  const slice = filtered.slice((current - 1) * PAGE, current * PAGE);
  return /* @__PURE__ */ jsxs21("div", { className: "hb-card hb-table-card hb-table hb-table-structured", children: [
    /* @__PURE__ */ jsxs21("table", { className: "hb-table-grid", children: [
      caption2 && /* @__PURE__ */ jsx24("caption", { className: "hb-table-caption", children: caption2 }),
      /* @__PURE__ */ jsx24("thead", { children: /* @__PURE__ */ jsx24("tr", { children: columns.map((c) => /* @__PURE__ */ jsx24("th", { scope: "col", className: c.align ? `hb-align-${c.align}` : void 0, children: c.label }, c.id)) }) }),
      /* @__PURE__ */ jsxs21("tbody", { children: [
        slice.map((row, i) => /* @__PURE__ */ jsx24("tr", { children: columns.map((column, ci) => /* @__PURE__ */ jsxs21("td", { className: column.align ? `hb-align-${column.align}` : void 0, children: [
          column.kind === "sources" ? /* @__PURE__ */ jsx24("span", { className: "hb-table-sources", children: row.sources.length ? row.sources.map(
            (s, si) => s.url ? /* @__PURE__ */ jsx24("a", { href: s.url, target: "_blank", rel: "noreferrer", children: s.label }, si) : /* @__PURE__ */ jsx24("span", { children: s.label }, si)
          ) : /* @__PURE__ */ jsx24("span", { className: "hb-table-empty", children: "\u2013" }) }) : column.kind === "bar" ? /* @__PURE__ */ jsxs21("span", { className: "hb-table-bar", children: [
            /* @__PURE__ */ jsx24(
              "span",
              {
                className: "hb-table-bar-fill",
                style: { width: `${Math.min(100, Math.max(0, (row.cells[column.id]?.value ?? 0) / (column.max ?? Math.max(1, ...rows.map((r) => r.cells[column.id]?.value ?? 0))) * 100))}%` }
              }
            ),
            /* @__PURE__ */ jsx24("span", { className: "hb-table-bar-value", children: shown(row.cells[column.id], column) })
          ] }) : column.kind === "badge" ? /* @__PURE__ */ jsx24("span", { className: `hb-chip hb-chip-${row.cells[column.id]?.tone ?? column.tone ?? "plain"}`, children: shown(row.cells[column.id], column) }) : column.kind === "link" && row.cells[column.id]?.url ? /* @__PURE__ */ jsx24("a", { href: row.cells[column.id].url, target: "_blank", rel: "noreferrer", children: shown(row.cells[column.id], column) }) : /* @__PURE__ */ jsx24("span", { children: shown(row.cells[column.id], column) }),
          ci === 0 && row.sources.length > 0 && column.kind !== "sources" && /* @__PURE__ */ jsx24("span", { className: "hb-table-source-hint", "aria-label": `Sources: ${row.sources.map((s) => s.label).join(", ")}`, children: "\u2022" })
        ] }, column.id)) }, `${(current - 1) * PAGE + i}`)),
        !slice.length && /* @__PURE__ */ jsx24("tr", { children: /* @__PURE__ */ jsx24("td", { colSpan: columns.length, className: "hb-table-empty-cell", children: "No rows match." }) })
      ] }),
      aggregates.length > 0 && /* @__PURE__ */ jsx24("tfoot", { children: /* @__PURE__ */ jsx24("tr", { children: columns.map((column, ci) => {
        const a = aggregates.find((item) => item.column === column.id);
        if (!a) return /* @__PURE__ */ jsx24("td", {}, column.id);
        const value = aggregateValue(filtered, a);
        return /* @__PURE__ */ jsxs21("td", { children: [
          /* @__PURE__ */ jsx24("span", { className: "hb-table-aggregate-label", children: ci === 0 ? a.label : aggregateLabel(a.op) }),
          value !== null ? ` ${formatNumber(value)}` : " \u2013"
        ] }, column.id);
      }) }) })
    ] }),
    (filterable || pages > 1) && /* @__PURE__ */ jsxs21("div", { className: "hb-table-tools", children: [
      filterable && /* @__PURE__ */ jsx24(
        "input",
        {
          type: "search",
          value: query,
          placeholder: "Filter rows",
          "aria-label": "Filter rows",
          onChange: (e) => {
            setQuery(e.target.value);
            setAt(1);
          }
        }
      ),
      pages > 1 && /* @__PURE__ */ jsxs21("div", { className: "hb-table-pages", children: [
        /* @__PURE__ */ jsx24("button", { type: "button", disabled: current === 1, onClick: () => setAt(Math.max(1, current - 1)), "aria-label": "Previous page", children: "\u2039" }),
        /* @__PURE__ */ jsxs21("span", { children: [
          "Page ",
          current,
          " of ",
          pages
        ] }),
        /* @__PURE__ */ jsx24("button", { type: "button", disabled: current === pages, onClick: () => setAt(Math.min(pages, current + 1)), "aria-label": "Next page", children: "\u203A" })
      ] })
    ] })
  ] });
}

// src/blocks/table/sort.ts
var GAP2 = "\u2013";
function isBlank(cell) {
  return !cell || cell === GAP2;
}
function cellNumber(cell) {
  const plain2 = cell.replace(/,/g, "").replace(/^−/, "-");
  const m = /^([-+]?)[^\d\-+]{0,3}([-+]?\d+(?:\.\d+)?)/.exec(plain2);
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
    if (isBlank(left) || isBlank(right)) return blanksLast(left, right);
    return sign * compareCells(left, right);
  });
}
function blanksLast(left, right) {
  const leftBlank = isBlank(left), rightBlank = isBlank(right);
  if (leftBlank && rightBlank) return 0;
  if (leftBlank) return 1;
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
  const filled = rows.map((r) => r[column] ?? "").filter((cell) => !isBlank(cell));
  return filled.length > 0 && filled.every((cell) => cellNumber(cell) !== null);
}

// src/blocks/table/cells.ts
function isChangeColumn(rows, column) {
  if (!isNumberColumn(rows, column) || !rows.some((r) => /^[-+−]/.test(r[column] ?? ""))) return false;
  const filled = rows.map((r) => (r[column] ?? "").trim()).filter((cell) => !isBlank(cell));
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
import { jsx as jsx25, jsxs as jsxs22 } from "react/jsx-runtime";
var MINI_BARS_FROM = 3;
function Table(props) {
  if ("structured" in props && props.structured) return /* @__PURE__ */ jsx25(StructuredTable, { ...props });
  const { columns, rows, highlight, caption: caption2 } = props;
  const [sort, setSort] = useState12(null);
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
  return /* @__PURE__ */ jsxs22("div", { className: "hb-card hb-table-card", children: [
    caption2 && /* @__PURE__ */ jsx25("div", { className: "hb-chart-title hb-table-caption", children: /* @__PURE__ */ jsx25(InlineText, { text: caption2 }) }),
    /* @__PURE__ */ jsx25("div", { className: "hb-table-scroll", children: /* @__PURE__ */ jsxs22("table", { className: columns.length >= 3 ? "hb-table hb-table-wide" : "hb-table", children: [
      /* @__PURE__ */ jsx25("thead", { children: /* @__PURE__ */ jsx25("tr", { children: columns.map((name, c) => /* @__PURE__ */ jsx25("th", { "aria-sort": ariaSort(sort, c), className: cellClass(c, name, sort?.column === c ? "hb-sorted" : ""), children: /* @__PURE__ */ jsxs22("button", { type: "button", onClick: () => setSort(nextSort(sort, c)), children: [
        /* @__PURE__ */ jsx25("span", { children: name }),
        /* @__PURE__ */ jsx25("span", { className: "hb-sort", "aria-hidden": "true", children: sortMark(sort, c) }),
        c === bestColumn && /* @__PURE__ */ jsx25("span", { className: "hb-chip hb-chip-soft", children: "Best" })
      ] }) }, c)) }) }),
      /* @__PURE__ */ jsxs22("tbody", { children: [
        !rows.length && /* @__PURE__ */ jsx25("tr", { children: /* @__PURE__ */ jsx25("td", { className: "hb-table-empty", colSpan: columns.length, children: "No rows to show." }) }),
        order.map((r) => /* @__PURE__ */ jsx25("tr", { className: r === bestRow ? "hb-best" : void 0, children: rows[r].map((cell, c) => {
          const big = bigNumber(cell);
          const direction = change[c] ? changeOf(cell) : null;
          const bar = change[c] && withBars ? cellNumber(cell) : null;
          return /* @__PURE__ */ jsxs22("td", { className: cellClass(c, cell, direction ? `hb-${direction}` : ""), title: big?.full, children: [
            bar !== null && /* @__PURE__ */ jsx25(MiniBar, { value: bar, largest: largest[c] }),
            big ? big.short : /* @__PURE__ */ jsx25(InlineText, { text: cell }),
            c === 0 && r === bestRow && /* @__PURE__ */ jsx25("span", { className: "hb-chip hb-chip-soft", children: "Best" })
          ] }, c);
        }) }, r))
      ] })
    ] }) })
  ] });
}
function MiniBar({ value, largest }) {
  const { left, width } = miniBar(value, largest);
  return /* @__PURE__ */ jsxs22("span", { className: "hb-mini", "aria-hidden": "true", children: [
    /* @__PURE__ */ jsx25("span", { className: "hb-mini-zero" }),
    /* @__PURE__ */ jsx25("span", { className: "hb-mini-bar", style: { left: `${left}%`, width: `${width}%` } })
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

// src/blocks/widget/expr.ts
var DIVIDED_BY_ZERO = "divided by zero";
var NON_FINITE = "non-finite result";
var UNKNOWN_REFERENCE = "unknown reference";
var UNKNOWN_OPERATOR = "unknown operator";
var WRONG_OPERAND_TYPE = "wrong operand type";
var ARITY = { add: 2, sub: 2, mul: 2, div: 2, eq: 2, lt: 2, lte: 2, and: 2, or: 2, not: 1, if: 3 };
var OPS = Object.keys(ARITY);
var NAME = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;
var PROTO = /* @__PURE__ */ new Set(["__proto__", "prototype", "constructor"]);
var MAX_EXPR_STRING = 200;
var MAX_EXPR_DEPTH = 6;
var ok = (value) => ({ value, error: null });
var fail = (error) => ({ value: null, error });
function isObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}
function isNumber(v) {
  return typeof v === "number" && isFinite(v);
}
function isReference(path) {
  if (typeof path !== "string") return false;
  const parts2 = path.split(".");
  if (parts2.length !== 2) return false;
  const [root, key] = parts2;
  if (PROTO.has(root) || PROTO.has(key)) return false;
  return (root === "data" || root === "state" || root === "computed" || root === "item") && NAME.test(key);
}
function computedReferences(expr, found = []) {
  if (!isObject(expr)) return found;
  if (typeof expr.get === "string") {
    const path = expr.get;
    if (path.startsWith("computed.")) found.push(path.slice("computed.".length));
    return found;
  }
  const args = expr.args;
  if (Array.isArray(args)) for (const arg of args) computedReferences(arg, found);
  return found;
}
function checkExpr(expr, depth = 0) {
  if (depth > MAX_EXPR_DEPTH) return "expression nested too deep";
  if (expr === null || typeof expr === "boolean") return null;
  if (typeof expr === "number") return isFinite(expr) ? null : "non-finite literal";
  if (typeof expr === "string") return expr.length <= MAX_EXPR_STRING ? null : "string too long";
  if (!isObject(expr)) return "not an expression";
  if ("get" in expr) return isReference(expr.get) ? null : "bad reference";
  const op = expr.op;
  if (typeof op !== "string" || !Object.hasOwn(ARITY, op)) return "unknown operator";
  const args = expr.args;
  if (!Array.isArray(args) || args.length !== ARITY[op]) return "wrong arity";
  for (const arg of args) {
    const why = checkExpr(arg, depth + 1);
    if (why) return why;
  }
  return null;
}
function evaluate2(expr, scope, resolveComputed) {
  if (expr === null) return ok(null);
  if (typeof expr === "boolean" || typeof expr === "string") return ok(expr);
  if (typeof expr === "number") return isFinite(expr) ? ok(expr) : fail(NON_FINITE);
  if (!isObject(expr)) return fail(WRONG_OPERAND_TYPE);
  if ("get" in expr) return reference(expr.get, scope, resolveComputed);
  const op = expr.op;
  if (typeof op !== "string" || !Object.hasOwn(ARITY, op)) return fail(UNKNOWN_OPERATOR);
  const args = expr.args;
  const arity = ARITY[op];
  if (!Array.isArray(args) || args.length !== arity) return fail(WRONG_OPERAND_TYPE);
  const arg = (i) => evaluate2(args[i], scope, resolveComputed);
  switch (op) {
    case "add":
    case "sub":
    case "mul":
    case "div":
      return arithmetic(op, arg(0), arg(1));
    case "eq":
      return equal(arg(0), arg(1));
    case "lt":
    case "lte":
      return compare(op, arg(0), arg(1));
    case "and":
    case "or":
      return logical(op, arg(0), arg(1));
    case "not": {
      const value = arg(0);
      if (value.error) return value;
      if (value.value === null) return ok(null);
      if (typeof value.value !== "boolean") return fail(WRONG_OPERAND_TYPE);
      return ok(!value.value);
    }
    case "if": {
      const test = arg(0);
      if (test.error) return test;
      if (test.value === null) return ok(null);
      if (typeof test.value !== "boolean") return fail(WRONG_OPERAND_TYPE);
      return arg(test.value ? 1 : 2);
    }
  }
}
function reference(path, scope, resolve) {
  if (!isReference(path)) return fail(UNKNOWN_REFERENCE);
  const [root, key] = path.split(".");
  if (root === "computed" && resolve) {
    const defined = resolve(key);
    if (defined) return defined;
  }
  const bag = root === "data" ? scope.data : root === "state" ? scope.state : root === "computed" ? scope.computed : scope.item;
  if (!isObject(bag) || !Object.hasOwn(bag, key)) return fail(UNKNOWN_REFERENCE);
  const value = bag[key];
  return value === void 0 ? fail(UNKNOWN_REFERENCE) : ok(value);
}
function arithmetic(op, a, b) {
  if (a.error) return a;
  if (b.error) return b;
  if (a.value === null || b.value === null) return ok(null);
  if (!isNumber(a.value) || !isNumber(b.value)) return fail(WRONG_OPERAND_TYPE);
  if (op === "div" && b.value === 0) return fail(DIVIDED_BY_ZERO);
  const value = op === "add" ? a.value + b.value : op === "sub" ? a.value - b.value : op === "mul" ? a.value * b.value : a.value / b.value;
  return isFinite(value) ? ok(value) : fail(NON_FINITE);
}
function equal(a, b) {
  if (a.error) return a;
  if (b.error) return b;
  if (a.value === null || b.value === null) return ok(null);
  if (isNumber(a.value) && isNumber(b.value)) return ok(a.value === b.value);
  if (typeof a.value === "string" && typeof b.value === "string") return ok(a.value === b.value);
  if (typeof a.value === "boolean" && typeof b.value === "boolean") return ok(a.value === b.value);
  if (isPrimitive(a.value) && isPrimitive(b.value)) return ok(false);
  return ok(null);
}
function compare(op, a, b) {
  if (a.error) return a;
  if (b.error) return b;
  if (a.value === null || b.value === null) return ok(null);
  const sameNumbers = isNumber(a.value) && isNumber(b.value);
  const sameStrings = typeof a.value === "string" && typeof b.value === "string";
  if (!sameNumbers && !sameStrings) return fail(WRONG_OPERAND_TYPE);
  const left = a.value;
  const right = b.value;
  return ok(op === "lt" ? left < right : left <= right);
}
function logical(op, a, b) {
  if (a.error) return a;
  if (a.value === null) return ok(null);
  if (typeof a.value !== "boolean") return fail(WRONG_OPERAND_TYPE);
  if (op === "and" && !a.value) return ok(false);
  if (op === "or" && a.value) return ok(true);
  if (b.error) return b;
  if (b.value === null) return ok(null);
  if (typeof b.value !== "boolean") return fail(WRONG_OPERAND_TYPE);
  return ok(op === "and" ? a.value && b.value : a.value || b.value);
}
function isPrimitive(v) {
  return v === null || typeof v === "number" || typeof v === "string" || typeof v === "boolean";
}
function evaluateComputed(definitions, base) {
  const values = {};
  const errors = {};
  const visiting = /* @__PURE__ */ new Set();
  const find = (name) => {
    if (!Object.hasOwn(definitions, name)) return void 0;
    if (Object.hasOwn(values, name)) return { value: values[name], error: errors[name] };
    if (visiting.has(name)) return fail(UNKNOWN_REFERENCE);
    visiting.add(name);
    const result = evaluate2(definitions[name], { ...base, computed: values }, find);
    visiting.delete(name);
    values[name] = result.value;
    errors[name] = result.error;
    return result;
  };
  for (const name of Object.keys(definitions)) find(name);
  return { values, errors };
}

// src/blocks/chart/read.ts
var SCATTER_POINTS = 200;
function readChart(raw, here) {
  const type = chartKind(raw?.kind);
  const points = type === "scatter" || type === "waterfall";
  const spec = points ? readPoints(raw, type, here) : readSpec(raw);
  if (!spec) return points ? null : here.drop("chart needs x labels and at least one series");
  return { type: "chart", spec };
}
function caption(value, max) {
  if (typeof value !== "string") return void 0;
  const text = value.trim();
  if (!text) return void 0;
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}\u2026` : text;
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
  return specOf(d, type, x, series, unit);
}
function readPoints(d, type, here) {
  if (!Array.isArray(d.series) || !d.series.length) {
    return here.drop(type === "scatter" ? "scatter needs series with points" : "waterfall needs series with points");
  }
  const series = keepFirst(d.series, maxSeries(type), here, `${type} series`).map((s, k) => type === "scatter" ? readScatterSeries(s, k, here) : readWaterfallSeries(s, here));
  if (type === "scatter") {
    if (!scatterPoints(series).length) return here.drop("scatter needs a point with a number on both scales");
    return specOf(d, type, [], series, d.unit);
  }
  const points = series[0].points ?? [];
  if (waterfallBars(points).every((bar) => bar === null)) return here.drop("waterfall needs a point with a value or a total");
  const x = points.map((p, i) => p.label ?? (p.total ? `Total ${i + 1}` : `Step ${i + 1}`));
  return specOf(d, type, x, series, d.unit);
}
function specOf(d, type, x, series, unit) {
  const spec = {
    type,
    title: typeof d.title === "string" ? d.title : void 0,
    x,
    series,
    unit: typeof unit === "string" ? unit : void 0,
    source: typeof d.source === "string" ? d.source : void 0
  };
  if (typeof d.figure === "boolean") spec.figure = d.figure;
  if (d.tone === "change") spec.tone = "change";
  const caveat = caption(d.caveat, 120);
  if (caveat) spec.caveat = caveat;
  if (type !== "pie" && type !== "donut") {
    const xLabel = caption(d.xLabel, 40);
    const yLabel = caption(d.yLabel, 40);
    const drawn2 = kindToDraw(spec);
    if (xLabel && drawn2 !== "hbar") spec.xLabel = xLabel;
    if (yLabel && drawn2 !== "hbar") spec.yLabel = yLabel;
    if (drawn2 === "hbar") {
      const valueLabel = xLabel ?? yLabel;
      if (valueLabel) spec.xLabel = valueLabel;
    }
  }
  if (d.stepped === true) spec.stepped = true;
  if (typeof d.height === "number" && isFinite(d.height)) spec.height = Math.round(Math.min(480, Math.max(120, d.height)));
  if (d.sortDesc === true && (type === "bar" || type === "hbar")) sortByFirstSeries(spec);
  return spec;
}
function sortByFirstSeries(spec) {
  const values = spec.series[0]?.data ?? [];
  const order = spec.x.map((_, i) => i).sort((a, b) => {
    const av = values[a] ?? null, bv = values[b] ?? null;
    if (av === null && bv === null) return a - b;
    if (av === null) return 1;
    if (bv === null) return -1;
    return bv - av || a - b;
  });
  spec.x = order.map((i) => spec.x[i]);
  spec.series = spec.series.map((s) => ({ ...s, data: order.map((i) => s.data[i] ?? null) }));
}
function readSeries(s, k, type, chartUnit) {
  const name = typeof s.name === "string" ? s.name : void 0;
  const data = s.data.map((v) => typeof v === "number" && isFinite(v) ? v : null);
  const unit = typeof s.unit === "string" ? s.unit : void 0;
  const right = isOnRightScale(type, k, unit, s.axis, chartUnit);
  return { name, data, unit, right };
}
function readScatterSeries(s, k, here) {
  const raw = Array.isArray(s?.points) ? s.points : [];
  const points = keepFirst(raw, SCATTER_POINTS, here.at(`series.${k}`), "points").flatMap((p, i) => {
    const point = readScatterPoint(p, here.at(`series.${k}.points.${i}`));
    return point ? [point] : [];
  });
  return { name: typeof s?.name === "string" ? s.name : void 0, data: [], points };
}
function readScatterPoint(raw, here) {
  const x = num(raw?.x);
  if (x === null) return here.drop("a point needs a number on both scales");
  return clean({ x, y: num(raw?.y), label: str(raw?.label, 40) });
}
function readWaterfallSeries(s, here) {
  const raw = Array.isArray(s?.points) ? s.points : [];
  const points = raw.flatMap((p, i) => {
    const point = readWaterfallPoint(p, here.at(`points.${i}`));
    return point ? [point] : [];
  });
  return { name: typeof s?.name === "string" ? s.name : void 0, data: [], points };
}
function readWaterfallPoint(raw, here) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return here.drop("a point is an object with a label and a value");
  return clean({ label: str(raw.label, 40), value: num(raw.value), total: raw.total === true ? true : void 0 });
}

// src/blocks/kpis/read.ts
var TREND_FEWEST = 2;
var TREND_MOST = 60;
var MAX_CHIP = 1e15;
function readKpi(item) {
  let value = num(item.value);
  if (value === null) value = str(item.value, 40) ?? null;
  const unit = typeof item.unit === "string" ? item.unit : void 0;
  const fromPrevious = "previous" in item;
  const changeUnit = readChangeUnit(item.change_unit, unit, fromPrevious);
  let change = fromPrevious ? changeFrom(item.previous, value, changeUnit) : num(item.change);
  if (change !== null && Math.abs(change) >= MAX_CHIP) change = null;
  const kpi = { label: item.label, value, unit, change, change_unit: changeUnit };
  if (kpi.unit === void 0) delete kpi.unit;
  if (kpi.change === null) delete kpi.change;
  if (item.invert_tone === true) kpi.invert_tone = true;
  const trend = readTrend(item.trend);
  if (trend) kpi.trend = trend;
  return kpi;
}
function readChangeUnit(written, unit, fromPrevious) {
  if (written === "%" || written === "pt") return written;
  return fromPrevious && unit === "%" ? "pt" : "%";
}
function changeFrom(previous, value, unit) {
  const before = num(previous);
  if (before === null || typeof value !== "number") return null;
  const moved = value - before;
  if (unit === "pt") return moved;
  return before === 0 ? null : moved / Math.abs(before) * 100;
}
function readTrend(v) {
  if (!Array.isArray(v)) return void 0;
  const slots = v.slice(-TREND_MOST).map((x) => num(x));
  const known = slots.filter((n) => n !== null).length;
  return known >= TREND_FEWEST ? slots : void 0;
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

// src/blocks/source/read.ts
var KINDS = ["web", "file", "tool", "derived"];
var MAX_ITEMS = 32;
var ACCESSED = /^(\d{4}-\d{2}-\d{2})/;
function short(v, max) {
  if (typeof v !== "string") return void 0;
  const s = v.trim();
  return s ? s.slice(0, max) : void 0;
}
function safeUrl(v) {
  const s = short(v, 500);
  return s && /^https?:\/\/[^\s<>]+$/i.test(s) ? s : void 0;
}
function readItem(raw, here) {
  const label = short(raw?.label, 80);
  if (!label) {
    here.drop("source item needs a label");
    return null;
  }
  const kind = KINDS.find((k) => k === raw?.kind);
  const accessed = ACCESSED.exec(short(raw?.accessed, 32) ?? "")?.[1];
  const item = { label };
  const url = safeUrl(raw?.url);
  const note = short(raw?.note, 160);
  if (url) item.url = url;
  if (kind) item.kind = kind;
  if (accessed) item.accessed = accessed;
  if (note) item.note = note;
  return item;
}
function readSource(raw, here) {
  const title = short(raw.title, 80);
  if (Array.isArray(raw.items)) {
    const items = raw.items.map((item, i) => readItem(item, here.at("items").at(i)));
    const kept = items.filter((item) => item !== null).slice(0, MAX_ITEMS);
    if (raw.items.length > MAX_ITEMS) here.drop("source keeps 32 items");
    if (kept.length) return { type: "source", ...title ? { title } : {}, items: kept };
  }
  const named = [];
  if (Array.isArray(raw.sources)) {
    for (const s of raw.sources) if (s && short(s.name ?? s.title ?? s.label, 80)) named.push(s);
  }
  let text = short(raw.text, 500) ?? "";
  if (!text) text = named.map((s) => short(s.name ?? s.title ?? s.label, 80)).join(" \xB7 ");
  if (!text) return here.drop("source needs text");
  const candidates = [raw.url, ...named.map((s) => s.url)];
  const url = candidates.find((u) => typeof u === "string" && /^https?:\/\/[^\s<>]+$/i.test(u.trim()));
  return { type: "source", text, ...url ? { url: String(url).trim().slice(0, 500) } : {}, ...title ? { title } : {} };
}

// src/blocks/table/read.ts
var MAX_COLUMNS = 8;
var MAX_ROWS = 30;
var KINDS2 = ["text", "number", "currency", "percent", "date", "badge", "link", "bar", "sources"];
var OPS2 = ["sum", "avg", "min", "max", "count"];
var TONES = ["accent", "good", "warn", "neutral"];
function isObject2(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}
function plain(v, max) {
  if (typeof v !== "string") return void 0;
  const s = v.trim();
  return s ? s.slice(0, max) : void 0;
}
function safeUrl2(v) {
  const s = plain(v, 500);
  return s && /^https?:\/\/[^\s<>]+$/i.test(s) ? s : void 0;
}
function readSources(raw) {
  if (!Array.isArray(raw)) return [];
  const sources = [];
  for (const item of raw.slice(0, 4)) {
    const label = isObject2(item) ? firstText([item.label, item.name, item.title], 40) : plain(item, 40);
    if (!label) continue;
    const source = { label };
    const url = safeUrl2(isObject2(item) ? item.url : void 0);
    if (url) source.url = url;
    sources.push(source);
  }
  return sources;
}
function readStructuredColumns(raw, here) {
  const list = Array.isArray(raw) ? raw.slice(0, MAX_COLUMNS) : [];
  const used = /* @__PURE__ */ new Set();
  const columns = list.map((item, i) => {
    if (!isObject2(item)) return { id: `c${i}`, label: plain(item, 40) ?? `Column ${i + 1}`, kind: "text" };
    const label = firstText([item.label, item.title, item.name], 40) ?? `Column ${i + 1}`;
    let id = plain(item.id ?? item.key, 40)?.replace(/[^A-Za-z0-9_-]+/g, "-").toLowerCase() ?? `c${i}`;
    if (used.has(id)) id = `${id}-${i}`;
    used.add(id);
    const column = { id, label, kind: KINDS2.find((k) => k === item.kind) ?? "text" };
    const align = ["left", "right", "center"].find((a) => a === item.align);
    const tone2 = TONES.find((t) => t === item.tone);
    const max = num(item.max);
    const unit = plain(item.unit, 12);
    if (align) column.align = align;
    if (tone2) column.tone = tone2;
    if (max !== null && max > 0) column.max = max;
    if (unit) column.unit = unit;
    return column;
  });
  if (Array.isArray(raw) && raw.length > MAX_COLUMNS) here.drop("table keeps 8 columns");
  return columns;
}
function readStructuredCell(raw, column) {
  if (isObject2(raw)) {
    const value = num(raw.value ?? raw.number);
    const text2 = firstText([raw.text, raw.label, raw.value], 120) ?? "";
    const cell = { text: text2 };
    if (value !== null) cell.value = value;
    const url = safeUrl2(raw.url ?? raw.href);
    if (url) cell.url = url;
    const tone2 = TONES.find((t) => t === raw.tone);
    if (tone2) cell.tone = tone2;
    return cell.text || cell.value !== void 0 ? cell : null;
  }
  if (column.kind === "sources") return null;
  if (typeof raw === "number") return { text: String(raw), value: raw };
  const text = plain(raw, 120);
  if (!text) return null;
  if (column.kind === "number" || column.kind === "currency" || column.kind === "percent" || column.kind === "bar") {
    const n = Number(text.replace(/,/g, ""));
    return isFinite(n) ? { text, value: n } : null;
  }
  return { text };
}
function readAggregates(raw, columns) {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 4).map((item, i) => {
    const id = plain(isObject2(item) ? item.column ?? item.id : void 0, 40);
    const column = columns.find((c) => c.id === id) ?? columns[i];
    const op = OPS2.find((o) => o === (isObject2(item) ? item.op : void 0)) ?? "sum";
    const label = firstText([isObject2(item) ? item.label : void 0, column?.label], 20) ?? op;
    return { column: column.id, op, label };
  }).filter((a) => columns.some((c) => c.id === a.column));
}
function readStructuredTable(raw, here, caption2) {
  const columns = readStructuredColumns(raw.columns, here.at("columns"));
  if (!columns.length) return here.drop("table needs columns");
  const rawRows = Array.isArray(raw.rows) ? raw.rows : [];
  const rows = [];
  rawRows.slice(0, MAX_ROWS).forEach((row) => {
    const cells = {};
    let hasCell = false;
    const sources = readSources(isObject2(row) ? row.sources ?? row.sourceIds : void 0);
    columns.forEach((column, ci) => {
      const values = isObject2(row) && isObject2(row.cells) ? row.cells : row;
      const value = isObject2(values) ? values[column.id] ?? values[column.label] : Array.isArray(values) ? values[ci] : void 0;
      if (column.kind === "sources") {
        sources.push(...readSources(Array.isArray(value) ? value : value ? [value] : []));
        return;
      }
      const cell = readStructuredCell(value, column);
      if (cell) {
        cells[column.id] = cell;
        hasCell = true;
      }
    });
    if (hasCell || sources.length) rows.push({ cells, sources });
  });
  if (rawRows.length > MAX_ROWS) here.drop("table keeps 30 rows");
  if (!rows.length) return here.drop("table needs at least one row");
  const page = num(raw.page);
  return clean({
    type: "table",
    caption: caption2,
    structured: true,
    columns,
    rows,
    filterable: raw.filterable === true,
    page: page !== null && page >= 1 && page <= 10 ? Math.floor(page) : 1,
    aggregates: readAggregates(raw.aggregates, columns)
  });
}
function readTable(raw, here) {
  const caption2 = firstText([raw.caption, raw.title], 100);
  const structured = Array.isArray(raw.columns) && raw.columns.some(isObject2) || raw.filterable === true || raw.page !== void 0 || Array.isArray(raw.aggregates);
  if (structured) return readStructuredTable(raw, here, caption2);
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
  columns = keepFirst(columns, MAX_COLUMNS, here.at("columns"), "columns");
  const rows = [];
  rowsToRead.forEach((row, i) => {
    const cells = readRow(row, columns, here.at("rows").at(i));
    if (cells) rows.push(cells);
  });
  if (!rows.length) here.drop("table has no rows");
  const kept = keepFirst(rows, MAX_ROWS, here.at("rows"), "rows");
  const highlight = readHighlight(raw.highlight, columns, kept, here.at("highlight"));
  return clean({ type: "table", columns, rows: kept, highlight, caption: caption2 });
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
  const out = cells.map(cellText);
  while (out.length < columns.length) out.push("");
  return out;
}
function cellsByColumnName(row, columns) {
  const byLowerName = new Map(Object.entries(row).map(([k, v]) => [k.toLowerCase(), v]));
  return columns.map((c) => byLowerName.get(c.toLowerCase()));
}
function cellText(v) {
  if (v === null) return "\u2013";
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

// src/blocks/widget/read.ts
var WIDGET_VERSION = 1;
var MAX_STATE = 16;
var MAX_COMPUTED = 32;
var MAX_NODES = 200;
var MAX_DEPTH2 = 8;
var MAX_REPEAT_ITEMS = 100;
var MAX_FILL_FIELDS = 8;
var NAME2 = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;
var PROTO2 = /* @__PURE__ */ new Set(["__proto__", "prototype", "constructor"]);
var FORBIDDEN_KEYS = /* @__PURE__ */ new Set(["fetch", "tool", "tools", "include"]);
var GAPS = ["xs", "sm", "md", "lg"];
var TONES2 = ["muted", "good", "warn", "bad", "info"];
var CONTROLS = ["number", "slider", "select", "checkbox", "text"];
var EMBED_KINDS = ["stat", "bar", "chart", "table", "source"];
function isObject3(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}
function ident(v) {
  return typeof v === "string" && NAME2.test(v) ? v : void 0;
}
function gap(v) {
  return GAPS.includes(v) ? v : void 0;
}
function tone(v) {
  return TONES2.includes(v) ? v : void 0;
}
function readWidget(raw, here) {
  if (!isObject3(raw)) return here.drop("widget must be an object");
  if (raw.version !== WIDGET_VERSION) return here.drop("widget version must be 1");
  const id = ident(raw.id);
  if (!id) return here.drop("widget needs an id");
  const title = firstText([raw.title], 120);
  if (!title) return here.drop("widget needs a title");
  const data = readData(raw.data, here.at("data"));
  if (!data) return null;
  const state = readState(raw.state, here.at("state"));
  if (!state) return null;
  const computed = readComputed(raw.computed, here.at("computed"));
  if (!computed) return null;
  if (!Array.isArray(raw.view)) return here.drop("widget needs a view list");
  const context = { data, state, seen: /* @__PURE__ */ new Set(), budget: { used: 0 }, depth: 1, inRepeat: false };
  const view = readNodes(raw.view, here.at("view"), context);
  return { type: "widget", version: WIDGET_VERSION, id, title, data, state, computed, view };
}
function readData(raw, here) {
  if (raw === void 0 || raw === null) return {};
  if (!isObject3(raw)) return here.drop("widget data must be an object");
  const why = forbidden(raw, 0);
  if (why) return here.drop(why);
  return raw;
}
function forbidden(value, depth) {
  if (depth > 12) return "widget data is nested too deep";
  if (Array.isArray(value)) {
    for (const item of value) {
      const why = forbidden(item, depth + 1);
      if (why) return why;
    }
    return null;
  }
  if (!isObject3(value)) return null;
  if (value.type === "include") return "widget data can't carry an include block";
  for (const [key, inner] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(key)) return `widget data can't carry "${key}"`;
    const why = forbidden(inner, depth + 1);
    if (why) return why;
  }
  return null;
}
function readState(raw, here) {
  if (raw === void 0 || raw === null) return {};
  if (!isObject3(raw)) return here.drop("widget state must be an object");
  const names = Object.keys(raw);
  if (names.length > MAX_STATE) return here.drop(`widget state keeps ${MAX_STATE} entries`);
  const state = {};
  for (const name of names) {
    if (!NAME2.test(name) || PROTO2.has(name)) return here.at(name).drop("state name must be a letter, then letters, digits, _ or -");
    const decl = readDecl(raw[name], here.at(name));
    if (!decl) return null;
    state[name] = decl;
  }
  return state;
}
function readDecl(raw, here) {
  if (!isObject3(raw)) return here.drop("a state entry must be an object");
  const label = firstText([raw.label], 40);
  if (!label) return here.drop("a state entry needs a label");
  if (raw.type === "number") {
    const initial = num(raw.initial);
    const min = num(raw.min);
    const max = num(raw.max);
    const step = num(raw.step);
    if (initial === null || min === null || max === null || step === null) return here.drop("a number needs finite initial, min, max and step");
    if (min > max) return here.drop("a number's min is above its max");
    if (initial < min || initial > max) return here.drop("a number's initial is outside min and max");
    if (step <= 0) return here.drop("a number's step must be above zero");
    return { type: "number", label, initial, min, max, step };
  }
  if (raw.type === "string") {
    if (typeof raw.initial !== "string") return here.drop("a string's initial must be text");
    const maxLength = num(raw.maxLength);
    if (maxLength === null || maxLength < 1 || !Number.isInteger(maxLength)) return here.drop("a string needs a whole maxLength above zero");
    if (raw.initial.length > maxLength) return here.drop("a string's initial is longer than maxLength");
    const decl = { type: "string", label, initial: raw.initial, maxLength };
    const options = readOptions(raw.options, maxLength, here);
    if (options) decl.options = options;
    return decl;
  }
  if (raw.type === "boolean") {
    if (typeof raw.initial !== "boolean") return here.drop("a boolean's initial must be true or false");
    return { type: "boolean", label, initial: raw.initial };
  }
  return here.drop('a state entry type must be "number", "string" or "boolean"');
}
function readOptions(raw, maxLength, here) {
  if (raw === void 0) return void 0;
  if (!Array.isArray(raw)) {
    here.drop("options must be a list of text");
    return void 0;
  }
  const options = [];
  for (const option of raw) {
    const text = str(option, maxLength);
    if (text === void 0) {
      here.drop("an option must be text within maxLength");
      continue;
    }
    if (!options.includes(text)) options.push(text);
  }
  if (options.length > 24) here.drop("options keeps 24 entries");
  return options.slice(0, 24);
}
function readComputed(raw, here) {
  if (raw === void 0 || raw === null) return {};
  if (!isObject3(raw)) return here.drop("widget computed must be an object");
  const names = Object.keys(raw);
  if (names.length > MAX_COMPUTED) return here.drop(`widget computed keeps ${MAX_COMPUTED} entries`);
  const computed = {};
  for (const name of names) {
    if (!NAME2.test(name) || PROTO2.has(name)) return here.at(name).drop("computed name must be a letter, then letters, digits, _ or -");
    const why = checkExpr(raw[name]);
    if (why) return here.at(name).drop(`computed "${name}": ${why}`);
    computed[name] = raw[name];
  }
  const cycle = findCycle(computed);
  if (cycle) return here.drop(`computed has a cycle through "${cycle}"`);
  return computed;
}
function findCycle(computed) {
  const state = /* @__PURE__ */ new Map();
  const walk = (name) => {
    if (state.get(name) === "done") return null;
    if (state.get(name) === "open") return name;
    state.set(name, "open");
    for (const next of computedReferences(computed[name])) {
      if (!Object.hasOwn(computed, next)) continue;
      const found = walk(next);
      if (found) return found;
    }
    state.set(name, "done");
    return null;
  };
  for (const name of Object.keys(computed)) {
    const found = walk(name);
    if (found) return found;
  }
  return null;
}
function readNodes(list, here, context) {
  const nodes = [];
  list.forEach((raw, i) => {
    const node = readNode(raw, here.at(i), context);
    if (node) nodes.push(node);
  });
  return nodes;
}
function readNode(raw, here, context) {
  if (!isObject3(raw)) return here.drop("an element must be an object");
  if (context.depth > MAX_DEPTH2) return here.drop(`widget elements nest ${MAX_DEPTH2} deep`);
  if (context.budget.used >= MAX_NODES) return here.drop(`widget keeps ${MAX_NODES} elements`);
  const id = ident(raw.id);
  if (!id) return here.drop("an element needs an id (a letter, then letters, digits, _ or -)");
  if (context.seen.has(id)) return here.drop(`element id "${id}" is used twice`);
  context.seen.add(id);
  context.budget.used += 1;
  switch (raw.kind) {
    case "stack":
    case "row":
    case "grid":
    case "surface":
      return readBox(raw, here, context, id);
    case "text":
      return readText2(raw, here, id);
    case "number":
      return readNumber(raw, here, id);
    case "badge":
      return readBadge2(raw, here, id);
    case "divider":
      return { kind: "divider", id };
    case "image":
      return readImage2(raw, here, id);
    case "link":
      return readLink2(raw, here, id);
    case "input":
      return readInput2(raw, here, context, id);
    case "button":
      return readButton2(raw, here, context, id);
    case "when":
      return readWhen(raw, here, context, id);
    case "repeat":
      return readRepeat(raw, here, context, id);
    case "block":
      return readEmbedded(raw, here, id);
    default:
      return here.drop(`unknown element kind "${String(raw.kind)}"`);
  }
}
function readBox(raw, here, context, id) {
  if (!Array.isArray(raw.children)) return here.drop(`${raw.kind} needs a children list`);
  const children = readNodes(raw.children, here.at("children"), { ...context, depth: context.depth + 1 });
  const box = { id, gap: gap(raw.gap), children };
  if (raw.kind === "grid") {
    const columns = num(raw.columns) ?? 2;
    if (!Number.isInteger(columns) || columns < 1 || columns > 4) return here.drop("a grid has 1 to 4 columns");
    return { kind: "grid", ...box, columns };
  }
  return { kind: raw.kind, ...box };
}
function readText2(raw, here, id) {
  const text = str(raw.text, 600);
  const expr = readExpr(raw.expr);
  if (expr === null) return here.drop("text expression is malformed");
  if (text === void 0 && expr === void 0) return here.drop("text needs text or an expression");
  return cleanNode({ kind: "text", id, text, expr, tone: tone(raw.tone) });
}
function readNumber(raw, here, id) {
  const expr = readExpr(raw.expr);
  if (expr === null) return here.drop("number expression is malformed");
  if (expr === void 0) return here.drop("number needs an expression");
  return cleanNode({ kind: "number", id, expr, label: str(raw.label, 40), unit: str(raw.unit, 12), tone: tone(raw.tone) });
}
function readBadge2(raw, here, id) {
  const text = str(raw.text, 40);
  const expr = readExpr(raw.expr);
  if (expr === null) return here.drop("badge expression is malformed");
  if (text === void 0 && expr === void 0) return here.drop("badge needs text or an expression");
  return cleanNode({ kind: "badge", id, text, expr, tone: tone(raw.tone) });
}
function readImage2(raw, here, id) {
  const url = https(raw.url);
  if (!url) return here.drop("image needs a literal https url");
  const alt = str(raw.alt, 200);
  if (!alt) return here.drop("image needs alt text");
  return { kind: "image", id, url, alt };
}
function readLink2(raw, here, id) {
  const url = https(raw.url);
  if (!url) return here.drop("link needs a literal https url");
  const text = str(raw.text, 80);
  if (!text) return here.drop("link needs text");
  return { kind: "link", id, text, url };
}
function readInput2(raw, here, context, id) {
  const control = CONTROLS.includes(raw.control) ? raw.control : null;
  if (!control) return here.drop("input control must be number, slider, select, checkbox or text");
  const name = stateName(raw.state);
  if (!name || !Object.hasOwn(context.state, name)) return here.drop("input needs a declared state name");
  const decl = context.state[name];
  const expected = control === "number" || control === "slider" ? "number" : control === "checkbox" ? "boolean" : "string";
  if (decl.type !== expected) return here.drop(`a ${control} input needs a ${expected} state entry`);
  if (control === "select" && (!("options" in decl) || !decl.options?.length)) return here.drop("a select input needs options on its state entry");
  const label = str(raw.label, 40);
  if (!label) return here.drop("input needs a visible label");
  return { kind: "input", id, control, state: name, label };
}
function readButton2(raw, here, context, id) {
  const label = str(raw.label, 60);
  if (!label) return here.drop("button needs a label");
  const action = readAction(raw.action, here.at("action"), context);
  if (!action) return null;
  return { kind: "button", id, label, action };
}
function readAction(raw, here, context) {
  if (!isObject3(raw)) return here.drop("button needs an action");
  if (raw.op === "reset") return { op: "reset" };
  if (raw.op === "set") {
    const name = stateName(raw.state);
    if (!name || !Object.hasOwn(context.state, name)) return here.drop("set needs a declared state name");
    const value = readExpr(raw.value);
    if (value === null) return here.drop("set value expression is malformed");
    if (value === void 0) return here.drop("set needs a value expression");
    return { op: "set", state: name, value };
  }
  if (raw.op === "fill") {
    const message = str(raw.message, 300);
    if (!message) return here.drop("fill needs a message");
    if (actsBeforeTheModel(message)) return here.drop("a fill message can't start with / @ or ! or carry @-references");
    const fields = readFillFields(raw.fields, context, here);
    if (!fields) return null;
    return { op: "fill", message, fields };
  }
  return here.drop("a button action must be set, reset or fill");
}
function readFillFields(raw, context, here) {
  if (raw === void 0) return [];
  if (!Array.isArray(raw)) return here.drop("fill fields must be a list of state names");
  const fields = [];
  for (const entry2 of raw) {
    const name = stateName(entry2);
    if (!name || !Object.hasOwn(context.state, name)) return here.drop("fill fields must name declared state entries");
    if (!fields.includes(name)) fields.push(name);
  }
  if (fields.length > MAX_FILL_FIELDS) return here.drop(`fill keeps ${MAX_FILL_FIELDS} fields`);
  return fields;
}
function readWhen(raw, here, context, id) {
  const test = readExpr(raw.test);
  if (test === null) return here.drop("when test expression is malformed");
  if (test === void 0) return here.drop("when needs a test expression");
  if (!Array.isArray(raw.then)) return here.drop("when needs a then list");
  if (raw.else !== void 0 && !Array.isArray(raw.else)) return here.drop("else must be a list");
  const branch = { ...context, depth: context.depth + 1 };
  return {
    kind: "when",
    id,
    test,
    then: readNodes(raw.then, here.at("then"), branch),
    else: Array.isArray(raw.else) ? readNodes(raw.else, here.at("else"), branch) : []
  };
}
function readRepeat(raw, here, context, id) {
  if (context.inRepeat) return here.drop("a repeat cannot nest inside another repeat");
  const items = readExpr(raw.items);
  if (items === null) return here.drop("repeat items expression is malformed");
  const path = items === void 0 ? "" : items.get;
  if (!isReference(path) || !path.startsWith("data.")) return here.drop("repeat items must reference a data list");
  const list = context.data[path.slice("data.".length)];
  if (!Array.isArray(list)) return here.drop("repeat items must reference a data list");
  const key = ident(raw.key);
  if (!key) return here.drop("repeat needs a key field name");
  if (!Array.isArray(raw.template) || !raw.template.length) return here.drop("repeat needs a template list");
  if (raw.empty !== void 0 && !Array.isArray(raw.empty)) return here.drop("repeat empty must be a list");
  const branch = { ...context, depth: context.depth + 1, inRepeat: true };
  const node = {
    kind: "repeat",
    id,
    items,
    key,
    template: readNodes(raw.template, here.at("template"), branch),
    empty: Array.isArray(raw.empty) ? readNodes(raw.empty, here.at("empty"), branch) : []
  };
  if (list.length > MAX_REPEAT_ITEMS) here.drop(`repeat keeps the first ${MAX_REPEAT_ITEMS} items`);
  const shown2 = list.slice(0, MAX_REPEAT_ITEMS);
  if (shown2.length && !itemsKeyed(node, shown2)) return here.drop(`repeat needs a unique "${key}" on every item`);
  return node;
}
function repeatItems(block, node) {
  const path = node.items.get;
  const value = block.data[path.slice("data.".length)];
  return Array.isArray(value) ? value.slice(0, MAX_REPEAT_ITEMS) : [];
}
function readEmbedded(raw, here, id) {
  if (!isObject3(raw.spec)) return here.drop("block needs a spec object");
  const kind = raw.spec.type;
  if (kind === "include" || kind === "widget") return here.drop(`widget can't embed ${kind}`);
  if (!EMBED_KINDS.includes(kind)) {
    return here.drop("widget can embed stat, bar, chart, table or source");
  }
  const embed = kind;
  const bindings = readBindings(raw.bindings, embed, raw.spec, here.at("bindings"));
  if (bindings === null) return null;
  if (!readEmbed(embed, raw.spec)) return here.drop(`embedded ${embed} doesn't read`);
  return { kind: "block", id, spec: raw.spec, bindings };
}
function readBindings(raw, kind, spec, here) {
  if (raw === void 0) return {};
  if (!isObject3(raw)) return here.drop("bindings must be an object of pointer \u2192 expression");
  const bindings = {};
  for (const [pointer, expr] of Object.entries(raw)) {
    const target = bindingTarget(pointer, kind);
    if (!target) {
      here.drop(`binding "${pointer}" is not allowed on ${kind}`);
      continue;
    }
    const value = readExpr(expr);
    if (value === null) {
      here.drop(`binding "${pointer}" is not a valid expression`);
      continue;
    }
    if (value === void 0) {
      here.drop(`binding "${pointer}" needs an expression`);
      continue;
    }
    if (!target.exists(spec)) {
      here.drop(`binding "${pointer}" points outside the ${kind}`);
      continue;
    }
    bindings[pointer] = value;
  }
  return bindings;
}
function bindingTarget(pointer, kind) {
  if (kind === "stat") return pointer === "/value" ? { exists: () => true } : null;
  if (kind === "bar") {
    if (pointer === "/value" || pointer === "/max") return { exists: () => true };
    return null;
  }
  if (kind === "chart") {
    const match = /^\/series\/(\d+)\/data\/(\d+)$/.exec(pointer);
    if (!match) return null;
    const series = Number(match[1]);
    const point = Number(match[2]);
    return {
      exists: (spec) => {
        const list = spec.series;
        if (!Array.isArray(list) || !isObject3(list[series])) return false;
        const data = list[series].data;
        return Array.isArray(data) && point < data.length;
      }
    };
  }
  if (kind === "table") {
    const match = /^\/rows\/(\d+)\/(\d+|[A-Za-z0-9_-]+)$/.exec(pointer);
    if (!match) return null;
    const row = Number(match[1]);
    const cell = match[2];
    return {
      exists: (spec) => {
        const rows = spec.rows;
        if (!Array.isArray(rows)) return false;
        const one = rows[row];
        if (Array.isArray(one)) return Number(cell) < one.length;
        return isObject3(one);
      }
    };
  }
  return null;
}
function readExpr(raw) {
  if (raw === void 0) return void 0;
  return checkExpr(raw) === null ? raw : null;
}
function stateName(raw) {
  const text = typeof raw === "string" ? raw.trim() : "";
  const name = text.startsWith("state.") ? text.slice("state.".length) : text;
  return NAME2.test(name) && !PROTO2.has(name) ? name : void 0;
}
function cleanNode(node) {
  return Object.fromEntries(Object.entries(node).filter(([, value]) => value !== void 0));
}
function applyBindings(spec, bindings, scope) {
  const out = cloneJson(spec);
  const errors = [];
  for (const [pointer, expr] of Object.entries(bindings)) {
    const result = evaluate2(expr, scope);
    if (result.error) {
      errors.push(`${pointer}: ${result.error}`);
      continue;
    }
    const segments = pointer.split("/").slice(1);
    const why = writeBinding(out, segments, result.value);
    if (why) errors.push(`${pointer}: ${why}`);
  }
  return { spec: out, errors };
}
function writeBinding(spec, segments, value) {
  const head = segments[0];
  if (head === "value" || head === "max") {
    if (value === null) {
      if (head !== "value") return "max needs a number";
      spec[head] = null;
      return null;
    }
    if (typeof value !== "number" || !isFinite(value)) return "not a finite number";
    if (head === "max" && value <= 0) return "max must be above zero";
    spec[head] = value;
    return null;
  }
  if (head === "series" && segments.length === 4) {
    if (value !== null && (typeof value !== "number" || !isFinite(value))) return "a chart point must be a number or null";
    const series = spec.series;
    if (!Array.isArray(series)) return "the chart has no series";
    const one = series[Number(segments[1])];
    if (!isObject3(one) || !Array.isArray(one.data)) return "the chart point is outside the series";
    one.data[Number(segments[3])] = value;
    return null;
  }
  if (head === "rows" && segments.length === 3) {
    const cell = value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean";
    if (!cell) return "not a table cell";
    const rows = spec.rows;
    if (!Array.isArray(rows)) return "the table has no rows";
    const row = rows[Number(segments[1])];
    if (Array.isArray(row)) {
      row[Number(segments[2])] = value;
      return null;
    }
    if (isObject3(row)) {
      row[segments[2]] = value;
      return null;
    }
    return "the table row is outside the table";
  }
  return "not an allowed binding target";
}
function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}
function readEmbed(kind, spec) {
  const here = new Trail();
  switch (kind) {
    case "stat":
      return readStat(spec, here);
    case "bar":
      return readBar(spec, here);
    case "chart":
      return readChart(spec, here);
    case "table":
      return readTable(spec, here);
    case "source":
      return readSource(spec, here);
  }
}
function itemKey(node, item) {
  if (!isObject3(item)) return null;
  const value = item[node.key];
  if (typeof value === "string" && value) return value;
  if (typeof value === "number" && isFinite(value)) return String(value);
  return null;
}
function itemsKeyed(node, items) {
  const keys = /* @__PURE__ */ new Set();
  for (const item of items) {
    const key = itemKey(node, item);
    if (key === null || keys.has(key)) return false;
    keys.add(key);
  }
  return true;
}
function initialState(state) {
  return Object.fromEntries(Object.entries(state).map(([name, decl]) => [name, decl.initial]));
}

// src/blocks/widget/Widget.tsx
import { Fragment as Fragment6, jsx as jsx26, jsxs as jsxs23 } from "react/jsx-runtime";
function Widget({ block }) {
  const { fill } = useContext6(BlockActions);
  const uid = `hb-widget-${useId3().replace(/[^A-Za-z0-9_-]/g, "")}`;
  const [values, setValues] = useState13(() => initialState(block.state));
  const computed = useMemo7(() => evaluateComputed(block.computed, { data: block.data, state: values }), [block, values]);
  const context = {
    block,
    values,
    computed: computed.values,
    uid,
    set: (name, value) => setValues((all) => ({ ...all, [name]: value })),
    reset: () => setValues(initialState(block.state)),
    fill
  };
  return /* @__PURE__ */ jsx26("div", { className: "hb-widget", role: "group", "aria-label": block.title, children: drawNodes(block.view, context, null, []) });
}
function drawNodes(nodes, context, item, path) {
  return nodes.map((node) => /* @__PURE__ */ jsx26(Fragment5, { children: drawNode(node, context, item, path) }, `${path.join("/")}/${node.id}`));
}
function drawNode(node, context, item, path) {
  const scope = { data: context.block.data, state: context.values, computed: context.computed, item };
  const here = [...path, node.id];
  switch (node.kind) {
    case "stack":
    case "row":
    case "surface":
      return /* @__PURE__ */ jsx26("div", { className: `hb-widget-${node.kind} hb-widget-gap-${node.gap ?? "md"}`, children: drawNodes(node.children, context, item, here) });
    case "grid":
      return /* @__PURE__ */ jsx26("div", { className: `hb-widget-grid hb-widget-grid-${node.columns} hb-widget-gap-${node.gap ?? "md"}`, children: drawNodes(node.children, context, item, here) });
    case "text": {
      const result = node.text !== void 0 ? { value: node.text, error: null } : evaluate2(node.expr, scope);
      return /* @__PURE__ */ jsxs23("div", { className: `hb-widget-text hb-widget-tone-${node.tone ?? "plain"}`, children: [
        /* @__PURE__ */ jsx26(InlineText, { text: shownText(result.value) }),
        result.error && /* @__PURE__ */ jsxs23("span", { className: "hb-widget-note", role: "note", children: [
          " ",
          result.error
        ] })
      ] });
    }
    case "number": {
      const result = evaluate2(node.expr, scope);
      return /* @__PURE__ */ jsxs23("div", { className: `hb-widget-figure hb-widget-tone-${node.tone ?? "plain"}`, children: [
        node.label && /* @__PURE__ */ jsx26("div", { className: "hb-widget-figure-label", children: node.label }),
        /* @__PURE__ */ jsx26("div", { className: "hb-widget-figure-value", children: result.error ? "unavailable" : typeof result.value === "number" ? formatWithUnit(result.value, node.unit) : shownText(result.value) }),
        result.error && /* @__PURE__ */ jsx26("div", { className: "hb-widget-note", role: "note", children: result.error })
      ] });
    }
    case "badge": {
      const result = node.text !== void 0 ? { value: node.text, error: null } : evaluate2(node.expr, scope);
      return /* @__PURE__ */ jsxs23("div", { className: "hb-widget-badge", children: [
        /* @__PURE__ */ jsx26("span", { className: `hb-chip ${chipClass(node.tone)}`, children: shownText(result.value) }),
        result.error && /* @__PURE__ */ jsxs23("span", { className: "hb-widget-note", role: "note", children: [
          " ",
          result.error
        ] })
      ] });
    }
    case "divider":
      return /* @__PURE__ */ jsx26("div", { className: "hb-divider", role: "separator" });
    case "image":
      return /* @__PURE__ */ jsx26("figure", { className: "hb-image", children: /* @__PURE__ */ jsx26("img", { src: node.url, alt: node.alt, loading: "lazy", referrerPolicy: "no-referrer" }) });
    case "link":
      return /* @__PURE__ */ jsx26(LinkLine, { type: "link", text: node.text, url: node.url });
    case "input":
      return drawInput(node.state, node.control, node.label, context, here);
    case "button":
      return /* @__PURE__ */ jsx26("div", { className: "hb-widget-button", children: /* @__PURE__ */ jsx26("button", { type: "button", className: "hb-pill", onClick: () => runAction(node.action, context, item, scope), children: node.label }) });
    case "when": {
      const result = evaluate2(node.test, scope);
      const branch = result.value === true ? node.then : result.value === false ? node.else : [];
      return /* @__PURE__ */ jsxs23(Fragment6, { children: [
        drawNodes(branch, context, item, here),
        result.error && /* @__PURE__ */ jsx26("div", { className: "hb-widget-note", role: "note", children: result.error })
      ] });
    }
    case "repeat": {
      const items = repeatItems(context.block, node);
      if (!items.length) return /* @__PURE__ */ jsx26(Fragment6, { children: drawNodes(node.empty, context, item, here) });
      return /* @__PURE__ */ jsx26("div", { className: "hb-widget-repeat", children: items.map((entry2, i) => {
        const key = itemKey(node, entry2) ?? String(i);
        const next = entry2 !== null && typeof entry2 === "object" && !Array.isArray(entry2) ? entry2 : null;
        return /* @__PURE__ */ jsx26(Fragment5, { children: drawNodes(node.template, context, next, [...here, key]) }, key);
      }) });
    }
    case "block":
      return /* @__PURE__ */ jsx26(Embedded, { spec: node.spec, bindings: node.bindings, scope });
  }
}
function drawInput(name, control, label, context, here) {
  const decl = context.block.state[name];
  const id = `${context.uid}-${here.join("-")}`;
  const value = context.values[name];
  if (!decl) return null;
  if (control === "checkbox" && decl.type === "boolean") {
    return /* @__PURE__ */ jsxs23("label", { className: "hb-widget-field hb-widget-check", htmlFor: id, children: [
      /* @__PURE__ */ jsx26("input", { id, type: "checkbox", checked: value === true, onChange: (e) => context.set(name, e.target.checked) }),
      /* @__PURE__ */ jsx26("span", { className: "hb-widget-label", children: label })
    ] });
  }
  if (decl.type === "number" && (control === "number" || control === "slider")) {
    const current = typeof value === "number" ? value : decl.initial;
    return /* @__PURE__ */ jsxs23("label", { className: "hb-widget-field", htmlFor: id, children: [
      /* @__PURE__ */ jsxs23("span", { className: "hb-widget-field-head", children: [
        /* @__PURE__ */ jsx26("span", { className: "hb-widget-label", children: label }),
        /* @__PURE__ */ jsx26("span", { className: "hb-widget-value", children: formatNumber(current) })
      ] }),
      /* @__PURE__ */ jsx26(
        "input",
        {
          id,
          className: control === "slider" ? "hb-range" : "hb-input",
          type: control === "slider" ? "range" : "number",
          min: decl.min,
          max: decl.max,
          step: decl.step,
          value: current,
          onChange: (e) => {
            const next = Number(e.target.value);
            if (e.target.value !== "" && isFinite(next)) context.set(name, within(decl, next));
          }
        }
      )
    ] });
  }
  if (decl.type === "string" && control === "select") {
    return /* @__PURE__ */ jsxs23("label", { className: "hb-widget-field", htmlFor: id, children: [
      /* @__PURE__ */ jsx26("span", { className: "hb-widget-label", children: label }),
      /* @__PURE__ */ jsx26("select", { id, className: "hb-input", value: typeof value === "string" ? value : decl.initial, onChange: (e) => context.set(name, e.target.value), children: (decl.options ?? []).map((option) => /* @__PURE__ */ jsx26("option", { value: option, children: option }, option)) })
    ] });
  }
  if (decl.type === "string") {
    return /* @__PURE__ */ jsxs23("label", { className: "hb-widget-field", htmlFor: id, children: [
      /* @__PURE__ */ jsx26("span", { className: "hb-widget-label", children: label }),
      /* @__PURE__ */ jsx26(
        "input",
        {
          id,
          className: "hb-input",
          type: "text",
          maxLength: decl.maxLength,
          value: typeof value === "string" ? value : decl.initial,
          onChange: (e) => context.set(name, e.target.value.slice(0, decl.maxLength))
        }
      )
    ] });
  }
  return null;
}
function within(decl, value) {
  return Math.min(decl.max, Math.max(decl.min, value));
}
function typedValue(decl, value) {
  if (decl.type === "number") return typeof value === "number" && isFinite(value) ? within(decl, value) : null;
  if (decl.type === "boolean") return typeof value === "boolean" ? value : null;
  if (typeof value !== "string") return null;
  const text = value.slice(0, decl.maxLength);
  if (decl.options && !decl.options.includes(text)) return null;
  return text;
}
function runAction(action, context, item, scope) {
  if (action.op === "reset") {
    context.reset();
    return;
  }
  if (action.op === "fill") {
    context.fill(fillMessage(action, context));
    return;
  }
  const decl = context.block.state[action.state];
  if (!decl) return;
  const result = evaluate2(action.value, { ...scope, item });
  if (result.error || result.value === null) return;
  const value = typedValue(decl, result.value);
  if (value !== null) context.set(action.state, value);
}
function fillMessage(action, context) {
  const lines = action.fields.map((name) => {
    const decl = context.block.state[name];
    return `${decl?.label ?? name}: ${shownText(context.values[name])}`;
  });
  return lines.length ? `${action.message}

${lines.join("\n")}` : action.message;
}
function shownText(value) {
  if (typeof value === "number") return formatNumber(value);
  if (typeof value === "string") return value;
  if (typeof value === "boolean") return value ? "true" : "false";
  return "unknown";
}
function chipClass(tone2) {
  if (tone2 === "good") return "hb-chip-good";
  if (tone2 === "warn") return "hb-chip-warn";
  if (tone2 === "bad") return "hb-widget-chip-bad";
  if (tone2 === "info") return "hb-chip-soft";
  return "hb-chip-plain";
}
function Embedded({ spec, bindings, scope }) {
  const { spec: bound2, errors } = applyBindings(spec, bindings, scope);
  const block = readEmbed(spec.type, bound2);
  return /* @__PURE__ */ jsxs23(Fragment6, { children: [
    block && drawn(block),
    errors.map((why) => /* @__PURE__ */ jsx26("div", { className: "hb-widget-note", role: "note", children: why }, why))
  ] });
}
function drawn(block) {
  switch (block.type) {
    case "stat":
      return /* @__PURE__ */ jsx26(KpiCard, { item: block });
    case "bar":
      return /* @__PURE__ */ jsx26(Bar, { ...block });
    case "chart":
      return /* @__PURE__ */ jsx26(Chart, { spec: block.spec });
    case "table":
      return /* @__PURE__ */ jsx26(Table, { ...block });
    case "source":
      return /* @__PURE__ */ jsx26(Source, { ...block });
  }
}

// src/blocks/callout/read.ts
var TONES3 = {
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
  const tone2 = TONES3[toneWord] ?? "info";
  let title = firstText([raw.title], 80);
  let text = firstWords([raw.text, raw.body, raw.message, raw.content], 400);
  if (!text && title) {
    text = title;
    title = void 0;
  }
  if (!text) return here.drop("callout needs text");
  return clean({ type: "callout", tone: tone2, title, text });
}

// src/blocks/checklist/Checklist.tsx
import { useId as useId4 } from "react";
import { jsx as jsx27, jsxs as jsxs24 } from "react/jsx-runtime";
var STATE_WORDS = {
  pending: void 0,
  active: "In progress",
  blocked: "Blocked",
  skipped: "Skipped"
};
function segmentName(item, on) {
  const state = on ? "done" : item.state ? STATE_WORDS[item.state]?.toLowerCase() ?? item.state : "not started";
  const sources = item.sourceIds?.length ? `, sources ${item.sourceIds.join(", ")}` : "";
  return `${item.text}, ${state}${sources}`;
}
function Checklist({ title, numbered, items, ticked, path, density }) {
  const [ticks, tap] = useSavedTicks(path, ticked, items.length);
  const uid = useId4();
  const done = ticks.length;
  const allDone = done === items.length;
  const open = items.filter((_, i) => !ticks.includes(i));
  const blocked = open.filter((item) => item.state === "blocked").length;
  const skipped = open.filter((item) => item.state === "skipped").length;
  const pointer = items.some((item) => item.state) ? pointerAt(items, ticks) : -1;
  function row(item, index) {
    const on = ticks.includes(index);
    const state = on ? void 0 : item.state;
    const word = state ? STATE_WORDS[state] : void 0;
    const labelId = `${uid}-label-${index}`;
    const wordId = word ? `${uid}-state-${index}` : void 0;
    const ownerId = item.owner ? `${uid}-owner-${index}` : void 0;
    const noteId = item.note ? `${uid}-note-${index}` : void 0;
    const sourceId = item.sourceIds?.length ? `${uid}-source-${index}` : void 0;
    const describedBy = [wordId, ownerId, noteId, sourceId].filter(Boolean).join(" ") || void 0;
    const classes = ["hb-check", on ? "hb-check-on" : state ? `hb-check-${state}` : "", pointer === index ? "hb-check-pointer" : ""];
    return /* @__PURE__ */ jsx27("div", { className: "hb-checklist-row", children: /* @__PURE__ */ jsxs24(
      "button",
      {
        type: "button",
        role: "checkbox",
        "aria-checked": on,
        "aria-current": pointer === index ? "step" : void 0,
        "aria-labelledby": labelId,
        "aria-describedby": describedBy,
        onClick: () => tap(index),
        className: classes.join(" ").trim(),
        children: [
          /* @__PURE__ */ jsx27("span", { className: "hb-check-mark", children: on ? /* @__PURE__ */ jsx27(Icon, { name: "check", size: 13, stroke: 3 }) : numbered ? index + 1 : null }),
          /* @__PURE__ */ jsxs24("span", { className: "hb-check-text", children: [
            /* @__PURE__ */ jsxs24("span", { className: "hb-check-line", children: [
              /* @__PURE__ */ jsx27("span", { className: "hb-check-label", id: labelId, children: /* @__PURE__ */ jsx27(InlineText, { text: item.text }) }),
              word && /* @__PURE__ */ jsx27("span", { className: "hb-check-state", id: wordId, children: word }),
              item.owner && /* @__PURE__ */ jsx27("span", { className: "hb-check-owner", id: ownerId, children: item.owner })
            ] }),
            item.note && /* @__PURE__ */ jsx27("span", { className: "hb-check-note", id: noteId, children: item.note }),
            item.sourceIds?.length && /* @__PURE__ */ jsxs24("span", { className: "hb-check-source", id: sourceId, children: [
              "sources ",
              item.sourceIds.join(", ")
            ] })
          ] })
        ]
      }
    ) }, index);
  }
  return /* @__PURE__ */ jsxs24("div", { className: "hb-card hb-checklist", children: [
    /* @__PURE__ */ jsxs24("div", { className: "hb-checklist-head", children: [
      title && /* @__PURE__ */ jsx27("span", { className: "hb-card-title", children: /* @__PURE__ */ jsx27(InlineText, { text: title }) }),
      /* @__PURE__ */ jsx27("span", { className: allDone ? "hb-checklist-count hb-checklist-count-done" : "hb-checklist-count", "aria-live": "polite", children: countText(done, items.length, blocked, skipped) })
    ] }),
    /* @__PURE__ */ jsx27("div", { className: "hb-checklist-track", "aria-hidden": "true", children: /* @__PURE__ */ jsx27("span", { className: "hb-checklist-fill", style: { transform: `scaleX(${done / (items.length || 1)})` } }) }),
    density === "compact" && /* @__PURE__ */ jsx27("div", { className: "hb-checklist-compact", role: "group", "aria-label": title ?? "Phases", children: items.map((item, index) => {
      const on = ticks.includes(index);
      const state = on ? void 0 : item.state;
      const classes = [
        "hb-check-seg",
        on ? "hb-check-on" : state ? `hb-check-${state}` : "",
        pointer === index ? "hb-check-pointer" : ""
      ];
      return /* @__PURE__ */ jsx27(
        "button",
        {
          type: "button",
          role: "checkbox",
          "aria-checked": on,
          "aria-current": pointer === index ? "step" : void 0,
          "aria-label": segmentName(item, on),
          title: segmentName(item, on),
          onClick: () => tap(index),
          className: classes.join(" ").trim(),
          children: /* @__PURE__ */ jsx27("span", { className: "hb-sr", children: segmentName(item, on) })
        },
        index
      );
    }) }),
    density !== "compact" && segmentsOf(items).map(
      (segment, si) => segment.label ? /* @__PURE__ */ jsxs24("div", { className: "hb-checklist-group", role: "group", "aria-labelledby": `${uid}-group-${si}`, children: [
        /* @__PURE__ */ jsx27("div", { className: "hb-checklist-group-label", id: `${uid}-group-${si}`, children: /* @__PURE__ */ jsx27(InlineText, { text: segment.label }) }),
        segment.rows.map(({ item, index }) => row(item, index))
      ] }, si) : /* @__PURE__ */ jsx27("div", { className: "hb-checklist-plain", children: segment.rows.map(({ item, index }) => row(item, index)) }, si)
    )
  ] });
}
function countText(done, total, blocked, skipped) {
  const head = done === total ? "All done" : `${done} of ${total} done`;
  const beside = [blocked ? `${blocked} blocked` : "", skipped ? `${skipped} skipped` : ""].filter(Boolean);
  return beside.length ? `${head}, ${beside.join(", ")}` : head;
}
function pointerAt(items, ticks) {
  const open = (i) => !ticks.includes(i);
  const active = items.findIndex((item, i) => item.state === "active" && open(i));
  if (active >= 0) return active;
  return items.findIndex((item, i) => item.state === "pending" && open(i));
}
function segmentsOf(items) {
  const segments = [];
  items.forEach((item, index) => {
    const last = segments[segments.length - 1];
    const row = { item, index };
    if (item.group) {
      if (last?.label === item.group) last.rows.push(row);
      else segments.push({ label: item.group, rows: [row] });
    } else if (last && !last.label) last.rows.push(row);
    else segments.push({ rows: [row] });
  });
  return segments;
}
function useSavedTicks(path, ticked, count2) {
  const [ticks, setTicks] = useStoredValue({
    path,
    door: "always",
    initial: () => ticked,
    revive: (saved) => readTicks(saved, count2),
    stored: (value) => value
  });
  return [ticks, (i) => setTicks(toggleTick(ticks, i))];
}

// src/blocks/checklist/read.ts
var STATE_RULE = "item state is pending, active, done, blocked or skipped";
var STATE_ALIASES = {
  pending: "pending",
  todo: "pending",
  "to do": "pending",
  active: "active",
  "in progress": "active",
  doing: "active",
  done: "done",
  complete: "done",
  completed: "done",
  blocked: "blocked",
  skipped: "skipped"
};
var MAX_ITEMS2 = 40;
function readChecklist(raw, here) {
  const found = collectItems(raw, here);
  if (!found.length) return here.drop("checklist has no item with text");
  const kept = keepFirst(found, MAX_ITEMS2, here, "items");
  const items = [];
  const ticked = [];
  kept.forEach((item, i) => {
    items.push(clean({
      text: item.text,
      group: item.group,
      id: item.id,
      state: item.state,
      owner: item.owner,
      note: item.note,
      sourceIds: item.sourceIds
    }));
    if (item.done) ticked.push(i);
  });
  const numbered = raw.numbered === true || raw.ordered === true;
  const title = firstText([raw.title, raw.label], 80);
  const density = readDensity(raw.density);
  return clean({ type: "checklist", title, numbered, items, ticked, path: here.path, density });
}
function collectItems(raw, here) {
  const found = [];
  const flat = firstList([raw.items, raw.tasks, raw.steps]);
  flat?.forEach((item, i) => {
    const read = readItem2(item, void 0, here.at("items").at(i));
    if (read) found.push(read);
    else here.at("items").at(i).drop("item has no text");
  });
  const groups = firstList([raw.groups, raw.sections]) ?? [];
  groups.forEach((g, gi) => {
    const label = firstText([g?.label, g?.title, g?.name], 60);
    const list = firstList([g?.items, g?.tasks]) ?? [];
    list.forEach((item, i) => {
      const read = readItem2(item, label, here.at("groups").at(gi).at("items").at(i));
      if (read) found.push(read);
      else here.at("groups").at(gi).at("items").at(i).drop("item has no text");
    });
  });
  return found;
}
function readItem2(item, groupLabel, here) {
  if (typeof item === "string") {
    const text2 = firstText([item], 160);
    if (!text2) return null;
    return { text: text2, group: groupLabel, done: false };
  }
  if (!item || typeof item !== "object") return null;
  const text = firstText([item.text, item.title, item.label, item.name], 160);
  if (!text) return null;
  const group = firstText([item.group, item.section, item.category], 60) ?? groupLabel;
  const id = typeof item.id === "string" && item.id.trim() ? item.id.trim().slice(0, 40) : void 0;
  const state = readState2(item.state, here);
  return {
    text,
    group,
    id,
    done: item.done === true || item.checked === true || state === "done",
    state: state === "done" ? void 0 : state,
    owner: firstText([item.owner], 40),
    note: firstText([item.note], 120),
    sourceIds: readSourceIds(item.sourceIds ?? item.sources, here)
  };
}
function readSourceIds(raw, here) {
  if (!Array.isArray(raw)) return void 0;
  const ids = raw.map((id) => typeof id === "string" && id.trim() ? id.trim().slice(0, 40) : void 0).filter((id) => id !== void 0).slice(0, 4);
  if (raw.length > 4) here.drop("item keeps 4 source ids");
  return ids.length ? ids : void 0;
}
function readDensity(raw) {
  return typeof raw === "string" && raw.trim().toLowerCase() === "compact" ? "compact" : void 0;
}
function readState2(raw, here) {
  if (raw === void 0 || raw === null) return void 0;
  if (typeof raw === "string") {
    const found = STATE_ALIASES[raw.trim().toLowerCase()];
    if (found) return found;
  }
  here.drop(STATE_RULE);
  return void 0;
}

// src/blocks/flip/Flip.tsx
import { useState as useState14 } from "react";

// src/blocks/flip/columns.ts
function flipColumns(cards) {
  if (cards <= 4) return Math.max(1, cards);
  const lastRow = (cols) => cards % cols || cols;
  return lastRow(3) / 3 > lastRow(4) / 4 ? 3 : 4;
}

// src/blocks/flip/Flip.tsx
import { jsx as jsx28, jsxs as jsxs25 } from "react/jsx-runtime";
function Flip({ title, cards }) {
  const [turned, setTurned] = useState14(() => cards.map(() => false));
  const toggle = (i) => setTurned((was) => was.map((t, k) => k === i ? !t : t));
  const tall = cards.some((c) => c.image);
  return /* @__PURE__ */ jsxs25("div", { className: "hb-flip", children: [
    title && /* @__PURE__ */ jsx28("div", { className: "hb-card-title", children: title }),
    /* @__PURE__ */ jsx28(
      "div",
      {
        className: tall ? "hb-flip-grid hb-flip-tall" : "hb-flip-grid",
        style: { "--hb-flip-cols": flipColumns(cards.length) },
        children: cards.map((c, i) => /* @__PURE__ */ jsx28(Card2, { card: c, place: `${i + 1} of ${cards.length}`, turned: turned[i] === true, onTurn: () => toggle(i) }, i))
      }
    )
  ] });
}
function Card2({ card, place: place2, turned, onTurn }) {
  const [photoFailed, setPhotoFailed] = useState14(false);
  const photo = card.image && !photoFailed ? card.image : void 0;
  const label = turned ? `${card.front}: ${card.back}` : `${card.front}, tap to see the answer`;
  return /* @__PURE__ */ jsx28("button", { type: "button", className: "hb-flip-card", onClick: onTurn, "aria-pressed": turned, "aria-label": label, children: /* @__PURE__ */ jsxs25("span", { className: turned ? "hb-flip-inner hb-flip-turned" : "hb-flip-inner", children: [
    /* @__PURE__ */ jsxs25("span", { className: "hb-flip-face hb-flip-front", children: [
      /* @__PURE__ */ jsx28("span", { className: "hb-flip-label", children: place2 }),
      /* @__PURE__ */ jsx28("span", { className: "hb-flip-question", children: /* @__PURE__ */ jsx28(InlineText, { text: card.front }) }),
      /* @__PURE__ */ jsxs25("span", { className: "hb-flip-foot", children: [
        /* @__PURE__ */ jsx28("span", { children: "Tap to turn" }),
        /* @__PURE__ */ jsx28("span", { "aria-hidden": "true", children: "\u21BB" })
      ] })
    ] }),
    /* @__PURE__ */ jsxs25("span", { className: "hb-flip-face hb-flip-back", children: [
      photo && /* @__PURE__ */ jsx28("img", { src: photo, alt: "", loading: "lazy", referrerPolicy: "no-referrer", onError: () => setPhotoFailed(true) }),
      /* @__PURE__ */ jsx28("span", { className: "hb-flip-label", children: "Answer" }),
      /* @__PURE__ */ jsx28("span", { className: "hb-flip-answer", children: /* @__PURE__ */ jsx28(InlineText, { text: card.back }) })
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
import { Fragment as Fragment7, useId as useId5, useLayoutEffect as useLayoutEffect3, useMemo as useMemo8, useRef as useRef8, useState as useState15 } from "react";

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
function arc(a, control, b, count2 = 16) {
  return Array.from({ length: count2 + 1 }, (_, k) => {
    const t = k / count2;
    const u = 1 - t;
    return { x: u * u * a.x + 2 * u * t * control.x + t * t * b.x, y: u * u * a.y + 2 * u * t * control.y + t * t * b.y };
  });
}

// src/blocks/flow/walk.ts
function flowState(nodes, groups, steps, at2) {
  const holds = nodes.map((n) => n.holds ?? []);
  const place2 = (id) => id === void 0 ? -1 : nodes.findIndex((n) => n.id === id);
  const moving = isMoving(nodes, steps);
  let seen = /* @__PURE__ */ new Set();
  let layers = groups.map(() => 0);
  let lit;
  for (const step of steps.slice(0, at2 + 1)) {
    const i = place2(step.node);
    if (i === 0 && seen.size) {
      seen = /* @__PURE__ */ new Set();
      layers = groups.map(() => 0);
    }
    if (i >= 0) seen.add(i);
    for (const [id, chips] of Object.entries(step.holds ?? {})) {
      const k = place2(id);
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
import { Fragment as Fragment8, jsx as jsx29, jsxs as jsxs26 } from "react/jsx-runtime";
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
function pieces(count2, groups) {
  const out = [];
  for (let i = 0; i < count2; i++) {
    const group = groups.find((g) => g.from === i);
    if (group) {
      out.push({ start: i, end: group.to, group });
      i = group.to;
    } else out.push({ start: i, end: i });
  }
  return out;
}
function Flow({ id, title, direction, nodes, groups = [] }) {
  const box = useRef8(null);
  const packet = useRef8(null);
  const boxes = useRef8([]);
  const width = useWidth(box);
  const [open, setOpen] = useState15(null);
  const walk = useWalk(id);
  const steps = walk?.steps ?? NO_STEPS;
  const target = useMemo8(() => flowState(nodes, groups, steps, walk?.at ?? 0), [nodes, groups, steps, walk?.at]);
  const travelling = useTravel(walk, nodes, groups, target, packet, boxes, box);
  const state = travelling ?? target;
  const moving = isMoving(nodes, steps);
  const holds = state.holds.some((h) => h.length > 0);
  const panelId = useId5();
  const down = direction === "down" || !fitsAcross(nodes.length, groups.length, width, holds);
  const shown2 = open === null ? void 0 : nodes[open];
  const node = (n, i, arrow) => /* @__PURE__ */ jsxs26("li", { className: "hb-flow-step", children: [
    arrow && /* @__PURE__ */ jsx29(Arrow, {}),
    /* @__PURE__ */ jsx29(
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
  return /* @__PURE__ */ jsxs26("div", { className: "hb-card hb-flow", onKeyDown, children: [
    title && /* @__PURE__ */ jsx29("div", { className: "hb-card-title", children: title }),
    /* @__PURE__ */ jsxs26("div", { ref: box, className: "hb-flow-box", children: [
      /* @__PURE__ */ jsx29("ol", { className: `hb-flow-chain ${down ? "hb-flow-down" : "hb-flow-right"}`, children: pieces(nodes.length, groups).map(({ start, end, group }) => group ? /* @__PURE__ */ jsxs26("li", { className: "hb-flow-step", style: { flexGrow: end - start + 1 }, children: [
        start > 0 && /* @__PURE__ */ jsx29(Arrow, {}),
        /* @__PURE__ */ jsxs26("div", { className: "hb-flow-group", children: [
          /* @__PURE__ */ jsxs26("div", { className: "hb-flow-group-head", children: [
            /* @__PURE__ */ jsx29("span", { className: "hb-flow-group-label", children: group.label }),
            group.count !== void 0 && /* @__PURE__ */ jsx29(Counter, { layer: state.layers[groups.indexOf(group)], count: group.count })
          ] }),
          /* @__PURE__ */ jsx29("ol", { className: "hb-flow-chain", children: nodes.slice(start, end + 1).map((n, k) => node(n, start + k, k > 0)) })
        ] })
      ] }, start) : /* @__PURE__ */ jsx29(Fragment7, { children: node(nodes[start], start, start > 0) }, start)) }),
      moving && walk && /* @__PURE__ */ jsx29("div", { ref: packet, className: "hb-flow-packet", "aria-hidden": "true" })
    ] }),
    shown2?.note && /* @__PURE__ */ jsxs26("div", { id: panelId, className: "hb-flow-panel", role: "region", "aria-label": shown2.label, children: [
      /* @__PURE__ */ jsx29("div", { className: "hb-flow-panel-title", children: shown2.label }),
      /* @__PURE__ */ jsx29("p", { className: "hb-flow-note", children: /* @__PURE__ */ jsx29(InlineText, { text: shown2.note }) })
    ] })
  ] });
}
function Counter({ layer, count: count2 }) {
  return /* @__PURE__ */ jsx29("span", { className: "hb-chip hb-chip-soft hb-flow-count", children: layer ? `layer ${layer} of ${count2}` : `\xD7 ${count2}` });
}
function useTravel(walk, nodes, groups, target, packet, boxes, frame) {
  const [travelling, setTravelling] = useState15(null);
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
  const holds = chips.length > 0 && /* @__PURE__ */ jsx29(Chips, { chips }, JSON.stringify(chips));
  const inside2 = /* @__PURE__ */ jsxs26(Fragment8, { children: [
    node.icon && /* @__PURE__ */ jsx29("span", { className: "hb-flow-icon", children: /* @__PURE__ */ jsx29(Icon, { name: node.icon, size: 14 }) }),
    /* @__PURE__ */ jsx29("span", { className: "hb-flow-label", children: node.label })
  ] });
  if (!node.note) return /* @__PURE__ */ jsxs26("div", { ref: boxRef, className, "aria-current": lit ? "step" : void 0, children: [
    inside2,
    holds
  ] });
  return /* @__PURE__ */ jsxs26(
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
        /* @__PURE__ */ jsx29("span", { className: "hb-flow-more", "aria-hidden": "true", children: open ? "\u2212" : "+" }),
        holds
      ]
    }
  );
}
function Chips({ chips }) {
  return /* @__PURE__ */ jsx29("span", { className: "hb-flow-holds", children: chips.map((c, k) => /* @__PURE__ */ jsx29("span", { className: c.accent ? "hb-flow-chip hb-flow-chip-accent" : "hb-flow-chip", children: c.text }, k)) });
}
function Arrow() {
  return /* @__PURE__ */ jsx29("span", { className: "hb-flow-arrow", "aria-hidden": "true", children: /* @__PURE__ */ jsx29(
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
      children: /* @__PURE__ */ jsx29("path", { d: "M4 12h15M13 6l6 6-6 6" })
    }
  ) });
}

// src/blocks/flow/read.ts
var MAX_NODES2 = 10;
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
  const kept = keepFirst(nodes, MAX_NODES2, here, "nodes");
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
    const count2 = num(g.count);
    const counted = count2 !== null && Number.isInteger(count2) && count2 >= 2 && count2 <= 100 ? count2 : void 0;
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
import { useContext as useContext7 } from "react";

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
var KINDS3 = ["select", "radio", "checkbox", "text", "slider"];
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
  if (!kind) return here.drop(`field kind "${named}" isn't one of ${KINDS3.join(", ")}`);
  const id = firstText([item.id, item.name, item.key], 200);
  if (!id) return here.drop("field needs an id");
  if (!FIELD_ID.test(id)) return here.drop('field id must be a word like "where" (letters, digits, _ or -)');
  if (RESERVED_IDS.includes(id)) return here.drop(`field id "${id}" is reserved`);
  const whole2 = firstText([item.label, item.title], 400);
  const group = firstText([item.group, item.section], GROUP);
  const base = clean({ id, label: whole2 ? shortLabel2(whole2) : id, group, required: item.required === true });
  if (kind === "text") return readTextField(item, named, base);
  if (kind === "slider") return readSlider(item, base, here);
  const options = readOptions2(firstList([item.options, item.choices]) ?? [], here);
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
function readOptions2(list, here) {
  const options = [];
  for (const o of list) {
    const isObject5 = !!o && typeof o === "object";
    const value = isObject5 ? firstTextOrNumber([o.value, o.id, o.label], OPTION) : firstTextOrNumber([o], OPTION);
    if (value === void 0 || options.some((x) => x.value === value)) continue;
    const label = (isObject5 ? firstText([o.label, o.name], OPTION) : void 0) ?? value;
    const note = isObject5 ? firstText([o.note, o.description], NOTE) : void 0;
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
function startsGroup(fields, i) {
  const group = fields[i].group;
  if (!group) return false;
  return fields[i - 1]?.group !== group;
}
function answerMessage(form, values) {
  const lines = [form.title ? `Form: ${form.title} (${form.id})` : `Form: ${form.id}`];
  form.fields.forEach((f, i) => {
    if (startsGroup(form.fields, i)) lines.push(`\u2014 ${f.group} \u2014`);
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
function draftFits(saved, form) {
  if (!saved || typeof saved !== "object" || Array.isArray(saved)) return null;
  const given = saved;
  const values = startingValues(form);
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
import { jsx as jsx30, jsxs as jsxs27 } from "react/jsx-runtime";
function Form(form) {
  const { send } = useContext7(BlockActions);
  const [draft, writeDraft] = useStoredValue({
    door: "identity",
    field: "~v",
    initial: () => startingValues(form),
    revive: (saved) => draftFits(saved, form),
    stored: (value) => value
  });
  const [record, setRecord] = useStoredValue({
    path: form.path,
    door: "always",
    initial: () => null,
    revive: (saved) => readSent(saved, form) !== null ? saved : null,
    stored: (value) => value
  });
  const sent = record !== null;
  const answers = record !== null ? readSent(record, form) : null;
  const values = answers ?? draft;
  const ready = canSend(form, values, sent);
  function onSend() {
    if (!ready) return;
    setRecord(sentRecord(values));
    send(answerMessage(form, values));
  }
  return /* @__PURE__ */ jsxs27(
    "form",
    {
      className: sent ? "hb-card hb-form hb-form-sent" : "hb-card hb-form",
      "aria-disabled": sent,
      onSubmit: (e) => {
        e.preventDefault();
        onSend();
      },
      children: [
        form.title && /* @__PURE__ */ jsx30("div", { className: "hb-card-title", children: /* @__PURE__ */ jsx30(InlineText, { text: form.title }) }),
        /* @__PURE__ */ jsx30("fieldset", { disabled: sent, children: form.fields.map((field, i) => /* @__PURE__ */ jsxs27("div", { children: [
          startsGroup(form.fields, i) && /* @__PURE__ */ jsx30("div", { className: "hb-form-group", children: /* @__PURE__ */ jsx30(InlineText, { text: field.group }) }),
          /* @__PURE__ */ jsx30(
            FieldView,
            {
              field,
              value: values[field.id],
              onChange: (v) => writeDraft({ ...values, [field.id]: v })
            }
          )
        ] }, field.id)) }),
        /* @__PURE__ */ jsxs27("div", { className: "hb-form-foot", children: [
          sent && /* @__PURE__ */ jsx30("span", { className: "hb-form-done", children: "\u2713 Sent" }),
          /* @__PURE__ */ jsx30("button", { type: "submit", className: "hb-pill hb-pill-solid", disabled: !ready, children: form.submit })
        ] })
      ]
    }
  );
}
function FieldView({ field, value, onChange }) {
  if (field.kind === "slider") {
    const at2 = typeof value === "number" ? value : field.value;
    return /* @__PURE__ */ jsxs27("label", { className: "hb-form-field", children: [
      /* @__PURE__ */ jsxs27("span", { className: "hb-calc-head", children: [
        /* @__PURE__ */ jsx30("span", { className: "hb-calc-label", children: /* @__PURE__ */ jsx30(InlineText, { text: field.label }) }),
        /* @__PURE__ */ jsx30("span", { className: "hb-calc-value", children: formatWithUnit(at2, field.unit) })
      ] }),
      /* @__PURE__ */ jsx30(
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
      field.ends && /* @__PURE__ */ jsxs27("span", { className: "hb-form-ends", children: [
        /* @__PURE__ */ jsx30("span", { children: field.ends[0] }),
        /* @__PURE__ */ jsx30("span", { children: field.ends[1] })
      ] })
    ] });
  }
  if (field.kind === "text") {
    const text = typeof value === "string" ? value : "";
    const props = { className: "hb-input", value: text, maxLength: TEXT_VALUE, placeholder: field.placeholder };
    return /* @__PURE__ */ jsxs27("label", { className: "hb-form-field", children: [
      /* @__PURE__ */ jsx30("span", { className: "hb-form-label", children: /* @__PURE__ */ jsx30(InlineText, { text: field.label }) }),
      field.multiline ? /* @__PURE__ */ jsx30("textarea", { ...props, rows: 3, onChange: (e) => onChange(e.target.value) }) : /* @__PURE__ */ jsx30("input", { type: "text", ...props, onChange: (e) => onChange(e.target.value) })
    ] });
  }
  if (field.kind === "select") {
    const chosen = field.options.find((o) => o.value === value);
    return /* @__PURE__ */ jsxs27("label", { className: "hb-form-field", children: [
      /* @__PURE__ */ jsx30("span", { className: "hb-form-label", children: /* @__PURE__ */ jsx30(InlineText, { text: field.label }) }),
      /* @__PURE__ */ jsxs27("select", { className: "hb-input", value: chosen ? chosen.value : "", onChange: (e) => onChange(e.target.value), children: [
        !chosen && /* @__PURE__ */ jsx30("option", { value: "", disabled: true, children: "Choose\u2026" }),
        field.options.map((o) => /* @__PURE__ */ jsx30("option", { value: o.value, children: o.label }, o.value))
      ] }),
      chosen?.note && /* @__PURE__ */ jsx30("span", { className: "hb-form-note", children: chosen.note })
    ] });
  }
  return /* @__PURE__ */ jsx30(Pills, { field, value, onChange });
}
function Pills({ field, value, onChange }) {
  const isRadio = field.kind === "radio";
  const picked = isRadio ? [String(value ?? "")] : Array.isArray(value) ? value : [];
  function tap(option) {
    if (isRadio) return onChange(option.value);
    const ticked = picked.includes(option.value) ? picked.filter((v) => v !== option.value) : [...picked, option.value];
    onChange(field.options.map((o) => o.value).filter((v) => ticked.includes(v)));
  }
  return /* @__PURE__ */ jsxs27("div", { className: "hb-form-field", role: isRadio ? "radiogroup" : "group", "aria-label": field.label, children: [
    /* @__PURE__ */ jsx30("span", { className: "hb-form-label", children: /* @__PURE__ */ jsx30(InlineText, { text: field.label }) }),
    /* @__PURE__ */ jsx30("div", { className: "hb-options", children: field.options.map((o) => {
      const on = picked.includes(o.value);
      return /* @__PURE__ */ jsxs27(
        "button",
        {
          type: "button",
          role: isRadio ? "radio" : "checkbox",
          "aria-checked": on,
          onClick: () => tap(o),
          className: on ? "hb-option hb-option-on" : "hb-option",
          children: [
            o.label,
            o.note && /* @__PURE__ */ jsx30("span", { className: "hb-option-note", children: o.note })
          ]
        },
        o.value
      );
    }) })
  ] });
}

// src/blocks/heatmap/Heatmap.tsx
import { Fragment as Fragment9, useState as useState16 } from "react";

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
function cellText2(value, unit) {
  if (value === null) return "\u2013";
  const text = Number.isInteger(value) ? String(value) : value.toFixed(1);
  if (!unit) return text;
  if (unit === "%") return `${text}%`;
  return `${text} ${unit}`;
}

// src/blocks/heatmap/Heatmap.tsx
import { jsx as jsx31, jsxs as jsxs28 } from "react/jsx-runtime";
var SHOW_NUMBERS_UP_TO = 6;
function Heatmap({ title, rows, cols, values, unit, scale }) {
  const [picked, setPicked] = useState16(null);
  const range = rangeOf(values);
  const numbersInCells = cols.length <= SHOW_NUMBERS_UP_TO;
  return /* @__PURE__ */ jsxs28("div", { className: "hb-card hb-heatmap", children: [
    title && /* @__PURE__ */ jsx31("div", { className: "hb-card-title", children: title }),
    /* @__PURE__ */ jsxs28(
      "div",
      {
        className: "hb-heat-grid",
        style: { gridTemplateColumns: `minmax(0, max-content) repeat(${cols.length}, minmax(0, 1fr))` },
        role: "table",
        "aria-label": title ?? "Heat map",
        children: [
          /* @__PURE__ */ jsx31("span", {}),
          cols.map((c, j) => /* @__PURE__ */ jsx31("span", { className: "hb-heat-col", role: "columnheader", children: c }, j)),
          rows.map((r, i) => /* @__PURE__ */ jsxs28(Fragment9, { children: [
            /* @__PURE__ */ jsx31("span", { className: "hb-heat-row", role: "rowheader", children: r }),
            cols.map((c, j) => {
              const v = values[i][j];
              return /* @__PURE__ */ jsx31(
                "button",
                {
                  type: "button",
                  className: "hb-heat-cell",
                  style: { background: cellColour(v, range, scale) },
                  onClick: () => setPicked({ row: i, col: j }),
                  "aria-label": `${r}, ${c}: ${v === null ? "no data" : cellText2(v, unit)}`,
                  children: numbersInCells && v !== null ? cellText2(v, unit) : ""
                },
                j
              );
            })
          ] }, i))
        ]
      }
    ),
    picked && /* @__PURE__ */ jsxs28("div", { className: "hb-heat-picked", children: [
      rows[picked.row],
      " \xB7 ",
      cols[picked.col],
      ": ",
      /* @__PURE__ */ jsx31("b", { children: cellText2(values[picked.row][picked.col], unit) })
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
import { useEffect as useEffect2, useState as useState17 } from "react";
import { jsx as jsx32, jsxs as jsxs29 } from "react/jsx-runtime";
var GRID_FROM = 4;
function Images({ block }) {
  const [failed, setFailed] = useState17(/* @__PURE__ */ new Set());
  const [open, setOpen] = useState17(null);
  const shown2 = block.images.filter((p) => !failed.has(p.url));
  if (!shown2.length) return null;
  const fail2 = (url) => setFailed((before) => new Set(before).add(url));
  const grid = shown2.length >= GRID_FROM;
  const download = (p) => /* @__PURE__ */ jsx32(
    "a",
    {
      className: "hb-photo-download",
      href: p.url,
      download: p.caption || "photo",
      "aria-label": `Download ${p.caption ?? "photo"}`,
      onClick: (e) => e.stopPropagation(),
      children: /* @__PURE__ */ jsx32("span", { "aria-hidden": "true", children: "\u2193" })
    }
  );
  return /* @__PURE__ */ jsxs29("figure", { className: grid ? "hb-photos hb-photos-grid" : "hb-photos", children: [
    block.title && /* @__PURE__ */ jsx32("figcaption", { className: "hb-chart-title", children: block.title }),
    /* @__PURE__ */ jsx32("div", { className: "hb-photo-strip", children: shown2.map((p) => grid ? /* @__PURE__ */ jsxs29("div", { className: "hb-photo", children: [
      /* @__PURE__ */ jsx32("button", { type: "button", className: "hb-photo-open", onClick: () => setOpen(p), "aria-label": p.caption ?? "Open photo", children: /* @__PURE__ */ jsx32("img", { src: p.url, alt: p.caption ?? "", loading: "lazy", referrerPolicy: "no-referrer", onError: () => fail2(p.url) }) }),
      /* @__PURE__ */ jsxs29("div", { className: "hb-photo-text", children: [
        /* @__PURE__ */ jsxs29("button", { type: "button", className: "hb-photo-label", onClick: () => setOpen(p), children: [
          p.caption && /* @__PURE__ */ jsx32("span", { className: "hb-photo-caption", children: p.caption }),
          p.source && /* @__PURE__ */ jsx32("span", { className: "hb-photo-source", children: p.source })
        ] }),
        download(p)
      ] })
    ] }, p.url) : /* @__PURE__ */ jsxs29("div", { className: "hb-photo", children: [
      /* @__PURE__ */ jsxs29("button", { type: "button", className: "hb-photo-open", onClick: () => setOpen(p), "aria-label": p.caption ?? "Open photo", children: [
        /* @__PURE__ */ jsx32("img", { src: p.url, alt: p.caption ?? "", loading: "lazy", referrerPolicy: "no-referrer", onError: () => fail2(p.url) }),
        (p.caption || p.source) && /* @__PURE__ */ jsxs29("span", { className: "hb-photo-text", children: [
          p.caption && /* @__PURE__ */ jsx32("span", { className: "hb-photo-caption", children: p.caption }),
          p.source && /* @__PURE__ */ jsx32("span", { className: "hb-photo-source", children: p.source })
        ] })
      ] }),
      download(p)
    ] }, p.url)) }),
    open && /* @__PURE__ */ jsx32(Overlay, { photo: open, onClose: () => setOpen(null) })
  ] });
}
function Overlay({ photo, onClose }) {
  useEffect2(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return /* @__PURE__ */ jsxs29("div", { className: "hb-photo-overlay", role: "dialog", "aria-label": photo.caption ?? "Photo", onClick: onClose, children: [
    /* @__PURE__ */ jsx32("img", { src: photo.url, alt: photo.caption ?? "", referrerPolicy: "no-referrer" }),
    (photo.caption || photo.source) && /* @__PURE__ */ jsxs29("div", { className: "hb-photo-overlay-text", children: [
      photo.caption,
      photo.source && /* @__PURE__ */ jsxs29("span", { children: [
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

// src/blocks/layout/Containers.tsx
import { isValidElement, useState as useState18 } from "react";
import { jsx as jsx33, jsxs as jsxs30 } from "react/jsx-runtime";
function cellKey(child, i) {
  const k = isValidElement(child) ? child.key : null;
  return `c:${k ?? i}`;
}
var OWN_WIDTH_KINDS = ["badge", "button", "link"];
function Row2({ kinds, children }) {
  return /* @__PURE__ */ jsx33("div", { className: "hb-row", children: children.map((child, i) => /* @__PURE__ */ jsx33("div", { className: OWN_WIDTH_KINDS.includes(kinds[i]) ? "hb-row-cell hb-row-cell-own" : "hb-row-cell", children: child }, cellKey(child, i))) });
}
function Grid({ children }) {
  return /* @__PURE__ */ jsx33("div", { className: "hb-grid", children: children.map((child, i) => /* @__PURE__ */ jsx33("div", { className: "hb-grid-cell", children: child }, cellKey(child, i))) });
}
function Columns({ children }) {
  return /* @__PURE__ */ jsx33("div", { className: "hb-columns", children: children.map((child, i) => /* @__PURE__ */ jsx33("div", { className: "hb-column", children: child }, cellKey(child, i))) });
}
function Section({ title, collapsed, children }) {
  const [open, setOpen] = useState18(!collapsed);
  if (!collapsed) {
    return /* @__PURE__ */ jsxs30("div", { className: "hb-card hb-section", children: [
      title && /* @__PURE__ */ jsx33("div", { className: "hb-card-title", children: /* @__PURE__ */ jsx33(InlineText, { text: title }) }),
      /* @__PURE__ */ jsx33("div", { className: "hb-section-body", children })
    ] });
  }
  return /* @__PURE__ */ jsxs30("div", { className: "hb-card hb-section", children: [
    /* @__PURE__ */ jsxs30("button", { type: "button", className: "hb-section-toggle", onClick: () => setOpen(!open), "aria-expanded": open, children: [
      /* @__PURE__ */ jsx33("span", { className: "hb-card-title", children: /* @__PURE__ */ jsx33(InlineText, { text: title ?? "" }) }),
      /* @__PURE__ */ jsx33(
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
          children: /* @__PURE__ */ jsx33("path", { d: "M9 6l6 6-6 6" })
        }
      )
    ] }),
    open && /* @__PURE__ */ jsx33("div", { className: "hb-section-body hb-appear", children })
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
var MAX_COLUMNS2 = 3;
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
    return [{ type: "columns", children: keepFirst(children, MAX_COLUMNS2, here, "children") }];
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
var MAX_BADGE = 999;
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
  const badge = item.badge;
  return Number.isInteger(badge) && badge >= 1 && badge <= MAX_BADGE ? { label, children, badge } : { label, children };
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
import { useId as useId6, useRef as useRef9 } from "react";
import { jsx as jsx34, jsxs as jsxs31 } from "react/jsx-runtime";
function tabAfterKey(current, count2, key) {
  if (key === "ArrowRight") return (current + 1) % count2;
  if (key === "ArrowLeft") return (current - 1 + count2) % count2;
  return current;
}
function Tabs({ labels: labels2, badges = [], panel }) {
  const [answer, pick] = useStoredValue({
    door: "identity",
    initial: () => 0,
    revive: (saved) => Number.isInteger(saved) && saved >= 0 ? saved : null,
    stored: (value) => value
  });
  const picked = answer < labels2.length ? answer : 0;
  const buttons = useRef9([]);
  const base = useId6().replace(/[^a-zA-Z0-9]/g, "");
  const onKey = (e) => {
    const next = tabAfterKey(picked, labels2.length, e.key);
    if (next === picked) return;
    e.preventDefault();
    pick(next);
    buttons.current[next]?.focus();
  };
  return /* @__PURE__ */ jsxs31("div", { className: "hb-tabs", children: [
    /* @__PURE__ */ jsx34("div", { className: "hb-tab-bar", role: "tablist", onKeyDown: onKey, children: labels2.map((label, i) => /* @__PURE__ */ jsxs31(
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
        onClick: () => pick(i),
        "aria-label": badges[i] ? `${label}, ${badges[i]} open` : void 0,
        children: [
          /* @__PURE__ */ jsx34(InlineText, { text: label }),
          badges[i] ? /* @__PURE__ */ jsx34("span", { className: "hb-tab-badge", "aria-hidden": "true", children: badges[i] }) : null
        ]
      },
      i
    )) }),
    /* @__PURE__ */ jsx34("div", { className: "hb-tab-panel hb-appear", role: "tabpanel", id: `${base}-panel`, "aria-labelledby": `${base}-tab-${picked}`, children: panel(picked) }, picked)
  ] });
}

// src/blocks/list/List.tsx
import { useContext as useContext8, useState as useState19 } from "react";

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
import { Fragment as Fragment10, jsx as jsx35, jsxs as jsxs32 } from "react/jsx-runtime";
function List({ title, ranked, items, max }) {
  const hasBars = items.some((item) => item.bar !== void 0);
  const ceiling = max ?? Math.max(0, ...items.map((item) => item.bar ?? 0));
  return /* @__PURE__ */ jsxs32("div", { className: hasBars ? "hb-card hb-list hb-list-bars" : "hb-card hb-list", children: [
    title && /* @__PURE__ */ jsx35("div", { className: "hb-list-heading", children: /* @__PURE__ */ jsx35(InlineText, { text: title }) }),
    items.map((item, i) => /* @__PURE__ */ jsx35(ListRow, { item, rank: ranked ? i + 1 : null, ceiling }, i))
  ] });
}
function ListRow({ item, rank, ceiling }) {
  const { send } = useContext8(BlockActions);
  const [photoFailed, setPhotoFailed] = useState19(false);
  const lead = rowLead(item, rank !== null, photoFailed);
  const width = ceiling > 0 ? Math.max(0, Math.min(1, (item.bar ?? 0) / ceiling)) * 100 : 0;
  const body = /* @__PURE__ */ jsxs32(Fragment10, { children: [
    rank !== null && /* @__PURE__ */ jsx35("span", { className: "hb-list-rank", children: rank }),
    lead === "image" && /* @__PURE__ */ jsx35("img", { className: "hb-list-photo", src: item.image, alt: "", loading: "lazy", referrerPolicy: "no-referrer", onError: () => setPhotoFailed(true) }),
    lead === "icon" && item.icon && /* @__PURE__ */ jsx35("span", { className: "hb-list-icon", children: /* @__PURE__ */ jsx35(Icon, { name: item.icon, size: 17, stroke: 2.2 }) }),
    lead === "initial" && /* @__PURE__ */ jsx35("span", { className: "hb-list-initial", style: { background: avatarColour(item.title) }, "aria-hidden": "true", children: initialOf(item.title) }),
    /* @__PURE__ */ jsxs32("span", { className: "hb-list-body", children: [
      /* @__PURE__ */ jsx35("span", { className: "hb-list-title", children: /* @__PURE__ */ jsx35(InlineText, { text: item.title }) }),
      item.subtitle && /* @__PURE__ */ jsx35("span", { className: "hb-list-subtitle", children: /* @__PURE__ */ jsx35(InlineText, { text: item.subtitle }) })
    ] }),
    (item.bar !== void 0 || item.value) && /* @__PURE__ */ jsxs32("span", { className: "hb-list-tail", children: [
      item.bar !== void 0 && /* @__PURE__ */ jsx35("span", { className: "hb-list-bar", "aria-hidden": "true", children: /* @__PURE__ */ jsx35("span", { className: "hb-list-bar-fill", style: { width: `${width}%` } }) }),
      item.value && /* @__PURE__ */ jsx35("span", { className: "hb-list-value", children: /* @__PURE__ */ jsx35(InlineText, { text: item.value }) })
    ] }),
    (item.run || item.url) && /* @__PURE__ */ jsx35(Chevron, {})
  ] });
  if (item.run) {
    const run = item.run;
    return /* @__PURE__ */ jsx35("button", { type: "button", className: "hb-list-row hb-list-link hb-list-button", title: run, onClick: () => send(run), children: body });
  }
  if (item.url) {
    return /* @__PURE__ */ jsx35("a", { className: "hb-list-row hb-list-link", href: item.url, target: "_blank", rel: "noreferrer", children: body });
  }
  return /* @__PURE__ */ jsx35("div", { className: "hb-list-row", children: body });
}
function Chevron() {
  return /* @__PURE__ */ jsx35(
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
      children: /* @__PURE__ */ jsx35("path", { d: "M9 6l6 6-6 6" })
    }
  );
}

// src/blocks/layers/Layers.tsx
import { useEffect as useEffect4, useRef as useRef10, useState as useState21 } from "react";

// src/lib/canvas.ts
import { useEffect as useEffect3, useState as useState20 } from "react";
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
function colourOf2(el, token) {
  const before = el.style.color;
  el.style.color = `var(${token})`;
  const colour = getComputedStyle(el).color;
  el.style.color = before;
  return colour;
}
function useTheme() {
  const [version2, setVersion] = useState20(0);
  useEffect3(() => {
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
  return version2;
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
import { jsx as jsx36, jsxs as jsxs33 } from "react/jsx-runtime";
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
var rad = (deg3) => deg3 * Math.PI / 180;
function Layers({ title, caption: caption2, layers }) {
  const canvas = useRef10(null);
  const shapes = useRef10([]);
  const drag = useRef10(null);
  const [at2, setAt] = useState21(0);
  const [yaw, setYaw] = useState21(START_YAW);
  const open = useOpening(at2, layers.length);
  const width = useWidth(canvas);
  const theme = useTheme();
  const layer = layers[at2];
  const go = (i) => setAt(Math.max(0, Math.min(layers.length - 1, i)));
  const turn = (by) => setYaw((was) => Math.max(-TURN, Math.min(TURN, was + by)));
  useEffect4(() => {
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
  return /* @__PURE__ */ jsxs33("div", { className: "hb-card hb-layers", children: [
    title && /* @__PURE__ */ jsx36("div", { className: "hb-card-title", children: title }),
    /* @__PURE__ */ jsxs33("div", { className: "hb-layers-body", children: [
      /* @__PURE__ */ jsxs33("div", { className: "hb-layers-stage", children: [
        /* @__PURE__ */ jsx36(
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
        /* @__PURE__ */ jsx36("p", { className: "hb-layers-hint", children: "Drag the drawing, or use \u2190 \u2192 on it, to turn it; \u2191 \u2193 change the slab." }),
        caption2 && /* @__PURE__ */ jsx36("p", { className: "hb-layers-caption", children: caption2 })
      ] }),
      /* @__PURE__ */ jsxs33("div", { className: "hb-layers-side", onKeyDown: onSideKey, children: [
        /* @__PURE__ */ jsxs33("div", { className: "hb-steps-head", children: [
          /* @__PURE__ */ jsx36("div", { className: "hb-steps-title", children: layer.label }),
          /* @__PURE__ */ jsx36("span", { className: "hb-steps-place", children: `${at2 + 1} of ${layers.length}` })
        ] }),
        /* @__PURE__ */ jsx36("div", { className: "hb-steps-body", "aria-live": "polite", children: layer.note && /* @__PURE__ */ jsx36("p", { className: "hb-steps-text", children: /* @__PURE__ */ jsx36(InlineText, { text: layer.note }) }) }),
        /* @__PURE__ */ jsx36("div", { className: "hb-steps-foot", children: /* @__PURE__ */ jsxs33("div", { className: "hb-steps-moves", children: [
          /* @__PURE__ */ jsx36("button", { type: "button", className: "hb-pill", disabled: at2 === 0, onClick: () => go(at2 - 1), children: "Back" }),
          /* @__PURE__ */ jsx36("button", { type: "button", className: "hb-pill hb-pill-solid", disabled: at2 === layers.length - 1, onClick: () => go(at2 + 1), children: "Next" })
        ] }) }),
        /* @__PURE__ */ jsx36("ol", { className: "hb-layers-list", "aria-label": "Slabs", children: layers.map((l, i) => /* @__PURE__ */ jsx36("li", { children: /* @__PURE__ */ jsx36("button", { type: "button", className: "hb-layers-slab", "aria-pressed": i === at2, onClick: () => go(i), children: l.label }) }, i)) })
      ] })
    ] })
  ] });
}
function useOpening(at2, n) {
  const [open, setOpen] = useState21(() => Array.from({ length: n }, (_, i) => i === at2 ? 1 : 0));
  const now = useRef10(open);
  now.current = open;
  useEffect4(() => {
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
  const surface = colourOf2(el, "--hb-surface");
  const ink = colourOf2(el, "--hb-ink");
  const accent = colourOf2(el, "--hb-accent");
  const font = getComputedStyle(el).fontFamily || "system-ui";
  ctx.clearRect(0, 0, width, height);
  ctx.lineWidth = 1;
  ctx.textBaseline = "middle";
  shapes.forEach((shape, i) => {
    const lit = (open[i] ?? 0) > 0.5;
    const tone2 = lit ? accent : colourOf2(el, TONE_TOKEN[tones[i]]);
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
      ctx.fillStyle = tone2;
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
var TONES4 = ["blue", "amber", "green", "violet", "accent", "grey"];
function readLayers(raw, here) {
  const layers = [];
  (firstList([raw.layers, raw.levels]) ?? []).forEach((l, i) => {
    const label = firstText([l?.label, l?.title, l?.name], 24);
    if (!label) return here.at("layers").at(i).drop("layer needs a label");
    const tone2 = TONES4.includes(l.tone) ? l.tone : "blue";
    layers.push(clean({ label, tone: tone2, note: firstText([l.note, l.text, l.description], 280) }));
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
var MAX_ITEMS3 = 12;
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
  const max = typeof raw.max === "number" && isFinite(raw.max) && raw.max > 0 ? raw.max : void 0;
  return clean({
    type: "list",
    title: firstText([raw.title], 60),
    ranked,
    max,
    items: keepFirst(items, MAX_ITEMS3, here, "rows")
  });
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
  const bar = typeof item.bar === "number" && isFinite(item.bar) && item.bar >= 0 ? item.bar : void 0;
  return clean({
    title,
    subtitle: firstWords([item.subtitle, item.description, item.detail, item.note, textUnder], 160),
    value: valueOf2(item, bar),
    bar,
    icon: icon(item.icon),
    image: https(item.image),
    run: firstText([item.run], 300),
    url: https(item.url)
  });
}
function valueOf2(item, bar) {
  for (const field of ["value", "price", "rating", "score", "meta", "badge"]) {
    if (!(field in item)) continue;
    if (item[field] === null) return "\u2013";
    const text = firstTextOrNumber([item[field]], 30);
    if (text !== void 0) return text;
  }
  return bar === void 0 ? void 0 : firstTextOrNumber([bar], 30);
}

// src/blocks/progress/Progress.tsx
import { Fragment as Fragment11, jsx as jsx37, jsxs as jsxs34 } from "react/jsx-runtime";
function trackShare(value, goal, steps) {
  if (value === null || goal === null) return 0;
  if (!steps.length) return Math.max(0, Math.min(1, value / goal));
  if (value <= steps[0].at) return 0;
  for (let k = 1; k < steps.length; k++) {
    if (value < steps[k].at) return (k - 1 + (value - steps[k - 1].at) / (steps[k].at - steps[k - 1].at)) / (steps.length - 1);
  }
  return 1;
}
function amountOf(value, goal, unit) {
  const left = value === null ? "no data" : fmt(value, unit);
  if (goal === null) return value === null ? "no data / no data" : `${left} / no data`;
  const plain2 = fmt(goal);
  const joined = fmt(goal, unit);
  if (!unit || joined !== plain2 && joined !== `${plain2} ${unit}`) return `${left} / ${joined}`;
  return `${value === null ? left : fmt(value)} / ${plain2} ${unit}`;
}
function percentOf(value, goal) {
  if (value === null || goal === null) return 0;
  return Math.round(Math.max(0, Math.min(1, value / goal)) * 100);
}
function zoneTone(value, thresholds, fallback = "good", goal = Infinity) {
  if (value === null) return fallback;
  const toned = thresholds.filter((t) => t.tone !== void 0).sort((a, b) => a.at - b.at);
  if (!toned.length) return fallback;
  let from = 0;
  let last;
  for (const mark of toned) {
    const to = Math.min(mark.at, goal);
    if (to <= from) continue;
    if (value <= to) return mark.tone;
    from = to;
    last = mark.tone;
  }
  return last ?? fallback;
}
var place = (at2, goal) => at2 === null || goal === null ? 0 : Math.max(0, Math.min(1, at2 / goal));
var pctOf = (share) => `${Math.round(share * 1e4) / 100}%`;
function bandsOf(thresholds, goal) {
  const bands = [];
  let from = 0;
  for (const t of [...thresholds].sort((a, b) => a.at - b.at)) {
    if (!t.tone) continue;
    const to = Math.max(from, place(t.at, goal));
    if (to > from) bands.push({ from, to, tone: t.tone });
    from = to;
  }
  return bands;
}
function Progress({ title, value, goal, unit, steps, shape = "line", show_percent, tone: tone2, thresholds = [], segments = [] }) {
  const marks = thresholds.length ? thresholds : [];
  const checkpoints = marks.length ? [] : steps;
  const ring = shape === "circle" || shape === "dashboard";
  const share = ring ? place(value, goal) : trackShare(value, goal, checkpoints);
  const percent = percentOf(value, goal);
  const active = zoneTone(value, marks, tone2 ?? "good", goal ?? Infinity);
  return /* @__PURE__ */ jsxs34("div", { className: `hb-card hb-progress hb-progress-tone-${active}`, children: [
    /* @__PURE__ */ jsxs34("div", { className: "hb-progress-head", children: [
      /* @__PURE__ */ jsx37("span", { className: "hb-progress-icon", children: /* @__PURE__ */ jsx37(Icon, { name: "trophy", size: 19, stroke: 2.2 }) }),
      /* @__PURE__ */ jsx37("span", { className: "hb-card-title", children: title }),
      /* @__PURE__ */ jsxs34("span", { className: "hb-progress-amount", children: [
        /* @__PURE__ */ jsx37(Icon, { name: "flame", size: 15, stroke: 2.2 }),
        amountOf(value, goal, unit)
      ] }),
      show_percent && !ring && /* @__PURE__ */ jsxs34("span", { className: "hb-progress-pct", children: [
        percent,
        "%"
      ] })
    ] }),
    ring ? /* @__PURE__ */ jsx37(Ring, { shape, share, percent: show_percent ? percent : null, marks, segments, goal }) : segments.length ? /* @__PURE__ */ jsx37(Segments, { segments, goal, unit }) : checkpoints.length ? /* @__PURE__ */ jsx37(Checkpoints, { steps: checkpoints, value, share, unit }) : /* @__PURE__ */ jsx37(Bar2, { share, marks, goal, unit })
  ] });
}
function Bar2({ share, marks, goal, unit }) {
  const bands = bandsOf(marks, goal);
  const track = `hb-progress-track${marks.length ? " hb-progress-track-zoned" : ""}`;
  const body = /* @__PURE__ */ jsxs34(Fragment11, { children: [
    /* @__PURE__ */ jsxs34("div", { className: track, children: [
      bands.map((b, k) => /* @__PURE__ */ jsx37(
        "span",
        {
          className: `hb-progress-band hb-progress-band-${b.tone}`,
          style: { left: pctOf(b.from), width: pctOf(b.to - b.from) }
        },
        k
      )),
      /* @__PURE__ */ jsx37("span", { className: "hb-progress-fill", style: { width: pctOf(share) } })
    ] }),
    marks.map((m, k) => /* @__PURE__ */ jsx37("span", { className: "hb-progress-mark", style: { left: pctOf(place(m.at, goal)) } }, k)),
    /* @__PURE__ */ jsx37(MarkLabels, { marks, goal, unit })
  ] });
  return marks.length ? /* @__PURE__ */ jsx37("div", { className: "hb-progress-line", children: body }) : body;
}
function MarkLabels({ marks, goal, unit }) {
  const labelled = marks.filter((m) => m.label !== void 0);
  if (!labelled.length) return null;
  return /* @__PURE__ */ jsx37("div", { className: "hb-progress-mark-labels", children: labelled.map((m, k) => /* @__PURE__ */ jsx37("span", { style: { left: pctOf(Math.min(0.96, Math.max(0.04, place(m.at, goal)))) }, children: typeof m.label === "number" ? fmt(m.label, unit) : m.label }, k)) });
}
function Segments({ segments, goal, unit }) {
  let at2 = 0;
  const parts2 = segments.map((s, k) => {
    const from = at2;
    at2 = Math.min(1, at2 + (goal === null ? 0 : Math.max(0, s.value / goal)));
    return { key: k, left: from, width: at2 - from, label: s.label, value: s.value, tone: s.tone ?? "good" };
  });
  return /* @__PURE__ */ jsxs34(Fragment11, { children: [
    /* @__PURE__ */ jsx37("div", { className: "hb-progress-track hb-progress-track-zoned hb-progress-track-parts", children: parts2.filter((p) => p.width > 0).map((p) => /* @__PURE__ */ jsx37(
      "span",
      {
        className: `hb-progress-seg hb-progress-seg-${p.tone}`,
        style: { left: pctOf(p.left), width: pctOf(p.width) }
      },
      p.key
    )) }),
    parts2.some((p) => p.label) && /* @__PURE__ */ jsx37("div", { className: "hb-legend", children: parts2.filter((p) => p.label).map((p) => /* @__PURE__ */ jsxs34("span", { className: "hb-legend-item", children: [
      /* @__PURE__ */ jsx37("i", { className: `hb-legend-dot hb-progress-dot-${p.tone}` }),
      p.label,
      /* @__PURE__ */ jsx37("span", { className: "hb-legend-value", children: fmt(p.value, unit) })
    ] }, p.key)) })
  ] });
}
function Checkpoints({ steps, value, share, unit }) {
  const n = steps.length;
  const edge = `${50 / n}%`;
  const span = (n - 1) / n * 100;
  return /* @__PURE__ */ jsxs34(Fragment11, { children: [
    /* @__PURE__ */ jsxs34("div", { className: "hb-progress-nodes", children: [
      /* @__PURE__ */ jsx37("span", { className: "hb-progress-track hb-progress-track-steps", style: { left: edge, right: edge } }),
      /* @__PURE__ */ jsx37("span", { className: "hb-progress-fill hb-progress-fill-steps", style: { left: edge, width: `${span * share}%` } }),
      steps.map((s, k) => {
        const done = value !== null && value >= s.at;
        return /* @__PURE__ */ jsx37("span", { className: done ? "hb-progress-node hb-progress-node-done" : "hb-progress-node", style: { left: `${(k + 0.5) / n * 100}%` }, children: /* @__PURE__ */ jsx37(Icon, { name: done ? "check" : "lock", size: 12, stroke: 2.6 }) }, k);
      })
    ] }),
    /* @__PURE__ */ jsx37("div", { className: "hb-progress-labels", style: { gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }, children: steps.map((s, k) => /* @__PURE__ */ jsx37("span", { children: typeof s.label === "number" ? fmt(s.label, unit) : s.label }, k)) })
  ] });
}
var RING_R = 50;
function spot(at2, radius, shape) {
  const start = shape === "dashboard" ? -135 : 0;
  const sweep = shape === "dashboard" ? 270 : 360;
  const angle = (start + sweep * at2) * Math.PI / 180;
  return [60 + radius * Math.sin(angle), 60 - radius * Math.cos(angle)];
}
function ringLength(shape) {
  return 2 * Math.PI * RING_R * (shape === "dashboard" ? 270 / 360 : 1);
}
function startTurn(shape) {
  return `rotate(${shape === "dashboard" ? 135 : -90} 60 60)`;
}
function Ring({ shape, share, percent, marks, segments, goal }) {
  const length = ringLength(shape);
  const track = shape === "dashboard" ? /* @__PURE__ */ jsx37("path", { className: "hb-progress-ring-track", d: "M 25 95 A 50 50 0 1 1 95 95" }) : /* @__PURE__ */ jsx37("circle", { className: "hb-progress-ring-track", cx: "60", cy: "60", r: RING_R });
  let at2 = 0;
  const parts2 = segments.map((s) => {
    const from = at2;
    at2 = Math.min(1, at2 + (goal === null ? 0 : Math.max(0, s.value / goal)));
    return { from, to: at2, tone: s.tone ?? "good" };
  });
  return /* @__PURE__ */ jsxs34("div", { className: `hb-progress-ring${shape === "dashboard" ? " hb-progress-ring-dash" : ""}`, children: [
    /* @__PURE__ */ jsxs34("svg", { viewBox: "0 0 120 120", "aria-hidden": "true", children: [
      track,
      parts2.length ? parts2.filter((p) => p.to > p.from).map((p, k) => /* @__PURE__ */ jsx37(
        "circle",
        {
          className: `hb-progress-ring-fill hb-progress-ring-${p.tone}`,
          cx: "60",
          cy: "60",
          r: RING_R,
          transform: startTurn(shape),
          strokeDasharray: `${length * (p.to - p.from)} ${length}`,
          strokeDashoffset: -length * p.from
        },
        k
      )) : /* @__PURE__ */ jsx37(
        "circle",
        {
          className: "hb-progress-ring-fill",
          cx: "60",
          cy: "60",
          r: RING_R,
          transform: startTurn(shape),
          strokeDasharray: `${length * share} ${length}`
        }
      ),
      marks.map((m, k) => {
        const [x1, y1] = spot(place(m.at, goal), RING_R - 9, shape);
        const [x2, y2] = spot(place(m.at, goal), RING_R + 9, shape);
        return /* @__PURE__ */ jsx37("line", { className: "hb-progress-ring-mark", x1, y1, x2, y2 }, k);
      })
    ] }),
    percent !== null && /* @__PURE__ */ jsxs34("span", { className: "hb-progress-ring-pct", children: [
      percent,
      "%"
    ] })
  ] });
}

// src/blocks/progress/read.ts
var TONES5 = {
  good: "good",
  success: "good",
  positive: "good",
  ok: "good",
  warn: "warn",
  warning: "warn",
  caution: "warn",
  bad: "bad",
  danger: "bad",
  negative: "bad",
  error: "bad"
};
var SHAPES = { line: "line", bar: "line", circle: "circle", ring: "circle", dashboard: "dashboard", gauge: "dashboard" };
function progressTone(v) {
  return typeof v === "string" ? TONES5[v.toLowerCase()] : void 0;
}
function progressShape(v) {
  return typeof v === "string" ? SHAPES[v.toLowerCase()] : void 0;
}
function readStep(raw, here) {
  const label = str(raw?.label, 28) ?? num(raw?.label);
  const at2 = num(raw?.at);
  if (label === void 0 || label === null || at2 === null) {
    return here.drop("checkpoint needs a label and a number `at`");
  }
  return { label, at: at2 };
}
function readThreshold(raw, here) {
  const at2 = num(raw?.at);
  if (at2 === null) return here.drop("threshold needs a number `at`");
  const label = str(raw?.label, 28) ?? num(raw?.label);
  return clean({ at: at2, label: label === null ? void 0 : label, tone: progressTone(raw?.tone) });
}
function readSegment(raw, here) {
  const value = num(raw?.value);
  if (value === null || value < 0) return here.drop("segment needs a number `value` of 0 or more");
  return clean({ value, label: str(raw?.label, 28), tone: progressTone(raw?.tone) });
}
function readProgress(raw, here) {
  const title = str(raw.title, 40);
  if (!title) return here.drop("progress needs a title");
  const value = num(raw.value);
  if (value === null && raw.value !== null) return here.drop("progress needs a numeric value");
  const goal = num(raw.goal);
  if (goal === null && raw.goal !== null) return here.drop("progress needs a goal above 0");
  if (goal !== null && goal <= 0) return here.drop("progress needs a goal above 0");
  const thresholds = [];
  const rawThresholds = Array.isArray(raw.thresholds) ? raw.thresholds : [];
  rawThresholds.forEach((t, i) => {
    const mark = readThreshold(t, here.at("thresholds").at(i));
    if (mark) thresholds.push(mark);
  });
  thresholds.sort((a, b) => a.at - b.at);
  const steps = [];
  const rawSteps = Array.isArray(raw.steps) ? raw.steps : [];
  if (thresholds.length && rawSteps.length) {
    here.at("steps").drop("thresholds replace steps");
  } else {
    rawSteps.forEach((st, i) => {
      const step = readStep(st, here.at("steps").at(i));
      if (step) steps.push(step);
    });
    steps.sort((a, b) => a.at - b.at);
  }
  const segments = [];
  const rawSegments = Array.isArray(raw.segments) ? raw.segments : [];
  rawSegments.forEach((s, i) => {
    const segment = readSegment(s, here.at("segments").at(i));
    if (segment) segments.push(segment);
  });
  return clean({
    type: "progress",
    title,
    value,
    goal,
    unit: str(raw.unit, 12),
    shape: progressShape(raw.shape),
    show_percent: raw.show_percent === true ? true : void 0,
    tone: progressTone(raw.tone),
    steps: keepFirst(steps, 6, here, "checkpoints"),
    thresholds: thresholds.length ? keepFirst(thresholds, 6, here, "thresholds") : void 0,
    segments: segments.length ? keepFirst(segments, 5, here, "segments") : void 0
  });
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
import { useEffect as useEffect6, useMemo as useMemo9, useRef as useRef13, useState as useState22 } from "react";

// src/blocks/simulate/Piles.tsx
import { useEffect as useEffect5, useRef as useRef11 } from "react";

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
import { Fragment as Fragment12, jsx as jsx38, jsxs as jsxs35 } from "react/jsx-runtime";
var GROW_MS = 280;
var DOT = 14;
function Piles({ piles, amounts, start, per, most, playing, unit, label }) {
  const counts = amounts.map((a) => Math.max(0, Math.round((a ?? 0) / per)));
  const startDots = Math.max(0, Math.round(start / per));
  const tallest = Math.max(1, ...most.map((m) => Math.round(m / per)));
  return /* @__PURE__ */ jsxs35(Fragment12, { children: [
    /* @__PURE__ */ jsx38("div", { className: "hb-sim-piles", children: piles.map((pile, k) => /* @__PURE__ */ jsx38(
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
    /* @__PURE__ */ jsxs35("div", { className: "hb-legend", children: [
      /* @__PURE__ */ jsxs35("span", { className: "hb-legend-item", children: [
        /* @__PURE__ */ jsx38("i", { className: "hb-legend-dot", style: { background: partColour(0) } }),
        `${label ?? "Start"} (a dot is ${fmt(per, unit, { full: true })})`
      ] }),
      piles.map((pile, k) => /* @__PURE__ */ jsxs35("span", { className: "hb-legend-item", children: [
        /* @__PURE__ */ jsx38("i", { className: "hb-legend-dot", style: { background: partColour(k + 1) } }),
        pile.adds ?? pile.name
      ] }, k))
    ] })
  ] });
}
function Pile({ k, name, amount, counts, startDots, tallest, playing, unit }) {
  const canvas = useRef11(null);
  const born = useRef11([]);
  const width = useWidth(canvas);
  const theme = useTheme();
  const count2 = counts[k];
  const cols = Math.max(20, Math.floor(width / DOT));
  const size = width / cols;
  const height = Math.ceil(tallest / cols) * size;
  const shown2 = amount === null ? "\u2013" : fmt(amount, unit, { full: true });
  useEffect5(() => {
    const el = canvas.current;
    if (!el) return;
    const grow = playing && !lessMotion();
    let frame = 0;
    const draw = () => {
      const fit = fitCanvas(el, height);
      if (!fit) return;
      const now = performance.now();
      const palette = [1, 2, 3, 4].map((i) => colourOf2(el, `--hb-chart-${i}`));
      born.current.length = Math.min(born.current.length, count2);
      while (born.current.length < count2) born.current.push(grow ? now : 0);
      let growing = false;
      fit.ctx.clearRect(0, 0, fit.width, fit.height);
      for (let n = 0; n < count2; n++) {
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
  }, [count2, counts.join(), startDots, width, height, theme]);
  return /* @__PURE__ */ jsxs35("div", { className: "hb-sim-pile", children: [
    /* @__PURE__ */ jsx38("div", { className: "hb-sim-pile-name", children: name }),
    /* @__PURE__ */ jsx38("div", { className: "hb-sim-amount", children: shown2 }),
    /* @__PURE__ */ jsx38("canvas", { ref: canvas, className: "hb-sim-canvas", style: { height }, role: "img", "aria-label": `${name}: ${shown2}, ${count2} dots` })
  ] });
}

// src/blocks/simulate/SimChart.tsx
import { useRef as useRef12 } from "react";
import { jsx as jsx39, jsxs as jsxs36 } from "react/jsx-runtime";
var HEIGHT = 220;
var PAD = { left: 52, right: 12, top: 10, bottom: 22 };
function SimChart({ piles, lines, times, index, unit }) {
  const box = useRef12(null);
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
  return /* @__PURE__ */ jsxs36("div", { ref: box, className: "hb-sim-chart", children: [
    /* @__PURE__ */ jsxs36("svg", { width: "100%", height: HEIGHT, viewBox: `0 0 ${width} ${HEIGHT}`, role: "img", "aria-label": `Line chart at ${fmt(now)}: ${label}`, children: [
      yTicks.map((v) => /* @__PURE__ */ jsxs36("g", { children: [
        /* @__PURE__ */ jsx39("line", { x1: PAD.left, x2: width - PAD.right, y1: y(v), y2: y(v), className: "hb-sim-grid" }),
        /* @__PURE__ */ jsx39("text", { x: PAD.left - 6, y: y(v) + 4, textAnchor: "end", children: fmt(v, unit) })
      ] }, v)),
      xTicks.map((t) => /* @__PURE__ */ jsx39("text", { x: x(t), y: HEIGHT - 6, textAnchor: "middle", children: fmt(t) }, t)),
      piles.map((_, k) => {
        const runs = lineRuns(lines[k].slice(0, index + 1).map((v, i) => v === null ? null : [x(times[i]), y(v)]));
        const last = lines[k][index];
        return /* @__PURE__ */ jsxs36("g", { style: { color: partColour(k + 1) }, children: [
          runs.map((run, j) => /* @__PURE__ */ jsx39("polyline", { points: run.pts.map(([cx, cy]) => `${cx.toFixed(1)},${cy.toFixed(1)}`).join(" "), className: "hb-sim-line" }, j)),
          last !== null && /* @__PURE__ */ jsx39("circle", { cx: x(now), cy: y(last), r: 4.5, className: "hb-sim-point" })
        ] }, k);
      })
    ] }),
    /* @__PURE__ */ jsx39("div", { className: "hb-legend", children: piles.map((p, k) => /* @__PURE__ */ jsxs36("span", { className: "hb-legend-item", children: [
      /* @__PURE__ */ jsx39("i", { className: "hb-legend-dot", style: { background: partColour(k + 1) } }),
      p.name,
      /* @__PURE__ */ jsx39("span", { className: "hb-legend-value", children: valueText(lines[k][index], unit) })
    ] }, k)) })
  ] });
}
function valueText(v, unit) {
  return v === null || v === void 0 ? "\u2013" : fmt(v, unit, { full: true });
}

// src/blocks/simulate/Simulate.tsx
import { jsx as jsx40, jsxs as jsxs37 } from "react/jsx-runtime";
function Simulate(block) {
  const { title, t: time, inputs, values: fixed, piles, unit, source } = block;
  const root = useRef13(null);
  const clock = useRef13(time.to);
  const [answers, write] = useStoredValue({
    door: "identity",
    initial: () => Object.fromEntries(inputs.map((x) => [x.id, x.value])),
    revive: (saved) => {
      if (!saved || typeof saved !== "object" || Array.isArray(saved)) return null;
      const known = new Set(inputs.map((x) => x.id));
      const out = {};
      for (const [id, v] of Object.entries(saved)) {
        if (known.has(id) && typeof v === "number" && isFinite(v)) out[id] = v;
      }
      return out;
    },
    stored: (value) => value
  });
  const sliders = useMemo9(() => new Map(Object.entries(answers)), [answers]);
  const [view, setView] = useStoredValue({
    door: "identity",
    field: "~view",
    initial: () => block.view,
    revive: (saved) => saved === "dots" || saved === "chart" ? saved : null,
    stored: (value) => value
  });
  const [at2, setAt] = useState22(time.to);
  const [playing, setPlaying] = useState22(false);
  const trees = useMemo9(() => piles.map((p) => parseFormula(p.formula)), [piles]);
  const names = useMemo9(() => new Map([...fixed, ...sliders]), [fixed, sliders]);
  const times = useMemo9(() => timesOf(time.to, time.step), [time]);
  const lines = useMemo9(() => valuesOver(trees, names, time.name, times), [trees, names, time.name, times]);
  const most = useMemo9(() => {
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
  return /* @__PURE__ */ jsxs37("div", { ref: root, className: "hb-card hb-sim", children: [
    /* @__PURE__ */ jsxs37("div", { className: "hb-sim-head", children: [
      title && /* @__PURE__ */ jsx40("div", { className: "hb-card-title", children: /* @__PURE__ */ jsx40(InlineText, { text: title }) }),
      /* @__PURE__ */ jsxs37("div", { className: "hb-sim-switch", role: "group", "aria-label": "View", children: [
        /* @__PURE__ */ jsx40("button", { type: "button", "aria-pressed": view === "dots", onClick: () => setView("dots"), children: "Dots" }),
        /* @__PURE__ */ jsx40("button", { type: "button", "aria-pressed": view === "chart", onClick: () => setView("chart"), children: "Line chart" })
      ] })
    ] }),
    /* @__PURE__ */ jsxs37("div", { className: "hb-sim-controls", children: [
      /* @__PURE__ */ jsxs37("button", { type: "button", className: "hb-pill hb-pill-solid hb-sim-play", onClick: play, children: [
        /* @__PURE__ */ jsx40("svg", { width: "14", height: "14", viewBox: "0 0 24 24", "aria-hidden": "true", fill: "currentColor", children: /* @__PURE__ */ jsx40("path", { d: playing ? "M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" : "M8 5.5v13l10.5-6.5z" }) }),
        playing ? "Pause" : "Play"
      ] }),
      /* @__PURE__ */ jsxs37("label", { className: "hb-calc-slider hb-sim-time", children: [
        /* @__PURE__ */ jsxs37("span", { className: "hb-calc-head", children: [
          /* @__PURE__ */ jsx40("span", { className: "hb-calc-label", children: time.unit ? capital(time.unit) : time.name }),
          /* @__PURE__ */ jsx40("span", { className: "hb-calc-value", children: `${fmt(at2)} of ${fmt(time.to)}` })
        ] }),
        /* @__PURE__ */ jsx40(
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
      inputs.map((input) => /* @__PURE__ */ jsx40(
        Slider,
        {
          input,
          value: sliders.get(input.id) ?? input.value,
          onMove: (v) => write({ ...answers, [input.id]: v })
        },
        input.id
      ))
    ] }),
    view === "dots" ? /* @__PURE__ */ jsx40(Piles, { piles, amounts, start: lines[0][0] ?? 0, per, most, playing, unit, label: block.start }) : /* @__PURE__ */ jsx40(SimChart, { piles, lines, times, index, unit }),
    source && /* @__PURE__ */ jsx40(Source, { text: source })
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
  useEffect6(() => {
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
  useEffect6(() => {
    if (!playing || !root.current || typeof IntersectionObserver === "undefined") return;
    const watcher = new IntersectionObserver(([entry2]) => {
      if (!entry2.isIntersecting) pause();
    });
    watcher.observe(root.current);
    return () => watcher.disconnect();
  }, [playing]);
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
import { useEffect as useEffect7, useRef as useRef14, useState as useState23 } from "react";
import { jsx as jsx41, jsxs as jsxs38 } from "react/jsx-runtime";
function Steps({ title, for: flow, items }) {
  const [at2, setAt] = useState23(0);
  const [failed, setFailed] = useState23(() => /* @__PURE__ */ new Set());
  const setWalk = useSetWalk();
  const before = useRef14(null);
  const step = items[at2];
  const go = (to) => setAt(Math.max(0, Math.min(items.length - 1, to)));
  useEffect7(() => {
    if (flow !== void 0) setWalk(flow, { steps: items, at: at2, from: before.current });
    before.current = at2;
  }, [flow, items, at2, setWalk]);
  useEffect7(() => () => {
    if (flow !== void 0) setWalk(flow, void 0);
  }, [flow, setWalk]);
  function onKeyDown(e) {
    if (e.key === "ArrowRight") go(at2 + 1);
    else if (e.key === "ArrowLeft") go(at2 - 1);
    else return;
    e.preventDefault();
  }
  const photo = step.image && !failed.has(at2) ? step.image : void 0;
  return /* @__PURE__ */ jsxs38("div", { className: "hb-card hb-steps", role: "group", "aria-label": title ?? "Steps", onKeyDown, children: [
    /* @__PURE__ */ jsxs38("div", { className: "hb-steps-head", children: [
      title && /* @__PURE__ */ jsx41("div", { className: "hb-card-title", children: title }),
      /* @__PURE__ */ jsx41("span", { className: "hb-steps-place", children: `${at2 + 1} of ${items.length}` })
    ] }),
    /* @__PURE__ */ jsxs38("div", { className: "hb-steps-body", "aria-live": "polite", children: [
      /* @__PURE__ */ jsx41("div", { className: "hb-steps-title", children: step.title }),
      step.text && /* @__PURE__ */ jsx41("p", { className: "hb-steps-text", children: /* @__PURE__ */ jsx41(InlineText, { text: step.text }) }),
      photo && /* @__PURE__ */ jsx41(
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
    /* @__PURE__ */ jsxs38("div", { className: "hb-steps-foot", children: [
      /* @__PURE__ */ jsx41("div", { className: "hb-steps-dots", children: items.map((s, i) => /* @__PURE__ */ jsx41(
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
      /* @__PURE__ */ jsxs38("div", { className: "hb-steps-moves", children: [
        /* @__PURE__ */ jsx41("button", { type: "button", className: "hb-pill", disabled: at2 === 0, onClick: () => go(at2 - 1), children: "Back" }),
        /* @__PURE__ */ jsx41("button", { type: "button", className: "hb-pill hb-pill-solid", disabled: at2 === items.length - 1, onClick: () => go(at2 + 1), children: "Next" })
      ] })
    ] })
  ] });
}

// src/blocks/streak/read.ts
function readStreak(raw, here) {
  const count2 = num(raw.count);
  if (count2 === null) return here.drop("streak needs a numeric count");
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
  return { type: "streak", count: count2, label, unit, days: keepFirst(days, 7, here, "days") };
}

// src/blocks/streak/Streak.tsx
import { jsx as jsx42, jsxs as jsxs39 } from "react/jsx-runtime";
function unitFor(count2, unit) {
  if (count2 === 1 && unit.endsWith("s")) return unit.slice(0, -1);
  return unit;
}
function Streak({ count: count2, label, unit, days }) {
  return /* @__PURE__ */ jsxs39("div", { className: "hb-card hb-streak", children: [
    /* @__PURE__ */ jsxs39("div", { className: "hb-streak-head", children: [
      /* @__PURE__ */ jsxs39("div", { children: [
        /* @__PURE__ */ jsx42("div", { className: "hb-streak-label", children: label }),
        /* @__PURE__ */ jsxs39("div", { className: "hb-streak-count", children: [
          formatNumber(count2, { digits: 3 }),
          " ",
          /* @__PURE__ */ jsx42("span", { children: unitFor(count2, unit) })
        ] })
      ] }),
      /* @__PURE__ */ jsx42("span", { className: "hb-streak-medal", children: /* @__PURE__ */ jsx42(Icon, { name: "star", size: 24, stroke: 2.4 }) })
    ] }),
    days.length > 0 && /* @__PURE__ */ jsx42("div", { className: "hb-streak-week", style: { gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }, children: days.map((d, k) => /* @__PURE__ */ jsxs39("div", { className: d.today ? "hb-streak-day hb-streak-today" : "hb-streak-day", children: [
      /* @__PURE__ */ jsx42("span", { className: "hb-streak-day-label", children: d.label }),
      d.done ? /* @__PURE__ */ jsx42("span", { className: "hb-streak-done", children: /* @__PURE__ */ jsx42(Icon, { name: "check", size: 15, stroke: 2.6 }) }) : /* @__PURE__ */ jsx42("span", { className: "hb-streak-date", children: d.date ?? "\xB7" }),
      /* @__PURE__ */ jsx42("span", { className: "hb-streak-dot" })
    ] }, k)) })
  ] });
}

// src/blocks/tiles/read.ts
var MAX_TILES = 8;
var SUBTITLE_MAX = 120;
var TITLE_FIELDS = ["title", "label", "name", "caption", "text"];
var MORE_FIELDS = ["subtitle", "value", "text", "caption", "note", "description"];
function cutSubtitle(text) {
  const cut = cutAtWord(text, SUBTITLE_MAX);
  if (cut === text) return cut;
  const room = text.slice(0, SUBTITLE_MAX - 1);
  const lastSpace = room.search(/\s\S*$/);
  if (lastSpace > SUBTITLE_MAX / 2) return cut;
  const whole2 = room.slice(0, Math.max(lastSpace, 0)).replace(/[\s,;:.–—-]+$/, "");
  return whole2 ? `${whole2}\u2026` : "";
}
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
    const text = textOrNumber(item[f], Infinity);
    if (f !== titleField && text !== void 0) more.push(text);
  }
  const subtitle = more.length ? cutSubtitle(more.join(" \xB7 ")) || void 0 : void 0;
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
import { useContext as useContext9, useState as useState24 } from "react";
import { Fragment as Fragment13, jsx as jsx43, jsxs as jsxs40 } from "react/jsx-runtime";
var WASHES = [1, 4, 8, 3, 6];
function Tiles({ items }) {
  return /* @__PURE__ */ jsx43("div", { className: "hb-tiles", children: items.map((tile, i) => /* @__PURE__ */ jsx43(Tile, { tile, wash: WASHES[i % WASHES.length] }, i)) });
}
function tapOf(tile, send, fill) {
  if (tile.run) return () => send(tile.run);
  if (tile.ask) return () => fill(tile.ask);
  return void 0;
}
function Tile({ tile, wash }) {
  const { send, fill } = useContext9(BlockActions);
  const [photoFailed, setPhotoFailed] = useState24(false);
  const tap = tapOf(tile, send, fill);
  const colour = `var(--hb-chart-${wash})`;
  const content = /* @__PURE__ */ jsxs40(Fragment13, { children: [
    tile.image && !photoFailed && /* @__PURE__ */ jsx43("img", { src: tile.image, alt: "", loading: "lazy", referrerPolicy: "no-referrer", onError: () => setPhotoFailed(true) }),
    tile.icon && /* @__PURE__ */ jsx43("span", { className: "hb-tile-icon", children: /* @__PURE__ */ jsx43(Icon, { name: tile.icon, size: 18, stroke: 2.2 }) }),
    /* @__PURE__ */ jsxs40("span", { className: "hb-tile-text", children: [
      /* @__PURE__ */ jsx43("span", { className: "hb-tile-title", children: tile.title }),
      tile.subtitle && /* @__PURE__ */ jsx43("span", { className: "hb-tile-subtitle", children: tile.subtitle })
    ] })
  ] });
  const style = { background: `linear-gradient(140deg, ${colour}, color-mix(in srgb, ${colour} 55%, #140c24))` };
  return tap ? /* @__PURE__ */ jsx43("button", { type: "button", className: "hb-tile", onClick: tap, title: tile.run, style, children: content }) : /* @__PURE__ */ jsx43("div", { className: "hb-tile hb-tile-static", style, children: content });
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

// src/blocks/briefing/Briefing.tsx
import { Fragment as Fragment14, jsx as jsx44, jsxs as jsxs41 } from "react/jsx-runtime";
var deg2 = (v) => `${Math.round(v)}\xB0`;
function Line({ counts }) {
  const parts2 = [];
  if (counts.need) {
    if (counts.overdue) parts2.push(/* @__PURE__ */ jsxs41("span", { className: "hb-brief-bad", children: [
      counts.overdue,
      " overdue"
    ] }, "o"));
    parts2.push(/* @__PURE__ */ jsxs41("span", { children: [
      counts.need,
      " need you"
    ] }, "n"));
  } else {
    parts2.push(/* @__PURE__ */ jsx44("span", { children: "Nothing needs you today" }, "n"));
  }
  const handled = counts.handled ? /* @__PURE__ */ jsxs41("span", { className: "hb-brief-good", children: [
    "\u2713 ",
    counts.handled,
    " handled"
  ] }) : null;
  const joined = parts2.flatMap((p, i) => i ? [", ", p] : [p]);
  return /* @__PURE__ */ jsxs41("p", { className: "hb-brief-line", children: [
    joined,
    handled && /* @__PURE__ */ jsxs41(Fragment14, { children: [
      ", and ",
      handled
    ] }),
    "."
  ] });
}
function Briefing({ greeting, date, place: place2, temp, condition, high, low, sky, counts }) {
  const range = [high !== void 0 ? `H ${deg2(high)}` : null, low !== void 0 ? `L ${deg2(low)}` : null].filter(Boolean).join(" \xB7 ");
  return /* @__PURE__ */ jsxs41("section", { className: `hb-brief hb-brief-${sky}`, children: [
    /* @__PURE__ */ jsxs41("div", { className: "hb-brief-top", children: [
      /* @__PURE__ */ jsxs41("div", { className: "hb-brief-hello", children: [
        (date || place2) && /* @__PURE__ */ jsx44("span", { className: "hb-brief-date", children: [date, place2].filter(Boolean).join(" \xB7 ") }),
        /* @__PURE__ */ jsx44("h2", { children: greeting })
      ] }),
      temp !== void 0 && /* @__PURE__ */ jsxs41("div", { className: "hb-brief-wx", children: [
        /* @__PURE__ */ jsx44("span", { className: "hb-brief-temp", children: deg2(temp) }),
        /* @__PURE__ */ jsx44("span", { className: "hb-brief-sky", children: [condition, range].filter(Boolean).join(" \xB7 ") })
      ] })
    ] }),
    /* @__PURE__ */ jsx44(Line, { counts })
  ] });
}

// src/blocks/briefing/read.ts
var SKIES = ["clear", "cloud", "rain", "snow", "storm", "fog", "night"];
var count = (v) => {
  const n = num(v);
  return n !== null && n >= 0 ? Math.floor(n) : 0;
};
function readBriefing(raw, here) {
  const greeting = firstText([raw.greeting], 80);
  if (!greeting) return here.drop("briefing needs a greeting");
  const c = raw.counts ?? {};
  return clean({
    type: "briefing",
    greeting,
    date: firstText([raw.date], 40),
    place: firstText([raw.place], 60),
    temp: num(raw.temp) ?? void 0,
    condition: firstText([raw.condition], 40),
    high: num(raw.high) ?? void 0,
    low: num(raw.low) ?? void 0,
    sky: SKIES.includes(raw.sky) ? raw.sky : "clear",
    counts: { overdue: count(c.overdue), need: count(c.need), handled: count(c.handled) }
  });
}

// src/blocks/prepared/Prepared.tsx
import { useContext as useContext10, useState as useState25 } from "react";
import { jsx as jsx45, jsxs as jsxs42 } from "react/jsx-runtime";
function IdeaCard({ idea, group }) {
  const { fill } = useContext10(BlockActions);
  const [broken, setBroken] = useState25(false);
  return /* @__PURE__ */ jsxs42("button", { type: "button", className: "hb-prep-idea", onClick: () => fill(`Tell me more about ${idea.title} for ${group}`), children: [
    !broken && /* @__PURE__ */ jsx45("img", { src: idea.photo, alt: "", loading: "lazy", onError: () => setBroken(true) }),
    /* @__PURE__ */ jsxs42("span", { className: "hb-prep-cap", children: [
      idea.title,
      idea.note && /* @__PURE__ */ jsx45("small", { children: idea.note })
    ] })
  ] });
}
function GroupView({ group }) {
  const { fill } = useContext10(BlockActions);
  return /* @__PURE__ */ jsxs42("article", { className: "hb-prep-group", children: [
    /* @__PURE__ */ jsxs42("div", { className: "hb-prep-head", children: [
      /* @__PURE__ */ jsx45("span", { className: "hb-prep-title", children: group.title }),
      group.date && /* @__PURE__ */ jsx45("span", { className: "hb-prep-date", children: group.date })
    ] }),
    /* @__PURE__ */ jsx45("div", { className: "hb-prep-grid", children: group.ideas.map((idea, i) => /* @__PURE__ */ jsx45(IdeaCard, { idea, group: group.title }, i)) }),
    group.ask && /* @__PURE__ */ jsx45("button", { type: "button", className: "hb-prep-ask", onClick: () => fill(group.ask.text), children: group.ask.label })
  ] });
}
function Prepared({ groups }) {
  return /* @__PURE__ */ jsxs42("div", { className: "hb-prep", children: [
    /* @__PURE__ */ jsx45("span", { className: "hb-prep-label", children: "Prepared for you" }),
    groups.map((g, i) => /* @__PURE__ */ jsx45(GroupView, { group: g }, i))
  ] });
}

// src/blocks/prepared/read.ts
function readPrepared(raw, here) {
  const groups = [];
  (Array.isArray(raw.groups) ? raw.groups : []).slice(0, 2).forEach((g, i) => {
    const title = firstText([g?.title], 60);
    const ideas = (Array.isArray(g?.ideas) ? g.ideas : []).map((x) => {
      const t = firstText([x?.title], 40);
      const photo = https(x?.photo);
      if (!t || !photo || actsBeforeTheModel(t)) return null;
      return clean({ title: t, note: firstText([x?.note], 80), photo, link: https(x?.link) });
    }).filter(Boolean).slice(0, 4);
    if (!title || ideas.length < 2) {
      here.at("groups").at(i).drop("a group needs a title and 2-4 ideas");
      return;
    }
    const label = firstText([g?.ask?.label], 40);
    const text = firstText([g?.ask?.text], 160);
    groups.push(clean({
      title,
      date: firstText([g?.date], 30),
      ideas,
      ask: label && text && !actsBeforeTheModel(text) ? { label, text } : void 0
    }));
  });
  if (!groups.length) return here.drop("prepared has no group with ideas");
  return { type: "prepared", groups };
}

// src/blocks/tracker/read.ts
var STATES2 = ["overdue", "today", "soon", "open"];
var KINDS4 = ["closed", "tracking", "protected"];
var texts = (v, n, max) => (Array.isArray(v) ? v : []).map((x) => firstText([x], max)).filter((x) => Boolean(x)).slice(0, n);
function details(raw) {
  if (!raw || typeof raw !== "object") return void 0;
  const d = clean({
    from: firstText([raw.from], 120),
    received: firstText([raw.received], 40),
    about: texts(raw.about, 4, 60),
    trail: texts(raw.trail, 8, 80)
  });
  return d.from || d.about.length || d.trail.length ? d : void 0;
}
function readTracker(raw, here) {
  const need = [];
  (Array.isArray(raw.need) ? raw.need : []).slice(0, 20).forEach((c, i) => {
    const id = firstText([c?.id], 40);
    const title = firstText([c?.title], 80);
    if (!id || !title) {
      here.at("need").at(i).drop("card needs an id and a title");
      return;
    }
    const help = firstText([c?.help], 120);
    const url = https(c?.link?.url);
    const label = firstText([c?.link?.label], 40);
    need.push(clean({
      id,
      title,
      amount: firstText([c?.amount], 20),
      state: STATES2.includes(c?.state) ? c.state : "open",
      stateText: firstText([c?.stateText], 60),
      help: help && !actsBeforeTheModel(help) ? help : void 0,
      link: url && label ? { label, url } : void 0,
      details: details(c?.details)
    }));
  });
  const handled = [];
  (Array.isArray(raw.handled) ? raw.handled : []).slice(0, 6).forEach((r, i) => {
    const id = firstText([r?.id], 40);
    const title = firstText([r?.title], 80);
    if (!id || !title || !KINDS4.includes(r?.kind)) {
      here.at("handled").at(i).drop("row needs an id, a title, a kind");
      return;
    }
    handled.push(clean({
      id,
      title,
      amount: firstText([r?.amount], 20),
      kind: r.kind,
      verb: firstText([r?.verb], 30) ?? "",
      why: firstText([r?.why], 120),
      reopen: r?.reopen === true ? true : void 0,
      details: details(r?.details)
    }));
  });
  return { type: "tracker", need, handled };
}

// src/blocks/tracker/Tracker.tsx
import { useContext as useContext11, useEffect as useEffect8, useState as useState26 } from "react";
import { Fragment as Fragment15, jsx as jsx46, jsxs as jsxs43 } from "react/jsx-runtime";
var VIEW_KEY = "hermes-genui.tracker.view";
var SEEN_KEY = "hermes-genui.tracker.handled";
function stored2(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function store(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
  }
}
function More({ d }) {
  if (!d) return null;
  return /* @__PURE__ */ jsxs43("details", { className: "hb-tr-details", children: [
    /* @__PURE__ */ jsx46("summary", { children: "Details" }),
    /* @__PURE__ */ jsxs43("dl", { children: [
      d.from && /* @__PURE__ */ jsxs43(Fragment15, { children: [
        /* @__PURE__ */ jsx46("dt", { children: "From" }),
        /* @__PURE__ */ jsx46("dd", { children: d.from })
      ] }),
      d.received && /* @__PURE__ */ jsxs43(Fragment15, { children: [
        /* @__PURE__ */ jsx46("dt", { children: "Received" }),
        /* @__PURE__ */ jsx46("dd", { children: d.received })
      ] }),
      d.about.length > 0 && /* @__PURE__ */ jsxs43(Fragment15, { children: [
        /* @__PURE__ */ jsx46("dt", { children: "About" }),
        /* @__PURE__ */ jsx46("dd", { children: d.about.join(" \xB7 ") })
      ] }),
      d.trail.length > 0 && /* @__PURE__ */ jsxs43(Fragment15, { children: [
        /* @__PURE__ */ jsx46("dt", { children: "So far" }),
        /* @__PURE__ */ jsx46("dd", { children: d.trail.join(" \u2192 ") })
      ] })
    ] })
  ] });
}
function CardView({ card }) {
  const { fill } = useContext11(BlockActions);
  return /* @__PURE__ */ jsxs43("article", { className: `hb-tr-card hb-tr-${card.state}`, children: [
    /* @__PURE__ */ jsxs43("div", { className: "hb-tr-top", children: [
      /* @__PURE__ */ jsx46("span", { className: "hb-tr-title", children: card.title }),
      card.amount && /* @__PURE__ */ jsx46("span", { className: "hb-tr-amount", children: card.amount })
    ] }),
    card.stateText && /* @__PURE__ */ jsx46("span", { className: `hb-tr-pill hb-tr-pill-${card.state}`, children: card.stateText }),
    (card.link || card.help) && /* @__PURE__ */ jsxs43("div", { className: "hb-tr-acts", children: [
      card.link && /* @__PURE__ */ jsxs43("a", { className: "hb-tr-go", href: card.link.url, target: "_blank", rel: "noreferrer", children: [
        card.link.label,
        " \u2197"
      ] }),
      card.help && /* @__PURE__ */ jsx46("button", { type: "button", className: "hb-tr-help", onClick: () => fill(card.help), children: card.help })
    ] }),
    /* @__PURE__ */ jsx46(More, { d: card.details })
  ] });
}
function RowView({ row, onReopen }) {
  return /* @__PURE__ */ jsxs43("article", { className: `hb-tr-row hb-tr-${row.kind}`, children: [
    /* @__PURE__ */ jsxs43("div", { className: "hb-tr-top", children: [
      /* @__PURE__ */ jsxs43("span", { className: "hb-tr-title", children: [
        row.title,
        row.amount ? ` \xB7 ${row.amount}` : ""
      ] }),
      /* @__PURE__ */ jsx46("span", { className: "hb-tr-verb", children: row.kind === "closed" ? `\u2713 ${row.verb}` : row.verb })
    ] }),
    row.why && /* @__PURE__ */ jsx46("span", { className: "hb-tr-why", children: row.why }),
    row.reopen && /* @__PURE__ */ jsx46("button", { type: "button", className: "hb-tr-link", onClick: () => onReopen(row.id), children: "Reopen" }),
    /* @__PURE__ */ jsx46(More, { d: row.details })
  ] });
}
function Tracker({ need, handled }) {
  const { rest } = useContext11(BlockActions);
  const [view, setView] = useState26(() => stored2(VIEW_KEY) === "done" ? "done" : "need");
  const [reopened, setReopened] = useState26([]);
  const [pulse, setPulse] = useState26(false);
  const rows = handled.filter((r) => !reopened.includes(r.id));
  useEffect8(() => {
    const before = Number(stored2(SEEN_KEY));
    store(SEEN_KEY, String(handled.length));
    if (stored2(SEEN_KEY) !== null && Number.isFinite(before) && handled.length > before && before > 0) setPulse(true);
  }, [handled.length]);
  const choose = (v) => {
    setView(v);
    store(VIEW_KEY, v);
  };
  const reopen = (id) => {
    setReopened((ids) => [...ids, id]);
    void rest?.(`/assistant/items/${id}`, { method: "POST", body: { status: "suggested" } });
  };
  const red = need.some((c) => c.state === "overdue");
  return /* @__PURE__ */ jsxs43("div", { className: "hb-tr", children: [
    /* @__PURE__ */ jsxs43("div", { className: "hb-tr-switch", role: "tablist", "aria-label": "Needs you or handled", children: [
      /* @__PURE__ */ jsxs43("button", { type: "button", role: "tab", "aria-selected": view === "need", onClick: () => choose("need"), children: [
        "Needs you ",
        /* @__PURE__ */ jsx46("span", { className: `hb-tr-badge${red ? " hb-tr-badge-red" : ""}`, children: need.length })
      ] }),
      /* @__PURE__ */ jsxs43("button", { type: "button", role: "tab", "aria-selected": view === "done", onClick: () => choose("done"), children: [
        "Handled ",
        /* @__PURE__ */ jsxs43("span", { className: `hb-tr-badge hb-tr-badge-green${pulse ? " hb-tr-pulse" : ""}`, children: [
          "\u2713 ",
          rows.length
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsx46("div", { className: "hb-tr-list", role: "tabpanel", children: view === "need" ? need.length ? need.map((c) => /* @__PURE__ */ jsx46(CardView, { card: c }, c.id)) : /* @__PURE__ */ jsx46("p", { className: "hb-tr-empty", children: "Nothing needs you right now." }) : rows.length ? rows.map((r) => /* @__PURE__ */ jsx46(RowView, { row: r, onReopen: reopen }, r.id)) : /* @__PURE__ */ jsx46("p", { className: "hb-tr-empty", children: "When a payment, renewal or delivery mail arrives, it lands here with the reason." }) })
  ] });
}

// src/blocks/timeline/Timeline.tsx
import { jsx as jsx47, jsxs as jsxs44 } from "react/jsx-runtime";
function Timeline({ title, groups }) {
  return /* @__PURE__ */ jsxs44("div", { className: "hb-card hb-timeline", children: [
    title && /* @__PURE__ */ jsx47("div", { className: "hb-card-title", children: title }),
    groups.map((g, gi) => /* @__PURE__ */ jsxs44("div", { className: "hb-timeline-group", children: [
      g.label && /* @__PURE__ */ jsx47("span", { className: "hb-chip hb-chip-soft", children: g.label }),
      g.items.map((s, k) => {
        const last = k === g.items.length - 1;
        return /* @__PURE__ */ jsxs44("div", { className: "hb-stop", children: [
          /* @__PURE__ */ jsx47("span", { className: "hb-stop-time", children: s.time ?? "" }),
          /* @__PURE__ */ jsxs44("span", { className: "hb-stop-rail", children: [
            /* @__PURE__ */ jsx47("span", { className: "hb-stop-dot", children: s.icon ? /* @__PURE__ */ jsx47(Icon, { name: s.icon, size: 12, stroke: 2.4 }) : /* @__PURE__ */ jsx47("span", { className: "hb-stop-pip" }) }),
            !last && /* @__PURE__ */ jsx47("span", { className: "hb-stop-line" })
          ] }),
          /* @__PURE__ */ jsxs44("div", { className: last ? "hb-stop-body" : "hb-stop-body hb-stop-body-gap", children: [
            /* @__PURE__ */ jsx47("div", { className: "hb-stop-title", children: s.title }),
            s.place && /* @__PURE__ */ jsxs44("div", { className: "hb-stop-place", children: [
              /* @__PURE__ */ jsx47(Icon, { name: "pin", size: 12, stroke: 2.2 }),
              s.place
            ] }),
            s.note && /* @__PURE__ */ jsx47("div", { className: "hb-stop-note", children: s.note })
          ] })
        ] }, k);
      })
    ] }, gi))
  ] });
}

// src/registry.tsx
import { jsx as jsx48 } from "react/jsx-runtime";
var REGISTRY = {
  chart: { read: readChart, Component: ({ block }) => /* @__PURE__ */ jsx48(Chart, { spec: block.spec }) },
  kpis: { read: readKpis, Component: ({ block }) => /* @__PURE__ */ jsx48(Kpis, { items: block.items }) },
  source: { read: readSource, Component: ({ block }) => /* @__PURE__ */ jsx48(Source, { ...block }) },
  timeline: { read: readTimeline, Component: ({ block }) => /* @__PURE__ */ jsx48(Timeline, { ...block }) },
  images: { read: readImages, Component: ({ block }) => /* @__PURE__ */ jsx48(Images, { block }) },
  callout: { read: readCallout, Component: ({ block }) => /* @__PURE__ */ jsx48(Callout, { ...block }) },
  calendar: { read: readCalendar, Component: ({ block }) => /* @__PURE__ */ jsx48(Calendar, { ...block }) },
  upnext: { read: readUpNext, Component: ({ block }) => /* @__PURE__ */ jsx48(UpNext, { ...block }) },
  weather: { read: readWeather, Component: ({ block }) => /* @__PURE__ */ jsx48(Weather, { ...block }) },
  widget: { read: readWidget, Component: ({ block }) => /* @__PURE__ */ jsx48(Widget, { block }) },
  briefing: { read: readBriefing, Component: ({ block }) => /* @__PURE__ */ jsx48(Briefing, { ...block }) },
  tracker: { read: readTracker, Component: ({ block }) => /* @__PURE__ */ jsx48(Tracker, { ...block }) },
  prepared: { read: readPrepared, Component: ({ block }) => /* @__PURE__ */ jsx48(Prepared, { ...block }) },
  table: { read: readTable, Component: ({ block }) => /* @__PURE__ */ jsx48(Table, { ...block }) },
  list: { read: readList, Component: ({ block }) => /* @__PURE__ */ jsx48(List, { ...block }) },
  progress: { read: readProgress, Component: ({ block }) => /* @__PURE__ */ jsx48(Progress, { ...block }) },
  streak: { read: readStreak, Component: ({ block }) => /* @__PURE__ */ jsx48(Streak, { ...block }) },
  heatmap: { read: readHeatmap, Component: ({ block }) => /* @__PURE__ */ jsx48(Heatmap, { ...block }) },
  flip: { read: readFlip, Component: ({ block }) => /* @__PURE__ */ jsx48(Flip, { ...block }) },
  flow: { read: readFlow, Component: ({ block }) => /* @__PURE__ */ jsx48(Flow, { ...block }) },
  steps: { read: readSteps, Component: ({ block }) => /* @__PURE__ */ jsx48(Steps, { ...block }) },
  layers: { read: readLayers, Component: ({ block }) => /* @__PURE__ */ jsx48(Layers, { ...block }) },
  heading: { read: readHeading, Component: ({ block }) => /* @__PURE__ */ jsx48(Heading, { text: block.text }) },
  text: { read: readText, Component: ({ block }) => /* @__PURE__ */ jsx48(Text, { text: block.text }) },
  stat: { read: readStat, Component: ({ block }) => /* @__PURE__ */ jsx48(KpiCard, { item: block }) },
  divider: { read: readDivider, Component: () => /* @__PURE__ */ jsx48(Divider, {}) },
  badge: { read: readBadge, Component: ({ block }) => /* @__PURE__ */ jsx48(Badge, { ...block }) },
  link: { read: readLink, Component: ({ block }) => /* @__PURE__ */ jsx48(LinkLine, { ...block }) },
  image: { read: readImage, Component: ({ block }) => /* @__PURE__ */ jsx48(Picture, { ...block }) },
  bar: { read: readBar, Component: ({ block }) => /* @__PURE__ */ jsx48(Bar, { ...block }) },
  actions: { read: readActions, Component: ({ block }) => /* @__PURE__ */ jsx48(Actions, { items: block.items }) },
  button: { read: readButton, Component: ({ block }) => /* @__PURE__ */ jsx48(Button, { ...block }) },
  tiles: { read: readTiles, Component: ({ block }) => /* @__PURE__ */ jsx48(Tiles, { items: block.items }) },
  checklist: { read: readChecklist, Component: ({ block }) => /* @__PURE__ */ jsx48(Checklist, { ...block }) },
  calculator: { read: readCalculator, Component: ({ block }) => /* @__PURE__ */ jsx48(Calculator, { ...block }) },
  simulate: { read: readSimulate, Component: ({ block }) => /* @__PURE__ */ jsx48(Simulate, { ...block }) },
  form: { read: readForm, Component: ({ block }) => /* @__PURE__ */ jsx48(Form, { ...block }) },
  row: { read: readContainer, Component: ({ block, draw }) => /* @__PURE__ */ jsx48(Row2, { kinds: block.children.map((c) => c.type), children: draw(block.children) }) },
  section: { read: readContainer, Component: ({ block, draw }) => /* @__PURE__ */ jsx48(Section, { title: block.title, collapsed: block.collapsed, children: draw(block.children) }) },
  grid: { read: readContainer, Component: ({ block, draw }) => /* @__PURE__ */ jsx48(Grid, { children: draw(block.children) }) },
  columns: { read: readContainer, Component: ({ block, draw }) => /* @__PURE__ */ jsx48(Columns, { children: draw(block.children) }) },
  tabs: { read: readTabs, Component: ({ block, draw }) => /* @__PURE__ */ jsx48(Tabs, { labels: block.tabs.map((t) => t.label), badges: block.tabs.map((t) => t.badge), panel: (i) => draw(block.tabs[i].children) }) }
};

// src/core/Blocks.tsx
import { jsx as jsx49 } from "react/jsx-runtime";
function BlockView({ block }) {
  const entry2 = REGISTRY[block.type];
  if (!entry2) return null;
  const { Component } = entry2;
  return /* @__PURE__ */ jsx49(Contained, { block, children: /* @__PURE__ */ jsx49(Component, { block, draw: drawAll }) });
}
var Contained = class extends ReactComponent {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error, _info) {
    console.error(`hermes-genui: a "${this.props.block.type}" block failed to draw`, this.props.block, error);
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return /* @__PURE__ */ jsx49("p", { className: "hb-block-failed", role: "note", children: "This part couldn't be drawn." });
  }
};
function blockKey(b, i, carried2) {
  const asked = carriedKey(b);
  if (asked !== void 0) {
    noteMounted(b, asked);
    return asked;
  }
  if (carried2) {
    const fresh = mintKey(b);
    noteMounted(b, fresh);
    return fresh;
  }
  noteMounted(b, String(i));
  return i;
}
function Slotted({ block, flat }) {
  const parent = useContext12(BlockSlot);
  const slot = parent === null ? flat : `${parent}/${flat}`;
  return /* @__PURE__ */ jsx49(BlockSlot.Provider, { value: slot, children: /* @__PURE__ */ jsx49(BlockView, { block }) });
}
function drawAll(blocks) {
  const seen = /* @__PURE__ */ new Map();
  const carried2 = blocks.some((b) => carriedKey(b) !== void 0);
  return blocks.map((b, i) => {
    const id = identityOf(b);
    const occ = seen.get(id) ?? 0;
    seen.set(id, occ + 1);
    return /* @__PURE__ */ jsx49(Slotted, { block: b, flat: `${id}:${occ}` }, blockKey(b, i, carried2));
  });
}
function Blocks({ blocks }) {
  return /* @__PURE__ */ jsx49("div", { className: "hb-blocks", children: /* @__PURE__ */ jsx49(FlowLightBoard, { children: drawAll(blocks) }) });
}

// src/core/boardRoster.ts
var entries = /* @__PURE__ */ new Map();
function entry(id) {
  let e = entries.get(id);
  if (!e) entries.set(id, e = { owner: null, pointers: [], meta: {}, listeners: /* @__PURE__ */ new Set(), pokers: /* @__PURE__ */ new Set() });
  return e;
}
function shout(e) {
  for (const cb of e.listeners) cb();
}
function claim(id, token) {
  const e = entry(id);
  if (e.owner === token) return true;
  if (e.pointers.includes(token)) return false;
  if (e.owner === null) {
    e.owner = token;
    shout(e);
    return true;
  }
  e.pointers.push(token);
  return false;
}
function release(id, token) {
  const e = entries.get(id);
  if (e !== void 0) {
    if (e.owner === token) {
      e.owner = e.pointers.shift() ?? null;
      shout(e);
    } else {
      const at2 = e.pointers.indexOf(token);
      if (at2 >= 0) e.pointers.splice(at2, 1);
    }
    if (e.owner === null && e.pointers.length === 0 && e.listeners.size === 0 && e.pokers.size === 0) {
      entries.delete(id);
      return true;
    }
  }
  return !occupied(id);
}
function occupied(id) {
  const e = entries.get(id);
  return e !== void 0 && (e.owner !== null || e.pointers.length > 0);
}
function owns(id, token) {
  const e = entries.get(id);
  return !!e && e.owner === token;
}
function listed(id, token) {
  const e = entries.get(id);
  return !!e && (e.owner === token || e.pointers.includes(token));
}
function setMeta(id, meta) {
  const e = entry(id);
  const same = e.meta.version === meta.version && e.meta.updatedAt === meta.updatedAt;
  e.meta = meta;
  if (!same) shout(e);
}
function getMeta(id) {
  return entry(id).meta;
}
function poke(id) {
  const e = entry(id);
  if (e && e.owner !== null) for (const cb of e.pokers) cb();
}
function onPoke(id, cb) {
  const e = entry(id);
  e.pokers.add(cb);
  return () => {
    e.pokers.delete(cb);
    if (e.owner === null && e.pointers.length === 0 && e.listeners.size === 0 && e.pokers.size === 0) {
      entries.delete(id);
    }
  };
}
function subscribe(id, cb) {
  const e = entry(id);
  e.listeners.add(cb);
  return () => {
    e.listeners.delete(cb);
    if (e.owner === null && e.pointers.length === 0 && e.listeners.size === 0 && e.pokers.size === 0) {
      entries.delete(id);
    }
  };
}

// src/core/LivingBoards.tsx
import { useContext as useContext13, useEffect as useEffect9, useState as useState27 } from "react";

// src/core/readBlocks.ts
var BLOCK_TYPES = Object.keys(REGISTRY);
function readBlocksNoted(data) {
  let list = data;
  let boardVersion;
  let boardUpdatedAt;
  let boardLinks;
  const top = new Trail();
  if (isObject4(list) && Array.isArray(list.blocks)) {
    if (typeof list.type !== "string") {
      boardVersion = version(list.version);
      boardUpdatedAt = str(list.updated_at, 40);
      boardLinks = readBoardLinks(list.links, top.at("links"));
    }
    list = list.blocks;
  }
  if (isObject4(list) && typeof list.type === "string") list = [list];
  const blocks = [];
  if (Array.isArray(list)) {
    list.forEach((raw, i) => {
      blocks.push(...readOne(raw, top.at(i), 0));
    });
  }
  const noted = { blocks, dropped: top.dropped };
  if (boardVersion !== void 0) noted.version = boardVersion;
  if (boardUpdatedAt !== void 0) noted.updatedAt = boardUpdatedAt;
  if (boardLinks !== void 0) noted.links = boardLinks;
  return noted;
}
function readBlocks(data) {
  return readBlocksNoted(data).blocks;
}
function isObject4(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}
function readBoardLinks(value, here) {
  if (!Array.isArray(value)) return void 0;
  const items = [];
  value.forEach((item, i) => {
    const id = boardId(typeof item === "string" ? item : item?.id);
    if (!id) {
      here.at(i).drop("a link must name a board by its address");
      return;
    }
    const note = typeof item === "object" && item !== null ? str(item.note, 80) : void 0;
    items.push(note ? { id, note } : { id });
  });
  const kept = keepFirst(items, 3, here, "links");
  return kept.length ? kept : void 0;
}
function readOne(raw, here, depth) {
  if (!isObject4(raw)) {
    here.drop("not a block object");
    return [];
  }
  const kind = raw.type;
  const entry2 = Object.hasOwn(REGISTRY, kind) ? REGISTRY[kind] : void 0;
  if (!entry2) {
    here.drop(`unknown type "${kind}"`);
    return [];
  }
  const read = entry2.read(raw, here, depth, readOne);
  if (!read) return [];
  return Array.isArray(read) ? read : [read];
}

// src/core/LivingBoards.tsx
import { jsx as jsx50, jsxs as jsxs45 } from "react/jsx-runtime";
var HISTORY_SHOWN = 4;
function LiveRow({ id, version: version2, updatedAt, links, viewing, onShow, canReach }) {
  const older = version2 != null ? Array.from({ length: Math.min(version2 - 1, HISTORY_SHOWN) }, (_, i) => version2 - 1 - i) : [];
  return /* @__PURE__ */ jsxs45("div", { className: "hb-live", "data-board": id, children: [
    /* @__PURE__ */ jsxs45("div", { className: "hb-live-line", children: [
      /* @__PURE__ */ jsx50("span", { className: "hb-live-mark", "aria-hidden": "true", children: "\u21BB" }),
      version2 != null && /* @__PURE__ */ jsx50("span", { className: "hb-live-version", children: viewing === null ? `v${version2}` : `viewing v${viewing}` }),
      updatedAt && viewing === null && /* @__PURE__ */ jsx50("span", { className: "hb-live-when", children: updatedAt.slice(0, 10) }),
      /* @__PURE__ */ jsxs45("code", { className: "hb-live-addr", children: [
        "#",
        id
      ] }),
      canReach && older.map((n) => /* @__PURE__ */ jsxs45(
        "button",
        {
          type: "button",
          className: "hb-live-history",
          "aria-pressed": viewing === n,
          onClick: () => onShow(viewing === n ? null : n),
          children: [
            "v",
            n,
            " \u21A9"
          ]
        },
        n
      )),
      viewing !== null && /* @__PURE__ */ jsx50("button", { type: "button", className: "hb-live-back", onClick: () => onShow(null), children: "current" })
    ] }),
    !!links?.length && /* @__PURE__ */ jsxs45("div", { className: "hb-links", children: [
      /* @__PURE__ */ jsx50("span", { className: "hb-links-label", children: "linked across time \xB7 AI-suggested" }),
      links.map((l) => /* @__PURE__ */ jsx50(LinkChip, { link: l }, l.id))
    ] })
  ] });
}
function LinkChip({ link }) {
  const [open, setOpen] = useState27(false);
  return /* @__PURE__ */ jsxs45("div", { className: "hb-link", children: [
    /* @__PURE__ */ jsx50(
      "button",
      {
        type: "button",
        className: "hb-link-chip",
        "aria-expanded": open,
        title: link.note ? `${link.note} \u2014 board #${link.id}` : `board #${link.id}`,
        onClick: () => setOpen((o) => !o),
        children: link.note ?? `#${link.id}`
      }
    ),
    open && /* @__PURE__ */ jsx50(LinkedBoard, { link })
  ] });
}
function LinkedBoard({ link }) {
  const actions = useContext13(BlockActions);
  const rest = actions.rest;
  const [board, setBoard] = useState27("loading");
  useEffect9(() => {
    if (!rest) {
      setBoard(null);
      return;
    }
    let live = true;
    rest(`/blocks/${link.id}`).then((data) => {
      const noted = readBlocksNoted(data);
      if ((noted.version ?? 0) >= 2) markLiving(link.id);
      if (live) setBoard(noted.blocks.length ? noted.blocks : null);
    }).catch(() => {
      if (live) setBoard(null);
    });
    return () => {
      live = false;
    };
  }, [link.id, rest]);
  if (board === "loading") {
    return /* @__PURE__ */ jsxs45("div", { className: "hb-linked hb-linked-loading", children: [
      "Fetching #",
      link.id,
      " from the store\u2026"
    ] });
  }
  if (!board) {
    return /* @__PURE__ */ jsxs45("div", { className: "hb-linked hb-linked-gone", children: [
      "#",
      link.id,
      " is not a board on this machine."
    ] });
  }
  return /* @__PURE__ */ jsxs45("div", { className: "hb-linked", "data-linked": link.id, children: [
    /* @__PURE__ */ jsxs45("div", { className: "hb-linked-head", children: [
      /* @__PURE__ */ jsx50("span", { "aria-hidden": "true", children: "\u25C8" }),
      /* @__PURE__ */ jsx50("span", { children: link.note ? link.note : "linked board" }),
      /* @__PURE__ */ jsxs45("code", { children: [
        "#",
        link.id
      ] })
    ] }),
    /* @__PURE__ */ jsx50(BlockActions.Provider, { value: { ...actions, blockId: link.id }, children: /* @__PURE__ */ jsx50(Blocks, { blocks: board }) })
  ] });
}
function LivePointer({ id, address }) {
  const meta = getMeta(address);
  return /* @__PURE__ */ jsxs45("div", { className: "hb-tag hb-live-pointer", "data-pointer": id, children: [
    /* @__PURE__ */ jsx50("span", { className: "hb-live-mark", "aria-hidden": "true", children: "\u21BB" }),
    /* @__PURE__ */ jsxs45("span", { children: [
      "The same live board",
      meta.version ? ` \xB7 v${meta.version}` : "",
      " \u2014 its live view is where its first tag stands above."
    ] }),
    /* @__PURE__ */ jsxs45("code", { className: "hb-live-addr", children: [
      "#",
      id
    ] })
  ] });
}

// src/host/BlockTag.tsx
import { jsx as jsx51, jsxs as jsxs46 } from "react/jsx-runtime";
var ID_PATTERN = /^[0-9a-f]{8}$/;
function BlockTag({ id, streaming, load }) {
  const validId = typeof id === "string" && ID_PATTERN.test(id);
  const actions = useContext14(BlockActions);
  const address = validId ? `${actions.sessionScope ?? ""}|${id}` : "";
  const [state, setState] = useState28({ kind: "loading" });
  const [viewing, setViewing] = useState28(null);
  const drawn2 = useRef15(null);
  const self = useRef15(null);
  if (self.current === null) self.current = { token: /* @__PURE__ */ Symbol("hb-tag") };
  const [role, setRole] = useState28("unknown");
  const [refresh, setRefresh] = useState28(0);
  const [, force] = useReducer((x) => x + 1, 0);
  const [live, setLive] = useState28({});
  useLayoutEffect4(() => {
    if (streaming || !validId) return;
    const token = self.current.token;
    const claim2 = claim(address, token);
    setRole(claim2 ? "home" : "pointer");
    if (!claim2) poke(address);
    const recompute = () => {
      const mine = owns(address, token);
      setRole(mine ? "home" : listed(address, token) ? "pointer" : "unknown");
      force();
    };
    const unsub = subscribe(address, recompute);
    const offPoke = onPoke(address, () => {
      setViewing(null);
      setRefresh((r) => r + 1);
    });
    return () => {
      unsub();
      offPoke();
      if (release(address, token)) forgetBlock(id);
    };
  }, [address, id, streaming, validId]);
  useEffect10(() => {
    if (streaming || !validId || role !== "home") return;
    let alive = true;
    const ask = viewing === null || !actions.rest ? load(id) : actions.rest(`/blocks/${id}?version=${viewing}`);
    Promise.resolve(ask).then((data) => {
      const { blocks, version: boardVersion, updatedAt: boardUpdatedAt, links: boardLinks } = readBlocksNoted(data);
      if (!alive) return;
      if (blocks.length) {
        const headless = drawn2.current === null && viewing === null && (boardVersion ?? 0) >= 2;
        const commitDraw = () => {
          if (!alive) return;
          if (drawn2.current) carryBlocks(drawn2.current, blocks);
          if (drawn2.current && viewing === null) void promoteOnUpdate(actions.rest, id, drawn2.current, blocks);
          if (viewing === null && (boardVersion ?? 0) >= 2) markLiving(id);
          drawn2.current = blocks;
          setState({ kind: "drawn", blocks });
          if (viewing === null) {
            setLive({ version: boardVersion, updatedAt: boardUpdatedAt, links: boardLinks });
            setMeta(address, { version: boardVersion, updatedAt: boardUpdatedAt });
          }
        };
        if (headless && actions.rest !== void 0) {
          const rest = actions.rest;
          void migrateArchived(
            rest,
            id,
            async (v) => {
              const answer = await rest(`/blocks/${id}?version=${v}`);
              const read = readBlocksNoted(answer).blocks;
              return read.length > 0 ? read : null;
            },
            blocks,
            boardVersion ?? 2
          ).then(commitDraw, commitDraw);
        } else {
          commitDraw();
        }
      } else if (viewing === null) {
        setState({ kind: "failed" });
      } else {
        setViewing(null);
      }
    }).catch(() => {
      if (!alive) return;
      if (viewing === null) setState({ kind: "failed" });
      else setViewing(null);
    });
    return () => {
      alive = false;
    };
  }, [address, id, streaming, validId, role, refresh, viewing]);
  if (!validId && !streaming) return null;
  if (streaming || role === "unknown") return /* @__PURE__ */ jsx51(Note, { text: "drawing\u2026", pulse: true });
  if (role === "pointer") return /* @__PURE__ */ jsx51(LivePointer, { id, address });
  if (state.kind === "loading") return /* @__PURE__ */ jsx51(Note, { text: "drawing\u2026", pulse: true });
  if (state.kind === "failed") return null;
  return /* @__PURE__ */ jsxs46(BlockActions.Provider, { value: { ...actions, blockId: id }, children: [
    /* @__PURE__ */ jsx51(Blocks, { blocks: state.blocks }),
    (live.version != null || live.links) && /* @__PURE__ */ jsx51(
      LiveRow,
      {
        id,
        version: live.version,
        updatedAt: live.updatedAt,
        links: live.links,
        viewing,
        onShow: setViewing,
        canReach: Boolean(actions.rest)
      }
    )
  ] });
}
function Note({ text, pulse = false }) {
  return /* @__PURE__ */ jsx51("div", { className: pulse ? "hb-state hb-pulse" : "hb-state", children: text });
}

// src/live/DashboardView.tsx
import { useCallback as useCallback2, useEffect as useEffect11, useRef as useRef16, useState as useState29 } from "react";

// src/live/RefreshBar.tsx
import { jsx as jsx52, jsxs as jsxs47 } from "react/jsx-runtime";
function when(iso, now = /* @__PURE__ */ new Date()) {
  const at2 = new Date(iso);
  const time = at2.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  if (at2.toDateString() === now.toDateString()) return time;
  return `${at2.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}, ${time}`;
}
function RefreshBar({ label, at: at2, refreshing, error, schedule, onRefresh }) {
  return /* @__PURE__ */ jsxs47("div", { className: "hb-refresh", role: "status", children: [
    /* @__PURE__ */ jsx52("span", { className: "hb-refresh-label", children: label }),
    /* @__PURE__ */ jsx52("span", { className: "hb-refresh-when", children: at2 ? `updated ${when(at2)}` : "not filled yet" }),
    schedule && /* @__PURE__ */ jsxs47("span", { className: "hb-refresh-when", children: [
      "\xB7 refreshes ",
      schedule
    ] }),
    error && /* @__PURE__ */ jsx52("span", { className: "hb-refresh-error", children: error }),
    /* @__PURE__ */ jsxs47(
      "button",
      {
        type: "button",
        className: "hb-refresh-button",
        disabled: refreshing,
        onClick: onRefresh,
        "aria-label": refreshing ? "Refreshing" : `Refresh ${label}`,
        children: [
          /* @__PURE__ */ jsx52("span", { "aria-hidden": "true", children: "\u21BB" }),
          " ",
          refreshing ? "Refreshing\u2026" : "Refresh"
        ]
      }
    )
  ] });
}

// src/live/DashboardView.tsx
import { jsx as jsx53, jsxs as jsxs48 } from "react/jsx-runtime";
function snapshotOf(b) {
  if (b.snapshots) return b.snapshots;
  if (b.at !== void 0 || b.refreshing !== void 0) {
    return { at: b.at ?? null, refreshing: Boolean(b.refreshing), error: b.error ?? null, schedule: b.schedule ?? null };
  }
  return null;
}
var EMPTY = [{ type: "callout", tone: "info", text: "No dashboard yet. Ask Hermes: \u201CCreate my personal dashboard\u201D, or \u201Cput my bills and NVDA on my Today page\u201D." }];
function checklistsByPath(node, found = {}) {
  if (Array.isArray(node)) node.forEach((n) => checklistsByPath(n, found));
  else if (node && typeof node === "object") {
    const block = node;
    if (block.type === "checklist" && typeof block.path === "string" && Array.isArray(block.items)) {
      found[block.path] = block.items.map((i) => i.id);
    }
    Object.values(node).forEach((v) => {
      if (v && typeof v === "object") checklistsByPath(v, found);
    });
  }
  return found;
}
function signature(ids) {
  const text = JSON.stringify(ids);
  let h = 0;
  for (let i = 0; i < text.length; i += 1) h = h * 31 + text.charCodeAt(i) | 0;
  return (h >>> 0).toString(36);
}
function DashboardView({ load, fill, saveTicks, post, refreshNow = 0, refresh, refreshLabel = "Snapshot" }) {
  const [board, setBoard] = useState29(null);
  const [missing, setMissing] = useState29(false);
  const live = useRef16(false);
  const lastTicks = useRef16({});
  const reload = useCallback2(async () => {
    try {
      const next = await load();
      if (!next) return;
      setMissing(false);
      const snapshot = snapshotOf(next);
      live.current = Boolean(next.live) || Boolean(snapshot?.refreshing);
      setBoard({
        title: next.title,
        greeting: next.greeting ?? null,
        blocks: readBlocks(next.title ? next.blocks : EMPTY),
        live: live.current,
        at: /* @__PURE__ */ new Date(),
        snapshot
      });
    } catch {
      setMissing(true);
    }
  }, [load]);
  useEffect11(() => {
    if (refreshNow) void reload();
  }, [refreshNow, reload]);
  useEffect11(() => {
    let stop = false;
    let timer;
    const tick = async () => {
      if (!(typeof document !== "undefined" && document.hidden)) await reload();
      if (!stop) timer = setTimeout(tick, live.current ? 5e3 : 3e4);
    };
    void tick();
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [reload]);
  if (!board) {
    return /* @__PURE__ */ jsx53("div", { className: "hb-blocks hb-dash", children: /* @__PURE__ */ jsx53("p", { className: "hb-dash-sub", children: missing ? "This page isn't in this profile. Switch back to the profile it was made in, or ask Hermes to make it here." : "Loading\u2026" }) });
  }
  const ids = checklistsByPath(board.blocks);
  const sig = signature(ids);
  const rest = async (path, init) => {
    if (init?.method === "POST" && post && path.startsWith("/assistant/items/")) {
      try {
        return await post(path, init);
      } finally {
        void reload();
      }
    }
    if (init?.method !== "PUT") return {};
    const state = init.body?.state ?? {};
    const ticks = {};
    for (const [where, ticked] of Object.entries(state)) {
      const now = Array.isArray(ticked) ? ticked : [];
      const before = new Set(lastTicks.current[`${sig}:${where}`] ?? []);
      const after = new Set(now);
      (ids[where] ?? []).forEach((id, n) => {
        if (id && before.has(n) !== after.has(n)) ticks[id] = after.has(n);
      });
      lastTicks.current[`${sig}:${where}`] = now;
    }
    if (Object.keys(ticks).length) await saveTicks(ticks);
    return { ok: true };
  };
  return /* @__PURE__ */ jsxs48("div", { className: "hb-blocks hb-dash", children: [
    board.blocks[0]?.type !== "briefing" && /* @__PURE__ */ jsxs48("header", { className: "hb-dash-head", children: [
      /* @__PURE__ */ jsx53("div", { className: "hb-dash-date", children: board.at.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }) }),
      /* @__PURE__ */ jsx53("h1", { children: board.greeting ?? board.title ?? "Today" })
    ] }),
    refresh && board.snapshot && /* @__PURE__ */ jsx53(RefreshBar, { label: refreshLabel, ...board.snapshot, onRefresh: async () => {
      setBoard((b) => b ? { ...b, snapshot: { ...b.snapshot, refreshing: true, error: null } } : b);
      try {
        await refresh();
      } finally {
        void reload();
      }
    } }),
    /* @__PURE__ */ jsx53(BlockActions.Provider, { value: { send: fill, fill, rest, blockId: `dashboard-${sig}` }, children: /* @__PURE__ */ jsx53(Blocks, { blocks: board.blocks }, sig) })
  ] });
}

// src/live/pages.ts
var BOARD_PATH = "/genui-board";
function pageRoutes(register, view) {
  const shown2 = /* @__PURE__ */ new Map();
  return (list) => {
    const wanted = new Map(list.filter((p) => p.kind === "dashboard" && /^[a-z0-9-]{1,40}$/.test(p.slug)).map((p) => [p.slug, p.title]));
    for (const [slug2, entry2] of shown2) {
      if (wanted.get(slug2) !== entry2.title) {
        entry2.off.forEach((off) => off());
        shown2.delete(slug2);
      }
    }
    for (const [slug2, title] of wanted) {
      if (shown2.has(slug2)) continue;
      const path = `${BOARD_PATH}/${slug2}`;
      shown2.set(slug2, { title, off: [
        register({ id: `hermes-genui-page-${slug2}`, area: "routes", title, data: { path }, render: () => view(slug2) }),
        register({
          id: `hermes-genui-page-${slug2}-nav`,
          area: "sidebar.nav",
          data: { codicon: "dashboard", label: title, path }
        })
      ] });
    }
  };
}

// src/live/register.tsx
import { jsx as jsx54 } from "react/jsx-runtime";
var POLL_MS = 5e3;
var TODAY_PATH = "/genui-today";
function registerLive(ctx, fill) {
  let hasDashboard = false;
  let nav = null;
  ctx.register({
    id: "hermes-genui-today",
    area: "routes",
    title: "Today",
    data: { path: TODAY_PATH },
    render: () => /* @__PURE__ */ jsx54(
      DashboardView,
      {
        fill,
        load: () => ctx.rest("/dashboard"),
        post: (path, init) => ctx.rest(path, init),
        saveTicks: async (ticks) => {
          await ctx.rest("/dashboard/state", { method: "PUT", body: { ticks } });
        },
        refresh: async () => {
          await ctx.rest("/pages/today/refresh", { method: "POST" });
        },
        refreshLabel: "Work sections"
      }
    )
  });
  const sync = () => {
    if (hasDashboard && !nav) {
      nav = ctx.register({
        id: "hermes-genui-today-nav",
        area: "sidebar.nav",
        data: { codicon: "pulse", label: "Today", path: TODAY_PATH }
      });
    } else if (!hasDashboard && nav) {
      nav();
      nav = null;
    }
  };
  const checkHead = async () => {
    try {
      const head = await ctx.rest("/dashboard/head");
      hasDashboard = Boolean(head?.title);
      sync();
    } catch {
      hasDashboard = false;
      sync();
    }
  };
  const syncPages = pageRoutes(ctx.register, (slug2) => /* @__PURE__ */ jsx54(
    DashboardView,
    {
      fill,
      load: () => ctx.rest(`/pages/${slug2}`),
      saveTicks: async () => {
      },
      refresh: async () => {
        await ctx.rest(`/pages/${slug2}/refresh`, { method: "POST" });
      }
    }
  ));
  const checkPages = async () => {
    try {
      const listed2 = await ctx.rest("/pages");
      if (Array.isArray(listed2?.pages)) syncPages(listed2.pages);
    } catch {
      syncPages([]);
    }
  };
  const poll = () => Promise.all([checkHead(), checkPages()]);
  void poll();
  ctx.setInterval(() => {
    if (typeof document !== "undefined" && document.hidden) return;
    void poll();
  }, POLL_MS);
}

// src/live/open.ts
var sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function tryInsert(host2, text) {
  try {
    return Boolean(await host2.composer?.insertText(null, text, { mode: "block" }));
  } catch {
    return false;
  }
}
async function openAndFill(text, host2, { waitMs = 2e3, stepMs = 100 } = {}) {
  let landed = await tryInsert(host2, text);
  if (!landed && host2.navigate) {
    host2.navigate("/");
    for (let waited = 0; !landed && waited < waitMs; waited += stepMs) {
      await sleep(stepMs);
      landed = await tryInsert(host2, text);
    }
  }
  if (landed) host2.composer?.focus(null);
  return landed;
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
  /* The one tone the theme has no variable for: a red for a value in a bad band (a load over its limit). */
  --hb-bad: var(--ui-danger, #b42318);
  /* The page behind the blocks, for the few marks that must hide what's under them (a progress checkpoint). */
  --hb-surface: var(--background, Canvas);
  /* A raised card (a chart's hover card). */
  --hb-shadow: 0 8px 28px rgba(15, 20, 30, 0.14), 0 1px 3px rgba(15, 20, 30, 0.1);
  /* One curve for everything that moves: transform, opacity and entrance animations. A colour or border
     fade keeps the browser's own ease, which is right for a tint. */
  --hb-ease-out: cubic-bezier(0.2, 0.8, 0.2, 1);
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
  --hb-bad: var(--ui-danger, #f0796c);
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
var shared_default = "/* Pieces several blocks share: cards, chips, pill buttons and the motion they use. */\n/* A block that threw while drawing: a quiet one-line note in its place (core/Blocks.tsx). */\n.hb-block-failed {\n  margin: 0;\n  font-size: 12px;\n  line-height: 18px;\n  color: var(--hb-muted);\n}\n/* Cards */\n.hb-card {\n  background: var(--hb-card);\n  border: 1px solid var(--hb-line);\n  border-radius: 16px;\n  padding: 14px 16px;\n}\n.hb-card-title {\n  font-size: 16px;\n  line-height: 22px;\n  font-weight: 700;\n  letter-spacing: -0.01em;\n}\n/* Chips */\n.hb-chip {\n  display: inline-flex;\n  align-items: center;\n  align-self: flex-start;\n  gap: 4px;\n  padding: 2px 9px;\n  border-radius: 999px;\n  font-size: 12px;\n  font-weight: 600;\n  line-height: 18px;\n  font-variant-numeric: tabular-nums;\n  white-space: nowrap;\n}\n.hb-chip-soft { background: var(--hb-accent-soft); color: var(--hb-accent-ink); }\n.hb-chip-good { background: color-mix(in srgb, var(--hb-good) 14%, transparent); color: var(--hb-good); }\n.hb-chip-warn { background: color-mix(in srgb, var(--hb-warn) 13%, transparent); color: var(--hb-warn); }\n.hb-chip-plain { background: var(--hb-well); color: var(--hb-ink-2); }\n/* Pill buttons that act (actions, button, a form's Send): soft for buttons in a reply, solid for a form's Send. */\n.hb-pill {\n  display: inline-flex;\n  align-items: center;\n  gap: 6px;\n  min-height: 36px;\n  max-width: 100%;\n  padding: 7px 14px;\n  border: 0;\n  border-radius: 999px;\n  background: var(--hb-accent-soft);\n  color: var(--hb-accent-ink);\n  font: inherit;\n  font-size: 13.5px;\n  font-weight: 600;\n  line-height: 18px;\n  text-align: left;\n  text-decoration: none;\n  cursor: pointer;\n  transition: background 0.15s ease, transform 0.1s var(--hb-ease-out);\n}\n.hb-pill svg { flex: none; }\n.hb-pill:hover { background: color-mix(in srgb, var(--hb-accent) 22%, transparent); }\n.hb-pill:active { transform: scale(0.97); }\n.hb-pill:focus-visible { outline: 2px solid var(--hb-accent); outline-offset: 2px; }\n.hb-pill-solid { background: var(--hb-accent); color: #fff; }\n.hb-pill-solid:hover { background: color-mix(in srgb, var(--hb-accent) 86%, #000); }\n.hb-pill:disabled { opacity: 0.45; cursor: default; transform: none; }\n.hb-pill-solid:disabled:hover { background: var(--hb-accent); }\n/* Motion: a panel appearing (section, tabs, photo overlay) and a bar growing (bar, progress). */\n.hb-appear { animation: hb-appear 0.22s var(--hb-ease-out); }\n@keyframes hb-appear { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }\n@keyframes hb-grow { from { transform: scaleX(0); } }\n@media (prefers-reduced-motion: reduce) {\n  .hb-pill { transition: none; }\n  .hb-appear { animation: none; }\n}\n";

// src/host/blockTag.css
var blockTag_default = `/* The block tag's own states */
.hb-state {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 8px 0;
  padding: 10px 14px;
  max-width: 100%;
  border-radius: 14px;
  background: color-mix(in srgb, var(--foreground, #1f2328) 5%, transparent);
  color: var(--ui-text-tertiary, #6b7280);
  font-size: 13px;
}
.hb-pulse { animation: hb-pulse 1.2s ease-in-out infinite; }
@keyframes hb-pulse { 50% { opacity: 0.45; } }
@media (prefers-reduced-motion: reduce) {
  .hb-pulse { animation: none; }
}

/* --- Living Boards ---------------------------------------------------------------------------
   The quiet row a live board says under itself, and the pointer a later tag of the same address
   draws instead of a second board. Both sit OUTSIDE .hb-blocks (the board's own DOM is untouched)
   and animate nothing: with no motion of their own there is nothing for prefers-reduced-motion
   to still. Colors ride the app's own variables with fallbacks, as the chrome row's do. */
.hb-live {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 14px;
  align-items: center;
  margin-top: 10px;
  padding: 6px 10px;
  border: 1px solid color-mix(in srgb, var(--foreground, #1f2328) 10%, transparent);
  border-radius: 10px;
  background: color-mix(in srgb, var(--background, #ffffff) 60%, transparent);
  color: var(--ui-text-tertiary, #6b7280);
  font-size: 12px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}
.hb-live-line { display: inline-flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.hb-live-mark { color: var(--ui-success, #1a7f37); }
.hb-live-version { font-weight: 600; color: var(--foreground, #1f2328); }
.hb-live-addr {
  font-family: ui-monospace, monospace;
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 6px;
  background: color-mix(in srgb, var(--foreground, #1f2328) 7%, transparent);
}
.hb-live-history, .hb-live-back, .hb-link-chip {
  border: 1px solid color-mix(in srgb, var(--foreground, #1f2328) 14%, transparent);
  border-radius: 999px;
  background: transparent;
  color: inherit;
  font: inherit;
  padding: 1px 10px;
  cursor: pointer;
}
.hb-live-history[aria-pressed="true"], .hb-link-chip[aria-expanded="true"] {
  border-color: var(--theme-primary, #e0a83c);
  color: var(--foreground, #1f2328);
}
.hb-links { display: inline-flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.hb-links-label { font-style: italic; }
.hb-link { display: contents; }
.hb-linked {
  width: 100%;
  margin-top: 4px;
  padding: 10px 12px;
  border: 1px dashed color-mix(in srgb, var(--foreground, #1f2328) 22%, transparent);
  border-radius: 10px;
}
.hb-linked-head {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
  color: var(--ui-text-tertiary, #6b7280);
  font-size: 12px;
  overflow-wrap: anywhere;
}
.hb-linked-gone { color: var(--ui-text-tertiary, #6b7280); font-style: italic; }
.hb-live-pointer {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
  margin: 6px 0;
  color: var(--ui-text-tertiary, #6b7280);
  font-size: 13px;
  overflow-wrap: anywhere;
}
`;

// src/blocks/atoms/atoms.css
var atoms_default = "/* Small pieces: heading, text, divider, badge, link, image, bar */\n.hb-heading { font-size: 16px; line-height: 22px; font-weight: 700; letter-spacing: -0.01em; margin-top: 4px; }\n.hb-text { color: var(--hb-ink-2); }\n.hb-text strong { color: var(--hb-ink); font-weight: 650; }\n.hb-divider { height: 1px; background: var(--hb-line); margin: 2px 0; }\n\n.hb-badge { display: flex; align-items: center; }\n.hb-link a {\n  display: inline-flex;\n  align-items: center;\n  gap: 6px;\n  font-size: 14px;\n  font-weight: 600;\n  color: var(--hb-accent-ink);\n  text-decoration: underline;\n  text-underline-offset: 2px;\n}\n.hb-image { margin: 0; display: flex; flex-direction: column; gap: 6px; }\n.hb-image img {\n  display: block;\n  width: 100%;\n  max-height: 300px;\n  object-fit: cover;\n  border: 1px solid var(--hb-line);\n  border-radius: 16px;\n  background: var(--hb-well);\n}\n.hb-image figcaption { padding: 0 4px; font-size: 12px; line-height: 16px; color: var(--hb-muted); }\n.hb-bar { display: flex; flex-direction: column; justify-content: center; gap: 6px; padding: 11px 14px; }\n.hb-bar-head { display: flex; flex-wrap: wrap; align-items: baseline; gap: 2px 8px; font-size: 13px; }\n.hb-bar-label { flex: 1 0 auto; font-weight: 600; color: var(--hb-ink-2); }\n.hb-bar-amount { color: var(--hb-muted); font-variant-numeric: tabular-nums; white-space: nowrap; }\n.hb-bar-track { height: 8px; border-radius: 999px; background: var(--hb-accent-soft); overflow: hidden; }\n.hb-bar-fill { display: block; height: 100%; border-radius: 999px; background: var(--hb-accent); }\n.hb-bar-fill { transform-origin: left; animation: hb-grow 0.9s var(--hb-ease-out); }\n@media (prefers-reduced-motion: reduce) {\n  .hb-bar-fill { animation: none; }\n}\n";

// src/blocks/source/source.css
var source_default = ".hb-source { font-size: 11.5px; color: var(--hb-muted); }\n.hb-source a { color: inherit; text-decoration: underline; text-underline-offset: 2px; }\n.hb-source-list { display: flex; flex-direction: column; gap: 5px; }\n.hb-source-head { color: var(--hb-ink-2); font-weight: 600; }\n.hb-source-rows { display: flex; flex-direction: column; gap: 4px; margin: 0; padding: 0; list-style: none; }\n.hb-source-row { display: flex; flex-wrap: wrap; align-items: baseline; gap: 5px; min-width: 0; }\n.hb-source-n { color: var(--hb-muted); font-variant-numeric: tabular-nums; }\n.hb-source-kind {\n  padding: 1px 6px; border-radius: 999px; font-size: 10px; line-height: 15px;\n  background: var(--hb-well); color: var(--hb-ink-2);\n}\n.hb-source-kind-web { background: var(--hb-accent-soft); color: var(--hb-accent-ink); }\n.hb-source-kind-tool { color: var(--hb-good); }\n.hb-source-kind-derived { color: var(--hb-warn); }\n.hb-source-accessed { color: var(--hb-muted); }\n.hb-source-note { flex-basis: 100%; padding-left: 16px; color: var(--hb-ink-2); }\n";

// src/blocks/callout/callout.css
var callout_default = ".hb-callout strong { color: var(--hb-ink); font-weight: 650; }\n.hb-callout {\n  display: flex;\n  gap: 10px;\n  padding: 11px 14px;\n  border-radius: 14px;\n  font-size: 13.5px;\n  line-height: 19px;\n}\n.hb-callout-icon { flex: none; margin-top: 1px; }\n.hb-callout-body { min-width: 0; color: var(--hb-ink-2); }\n.hb-callout-title { font-weight: 700; color: var(--hb-ink); }\n.hb-callout-info { background: var(--hb-accent-soft); }\n.hb-callout-info .hb-callout-icon { color: var(--hb-accent-ink); }\n.hb-callout-tip { background: color-mix(in srgb, var(--hb-good) 11%, transparent); }\n.hb-callout-tip .hb-callout-icon { color: var(--hb-good); }\n.hb-callout-warn { background: color-mix(in srgb, var(--hb-warn) 10%, transparent); }\n.hb-callout-warn .hb-callout-icon { color: var(--hb-warn); }\n";

// src/blocks/kpis/kpis.css
var kpis_default = "/* Headline numbers */\n/* Cards keep a readable width (130-200px) instead of stretching across a wide chat. */\n.hb-kpis {\n  display: grid;\n  grid-template-columns: repeat(auto-fill, minmax(130px, 200px));\n  gap: 8px;\n}\n.hb-kpi { display: flex; flex-direction: column; gap: 2px; min-width: 0; padding: 10px 12px; }\n.hb-kpi-label { font-size: 12px; font-weight: 500; color: var(--hb-muted); }\n.hb-kpi-value {\n  font-size: 22px;\n  line-height: 1.2;\n  font-weight: 650;\n  letter-spacing: -0.01em;\n  font-variant-numeric: tabular-nums;\n  overflow-wrap: anywhere;\n}\n.hb-kpi-value-text { font-size: 15px; font-weight: 700; }\n/* A value nobody measured: the words in the quiet text colour, so the card doesn't read as a figure. */\n.hb-kpi-value-empty { font-size: 15px; font-weight: 600; color: var(--hb-muted); }\n.hb-kpi-change { font-size: 12px; font-weight: 600; font-variant-numeric: tabular-nums; }\n.hb-kpi-up { color: var(--hb-good); }\n.hb-kpi-down { color: var(--hb-warn); }\n.hb-kpi-flat { color: var(--hb-muted); }\n/* A card where a fall is the good news (invert_tone): the two directions keep their class and swap their tone. */\n.hb-kpi-change.hb-kpi-invert.hb-kpi-up { color: var(--hb-warn); }\n.hb-kpi-change.hb-kpi-invert.hb-kpi-down { color: var(--hb-good); }\n.hb-kpi-spark { display: block; width: 100%; height: 28px; margin-top: 6px; overflow: visible; }\n.hb-kpi-spark path {\n  fill: none;\n  stroke: var(--hb-chart-1);\n  stroke-width: 1.75;\n  stroke-linejoin: round;\n  stroke-linecap: round;\n  vector-effect: non-scaling-stroke;\n}\n";

// src/blocks/timeline/timeline.css
var timeline_default = "/* Timeline */\n.hb-timeline { display: flex; flex-direction: column; gap: 14px; }\n.hb-timeline-group { display: flex; flex-direction: column; }\n.hb-timeline-group > .hb-chip { margin-bottom: 10px; }\n.hb-stop { display: grid; grid-template-columns: 46px 22px 1fr; column-gap: 8px; }\n.hb-stop-time {\n  padding-top: 2px;\n  text-align: right;\n  font-size: 12.5px;\n  font-weight: 600;\n  color: var(--hb-muted);\n  font-variant-numeric: tabular-nums;\n}\n.hb-stop-rail { display: flex; flex-direction: column; align-items: center; }\n.hb-stop-dot {\n  display: grid;\n  place-items: center;\n  flex: none;\n  width: 22px;\n  height: 22px;\n  border-radius: 999px;\n  background: var(--hb-accent-soft);\n  color: var(--hb-accent-ink);\n}\n.hb-stop-pip { width: 6px; height: 6px; border-radius: 999px; background: var(--hb-accent); }\n.hb-stop-line { flex: 1; width: 1px; margin: 4px 0; background: var(--hb-line); }\n.hb-stop-body { min-width: 0; }\n.hb-stop-body-gap { padding-bottom: 14px; }\n.hb-stop-title { font-size: 14.5px; line-height: 21px; font-weight: 600; }\n.hb-stop-place {\n  display: flex;\n  align-items: center;\n  gap: 4px;\n  margin-top: 1px;\n  font-size: 12.5px;\n  color: var(--hb-muted);\n}\n.hb-stop-note { margin-top: 3px; font-size: 13px; line-height: 18px; color: var(--hb-ink-2); }\n";

// src/blocks/layout/layout.css
var layout_default = "/* Containers. A row's small cards (stats, badges) end at the same height; a tall block never sits in a row\n   (layout/read.ts draws that row as a stack). */\n.hb-row { display: flex; flex-wrap: wrap; align-items: stretch; gap: 8px; }\n.hb-row-cell { flex: 1 1 140px; min-width: 0; display: flex; flex-direction: column; }\n.hb-row-cell > * { flex: 1; }\n/* Grid: each cell keeps its block's own height, top-aligned in its row. */\n.hb-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; align-items: start; }\n.hb-grid-cell { min-width: 0; display: flex; flex-direction: column; }\n.hb-row-cell-own { flex: none; align-self: center; }\n.hb-section { display: flex; flex-direction: column; gap: 8px; }\n.hb-section-body { display: flex; flex-direction: column; gap: 10px; }\n.hb-section .hb-card { background: var(--hb-well); border-color: transparent; }\n.hb-section-toggle {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  width: 100%;\n  padding: 0;\n  border: 0;\n  background: none;\n  color: inherit;\n  font: inherit;\n  text-align: left;\n  cursor: pointer;\n}\n.hb-section-toggle .hb-card-title { flex: 1; min-width: 0; }\n.hb-chevron { flex: none; color: var(--hb-muted); transition: transform 0.2s var(--hb-ease-out); }\n.hb-chevron-open { transform: rotate(90deg); }\n/* Tabs: underlined tab buttons in a bar that scrolls sideways when they don't fit, above one panel of blocks. */\n.hb-tabs { display: flex; flex-direction: column; gap: 10px; min-width: 0; }\n.hb-tab-bar {\n  display: flex;\n  gap: 2px;\n  overflow-x: auto;\n  scrollbar-width: none;\n  border-bottom: 1px solid var(--hb-line);\n}\n.hb-tab-bar::-webkit-scrollbar { display: none; }\n.hb-tab {\n  flex: none;\n  margin-bottom: -1px;\n  padding: 7px 12px 8px;\n  border: 0;\n  border-bottom: 2px solid transparent;\n  border-radius: 8px 8px 0 0;\n  background: none;\n  color: var(--hb-muted);\n  font: inherit;\n  font-size: 13.5px;\n  font-weight: 600;\n  white-space: nowrap;\n  cursor: pointer;\n  transition: color 0.15s, border-color 0.15s, background 0.15s;\n}\n.hb-tab:hover { color: var(--hb-ink-2); background: var(--hb-well); }\n.hb-tab-on, .hb-tab-on:hover { color: var(--hb-accent-ink); border-bottom-color: var(--hb-accent); background: none; }\n.hb-tab:focus-visible { outline: 2px solid var(--hb-accent); outline-offset: -2px; }\n.hb-tab-badge { display: inline-block; min-width: 18px; margin-left: 6px; padding: 0 5px; border-radius: 99px;\n  background: var(--hb-well); color: var(--hb-ink-2); font-size: 11px; line-height: 18px; text-align: center;\n  font-variant-numeric: tabular-nums; vertical-align: 1px; }\n.hb-tab-on .hb-tab-badge { background: var(--hb-accent); color: #fff; }\n.hb-tab-panel { display: flex; flex-direction: column; gap: 10px; min-width: 0; }\n\n/* Columns: dashboards side by side, each block at its own height (a short card beside a tall one stays short). */\n.hb-columns { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(380px, 100%), 1fr)); gap: 10px; align-items: start; }\n.hb-column { min-width: 0; display: flex; flex-direction: column; gap: 10px; }\n/* Beside other blocks a table's card fills its column or cell (on its own it hugs its columns). */\n:is(.hb-column, .hb-grid-cell) > .hb-table-card { width: auto; }\n";

// src/blocks/chart/chart.css
var chart_default = "/* Charts are drawn at their real width and fill their place inside a layout block (a column, a cell, a tab). At the\n   top of a reply they stop at 720px; a long line (60+ points) takes the board's full width. */\n.hb-chart { margin: 0; padding: 14px 16px 10px; }\n.hb-blocks > .hb-chart:not(.hb-chart-wide) { max-width: 720px; }\n.hb-chart-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }\n.hb-chart-title {\n  display: block;\n  min-width: 0;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n  font-size: 13px;\n  font-weight: 600;\n  color: var(--hb-muted);\n}\n.hb-chart-figure { display: flex; align-items: baseline; gap: 8px; margin-top: 2px; min-width: 0; }\n.hb-chart-big {\n  font-size: 28px;\n  line-height: 1.15;\n  font-weight: 800;\n  letter-spacing: -0.03em;\n  font-variant-numeric: tabular-nums;\n}\n.hb-chart-at {\n  min-width: 0;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n  font-size: 12px;\n  color: var(--hb-muted);\n  font-variant-numeric: tabular-nums;\n}\n.hb-chart-other { margin-left: 8px; }\n.hb-chart-plot { position: relative; margin-top: 8px; }\n.hb-chart-svg { display: block; width: 100%; overflow: visible; touch-action: none; user-select: none; }\n.hb-chart-svg:focus-visible, .hb-pie-svg:focus-visible, .hb-hbar-grid:focus-visible {\n  outline: 2px solid var(--hb-accent);\n  outline-offset: 4px;\n  border-radius: 4px;\n}\n.hb-chart-source { margin-top: 2px; text-align: right; font-size: 11px; color: var(--hb-muted); }\n.hb-chart-caveat { margin-top: 6px; font-size: 11px; line-height: 1.35; color: var(--hb-muted); overflow-wrap: anywhere; }\n.hb-chart-axis-note { margin-top: 4px; font-size: 11px; color: var(--hb-muted); }\n\n/* Marks and text inside the drawings */\n.hb-chart-axis, .hb-chart-tick { font-size: 11px; fill: var(--hb-muted); font-variant-numeric: tabular-nums; }\n.hb-chart-value { font-size: 11.5px; font-weight: 500; fill: var(--hb-ink-2); font-variant-numeric: tabular-nums; }\n.hb-chart-end { font-size: 11.5px; font-weight: 600; fill: var(--hb-ink); font-variant-numeric: tabular-nums; }\n/* Text drawn over lines (a change line's Start label): a rim of the page's colour behind the letters. */\n.hb-chart-halo { paint-order: stroke; stroke: var(--hb-surface); stroke-width: 3px; stroke-linejoin: round; }\n.hb-chart-rule { stroke: var(--hb-line); }\n.hb-chart-rule-strong { stroke: var(--hb-line-strong); }\n/* A waterfall's connector: the balance carried across to the next bar. A guide, so the gridline's colour, not the\n   darker one an axis takes. */\n.hb-waterfall-link { stroke: var(--hb-line); stroke-width: 1; }\n.hb-chart-dot { stroke: var(--hb-surface); stroke-width: 2; }\n/* Where a column has no value: a tick on the baseline in the no-data colour, so an unknown is not read as a zero. */\n.hb-chart-gap { fill: var(--hb-well); }\n.hb-chart-svg g, .hb-hbar-bar { transition: opacity 0.15s var(--hb-ease-out); }\n.hb-chart-draw { animation: hb-chart-draw 1.2s var(--hb-ease-out) forwards; }\n@keyframes hb-chart-draw { to { stroke-dashoffset: 0; } }\n\n/* The hover card (ChartTip) */\n.hb-tip {\n  position: absolute;\n  top: 0;\n  left: 0;\n  z-index: 5;\n  display: flex;\n  flex-direction: column;\n  gap: 4px;\n  min-width: 120px;\n  padding: 8px 10px;\n  border: 1px solid var(--hb-line);\n  border-radius: 8px;\n  background: var(--hb-surface);\n  box-shadow: var(--hb-shadow);\n  color: var(--hb-ink);\n  font-size: 12.5px;\n  line-height: 1.35;\n  font-variant-numeric: tabular-nums;\n  white-space: nowrap;\n  pointer-events: none;\n  opacity: 0;\n  transition: opacity 120ms var(--hb-ease-out);\n}\n.hb-tip-on { opacity: 1; }\n.hb-tip-title, .hb-tip-note { font-size: 11.5px; color: var(--hb-muted); }\n.hb-tip-row { display: flex; align-items: center; gap: 8px; }\n.hb-tip-row i { flex: none; width: 8px; height: 8px; border-radius: 2px; }\n.hb-tip-name { flex: 1; color: var(--hb-ink-2); }\n.hb-tip-value { margin-left: 12px; font-weight: 600; }\n\n@media (prefers-reduced-motion: reduce) {\n  .hb-chart-draw { animation: none; stroke-dashoffset: 0; }\n  .hb-tip, .hb-chart-svg g, .hb-hbar-bar, .hb-slice, .hb-pie-legend tr { transition: none; }\n}\n\n.hb-legend {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 4px 12px;\n  margin-top: 6px;\n  font-size: 12px;\n  line-height: 16px;\n  color: var(--hb-muted);\n}\n.hb-legend-item { display: inline-flex; align-items: center; gap: 6px; }\n.hb-legend-dot { flex: none; width: 10px; height: 10px; border-radius: 999px; }\n.hb-legend-value { color: var(--hb-ink-2); font-variant-numeric: tabular-nums; }\n\n/* Pie and donut: the legend sits beside the drawing from 440px wide, below it when narrower. It stops at 420px so\n   amounts stay near their names when the donut fills a wide section. */\n.hb-pie { container-type: inline-size; }\n.hb-pie-body { position: relative; display: flex; flex-direction: column; gap: 14px; margin-top: 10px; }\n@container (min-width: 440px) {\n  .hb-pie-body { flex-direction: row; align-items: center; gap: 20px; }\n  .hb-pie-body .hb-pie-svg { margin: 0; }\n}\n.hb-pie-svg { display: block; flex: none; margin: 0 auto; user-select: none; }\n.hb-pie-total { font-size: 17px; font-weight: 650; fill: var(--hb-ink); font-variant-numeric: tabular-nums; }\n.hb-slice { cursor: pointer; stroke: var(--hb-surface); stroke-width: 2; stroke-linejoin: round; transition: opacity 0.15s var(--hb-ease-out); }\n.hb-pie-legend { flex: 1; min-width: 0; max-width: 420px; border-collapse: collapse; font-size: 13px; line-height: 18px; font-variant-numeric: tabular-nums; }\n.hb-pie-legend tr { cursor: pointer; transition: opacity 0.15s var(--hb-ease-out); }\n.hb-pie-legend td { padding: 3px 12px 3px 0; vertical-align: top; }\n.hb-pie-legend td:last-child { padding-right: 0; }\n.hb-pie-swatch { width: 10px; }\n.hb-pie-swatch i { display: block; width: 10px; height: 10px; margin-top: 4px; border-radius: 3px; }\n.hb-pie-name { width: 100%; color: var(--hb-ink-2); overflow-wrap: anywhere; }\n.hb-pie-value { text-align: right; font-weight: 600; white-space: nowrap; }\n.hb-pie-share { text-align: right; color: var(--hb-muted); white-space: nowrap; }\n\n/* Horizontal bars: label | bar | value on each row. */\n.hb-hbar-box { position: relative; margin: 10px 0 4px; }\n.hb-hbar-grid {\n  display: grid;\n  grid-template-columns: fit-content(40%) minmax(0, 1fr) max-content;\n  gap: 8px 12px;\n  align-items: center;\n  font-size: 13px;\n}\n.hb-hbar-label { min-width: 64px; line-height: 17px; color: var(--hb-ink-2); }\n.hb-hbar-tracks, .hb-hbar-values { display: flex; flex-direction: column; gap: 4px; }\n.hb-hbar-track { position: relative; height: 14px; }\n.hb-hbar-zero { position: absolute; top: -4px; bottom: -4px; width: 1px; background: var(--hb-line-strong); }\n.hb-hbar-bar { position: absolute; top: 0; bottom: 0; border-radius: 3px; }\n.hb-hbar-value { line-height: 14px; text-align: right; font-weight: 600; font-variant-numeric: tabular-nums; white-space: nowrap; }\n.hb-hbar-many .hb-hbar-track { height: 12px; }\n.hb-hbar-many .hb-hbar-value { font-size: 12px; line-height: 12px; }\n.hb-hbar-up { color: var(--hb-good); }\n.hb-hbar-down { color: var(--hb-warn); }\n";

// src/blocks/images/images.css
var images_default = "/* Photos */\n.hb-photos { margin: 0; display: flex; flex-direction: column; gap: 8px; }\n.hb-photo-strip {\n  display: flex;\n  gap: 10px;\n  overflow-x: auto;\n  padding-bottom: 6px;\n  scroll-snap-type: x mandatory;\n  scrollbar-width: thin;\n}\n.hb-photo {\n  position: relative;\n  flex: 0 0 220px;\n  min-width: 0;\n  height: auto;\n  margin: 0;\n  overflow: hidden;\n  border: 1px solid var(--hb-line);\n  border-radius: 14px;\n  background: var(--hb-card);\n  color: inherit;\n  font: inherit;\n  scroll-snap-align: start;\n}\n.hb-photo-open {\n  display: flex;\n  flex-direction: column;\n  justify-content: flex-start;\n  align-items: stretch;\n  width: 100%;\n  margin: 0;\n  padding: 0;\n  border: 0;\n  background: none;\n  color: inherit;\n  font: inherit;\n  text-align: left;\n  cursor: zoom-in;\n}\n.hb-photo-open:focus-visible { outline: 2px solid var(--hb-accent); outline-offset: -2px; }\n.hb-photo-download {\n  position: absolute;\n  right: 8px;\n  bottom: 8px;\n  z-index: 1;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  width: 28px;\n  height: 28px;\n  border-radius: 8px;\n  background: rgba(0, 0, 0, 0.6);\n  color: #fff;\n  font: inherit;\n  font-size: 16px;\n  line-height: 1;\n  text-decoration: none;\n  opacity: 0;\n  transition: opacity 0.12s var(--hb-ease-out);\n}\n.hb-photo:hover .hb-photo-download,\n.hb-photo:focus-within .hb-photo-download { opacity: 1; }\n.hb-photo-label {\n  display: flex;\n  flex-direction: column;\n  gap: 2px;\n  min-width: 0;\n  flex: 1;\n  padding: 0;\n  border: 0;\n  background: none;\n  color: inherit;\n  font: inherit;\n  text-align: left;\n  cursor: zoom-in;\n}\n.hb-photo-label:focus-visible { outline: 2px solid var(--hb-accent); outline-offset: 2px; }\n.hb-photo-download:focus-visible { outline: 2px solid var(--hb-accent); outline-offset: 2px; }\n@media (hover: none) { .hb-photo-download { opacity: 1; } }\n@media (prefers-reduced-motion: reduce) { .hb-photo-download { transition: none; } }\n/* Four or more pictures read better as a grid: same cards and tokens, no sideways scroll. No model-written field. */\n.hb-photos-grid .hb-photo-strip { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); overflow: visible; }\n.hb-photos-grid .hb-photo { flex: initial; width: auto; }\n/* In the full gallery the control sits on the right of the caption row, centred with it; the strip keeps it on the image. */\n.hb-photos-grid .hb-photo-text { flex-direction: row; align-items: center; gap: 8px; }\n.hb-photos-grid .hb-photo-download { position: static; flex: 0 0 28px; opacity: 1; }\n@media (max-width: 520px) { .hb-photos-grid .hb-photo-strip { grid-template-columns: 1fr; } }\n.hb-photo img { display: block; width: 100%; height: 150px; object-fit: cover; background: var(--hb-well); }\n/* In the gallery each photo keeps the shape of a photo: the width sets the height, so a wide window adds columns. */\n.hb-photos-grid .hb-photo img { height: auto; aspect-ratio: 4 / 3; }\n.hb-photo-text { display: flex; flex-direction: column; gap: 2px; padding: 8px 10px 10px; }\n.hb-photo-caption {\n  display: -webkit-box;\n  -webkit-line-clamp: 2;\n  -webkit-box-orient: vertical;\n  overflow: hidden;\n  font-size: 13px;\n  line-height: 17px;\n  font-weight: 600;\n}\n.hb-photo-source { font-size: 11.5px; color: var(--hb-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }\n.hb-photo-overlay {\n  position: fixed;\n  inset: 0;\n  z-index: 2147483000;\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  justify-content: center;\n  gap: 12px;\n  padding: 32px;\n  background: rgba(0, 0, 0, 0.82);\n  cursor: zoom-out;\n  animation: hb-appear 0.18s var(--hb-ease-out);\n}\n.hb-photo-overlay img { margin: 0; max-width: 100%; max-height: calc(100% - 48px); border-radius: 10px; object-fit: contain; }\n.hb-photo-overlay-text { max-width: 720px; text-align: center; font-size: 14px; color: rgba(255, 255, 255, 0.92); }\n.hb-photo-overlay-text span { color: rgba(255, 255, 255, 0.6); }\n";

// src/blocks/table/table.css
var table_default = "/* Tables */\n/* A table keeps its natural width (columns close together); the card hugs it. It scrolls inside the card: sideways\n   when wider than the chat, down past 520px with the header kept in view. */\n.hb-table-card { width: fit-content; max-width: 100%; padding: 4px 0 0; overflow: hidden; }\n.hb-table-caption { padding: 10px 16px 2px; }\n.hb-table-scroll { max-height: 520px; overflow: auto; }\n.hb-table {\n  border-collapse: separate;\n  border-spacing: 0;\n  font-size: 13.5px;\n  line-height: 20px;\n  font-variant-numeric: tabular-nums;\n}\n/* With 3 or more columns, a narrow chat scrolls the table rather than squeezing every column. */\n.hb-table-wide { min-width: 420px; }\n.hb-table th, .hb-table td {\n  height: 36px;\n  padding: 8px 12px;\n  border: 0;\n  border-bottom: 1px solid var(--hb-line);\n  background: none;\n  text-align: left;\n  vertical-align: middle;\n  white-space: nowrap;\n}\n/* The header stays in view as the rows scroll; it is painted like the card so rows don't show through. */\n.hb-table th {\n  position: sticky;\n  top: 0;\n  z-index: 1;\n  height: 34px;\n  padding: 0;\n  border-bottom-color: var(--hb-line-strong);\n  background: linear-gradient(var(--hb-card), var(--hb-card)), var(--hb-surface);\n}\n.hb-table th button {\n  display: flex;\n  align-items: center;\n  gap: 4px;\n  width: 100%;\n  height: 34px;\n  padding: 0 12px;\n  border: 0;\n  background: none;\n  color: var(--hb-muted);\n  font: inherit;\n  font-size: 11.5px;\n  font-weight: 600;\n  letter-spacing: 0.04em;\n  text-transform: uppercase;\n  white-space: nowrap;\n  cursor: pointer;\n}\n.hb-table th.hb-num button { justify-content: flex-end; }\n.hb-table .hb-first, .hb-table th.hb-first button { padding-left: 16px; }\n.hb-table td:last-child, .hb-table th:last-child button { padding-right: 16px; }\n.hb-table tbody tr:last-child td { border-bottom: 0; }\n.hb-table td.hb-first { font-weight: 600; }\n.hb-table td.hb-num { text-align: right; }\n.hb-table td.hb-wrap { min-width: 180px; white-space: normal; }\n/* Sorting: a faint \u2195 on the header under the pointer, \u2191 or \u2193 on the sorted one. */\n.hb-sort { opacity: 0; font-weight: 400; letter-spacing: 0; transition: opacity 0.12s var(--hb-ease-out); }\n.hb-table th:hover .hb-sort, .hb-table th button:focus-visible .hb-sort { opacity: 0.6; }\n.hb-table th.hb-sorted .hb-sort { opacity: 1; color: var(--hb-ink-2); }\n/* The best row: an accent edge on its first cell and a chip; the best column: an accent line under its header. */\n.hb-table tr.hb-best td.hb-first { box-shadow: inset 3px 0 0 var(--hb-accent); }\n.hb-table th.hb-best-col { box-shadow: inset 0 -2px 0 var(--hb-accent); }\n.hb-table .hb-chip { margin-left: 8px; vertical-align: 1px; padding: 0 7px; font-size: 11px; line-height: 16px; letter-spacing: 0; text-transform: none; }\n.hb-table th .hb-chip { margin-left: 4px; }\n/* Changes: green for a rise, orange for a fall, with a small bar growing from the middle. */\n.hb-table td.hb-up { color: var(--hb-good); }\n.hb-table td.hb-down { color: var(--hb-warn); }\n.hb-mini { display: inline-block; position: relative; width: 56px; height: 8px; margin-right: 8px; vertical-align: 0; }\n.hb-mini-zero { position: absolute; top: -3px; bottom: -3px; left: 50%; width: 1px; background: var(--hb-line-strong); }\n.hb-mini-bar { position: absolute; top: 0; bottom: 0; border-radius: 2px; background: currentColor; }\n.hb-table td.hb-table-empty { color: var(--hb-muted); font-weight: 400; text-align: center; }\n@media (prefers-reduced-motion: reduce) { .hb-sort { transition: none; } }\n.hb-section .hb-table-card { background: none; border: 0; }\n/* Structured tables: typed columns, local filter, pages, aggregates and source chips. */\n.hb-table-structured .hb-table-grid { width: 100%; border-collapse: collapse; font-size: 13px; }\n.hb-table-structured th, .hb-table-structured td { padding: 7px 10px; border-bottom: 1px solid var(--hb-line); text-align: left; vertical-align: top; }\n.hb-table-structured th { color: var(--hb-ink-2); font-size: 11.5px; font-weight: 700; }\n.hb-table-structured .hb-align-right { text-align: right; font-variant-numeric: tabular-nums; }\n.hb-table-structured .hb-align-center { text-align: center; }\n.hb-table-structured tfoot td { color: var(--hb-ink-2); font-weight: 600; border-top: 1px solid var(--hb-line-strong); }\n.hb-table-aggregate-label { color: var(--hb-muted); font-size: 11px; font-weight: 400; }\n.hb-table-sources { display: flex; flex-wrap: wrap; gap: 3px 8px; }\n.hb-table-sources a { color: var(--hb-accent-ink); text-decoration: underline; text-underline-offset: 2px; }\n.hb-table-source-hint { margin-left: 4px; color: var(--hb-muted); }\n.hb-table-bar { display: flex; align-items: center; gap: 6px; min-width: 90px; }\n.hb-table-bar-fill { display: block; flex: 1 1 auto; height: 6px; border-radius: 999px; background: var(--hb-accent); }\n.hb-table-bar-value { flex: none; font-variant-numeric: tabular-nums; }\n.hb-table-tools { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; padding-top: 8px; }\n.hb-table-tools input { min-width: 140px; max-width: 240px; padding: 5px 9px; border: 1px solid var(--hb-line-strong); border-radius: 8px; background: var(--hb-well); color: var(--hb-ink); font: inherit; font-size: 12px; }\n.hb-table-tools input:focus-visible, .hb-table-pages button:focus-visible { outline: 2px solid var(--hb-accent); outline-offset: 2px; }\n.hb-table-pages { display: flex; align-items: center; gap: 8px; color: var(--hb-muted); font-size: 11.5px; }\n.hb-table-pages button { min-width: 26px; min-height: 26px; border: 1px solid var(--hb-line-strong); border-radius: 8px; background: var(--hb-well); color: var(--hb-ink); cursor: pointer; }\n.hb-table-pages button:disabled { opacity: 0.4; cursor: default; }\n";

// src/blocks/list/list.css
var list_default = "/* List */\n.hb-list { padding: 4px 0; overflow: hidden; }\n.hb-list-heading { padding: 8px 16px 2px; font-size: 13px; font-weight: 700; color: var(--hb-muted); }\n.hb-list-row {\n  display: flex;\n  align-items: center;\n  gap: 12px;\n  padding: 10px 16px;\n  border-top: 1px solid var(--hb-line);\n  color: inherit;\n  text-decoration: none;\n}\n.hb-list > .hb-list-row:first-child, .hb-list-heading + .hb-list-row { border-top: 0; }\n.hb-list-link { cursor: pointer; transition: background 0.15s; }\n.hb-list-link:hover { background: var(--hb-well); }\n.hb-list-rank {\n  flex: none;\n  display: grid;\n  place-items: center;\n  width: 28px;\n  height: 28px;\n  border-radius: 999px;\n  background: var(--hb-accent-soft);\n  color: var(--hb-accent-ink);\n  font-size: 13px;\n  font-weight: 700;\n  font-variant-numeric: tabular-nums;\n}\n.hb-list-photo { flex: none; width: 44px; height: 44px; border-radius: 12px; object-fit: cover; background: var(--hb-well); }\n.hb-list-icon {\n  flex: none;\n  display: grid;\n  place-items: center;\n  width: 36px;\n  height: 36px;\n  border-radius: 12px;\n  background: var(--hb-accent-soft);\n  color: var(--hb-accent-ink);\n}\n.hb-list-initial {\n  flex: none;\n  display: grid;\n  place-items: center;\n  width: 36px;\n  height: 36px;\n  border-radius: 999px;\n  color: #fff;\n  font-size: 15px;\n  font-weight: 700;\n}\n.hb-list-body { flex: 1; min-width: 0; display: flex; flex-direction: column; }\n.hb-list-title { font-size: 14.5px; line-height: 20px; font-weight: 600; overflow-wrap: anywhere; }\n.hb-list-subtitle {\n  display: -webkit-box;\n  -webkit-line-clamp: 2;\n  -webkit-box-orient: vertical;\n  overflow: hidden;\n  margin-top: 1px;\n  font-size: 13px;\n  line-height: 18px;\n  color: var(--hb-muted);\n}\n.hb-list-value { flex: none; font-size: 14px; font-weight: 700; font-variant-numeric: tabular-nums; white-space: nowrap; }\n/* The bar and the value share one right-hand block, so every track starts at the same x. In a list with bars the value\n   column has a fixed width; a list without bars keeps the value at its natural width, as before. */\n.hb-list-tail { flex: none; display: flex; align-items: center; gap: 8px; }\n.hb-list-bars .hb-list-value { width: 6.5rem; text-align: right; overflow: hidden; text-overflow: ellipsis; }\n.hb-list-bar { flex: none; width: 64px; height: 6px; border-radius: 999px; background: var(--hb-accent-soft); overflow: hidden; }\n.hb-list-bar-fill { display: block; height: 100%; border-radius: 999px; background: var(--hb-accent); }\n.hb-list-chevron { flex: none; color: var(--hb-muted); }\n.hb-section .hb-list { padding: 0; }\n\n/* List rows that send a message when tapped */\n.hb-list-button {\n  width: 100%;\n  margin: 0;\n  border: 0;\n  border-top: 1px solid var(--hb-line);\n  background: none;\n  font: inherit;\n  text-align: left;\n}\n.hb-list-button:focus-visible { outline: 2px solid var(--hb-accent); outline-offset: -2px; }\n";

// src/blocks/heatmap/heatmap.css
var heatmap_default = "/* Heatmap */\n.hb-heatmap { display: flex; flex-direction: column; gap: 8px; }\n.hb-heat-grid { display: grid; gap: 4px; align-items: center; }\n.hb-heat-col {\n  overflow: hidden;\n  text-align: center;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n  font-size: 11px;\n  font-weight: 600;\n  color: var(--hb-muted);\n}\n.hb-heat-row {\n  max-width: 96px;\n  padding-right: 6px;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n  font-size: 12px;\n  font-weight: 600;\n}\n.hb-heat-cell {\n  display: grid;\n  place-items: center;\n  min-width: 0;\n  height: 32px;\n  margin: 0;\n  padding: 0 2px;\n  overflow: hidden;\n  border: 0;\n  border-radius: 8px;\n  color: var(--hb-ink);\n  font: inherit;\n  font-size: 11.5px;\n  font-weight: 600;\n  line-height: 1;\n  font-variant-numeric: tabular-nums;\n  cursor: pointer;\n}\n.hb-heat-cell:focus-visible { outline: 2px solid var(--hb-accent); outline-offset: 1px; }\n.hb-heat-picked { font-size: 12.5px; color: var(--hb-muted); font-variant-numeric: tabular-nums; }\n.hb-heat-picked b { font-weight: 600; color: var(--hb-ink); }\n";

// src/blocks/flip/flip.css
var flip_default = "/* Flash cards: a grid of cards, each turning over in 3D on a tap to a softly tinted answer. A card grows with its\n   text: both faces sit in one grid cell, so the longer side sets its height, and the cards in a row share the row's. */\n.hb-flip { display: flex; flex-direction: column; gap: 8px; }\n/* At most --hb-flip-cols columns (set from the card count so the last row isn't a lone card), at least 200px each. */\n.hb-flip-grid {\n  display: grid;\n  grid-template-columns: repeat(auto-fill, minmax(max(200px, calc((100% - (var(--hb-flip-cols, 4) - 1) * 10px) / var(--hb-flip-cols, 4))), 1fr));\n  gap: 10px;\n}\n.hb-flip-card {\n  display: grid;\n  grid-template-columns: minmax(0, 1fr);\n  min-width: 0;\n  margin: 0;\n  padding: 0;\n  border: 0;\n  background: none;\n  color: inherit;\n  font: inherit;\n  text-align: left;\n  cursor: pointer;\n  perspective: 1000px;\n}\n.hb-flip-inner {\n  display: grid;\n  grid-template-columns: minmax(0, 1fr);\n  min-height: 150px;\n  transform-style: preserve-3d;\n  transition: transform 0.5s var(--hb-ease-out);\n}\n/* A photo on any card makes every card at least as tall as a photo card needs, so the rows stay even. */\n.hb-flip-tall .hb-flip-inner { min-height: 220px; }\n.hb-flip-turned { transform: rotateY(180deg); }\n.hb-flip-face {\n  grid-area: 1 / 1;\n  display: flex;\n  flex-direction: column;\n  gap: 6px;\n  overflow: hidden;\n  padding: 12px 14px;\n  border-radius: 12px;\n  border: 1px solid var(--hb-line);\n  backface-visibility: hidden;\n  -webkit-backface-visibility: hidden;\n}\n.hb-flip-front { background: var(--hb-card); }\n.hb-flip-card:hover .hb-flip-front { border-color: var(--hb-line-strong); }\n/* The answer side: a soft wash of the accent over the page colour, text in the normal ink. */\n.hb-flip-back {\n  transform: rotateY(180deg);\n  background: linear-gradient(var(--hb-accent-soft), var(--hb-accent-soft)), var(--hb-surface);\n  border-color: color-mix(in srgb, var(--hb-accent) 30%, transparent);\n}\n.hb-flip-card:focus-visible .hb-flip-face { outline: 2px solid var(--hb-accent); outline-offset: 2px; }\n.hb-flip-label {\n  font-size: 11px;\n  font-weight: 600;\n  letter-spacing: 0.06em;\n  text-transform: uppercase;\n  color: var(--hb-muted);\n  font-variant-numeric: tabular-nums;\n}\n.hb-flip-back .hb-flip-label { color: var(--hb-accent-ink); }\n.hb-flip-question, .hb-flip-answer { flex: 1; display: flex; align-items: center; min-height: 0; }\n.hb-flip-question { font-size: 14.5px; line-height: 1.35; font-weight: 600; }\n.hb-flip-answer { font-size: 13.5px; line-height: 1.45; }\n.hb-flip-foot { display: flex; justify-content: space-between; font-size: 11.5px; color: var(--hb-muted); }\n.hb-flip-back img { display: block; flex: none; width: calc(100% + 28px); height: 96px; margin: -12px -14px 4px; object-fit: cover; }\n@media (prefers-reduced-motion: reduce) {\n  .hb-flip-inner, .hb-flip-turned { transition: none; transform: none; }\n  .hb-flip-face, .hb-flip-back { transform: none; backface-visibility: visible; -webkit-backface-visibility: visible; transition: opacity 0.2s var(--hb-ease-out); }\n  .hb-flip-inner:not(.hb-flip-turned) .hb-flip-back, .hb-flip-turned .hb-flip-front { opacity: 0; }\n}\n";

// src/blocks/flow/flow.css
var flow_default = "/* Flow: boxes joined by arrows, left to right (.hb-flow-right) or top to bottom (.hb-flow-down). A group is a dashed\n   frame with its label (and count) on top; the lit box (from a steps block) gets the accent outline; boxes a walk\n   hasn't reached are dimmed; a box's chips fade in when they change; a tapped box's note opens in a panel under the\n   diagram. */\n.hb-flow { display: flex; flex-direction: column; gap: 10px; }\n.hb-flow-box { position: relative; width: 100%; min-width: 0; }\n.hb-flow-chain { display: flex; margin: 0; padding: 0; list-style: none; }\n.hb-flow-step { display: flex; align-items: center; min-width: 0; }\n.hb-flow-right { flex-direction: row; align-items: stretch; }\n.hb-flow-right .hb-flow-chain { flex-direction: row; }\n.hb-flow-right .hb-flow-step { flex: 1 1 0; align-items: stretch; }\n.hb-flow-right .hb-flow-arrow { align-self: center; }\n.hb-flow-down, .hb-flow-down .hb-flow-chain { flex-direction: column; align-items: stretch; }\n.hb-flow-down .hb-flow-step { flex-direction: column; align-items: stretch; }\n.hb-flow-arrow { display: grid; place-items: center; flex: none; width: 24px; color: var(--hb-muted); }\n.hb-flow-down .hb-flow-arrow { width: auto; height: 22px; }\n.hb-flow-down .hb-flow-arrow svg { transform: rotate(90deg); }\n.hb-flow-node {\n  position: relative;\n  display: flex;\n  flex: 1;\n  align-items: center;\n  gap: 6px;\n  min-width: 0;\n  min-height: 44px;\n  margin: 0;\n  padding: 8px 10px;\n  border: 1px solid var(--hb-line-strong);\n  border-radius: 10px;\n  background: var(--hb-surface);\n  color: inherit;\n  font: inherit;\n  font-size: 13px;\n  line-height: 1.3;\n  font-weight: 600;\n  text-align: left;\n  transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;\n}\n.hb-flow-right .hb-flow-node { flex-direction: column; justify-content: center; text-align: center; }\nbutton.hb-flow-node { cursor: pointer; }\nbutton.hb-flow-node:hover { border-color: var(--hb-accent); }\nbutton.hb-flow-node:focus-visible { outline: 2px solid var(--hb-accent); outline-offset: 2px; }\n.hb-flow-open { background: var(--hb-accent-soft); border-color: color-mix(in srgb, var(--hb-accent) 45%, transparent); }\n.hb-flow-lit { border-color: var(--hb-accent); box-shadow: 0 0 0 2px var(--hb-accent); }\n.hb-flow-icon {\n  display: grid;\n  place-items: center;\n  flex: none;\n  width: 24px;\n  height: 24px;\n  border-radius: 999px;\n  background: var(--hb-accent-soft);\n  color: var(--hb-accent-ink);\n}\n.hb-flow-label { min-width: 0; }\n.hb-flow-more { margin-left: auto; color: var(--hb-muted); font-weight: 400; }\n.hb-flow-right .hb-flow-more { position: absolute; top: 2px; right: 6px; font-size: 12px; }\n.hb-flow-group {\n  display: flex;\n  flex: 1;\n  flex-direction: column;\n  gap: 6px;\n  min-width: 0;\n  padding: 6px;\n  border: 1px dashed var(--hb-line-strong);\n  border-radius: 12px;\n  background: var(--hb-card);\n}\n.hb-flow-group-head { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 6px; }\n.hb-flow-down .hb-flow-group-head { justify-content: flex-start; }\n.hb-flow-group-label { font-size: 11.5px; font-weight: 600; color: var(--hb-muted); text-align: center; }\n.hb-flow-down .hb-flow-group-label { text-align: left; }\n.hb-flow-down .hb-flow-node { flex-wrap: wrap; }\n.hb-flow-holds { display: flex; flex-wrap: wrap; gap: 3px; animation: hb-flow-fade 0.2s var(--hb-ease-out); }\n.hb-flow-right .hb-flow-holds { justify-content: center; }\n.hb-flow-down .hb-flow-holds { flex-basis: 100%; }\n@keyframes hb-flow-fade { from { opacity: 0; transform: translateY(-2px); } }\n.hb-flow-chip {\n  padding: 1px 6px;\n  border: 1px solid transparent;\n  border-radius: 6px;\n  background: var(--hb-well);\n  color: var(--hb-ink-2);\n  font: 11.5px/16px ui-monospace, SFMono-Regular, Menlo, monospace;\n  font-weight: 400;\n  white-space: nowrap;\n}\n.hb-flow-chip-accent { background: var(--hb-accent-soft); color: var(--hb-accent-ink); font-weight: 700; }\n/* A box the pass hasn't reached yet: faint, its chips only outlined. */\n.hb-flow-idle { color: var(--hb-muted); }\n.hb-flow-idle .hb-flow-holds { opacity: 0.6; }\n.hb-flow-idle .hb-flow-chip { border-style: dashed; border-color: var(--hb-line-strong); background: none; color: var(--hb-muted); font-family: inherit; }\n.hb-flow-packet {\n  position: absolute;\n  top: 0;\n  left: 0;\n  z-index: 3;\n  width: 12px;\n  height: 12px;\n  margin: -6px 0 0 -6px;\n  border-radius: 999px;\n  background: var(--hb-accent);\n  box-shadow: 0 0 0 4px var(--hb-accent-soft), 0 0 14px var(--hb-accent);\n  opacity: 0;\n  pointer-events: none;\n}\n.hb-flow-right .hb-flow-group > .hb-flow-chain { flex: 1; }\n.hb-flow-panel {\n  padding: 10px 12px;\n  border-radius: 10px;\n  background: linear-gradient(var(--hb-accent-soft), var(--hb-accent-soft)), var(--hb-surface);\n  border: 1px solid color-mix(in srgb, var(--hb-accent) 30%, transparent);\n}\n.hb-flow-panel-title { font-size: 13px; font-weight: 700; color: var(--hb-accent-ink); }\n.hb-flow-note { margin: 2px 0 0; font-size: 13.5px; line-height: 1.5; }\n@media (prefers-reduced-motion: reduce) {\n  .hb-flow-node { transition: none; }\n  .hb-flow-holds { animation: none; }\n}\n";

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
  transition: background 0.15s;
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
var progress_default = "/* Progress: a track toward a goal, with checkpoints, threshold bands and segments */\n.hb-progress {\n  /* The card, its icon, the fill and the ring take the tone of the value: good by default, warn or bad from a band. */\n  --hb-tone: var(--hb-good);\n  background: color-mix(in srgb, var(--hb-tone) 9%, transparent);\n  border-color: color-mix(in srgb, var(--hb-tone) 22%, transparent);\n}\n.hb-progress-tone-warn { --hb-tone: var(--hb-warn); }\n.hb-progress-tone-bad { --hb-tone: var(--hb-bad); }\n.hb-progress-head { display: flex; align-items: center; gap: 8px; }\n.hb-progress-head .hb-card-title { min-width: 0; }\n.hb-progress-icon { display: flex; color: var(--hb-tone); }\n.hb-progress-amount {\n  display: flex;\n  align-items: center;\n  gap: 4px;\n  margin-left: auto;\n  font-size: 14px;\n  font-weight: 600;\n  color: var(--hb-ink-2);\n  font-variant-numeric: tabular-nums;\n  white-space: nowrap;\n}\n.hb-progress-amount svg { color: var(--hb-tone); }\n.hb-progress-pct {\n  margin-left: 10px;\n  font-size: 13px;\n  font-weight: 650;\n  color: var(--hb-tone);\n  font-variant-numeric: tabular-nums;\n  white-space: nowrap;\n}\n.hb-progress-track {\n  display: block;\n  height: 8px;\n  margin: 16px 0 4px;\n  overflow: hidden;\n  border-radius: 999px;\n  background: color-mix(in srgb, var(--hb-tone) 20%, transparent);\n}\n.hb-progress-fill { transform-origin: left; animation: hb-grow 0.9s var(--hb-ease-out); }\n.hb-progress-fill { display: block; height: 100%; border-radius: 999px; background: var(--hb-tone); }\n.hb-progress-nodes { position: relative; height: 24px; margin-top: 16px; }\n.hb-progress-track-steps { position: absolute; top: 8px; margin: 0; }\n.hb-progress-fill-steps { position: absolute; top: 8px; height: 8px; }\n\n/* A marked track: the ticks and their labels are placed over and under the bar, so the wrapper holds the positions. */\n.hb-progress-line { position: relative; margin: 16px 0 4px; }\n.hb-progress-line .hb-progress-track { position: relative; margin: 0; }\n.hb-progress-track-zoned { position: relative; }\n.hb-progress-band { position: absolute; top: 0; bottom: 0; }\n.hb-progress-band-good { background: color-mix(in srgb, var(--hb-good) 34%, transparent); }\n.hb-progress-band-warn { background: color-mix(in srgb, var(--hb-warn) 34%, transparent); }\n.hb-progress-band-bad { background: color-mix(in srgb, var(--hb-bad) 34%, transparent); }\n.hb-progress-mark {\n  position: absolute;\n  top: -3px;\n  width: 2px;\n  height: 14px;\n  margin-left: -1px;\n  border-radius: 1px;\n  background: var(--hb-ink-2);\n  opacity: 0.55;\n  pointer-events: none;\n}\n.hb-progress-mark-labels { position: relative; height: 15px; margin-top: 6px; }\n.hb-progress-mark-labels span {\n  position: absolute;\n  transform: translateX(-50%);\n  max-width: 45%;\n  overflow: hidden;\n  font-size: 11px;\n  line-height: 15px;\n  font-weight: 500;\n  color: var(--hb-muted);\n  white-space: nowrap;\n  text-overflow: ellipsis;\n}\n\n/* Parts of one track: each starts where the last ended, cut apart by a hairline of the panel behind them. The track\n   under them stays neutral, so the part that is still empty never reads as another green stage. */\n.hb-progress-track-parts { background: var(--hb-well); }\n.hb-progress-seg { position: absolute; top: 0; bottom: 0; }\n.hb-progress-seg + .hb-progress-seg { border-left: 2px solid var(--hb-surface); }\n.hb-progress-seg-good { background: var(--hb-good); }\n.hb-progress-seg-warn { background: var(--hb-warn); }\n.hb-progress-seg-bad { background: var(--hb-bad); }\n.hb-progress-dot-good { background: var(--hb-good); }\n.hb-progress-dot-warn { background: var(--hb-warn); }\n.hb-progress-dot-bad { background: var(--hb-bad); }\n\n/* Ring and gauge: one stroked path, the toned part drawn over the track, the figure in the middle. */\n.hb-progress-ring { position: relative; width: 132px; margin: 10px auto 2px; }\n.hb-progress-ring svg { display: block; width: 100%; height: auto; overflow: visible; }\n.hb-progress-ring-track {\n  fill: none;\n  stroke: color-mix(in srgb, var(--hb-tone) 20%, transparent);\n  stroke-width: 10;\n  stroke-linecap: round;\n}\n.hb-progress-ring-fill { fill: none; stroke: var(--hb-tone); stroke-width: 10; }\n.hb-progress-ring-good { stroke: var(--hb-good); }\n.hb-progress-ring-warn { stroke: var(--hb-warn); }\n.hb-progress-ring-bad { stroke: var(--hb-bad); }\n/* A tick across the ring, in the same ink as the bar's mark, so it reads on a pale and on a dark card. */\n.hb-progress-ring-mark { stroke: var(--hb-ink-2); stroke-width: 3; stroke-linecap: round; opacity: 0.55; }\n.hb-progress-ring-pct {\n  position: absolute;\n  inset: 0;\n  display: grid;\n  place-items: center;\n  font-size: 20px;\n  font-weight: 700;\n  letter-spacing: -0.01em;\n  color: var(--hb-ink);\n  font-variant-numeric: tabular-nums;\n}\n.hb-progress-ring-dash .hb-progress-ring-pct { padding-bottom: 12px; }\n\n@media (prefers-reduced-motion: reduce) {\n  .hb-progress-fill { animation: none; }\n}\n";

// src/blocks/streak/streak.css
var streak_default = "/* Streak */\n.hb-streak { padding: 0; overflow: hidden; }\n.hb-streak-head { display: flex; align-items: center; gap: 12px; padding: 14px 16px 12px; }\n.hb-streak-label {\n  font-size: 12px;\n  font-weight: 600;\n  letter-spacing: 0.06em;\n  text-transform: uppercase;\n  color: var(--hb-accent-ink);\n}\n.hb-streak-count {\n  font-size: 32px;\n  line-height: 38px;\n  font-weight: 800;\n  letter-spacing: -0.03em;\n  font-variant-numeric: tabular-nums;\n}\n.hb-streak-count span { text-transform: capitalize; }\n.hb-streak-medal {\n  flex: none;\n  display: grid;\n  place-items: center;\n  width: 56px;\n  height: 56px;\n  margin-left: auto;\n  border-radius: 999px;\n  color: #fff;\n  background: radial-gradient(circle at 35% 30%, color-mix(in srgb, var(--hb-chart-2) 45%, #fff), var(--hb-chart-2) 55%,\n    color-mix(in srgb, var(--hb-chart-2) 75%, #000));\n  box-shadow: 0 8px 20px -8px color-mix(in srgb, var(--hb-chart-2) 70%, transparent);\n}\n.hb-streak-week { display: grid; padding: 12px 8px; border-top: 1px solid var(--hb-line); }\n.hb-streak-day { display: flex; flex-direction: column; align-items: center; gap: 6px; }\n.hb-streak-day-label { font-size: 12.5px; color: var(--hb-muted); }\n.hb-streak-done {\n  display: grid;\n  place-items: center;\n  width: 32px;\n  height: 32px;\n  border-radius: 999px;\n  background: var(--hb-accent-soft);\n  color: var(--hb-accent-ink);\n}\n.hb-streak-date {\n  display: grid;\n  place-items: center;\n  width: 32px;\n  height: 32px;\n  font-size: 16px;\n  color: var(--hb-muted);\n  font-variant-numeric: tabular-nums;\n}\n.hb-streak-dot { width: 4px; height: 4px; border-radius: 999px; }\n.hb-streak-today .hb-streak-day-label, .hb-streak-today .hb-streak-date { font-weight: 700; color: var(--hb-ink); }\n.hb-streak-today .hb-streak-dot { background: var(--hb-ink-2); }\n";

// src/blocks/actions/actions.css
var actions_default = "/* A row of pill buttons (the pills themselves are in styles/shared.css). */\n.hb-actions { display: flex; flex-wrap: wrap; gap: 8px; }\n";

// src/blocks/tiles/tiles.css
var tiles_default = "/* Tiles: cover cards. Every card keeps the cover shape \u2014 its height comes from its aspect-ratio, never from the\n   text, so rows stay even however long a reason is. The reason reads in up to three lines (the reader cuts it to\n   about 120 characters between words), in full white with a shadow, and the photo stays bright: only the caption\n   block darkens behind the text, there is no overlay over the whole card. */\n.hb-tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; }\n.hb-tile {\n  position: relative;\n  display: block;\n  aspect-ratio: 1 / 1.05;\n  margin: 0;\n  padding: 0;\n  overflow: hidden;\n  border: 0;\n  border-radius: 20px;\n  color: #fff;\n  font: inherit;\n  text-align: left;\n  cursor: pointer;\n  transition: transform 0.15s var(--hb-ease-out);\n}\n.hb-tile:hover { transform: translateY(-1px); }\n.hb-tile:active { transform: scale(0.98); }\n.hb-tile:disabled { cursor: default; transform: none; }\n.hb-tile-static { cursor: default; }\n.hb-tile-static:hover,\n.hb-tile-static:active { transform: none; }\n.hb-tile:focus-visible { outline: 2px solid var(--hb-accent); outline-offset: 2px; }\n.hb-tile img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }\n.hb-tile-icon {\n  position: absolute;\n  top: 12px;\n  left: 12px;\n  display: grid;\n  place-items: center;\n  width: 36px;\n  height: 36px;\n  border: 1px solid rgba(255, 255, 255, 0.35);\n  border-radius: 12px;\n  background: rgba(255, 255, 255, 0.22);\n  backdrop-filter: blur(8px);\n}\n/* The scrim is localized: it is the caption block's own background, so it fades in over the text and nowhere\n   else \u2014 the photo above the caption keeps its full brightness. It is already dark by the title (the top third of\n   the fade does most of the work), so a title over snow or sky reads as well as the lines under it. */\n.hb-tile-text {\n  position: absolute;\n  left: 0;\n  right: 0;\n  bottom: 0;\n  display: flex;\n  flex-direction: column;\n  gap: 3px;\n  padding: 30px 12px 12px 14px;\n  background: linear-gradient(180deg, rgba(12, 8, 24, 0) 0%, rgba(12, 8, 24, 0.46) 34%, rgba(12, 8, 24, 0.72) 100%);\n}\n.hb-tile-title { font-size: 15.5px; line-height: 20px; font-weight: 700; letter-spacing: -0.01em; text-shadow: 0 1px 8px rgba(0, 0, 0, 0.3); }\n.hb-tile-subtitle {\n  display: -webkit-box;\n  -webkit-line-clamp: 3;\n  -webkit-box-orient: vertical;\n  overflow: hidden;\n  font-size: 12.5px;\n  line-height: 16px;\n  color: #fff;\n  text-shadow: 0 1px 2px rgba(12, 8, 24, 0.55);\n}\n@media (prefers-reduced-motion: reduce) {\n  .hb-tile { transition: none; }\n}\n";

// src/blocks/checklist/checklist.css
var checklist_default = '/* Checklist */\n.hb-checklist { display: flex; flex-direction: column; }\n.hb-checklist-head { display: flex; align-items: baseline; gap: 8px; }\n.hb-checklist-head .hb-card-title { flex: 1; min-width: 0; }\n.hb-checklist-count {\n  margin-left: auto;\n  font-size: 12.5px;\n  font-weight: 600;\n  color: var(--hb-muted);\n  font-variant-numeric: tabular-nums;\n  white-space: nowrap;\n}\n.hb-checklist-count-done { color: var(--hb-good); }\n.hb-checklist-track { display: block; height: 6px; margin: 8px 0 4px; overflow: hidden; border-radius: 999px; background: var(--hb-well); }\n.hb-checklist-fill { display: block; width: 100%; height: 100%; border-radius: 999px; background: var(--hb-good); transform-origin: left; transition: transform 0.3s var(--hb-ease-out); }\n.hb-sr { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }\n.hb-checklist-compact { display: flex; gap: 4px; margin: 8px 0 4px; }\n.hb-check-seg {\n  flex: 1 1 0; min-width: 8px; height: 18px; padding: 0; border: 1px solid var(--hb-line-strong);\n  border-radius: 5px; background: var(--hb-well); cursor: pointer; transition: background 0.15s, border-color 0.15s;\n}\n.hb-check-seg.hb-check-active { border-color: var(--hb-accent); background: var(--hb-accent-soft); }\n.hb-check-seg.hb-check-blocked { border-color: var(--hb-warn); background: color-mix(in srgb, var(--hb-warn) 22%, transparent); }\n.hb-check-seg.hb-check-skipped { border-style: dashed; border-color: var(--hb-muted); }\n.hb-check-seg.hb-check-on { border-color: var(--hb-good); background: var(--hb-good); }\n.hb-check-seg.hb-check-pointer { outline: 2px solid var(--hb-accent); outline-offset: 2px; }\n.hb-check-seg:focus-visible { outline: 2px solid var(--hb-accent); outline-offset: 2px; }\n.hb-checklist-group-label { padding: 10px 0 2px; font-size: 12px; font-weight: 700; color: var(--hb-muted); }\n.hb-check {\n  display: flex;\n  align-items: flex-start;\n  gap: 12px;\n  width: 100%;\n  margin: 0;\n  padding: 7px 0;\n  border: 0;\n  background: none;\n  color: inherit;\n  font: inherit;\n  text-align: left;\n  cursor: pointer;\n}\n.hb-check:focus-visible { outline: 2px solid var(--hb-accent); outline-offset: 2px; border-radius: 8px; }\n.hb-check-mark {\n  flex: none;\n  display: grid;\n  place-items: center;\n  width: 22px;\n  height: 22px;\n  margin-top: 0.5px;\n  border: 2px solid var(--hb-line-strong);\n  border-radius: 999px;\n  color: var(--hb-muted);\n  font-size: 11px;\n  font-weight: 700;\n  font-variant-numeric: tabular-nums;\n  transition: background 0.15s, border-color 0.15s;\n}\n/* The state is a shape on the same 22px mark, so no icon has to carry it: a dot for the item being worked on, a bar\n   for one that cannot move, a dashed ring for one dropped on purpose. */\n.hb-check-mark::after { content: ""; display: block; border-radius: 999px; }\n.hb-check-active .hb-check-mark { border-color: var(--hb-accent); }\n.hb-check-active .hb-check-mark::after { width: 8px; height: 8px; background: var(--hb-accent); }\n.hb-check-blocked .hb-check-mark { border-color: var(--hb-warn); }\n.hb-check-blocked .hb-check-mark::after { width: 10px; height: 2px; background: var(--hb-warn); }\n.hb-check-skipped .hb-check-mark { border-style: dashed; border-color: var(--hb-muted); }\n.hb-check-pointer .hb-check-mark { border-color: var(--hb-accent); }\n.hb-check-on .hb-check-mark { border-color: var(--hb-good); background: var(--hb-good); color: var(--hb-surface); }\n.hb-check-text { flex: 1; min-width: 0; font-size: 14.5px; line-height: 21px; transition: color 0.15s; }\n.hb-check-line { display: flex; align-items: baseline; gap: 8px; }\n.hb-check-label { flex: 1; min-width: 0; overflow-wrap: anywhere; }\n.hb-check-state { flex: none; font-size: 11.5px; font-weight: 600; color: var(--hb-muted); white-space: nowrap; }\n.hb-check-blocked .hb-check-state { color: var(--hb-warn); }\n.hb-check-owner { flex: none; font-size: 11.5px; color: var(--hb-muted); white-space: nowrap; }\n.hb-check-note { display: block; margin-top: 2px; font-size: 12px; line-height: 18px; color: var(--hb-muted); overflow-wrap: anywhere; }\n.hb-check-source { display: block; margin-top: 1px; font-size: 11px; color: var(--hb-muted); }\n.hb-check-on .hb-check-text { color: var(--hb-muted); }\n.hb-check-on .hb-check-label { text-decoration: line-through; text-decoration-thickness: 1px; }\n@media (prefers-reduced-motion: reduce) {\n  .hb-checklist-fill, .hb-check-mark, .hb-check-text, .hb-check-seg { transition: none; }\n}\n';

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

// src/blocks/briefing/briefing.css
var briefing_default = `/* briefing: Today's sky band. Fixed sky gradients with white text (every stop at least 4.5:1, a test checks); the counts
   sit on soft tinted chips, not loud badges. */
.hb-brief { position: relative; overflow: hidden; display: flex; flex-direction: column; gap: 8px; padding: 14px 18px;
  border-radius: 18px; color: #fff; background: linear-gradient(160deg, #1d4fa3, #3a6cc0); }
.hb-brief::after { content: ""; position: absolute; inset: 0; pointer-events: none; opacity: .5; }
.hb-brief > * { position: relative; z-index: 1; }
.hb-brief-clear { background: linear-gradient(160deg, #1d4fa3 0%, #2c62bd 60%, #3a6cc0 100%); }
.hb-brief-cloud { background: linear-gradient(160deg, #3f4c63 0%, #55637c 60%, #66748c 100%); }
.hb-brief-rain { background: linear-gradient(160deg, #34435b 0%, #4d5e78 55%, #5f708a 100%); }
.hb-brief-rain::after { background: repeating-linear-gradient(105deg, transparent 0 13px, rgba(255, 255, 255, .08) 13px 14px); }
.hb-brief-snow { background: linear-gradient(160deg, #4a5d7c 0%, #5a6d8c 60%, #627592 100%); }
.hb-brief-storm { background: linear-gradient(160deg, #262f45 0%, #44506b 60%, #5a6680 100%); }
.hb-brief-fog { background: linear-gradient(160deg, #525a68 0%, #646d7b 60%, #6b7482 100%); }
.hb-brief-night { background: linear-gradient(160deg, #141b38 0%, #2a3566 60%, #45508a 100%); }
.hb-brief-top { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: flex-start; gap: 6px 16px; }
.hb-brief-hello { display: flex; flex-direction: column; min-width: 0; }
.hb-brief-date { font-size: 12px; opacity: .85; }
.hb-brief h2 { margin: 2px 0 0; font-size: 19px; line-height: 1.2; font-weight: 700; letter-spacing: -0.01em; color: #fff; }
.hb-brief-wx { display: flex; flex-direction: column; align-items: flex-end; text-align: right; }
.hb-brief-temp { font-size: 26px; line-height: 1; font-weight: 700; font-variant-numeric: tabular-nums; }
.hb-brief-sky { margin-top: 2px; font-size: 12px; opacity: .9; }
.hb-brief-line { margin: 0; font-size: 15px; line-height: 1.4; font-weight: 600; }
.hb-brief-bad, .hb-brief-good { padding: 1px 6px; border-radius: 6px; }
.hb-brief-bad { background: rgba(255, 110, 110, .3); }
.hb-brief-good { background: rgba(110, 230, 160, .26); }
`;

// src/blocks/tracker/tracker.css
var tracker_default = '/* tracker: Needs you | Handled. Small and quiet: an 11px state pill, 18px count badges, a 3px coloured edge by\n   state, outline help buttons, one solid pay link. */\n.hb-tr { display: flex; flex-direction: column; gap: 10px; min-width: 0; }\n.hb-tr-switch { align-self: flex-start; display: inline-flex; gap: 2px; padding: 3px; border-radius: 999px; background: var(--hb-well); }\n.hb-tr-switch button { all: unset; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; padding: 5px 12px;\n  border-radius: 999px; font-size: 13px; font-weight: 600; color: var(--hb-muted); }\n.hb-tr-switch button[aria-selected="true"] { background: var(--hb-surface); color: var(--hb-ink); box-shadow: 0 1px 3px rgba(15, 20, 30, .14); }\n.hb-tr-switch button:focus-visible { outline: 2px solid var(--hb-accent); outline-offset: 2px; }\n.hb-tr-badge { min-width: 18px; height: 18px; padding: 0 6px; border-radius: 999px; display: inline-grid; place-items: center;\n  font-size: 11px; font-weight: 700; font-variant-numeric: tabular-nums; background: var(--hb-line-strong); color: var(--hb-ink); }\n.hb-tr-badge-red { background: #d63b2f; color: #fff; }\n.hb-tr-badge-green { background: var(--hb-good); color: #fff; }\n.hb-tr-pulse { animation: hb-tr-pulse 1.2s ease 1; }\n@keyframes hb-tr-pulse { 0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--hb-good) 60%, transparent); }\n  100% { box-shadow: 0 0 0 8px transparent; } }\n.hb-tr-list { display: flex; flex-direction: column; gap: 8px; }\n.hb-tr-card, .hb-tr-row { display: flex; flex-direction: column; gap: 6px; min-width: 0; padding: 10px 12px;\n  border: 1px solid var(--hb-line); border-left: 3px solid var(--hb-line-strong); border-radius: 12px; background: var(--hb-card); }\n.hb-tr-overdue { border-left-color: #d63b2f; }\n.hb-tr-today, .hb-tr-soon { border-left-color: #e08a1e; }\n.hb-tr-closed { border-left-color: var(--hb-good); background: color-mix(in srgb, var(--hb-good) 7%, var(--hb-card)); }\n.hb-tr-protected { border-left-color: #d63b2f; }\n.hb-tr-top { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; }\n.hb-tr-title { font-size: 14px; font-weight: 600; line-height: 1.3; min-width: 0; overflow-wrap: anywhere; }\n.hb-tr-amount { font-size: 13px; font-weight: 600; font-variant-numeric: tabular-nums; white-space: nowrap; }\n.hb-tr-pill { align-self: flex-start; display: inline-flex; align-items: center; gap: 5px; padding: 3px 7px; border-radius: 999px;\n  font-size: 11px; line-height: 1.2; font-weight: 600; background: var(--hb-well); color: var(--hb-muted); }\n.hb-tr-pill::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: currentColor; }\n.hb-tr-pill-overdue { color: #c4321f; background: color-mix(in srgb, #d63b2f 12%, transparent); }\n.hb-tr-pill-today, .hb-tr-pill-soon { color: #9a5a00; background: color-mix(in srgb, #e08a1e 14%, transparent); }\n.dark .hb-tr-pill-overdue { color: #ff9a8a; }\n.dark .hb-tr-pill-today, .dark .hb-tr-pill-soon { color: #ffc46b; }\n.hb-tr-acts { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }\n.hb-tr-go, .hb-tr-help { font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 999px; line-height: 1.3; }\n.hb-tr-go { background: var(--hb-accent); color: #fff; text-decoration: none; }\n.hb-tr-help { all: unset; cursor: pointer; font-size: 12px; font-weight: 600; padding: 3px 10px; border-radius: 999px;\n  border: 1px solid var(--hb-accent); color: var(--hb-accent-ink); }\n.hb-tr-go:focus-visible, .hb-tr-help:focus-visible, .hb-tr-link:focus-visible { outline: 2px solid var(--hb-accent); outline-offset: 2px; }\n.hb-tr-verb { font-size: 11px; font-weight: 700; color: var(--hb-muted); white-space: nowrap; }\n.hb-tr-closed .hb-tr-verb { color: var(--hb-good); }\n.hb-tr-protected .hb-tr-verb { color: #c4321f; }\n.dark .hb-tr-protected .hb-tr-verb { color: #ff9a8a; }\n.hb-tr-why { font-size: 12.5px; color: var(--hb-muted); }\n.hb-tr-link { all: unset; cursor: pointer; align-self: flex-start; font-size: 12px; color: var(--hb-muted); text-decoration: underline;\n  text-underline-offset: 3px; }\n.hb-tr-details summary { cursor: pointer; width: max-content; font-size: 12px; color: var(--hb-muted); }\n.hb-tr-details dl { display: grid; grid-template-columns: max-content 1fr; gap: 3px 10px; margin: 6px 0 0; padding: 8px 10px;\n  border-radius: 8px; background: var(--hb-well); font-size: 12px; }\n.hb-tr-details dt { color: var(--hb-muted); }\n.hb-tr-details dd { margin: 0; min-width: 0; overflow-wrap: anywhere; }\n.hb-tr-empty { margin: 0; font-size: 13px; color: var(--hb-muted); }\n@media (prefers-reduced-motion: reduce) { .hb-tr-pulse { animation: none; } }\n';

// src/blocks/prepared/prepared.css
var prepared_default = "/* prepared: photo ideas, two by two, captions on a dark scrim; small, quiet buttons. */\n.hb-prep { display: flex; flex-direction: column; gap: 10px; min-width: 0; }\n.hb-prep-label { font-size: 12px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: var(--hb-muted); }\n.hb-prep-group { display: flex; flex-direction: column; gap: 8px; padding: 10px 12px; border: 1px solid var(--hb-line);\n  border-radius: 12px; background: var(--hb-card); }\n.hb-prep-head { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; }\n.hb-prep-title { font-size: 14px; font-weight: 600; }\n.hb-prep-date { font-size: 12px; color: var(--hb-muted); white-space: nowrap; }\n.hb-prep-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; }\n.hb-prep-idea { all: unset; cursor: pointer; position: relative; overflow: hidden; border-radius: 10px; aspect-ratio: 4 / 3;\n  max-width: 100%; background: linear-gradient(140deg, #6b7a99, #a3b0c7); }\n.hb-prep-idea img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }\n.hb-prep-idea:focus-visible { outline: 2px solid var(--hb-accent); outline-offset: 2px; }\n.hb-prep-cap { position: absolute; inset: auto 0 0 0; padding: 16px 8px 6px; color: #fff; font-size: 12px; font-weight: 600;\n  line-height: 1.25; background: linear-gradient(180deg, transparent, rgba(10, 8, 20, .72)); display: flex; flex-direction: column; }\n.hb-prep-cap small { font-size: 10.5px; font-weight: 500; opacity: .85; }\n.hb-prep-ask { all: unset; cursor: pointer; align-self: flex-start; font-size: 12px; font-weight: 600; padding: 3px 10px;\n  border-radius: 999px; border: 1px solid var(--hb-accent); color: var(--hb-accent-ink); }\n.hb-prep-ask:focus-visible { outline: 2px solid var(--hb-accent); outline-offset: 2px; }\n";

// src/blocks/calendar/calendar.css
var calendar_default = "/* calendar: one flat, wide strip after Odie's Today. Date | next event and the day's events | the week. It stacks on\n   a phone. */\n.hb-blocks .hb-cal { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 18px;\n  padding: 12px 16px; border-radius: 22px;\n  background: linear-gradient(110deg, color-mix(in srgb, #8a63d2 12%, var(--hb-card)),\n    color-mix(in srgb, #e86aa6 9%, var(--hb-card)) 80%); }\n@media (max-width: 760px) { .hb-blocks .hb-cal { grid-template-columns: auto minmax(0, 1fr); }\n  .hb-cal-week { grid-column: 1 / -1; } }\n\n.hb-cal-date { display: flex; flex-direction: column; align-items: center; min-width: 76px; padding-right: 16px;\n  border-right: 1px solid var(--hb-line); }\n.hb-cal-weekday { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--hb-ink-2); }\n.hb-cal-day { font-size: 44px; line-height: 1; font-weight: 800; letter-spacing: -0.04em; font-variant-numeric: tabular-nums; }\n.hb-cal-month { font-size: 11.5px; color: var(--hb-muted); white-space: nowrap; }\n\n.hb-cal-mid { display: flex; flex-direction: column; gap: 8px; min-width: 0; }\n.hb-cal-next-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; min-width: 0; }\n.hb-cal-title { font-size: 13px; font-weight: 700; color: var(--hb-ink-2); }\n.hb-cal-next { display: inline-flex; align-items: baseline; gap: 8px; min-width: 0; }\n.hb-cal-next-when { font-size: 12px; font-weight: 700; color: var(--hb-accent); }\n.hb-cal-next-time { font-size: 15px; font-weight: 700; font-variant-numeric: tabular-nums; }\n.hb-cal-next-title { font-size: 14px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }\n.hb-cal-ask { all: unset; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; height: 30px; padding: 0 12px;\n  border-radius: 99px; background: var(--hb-ink); color: var(--hb-surface, #fff); font-size: 12.5px; font-weight: 600;\n  margin-left: auto; }\n.hb-cal-ask:focus-visible { outline: 2px solid var(--hb-accent); outline-offset: 2px; }\n.hb-cal-events { list-style: none; margin: 0; padding: 0 28px 2px 0; display: flex; gap: 5px; overflow-x: auto;\n  scrollbar-width: none; mask-image: linear-gradient(to right, #000 calc(100% - 28px), transparent);\n  -webkit-mask-image: linear-gradient(to right, #000 calc(100% - 28px), transparent); }\n.hb-cal-events li { flex: 0 0 auto; display: inline-flex; align-items: baseline; gap: 4px; padding: 2px 8px;\n  border-radius: 99px; background: color-mix(in srgb, var(--hb-surface, #fff) 70%, transparent);\n  border: 1px solid var(--hb-line); font-size: 11px; line-height: 1.5; white-space: nowrap; }\n.hb-cal-event-time { font-weight: 700; color: var(--hb-ink-2); font-variant-numeric: tabular-nums; }\n.hb-cal-event-title { font-weight: 500; }\n.hb-cal-empty { font-size: 13px; color: var(--hb-muted); }\n\n.hb-cal-week { list-style: none; margin: 0; padding: 3px; display: grid; grid-template-columns: repeat(7, 30px); gap: 2px;\n  border-radius: 16px; background: color-mix(in srgb, var(--hb-surface, #fff) 70%, transparent); border: 1px solid var(--hb-line); }\n@media (max-width: 760px) { .hb-cal-week { grid-template-columns: repeat(7, minmax(0, 1fr)); } }\n.hb-cal-week li { display: flex; flex-direction: column; align-items: center; gap: 1px; padding: 3px 0; border-radius: 10px;\n  font-size: 10px; color: var(--hb-muted); }\n.hb-cal-week li b { font-size: 13px; font-weight: 600; color: var(--hb-ink-2); font-variant-numeric: tabular-nums; }\n.hb-cal-week li i { width: 4px; height: 4px; border-radius: 50%; }\n.hb-cal-week li.has-events i { background: var(--hb-accent); }\n.hb-cal-week li.is-selected { background: var(--hb-ink); color: var(--hb-surface, #fff); }\n.hb-cal-week li.is-selected b { color: var(--hb-surface, #fff); }\n.hb-cal-week li.is-selected.has-events i { background: var(--hb-surface, #fff); }\n";

// src/blocks/upnext/upnext.css
var upnext_default = `/* upnext: Odie's Up Next cards. Each card takes its kind's two pastel colours (--ka, --kb from EventArt's kindVars),
   and the deep night pair in dark mode (--kda, --kdb). */
.hb-up { display: flex; flex-direction: column; gap: 10px; container-type: inline-size; }
.hb-up-row { --up-n: 2; }
/* Only whole cards: as many as fit the width (about 160px or more each), never one sliced at the edge. The rest
   scroll in, a card at a time. */
@container (min-width: 520px) { .hb-up-row { --up-n: 3; } }
@container (min-width: 700px) { .hb-up-row { --up-n: 4; } }
@container (min-width: 880px) { .hb-up-row { --up-n: 5; } }
@container (min-width: 1060px) { .hb-up-row { --up-n: 6; } }
.hb-up-heading { font-size: 13px; font-weight: 700; color: var(--hb-ink-2); }
.hb-up-row { display: flex; gap: 12px; overflow-x: auto; scroll-snap-type: x mandatory; padding: 2px 0 8px;
  scrollbar-width: none; }
.hb-up-card { all: unset; box-sizing: border-box; cursor: pointer; scroll-snap-align: start; flex: 0 0 calc((100% - (var(--up-n) - 1) * 12px) / var(--up-n));
  min-width: 0; min-height: 168px; padding: 12px; border-radius: 24px; display: flex; flex-direction: column;
  background: linear-gradient(150deg, var(--ka), var(--kb)); color: #1d1a2c; border: 1px solid rgba(255, 255, 255, .6);
  box-shadow: 0 14px 30px -22px rgba(40, 30, 70, .45); transition: transform .15s var(--hb-ease-out); }
.dark .hb-up-card { background: linear-gradient(150deg, var(--kda), var(--kdb)); color: #f4f2fb; border-color: rgba(255, 255, 255, .08); }
.hb-up-card:hover { transform: translateY(-2px); }
.hb-up-card:active { transform: scale(.98); }
.hb-up-card:focus-visible { outline: 2px solid var(--hb-accent); outline-offset: 2px; }
.hb-up-top { display: flex; align-items: flex-start; justify-content: space-between; }
.hb-up-top > span { display: flex; flex-direction: column; }
.hb-up-weekday { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; opacity: .75; }
.hb-up-source { display: inline-grid; place-items: center; width: 20px; height: 20px; border-radius: 50%;
  background: rgba(255, 255, 255, .85); color: #4a4560; }
.dark .hb-up-source { background: rgba(255, 255, 255, .14); color: #f4f2fb; }
.hb-up-day { font-size: 32px; line-height: 1; font-weight: 800; letter-spacing: -0.04em; font-variant-numeric: tabular-nums; }
.hb-up-title { margin-top: 10px; font-size: 14.5px; line-height: 1.25; font-weight: 600; display: -webkit-box;
  -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; min-height: 36px; }
.hb-up-meta { margin-top: auto; padding-top: 6px; font-size: 12.5px; opacity: .7; font-variant-numeric: tabular-nums; }
/* A tracked item's state: a small pill (dot + words) on a translucent ground, so the card's own colours stay. Red only
   for overdue; amber for today and soon. */
.hb-up-state { align-self: flex-start; display: inline-flex; align-items: center; gap: 5px; margin-top: 6px;
  padding: 3px 7px; border-radius: 999px; font-size: 11px; line-height: 1.2; font-weight: 600;
  background: rgba(255, 255, 255, .78); }
.dark .hb-up-state { background: rgba(0, 0, 0, .32); }
.hb-up-state::before { content: ""; flex: none; width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
.hb-up-state-overdue { color: #c4321f; }
.hb-up-state-today, .hb-up-state-soon { color: #9a5a00; }
.dark .hb-up-state-overdue { color: #ff9a8a; }
.dark .hb-up-state-today, .dark .hb-up-state-soon { color: #ffc46b; }
/* Compact (Today): smaller cards in rows that fit the width, no sideways scroll; at most two rows. */
.hb-up-compact { display: grid; grid-template-columns: repeat(auto-fit, minmax(124px, 1fr)); gap: 8px; overflow: visible;
  padding: 0; grid-auto-rows: auto; }
.hb-up-compact .hb-up-card { min-height: 112px; padding: 10px; border-radius: 16px; }
.hb-up-compact .hb-up-day { font-size: 22px; }
.hb-up-compact .hb-up-title { margin-top: 6px; font-size: 13px; min-height: 0; }
.hb-up-compact .hb-up-meta { font-size: 11.5px; }
.hb-up-compact > :nth-child(n+9) { display: none; }
@container (max-width: 480px) { .hb-up-compact { grid-template-columns: 1fr 1fr; } .hb-up-compact > :nth-child(n+5) { display: none; } }
@media (prefers-reduced-motion: reduce) { .hb-up-card { transition: none; } .hb-up-card:hover { transform: none; } }
`;

// src/blocks/weather/weather.css
var weather_default = "/* weather: one wide strip after Odie's Today. Big temperature | sky in place, high and tonight's low. */\n.hb-blocks .hb-weather { display: flex; align-items: center; gap: 22px; padding: 16px 26px; border-radius: 22px;\n  background: linear-gradient(105deg, color-mix(in srgb, #7aa7ff 22%, var(--hb-card)),\n    color-mix(in srgb, #ffd66b 24%, var(--hb-card)) 100%); }\n.hb-weather-temp { font-size: 44px; line-height: 1; font-weight: 800; letter-spacing: -0.04em;\n  font-variant-numeric: tabular-nums; }\n.hb-weather-text { display: flex; flex-direction: column; gap: 4px; min-width: 0; }\n.hb-weather-where { font-size: 16px; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }\n.hb-weather-range { font-size: 13.5px; color: var(--hb-ink-2); }\n";

// src/blocks/widget/widget.css
var widget_default = "/* Widget: one authored tree of layout, content, controls, structure and embedded blocks. Everything is drawn with the\n   plugin's own pieces (cards, chips, pills, the chart and table blocks) and the shared tokens; a widget carries no\n   style of its own, so nothing here is written by the model. */\n.hb-widget {\n  display: flex;\n  flex-direction: column;\n  gap: 10px;\n  min-width: 0;\n  padding: 14px 16px;\n  border: 1px solid var(--hb-line);\n  border-radius: 16px;\n  background: var(--hb-card);\n}\n/* The gap a layout element asked for; xs through lg keep to the spacing the rest of the blocks use. */\n.hb-widget-gap-xs { gap: 4px; }\n.hb-widget-gap-sm { gap: 6px; }\n.hb-widget-gap-md { gap: 10px; }\n.hb-widget-gap-lg { gap: 14px; }\n.hb-widget-stack, .hb-widget-row, .hb-widget-grid, .hb-widget-surface { display: flex; flex-direction: column; min-width: 0; }\n.hb-widget-row { flex-direction: row; flex-wrap: wrap; align-items: flex-start; }\n/* A row shares its width between the parts, as the block rows do; a pill or a chip keeps its own. */\n.hb-widget-row > * { flex: 1 1 140px; min-width: 0; display: flex; flex-direction: column; }\n.hb-widget-row > .hb-widget-button, .hb-widget-row > .hb-widget-badge { flex: 0 0 auto; }\n.hb-widget-grid { display: grid; align-items: start; }\n.hb-widget-grid-1 { grid-template-columns: minmax(0, 1fr); }\n.hb-widget-grid-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }\n.hb-widget-grid-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }\n.hb-widget-grid-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }\n@media (max-width: 560px) {\n  .hb-widget-grid-3, .hb-widget-grid-4 { grid-template-columns: repeat(2, minmax(0, 1fr)); }\n}\n.hb-widget-surface {\n  gap: 10px;\n  padding: 14px 16px;\n  border: 1px solid var(--hb-line);\n  border-radius: 16px;\n  background: var(--hb-card);\n}\n/* Content */\n.hb-widget-text { min-width: 0; }\n.hb-widget-tone-muted { color: var(--hb-muted); }\n.hb-widget-tone-good { color: var(--hb-good); }\n.hb-widget-tone-warn { color: var(--hb-warn); }\n.hb-widget-tone-bad { color: var(--hb-bad); }\n.hb-widget-tone-info { color: var(--hb-accent-ink); }\n.hb-widget-figure { min-width: 0; padding: 2px 0; }\n.hb-widget-figure-label { font-size: 12px; line-height: 16px; color: var(--hb-muted); }\n.hb-widget-figure-value {\n  font-size: 24px;\n  line-height: 30px;\n  font-weight: 700;\n  letter-spacing: -0.01em;\n  font-variant-numeric: tabular-nums;\n}\n.hb-widget-badge { display: flex; align-items: center; gap: 6px; }\n.hb-widget-chip-bad { background: color-mix(in srgb, var(--hb-bad) 14%, transparent); color: var(--hb-bad); }\n/* Controls: the shared input and range pieces, with the label and the value now on one line above. */\n.hb-widget-field { display: flex; flex-direction: column; gap: 4px; min-width: 0; padding: 6px 0; }\n.hb-widget-field-head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }\n.hb-widget-label { font-size: 13.5px; line-height: 18px; font-weight: 600; color: var(--hb-ink-2); }\n.hb-widget-value { font-size: 13px; line-height: 18px; color: var(--hb-muted); font-variant-numeric: tabular-nums; }\n.hb-widget-check { flex-direction: row; align-items: center; gap: 8px; }\n.hb-widget-check input { width: 18px; height: 18px; margin: 0; accent-color: var(--hb-accent); }\n.hb-widget-button { display: flex; align-items: center; }\n/* A figure the expression could not produce, or a binding that could not be evaluated: one quiet line. */\n.hb-widget-note { display: block; margin: 0; font-size: 12px; line-height: 16px; color: var(--hb-warn); }\n.hb-widget-repeat { display: flex; flex-direction: column; gap: 6px; min-width: 0; }\n";

// src/live/dashboard.css
var dashboard_default = "/* The Today page: an assembled dashboard. Only its header is the page's own; everything under it is catalog blocks. */\n.hb-dash { box-sizing: border-box; height: 100%; overflow-y: auto; padding: 28px clamp(16px, 4vw, 40px) 48px;\n  background: var(--hb-surface); color: var(--hb-ink); }\n/* The page takes the whole window: no chat-column cap on it or the board inside it. */\n.hb-blocks.hb-dash, .hb-dash > .hb-blocks { max-width: none; }\n.hb-dash-head { margin-bottom: 18px; }\n.hb-dash-date { font-size: 13px; font-weight: 600; color: var(--hb-muted); }\n.hb-dash-head h1 { margin: 6px 0 0; font-size: clamp(28px, 4vw, 36px); line-height: 1.12; font-weight: 700;\n  letter-spacing: -0.025em; }\n.hb-dash-sub { color: var(--hb-muted); }\n/* On the Today page, a row of numbers spans the page's width; in chat it keeps its compact 200px cards. */\n.hb-dash .hb-kpis { grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); }\n/* A lone number (one stock's price) stays a card, not a banner. */\n.hb-dash .hb-kpis:has(> :only-child) { grid-template-columns: minmax(150px, 320px); }\n/* A designed page's snapshot line under the header: label \xB7 updated 09:12 \xB7 (why it failed) \xB7 \u21BB Refresh. */\n.hb-refresh { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; margin: -6px 0 16px; font-size: 13px;\n  color: var(--hb-muted); }\n.hb-refresh-label { font-weight: 700; color: var(--hb-ink-2); }\n.hb-refresh-error { color: var(--hb-warn, #b7791f); }\n.hb-refresh-button { all: unset; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; height: 28px;\n  padding: 0 12px; border-radius: 99px; border: 1px solid var(--hb-line); color: var(--hb-ink); font-weight: 600; }\n.hb-refresh-button:disabled { cursor: default; opacity: .6; }\n.hb-refresh-button:focus-visible { outline: 2px solid var(--hb-accent); outline-offset: 2px; }\n";

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
  form_default,
  briefing_default,
  tracker_default,
  prepared_default,
  calendar_default,
  upnext_default,
  weather_default,
  widget_default,
  dashboard_default
];
var styles_default = STYLE_PARTS.join("\n");

// src/plugin.tsx
import { jsx as jsx55 } from "react/jsx-runtime";
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
        render: ({ attrs, sessionId, streaming }) => /* @__PURE__ */ jsx55(BlockActions.Provider, { value: { send, fill, rest, blockId: attrs?.id, sessionScope: sessionId }, children: /* @__PURE__ */ jsx55(BlockTag, { id: attrs?.id, streaming: Boolean(streaming), load }) })
      }
    });
    const open = (text) => void openAndFill(text, host ?? {});
    registerLive(ctx, open);
  }
};
export {
  plugin_default as default
};

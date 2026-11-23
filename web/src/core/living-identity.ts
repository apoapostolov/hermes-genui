// Living Boards identity: who a block IS across an update, at any depth.
//
// A living board's update hands over a REPLACEMENT tree, and React reconciles children by key. Three
// rounds of review proved what the key may and may not depend on:
//   · keyed by INDEX, an inserted heading remounts every block behind it — so a block's key became the
//     hash of its OWN words, canonicalized (keys sorted; the door's positional `path` stamp skipped);
//   · hashing a container INCLUDING its descendants re-keys the whole subtree the moment any child
//     moves — so every value that holds blocks collapses to one constant and the children name
//     themselves, wherever drawAll reaches them;
//   · and content alone still cannot tell two same-worded containers apart: a calculator inside the
//     LEFT section and a text inside the RIGHT swap places, and an occurrence ordinal — a positional
//     key by another name — hands the surviving card's slot to the wrong twin.
//
// The stable answer, carried from the reviewed local build: identity is CARRIED, not derived per
// render. When an update lands, carryBlocks() matches the new tree against the tree that is mounted,
// and every logically-retained block — same own words — inherits the key it was MOUNTED UNDER,
// independent of content shape and of position alike. Twins that say the same title are distinguished
// by which one the update kept (their carried keys, assigned once and never re-derived), matched by
// what they hold rather than by the slot they sit in. A genuinely changed block (its own words moved)
// is honestly replaced: no match, a fresh key, a fresh draw. A brand-new block gets a fresh key. Plain
// (never-updated, never-addressed) boards carry nothing: drawAll keeps its plain index keys, byte for
// byte as an unsaid board has always drawn.
//
// The hash is FNV-1a over the canonical form: small, synchronous, dependency-free.
import type { Block } from "../registry";

/** The door's positional stamp ("2.children.1"): the slot, exactly the thing an update is allowed to
 *  move. It stays on the block for the door to file saved ticks under; it stays out of the identity. */
const POSITIONAL_PATH = /^\d+(?:\.[A-Za-z_]+(?:\.\d+)*)*$/;

/** One constant for every value that holds descendant blocks, at any depth: a child list is not
 *  part of the parent's identity — the children are keyed themselves, wherever they are drawn. */
const DESCENDANTS = "◇";

export function holdsBlocks(v: unknown): boolean {
  if (Array.isArray(v)) return v.some(holdsBlocks);
  if (v === null || typeof v !== "object") return false;
  if (typeof (v as { type?: unknown }).type === "string") return true;
  return Object.values(v).some(holdsBlocks);
}

export function canonicalize(v: unknown, root: boolean): string {
  if (!root && holdsBlocks(v)) return DESCENDANTS;
  if (v === null || typeof v !== "object") return JSON.stringify(v) ?? "null";
  if (Array.isArray(v)) return `[${v.map((e) => canonicalize(e, false)).join(",")}]`;
  const o = v as Record<string, unknown>;
  const positional = typeof o.type === "string" && typeof o.path === "string" && POSITIONAL_PATH.test(o.path);
  const keys = Object.keys(o).filter((k) => !(positional && k === "path")).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalize(o[k], false)}`).join(",")}}`;
}

export function identityOf(block: unknown): string {
  const json = canonicalize(block, true);
  let h = 0x811c9dc5;
  for (let i = 0; i < json.length; i++) {
    h ^= json.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16);
}

// --- the carried identity ---------------------------------------------------------------------------
//
// Two side tables, both keyed by the block OBJECT (every read of the door's JSON builds fresh objects,
// which is exactly the granularity the carry needs):
//   mounted: what key did this object's drawing get the last time it was on screen (recorded by drawAll);
//   carried: what key does this object INHERIT, decided once when its update landed.
// A carried key is what drawAll uses; a fresh or never-updated board has none and keeps the plain index
// key — the accepted, byte-identical drawing of an unsaid board.

let freshSeq = 0;
const mintOf = (b: unknown) => `${identityOf(b)}:~${(freshSeq += 1)}`;

const mounted = new WeakMap<object, string>();
const carried = new WeakMap<object, string>();

/** drawAll records the key it mounted each block under, so a later carry can hand that very key on. */
export function noteMounted(block: object, key: string): void {
  mounted.set(block, key);
}

/** The key this object was carried to, if an update carried it (plain draws: none). */
export function carriedKey(block: object): string | undefined {
  return carried.get(block);
}

/** A key for a block that is being minted right now: unique by construction, never an index key. */
export function mintKey(block: unknown): string {
  return mintOf(block);
}

/** The key an object already "is" on screen: carried, else mounted, else a fresh string (an object that
 *  was never mounted — a closed section's children — has no DOM element to protect, and nothing to lose). */
function existingKey(obj: object): string {
  return carried.get(obj) ?? mounted.get(obj) ?? mintOf(obj);
}

/** Is this value a block (something the registry can draw)? */
const isBlock = (v: unknown): boolean =>
  typeof v === "object" && v !== null && !Array.isArray(v) && typeof (v as { type?: unknown }).type === "string";

/** The multiset overlap of two signature lists — how much these two containers hold IN COMMON. */
function overlap(a: string[], b: string[]): number {
  const pool = new Map<string, number>();
  for (const x of a) pool.set(x, (pool.get(x) ?? 0) + 1);
  let n = 0;
  for (const y of b) {
    const c = pool.get(y) ?? 0;
    if (c > 0) { pool.set(y, c - 1); n += 1; }
  }
  return n;
}

/** One item's descendant signature, two deep: the identities it holds (exact content of its immediate
 *  block children) and the kinds it holds (types, anywhere below — a tab's panel counts its blocks). */
function signatures(obj: unknown): { exact: string[]; kinds: string[] } {
  const exact: string[] = [];
  const kinds: string[] = [];
  const walkKinds = (v: unknown): void => {
    if (Array.isArray(v)) { v.forEach(walkKinds); return; }
    if (v === null || typeof v !== "object") return;
    const t = (v as { type?: unknown }).type;
    if (typeof t === "string") { kinds.push(t); return; }   // a block's type; do not walk into it
    Object.values(v).forEach(walkKinds);
  };
  for (const value of Object.values(obj as Record<string, unknown>)) {
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

/** Carry a whole replacement tree against the tree that is mounted right now. */
export function carryBlocks(prev: Block[] | null | undefined, next: Block[]): void {
  carryList(prev ?? [], next);
}

/** Pair one list (blocks or container-shape holders) against its predecessor, then descend. */
function carryList(prev: unknown[], next: unknown[]): void {
  // Candidates: only a block whose OWN words are identical may retain its identity — a changed block
  // is honestly a replaced one and draws fresh (the 400→500 rule). Among eligible twins, what they
  // HOLD decides the pairing, never the slot they sit in.
  type Cand = { n: number; p: number; score: number };
  const cands: Cand[] = [];
  const nextSig = next.map((b) => signatures(b));
  const prevSig = prev.map((b) => signatures(b));
  for (let n = 0; n < next.length; n++) {
    if (!holdsOwnIdentity(next[n])) continue;
    for (let p = 0; p < prev.length; p++) {
      if (!holdsOwnIdentity(prev[p]) || identityOf(prev[p]) !== identityOf(next[n])) continue;
      // Eligibility is the block's OWN words (equal identity). Descendant overlap only tells WHICH
      // same-worded twin to keep — a leaf (no descendants) is eligible at score 0 and pairs with its
      // lone same-identity predecessor, so its mounted key is inherited, never minted fresh.
      const score = 2 * overlap(nextSig[n].exact, prevSig[p].exact) + overlap(nextSig[n].kinds, prevSig[p].kinds);
      cands.push({ n, p, score });
    }
  }
  // Greedy bijection, best match first; ties break by position proximity, then by order — fully
  // deterministic, and no survivor's slot is ever inherited by a better-matched twin.
  cands.sort((a, b) => b.score - a.score
    || Math.abs(a.n - a.p) - Math.abs(b.n - b.p)
    || a.p - b.p || a.n - b.n);
  const pairOf = new Map<number, number>();
  const prevTaken = new Set<number>();
  for (const c of cands) {
    if (pairOf.has(c.n) || prevTaken.has(c.p)) continue;
    pairOf.set(c.n, c.p);
    prevTaken.add(c.p);
  }
  // Keys, in the new list's order: a retained item inherits the predecessor's key; anything else mints
  // a fresh one. A collision inside this list (two items pointing at the same surviving key) yields the
  // mint — inherited keys always win, because they name a MOUNTED element.
  const assigned = new Set<string>();
  for (let n = 0; n < next.length; n++) {
    const item = next[n];
    if (typeof item !== "object" || item === null) continue;
    const p = pairOf.get(n);
    let key = p === undefined ? undefined : existingKey(prev[p] as object);
    if (key !== undefined && assigned.has(key)) key = undefined;
    if (key === undefined) key = mintOf(item);
    else if (p !== undefined) carriedFrom.set(item as object, prev[p] as object);  // the migration's trail
    assigned.add(key);
    carried.set(item as object, key);
  }
  // Descend: paired items carry their own children/holders against each other; an unpaired item carries
  // its children against NOTHING (its whole subtree is new to this slot — fresh keys, deterministic).
  for (let n = 0; n < next.length; n++) {
    const p = pairOf.get(n);
    carryFields(p === undefined ? null : prev[p], next[n]);
  }
}

/** Anything with an own identity to carry: a block, or a holder of blocks (a tab entry) — plain data
 *  (a checklist item, a series point) is part of its block's own words and carries no identity. */
function holdsOwnIdentity(v: unknown): boolean {
  return isBlock(v) || isHolderWithBlocks(v);
}

/** Every field of `nv` that holds blocks, carried against the same field of `pv` (if it held blocks too). */
function carryFields(pv: unknown, nv: unknown): void {
  if (typeof nv !== "object" || nv === null) return;
  const po = (typeof pv === "object" && pv !== null && !Array.isArray(pv) ? pv : {}) as Record<string, unknown>;
  for (const [k, value] of Object.entries(nv as Record<string, unknown>)) {
    if (!holdsBlocks(value)) continue;
    const before = po[k];
    if (Array.isArray(value)) {
      carryList(Array.isArray(before) ? before : [], value);
    } else if (isBlock(value)) {
      // one nested block under a named field (rare shapes): carry it as a one-item list
      carryList(before !== undefined && holdsBlocks(before) ? [before] : [], [value]);
    } else {
      carryFields(isHolderWithBlocks(before) ? before : null, value);
    }
  }
}

function isHolderWithBlocks(v: unknown): boolean {
  return typeof v === "object" && v !== null && !Array.isArray(v) && holdsBlocks(v);
}

// --- the identity SLOT: where the board files a block's answer -----------------------------------------------------
//
// A React key is a per-mount detail (carried, minted, or the plain index — the machinery above owns it).
// A living board files a block's interactive STATE by its identity slot instead: the chain of identity
// blocks above it (each block's own-words hash plus its occurrence among its same-worded siblings, joined
// by "/") and its own flat identity. Every part of the chain speaks a block's OWN words — never a slot
// index, never a descendant's content — so the same string falls out of the tree at the mount, at an
// update's promote, and at a reopen drawn from the stored spec: an answer follows its block through an
// insertion, a reorder, a move between containers and a reload. A block moving from one section to
// another changes its chain, which is exactly why the promote carries the stored answer from the old
// chain to the new one; two same-worded twins in different parents never share an answer, and only
// literal twins in the SAME list can collide (their occurrence ordinal is the last distinction
// content-free identity can offer — an accepted limit).
export function kkey(slot: string): string {
  return `k:${slot}`;
}

/** Visit every BLOCK of a drawn tree with its slots: the full chain (the state key) and its own flat
 *  identity (the move-matcher). Walks exactly the lists drawAll draws: a container's children under the
 *  container's chain; a tab entry is a holder, not a block — its panel lists chain under the tabs block. */
export function eachSlot(root: unknown[], visit: (block: object, full: string, flat: string) => void, prefix = ""): void {
  slotList(root, visit, prefix);
}

function slotList(list: unknown[], visit: (block: object, full: string, flat: string) => void, prefix: string): void {
  const seen = new Map<string, number>();
  for (const item of list) {
    if (typeof item !== "object" || item === null) continue;
    const id = identityOf(item);
    const n = seen.get(id) ?? 0;
    seen.set(id, n + 1);
    const flat = `${id}:${n}`;
    const full = prefix === "" ? flat : `${prefix}/${flat}`;
    const block = isBlock(item);
    if (block) visit(item as object, full, flat);
    slotDescend(item, visit, block ? full : prefix);  // a holder's children chain under the block above it
  }
}

function slotDescend(block: unknown, visit: (block: object, full: string, flat: string) => void, full: string): void {
  if (typeof block !== "object" || block === null) return;
  for (const value of Object.values(block as Record<string, unknown>)) slotValue(value, visit, full);
}

function slotValue(value: unknown, visit: (block: object, full: string, flat: string) => void, full: string): void {
  if (!holdsBlocks(value)) return;
  if (Array.isArray(value)) {
    slotList(value, visit, full);
    return;
  }
  if (isBlock(value)) {
    slotList([value], visit, full);  // one nested block under a named field: its own one-item list, like the carry
    return;
  }
  slotDescend(value, visit, full);   // a holder (a tab entry): its lists live in its fields, chained above
}

/** When an update carried a block, the block OBJECT of the previous tree it was carried from — the trail
 *  the living board's state migration follows when a positionally saved answer must become an identity one.
 *  (Set only when the inheritance actually landed: a collision that forced a mint carries nothing.) */
const carriedFrom = new WeakMap<object, object>();

export function carrySource(block: object): object | undefined {
  return carriedFrom.get(block);
}

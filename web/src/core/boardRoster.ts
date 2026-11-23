// The board roster (Living Boards): at most ONE live renderer per address.
//
// A board's tag is its address; the same address can be quoted twice in one conversation (the model
// updating the live board pastes the SAME tag again). Two mount points, one object: the FIRST BlockTag
// for an id claims it and owns the live view; every later tag for the same id becomes a pointer — it
// never mounts a second renderer (a second <Blocks> would reset calculator/form/tab state and double
// the DOM for one board, the exact defect this whole seam exists to prevent).
//
// The pointer "pokes" the owner; the owner refetches its id and updates the SAME mounted subtree in
// place — a layout/state change of the same elements, version bump included. If the owner unmounts (a
// virtualized transcript scrolled it away), the roster hands the claim to the next living tag for the
// id, so the board always has exactly one live home.
//
// Pure bookkeeping, no React: claim/release/poke/subscribe are called from effects, and subscribers
// re-render off their own state. Module-level — one page, one roster.

export type BoardMeta = { version?: number; updatedAt?: string };

type Entry = {
  owner: symbol | null;
  pointers: symbol[];
  meta: BoardMeta;
  listeners: Set<() => void>;   // role/meta change: re-render (pointers speak the live version)
  pokers: Set<() => void>;      // the owner's fetch trigger: the address answered a newer turn
};

const entries = new Map<string, Entry>();

function entry(id: string): Entry {
  let e = entries.get(id);
  if (!e) entries.set(id, (e = { owner: null, pointers: [], meta: {}, listeners: new Set(), pokers: new Set() }));
  return e;
}

function shout(e: Entry): void {
  for (const cb of e.listeners) cb();
}

/** Claim an address. true → you own the live view; false → you are a pointer for someone's board.
 *  Tokens are per BlockTag instance (a Symbol it made for itself); claiming twice with the same
 *  token answers what it already is. */
export function claim(id: string, token: symbol): boolean {
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

/** Let go of an address (unmount). The claim passes to the oldest pointer, if one is alive. Returns true
 *  when the page has let the address go entirely (no owner, no pointer — nothing may keep answering it). */
export function release(id: string, token: symbol): boolean {
  const e = entries.get(id);
  if (e !== undefined) {
    if (e.owner === token) {
      e.owner = e.pointers.shift() ?? null;
      shout(e);
    } else {
      const at = e.pointers.indexOf(token);
      if (at >= 0) e.pointers.splice(at, 1);
    }
    if (e.owner === null && e.pointers.length === 0 && e.listeners.size === 0 && e.pokers.size === 0) {
      entries.delete(id);
      return true;
    }
  }
  return !occupied(id);
}

/** Is anybody still home at this address? */
function occupied(id: string): boolean {
  const e = entries.get(id);
  return e !== undefined && (e.owner !== null || e.pointers.length > 0);
}

export function owns(id: string, token: symbol): boolean {
  const e = entries.get(id);
  return !!e && e.owner === token;
}

/** Is this token still on this address at all (owner or pointer)? */
export function listed(id: string, token: symbol): boolean {
  const e = entries.get(id);
  return !!e && (e.owner === token || e.pointers.includes(token));
}

/** What the live view knows about this address (version/updated_at), for pointers to say honestly. */
export function setMeta(id: string, meta: BoardMeta): void {
  const e = entry(id);
  const same = e.meta.version === meta.version && e.meta.updatedAt === meta.updatedAt;
  e.meta = meta;
  if (!same) shout(e);
}

export function getMeta(id: string): BoardMeta {
  return entry(id).meta;
}

/** The owner's refetch signal — a pointer says "this address answered something newer; draw it". The shout
 *  goes to the poke channel ONLY: a meta change must never look like a new turn (the owner answering a poke
 *  sets its own meta — that word is for the pointers to repeat, not for the owner to chase). */
export function poke(id: string): void {
  const e = entry(id);
  if (e && e.owner !== null) for (const cb of e.pokers) cb();
}

/** The owner's channel: hear pokes (new turns at this address). Returns the unsubscribe. */
export function onPoke(id: string, cb: () => void): () => void {
  const e = entry(id);
  e.pokers.add(cb);
  return () => {
    e.pokers.delete(cb);
    if (e.owner === null && e.pointers.length === 0 && e.listeners.size === 0 && e.pokers.size === 0) {
      entries.delete(id);
    }
  };
}

/** Subscribe to the address's role and meta changes (pointers re-render when the live view learns a
 *  version; both roles re-check their claim when the roster reshuffles). Returns the unsubscribe. */
export function subscribe(id: string, cb: () => void): () => void {
  const e = entry(id);
  e.listeners.add(cb);
  return () => {
    e.listeners.delete(cb);
    if (e.owner === null && e.pointers.length === 0 && e.listeners.size === 0 && e.pokers.size === 0) {
      entries.delete(id);
    }
  };
}

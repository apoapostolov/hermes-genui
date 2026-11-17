// prepared (Today only): ideas the assistant found before you asked, grouped by what they're for.
import { actsBeforeTheModel, clean, firstText, https, type Trail } from "../../core/fields";

export type Idea = { title: string; note?: string; photo: string; link?: string };
export type Group = { title: string; date?: string; ideas: Idea[]; ask?: { label: string; text: string } };
export type PreparedBlock = { type: "prepared"; groups: Group[] };

/**
 * prepared: groups (1-2) of {title, date, ideas: 2-4 {title, note, photo (https), link (https)}, ask {label, text}}.
 * Dropped: an idea without a title or an https photo; a group left with fewer than 2 ideas; an ask that acts before
 * the model; the block when no group is left.
 */
export function readPrepared(raw: any, here: Trail): PreparedBlock | null {
  const groups: Group[] = [];
  (Array.isArray(raw.groups) ? raw.groups : []).slice(0, 2).forEach((g: any, i: number) => {
    const title = firstText([g?.title], 60);
    const ideas = (Array.isArray(g?.ideas) ? g.ideas : []).map((x: any) => {
      const t = firstText([x?.title], 40);
      const photo = https(x?.photo);
      if (!t || !photo || actsBeforeTheModel(t)) return null;  // a tap puts the title in the message box
      return clean({ title: t, note: firstText([x?.note], 80), photo, link: https(x?.link) });
    }).filter(Boolean).slice(0, 4) as Idea[];
    if (!title || ideas.length < 2) { here.at("groups").at(i).drop("a group needs a title and 2-4 ideas"); return; }
    const label = firstText([g?.ask?.label], 40);
    const text = firstText([g?.ask?.text], 160);
    groups.push(clean({ title, date: firstText([g?.date], 30), ideas,
      ask: label && text && !actsBeforeTheModel(text) ? { label, text } : undefined }));
  });
  if (!groups.length) return here.drop("prepared has no group with ideas");
  return { type: "prepared", groups };
}

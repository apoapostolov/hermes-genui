// Prepared for you: for each thing coming up, a few ideas the assistant found (photo cards, two by two); a tap on an
// idea asks Hermes about it, the group's button asks for help with the whole thing. Both only fill the message box.
import { useContext, useState } from "react";
import { BlockActions } from "../../host/actions";
import type { Group, Idea, PreparedBlock } from "./read";

function IdeaCard({ idea, group }: { idea: Idea; group: string }) {
  const { fill } = useContext(BlockActions);
  const [broken, setBroken] = useState(false);
  return (
    <button type="button" className="hb-prep-idea" onClick={() => fill(`Tell me more about ${idea.title} for ${group}`)}>
      {!broken && <img src={idea.photo} alt="" loading="lazy" onError={() => setBroken(true)} />}
      <span className="hb-prep-cap">{idea.title}{idea.note && <small>{idea.note}</small>}</span>
    </button>
  );
}

function GroupView({ group }: { group: Group }) {
  const { fill } = useContext(BlockActions);
  return (
    <article className="hb-prep-group">
      <div className="hb-prep-head"><span className="hb-prep-title">{group.title}</span>
        {group.date && <span className="hb-prep-date">{group.date}</span>}</div>
      <div className="hb-prep-grid">{group.ideas.map((idea, i) => <IdeaCard key={i} idea={idea} group={group.title} />)}</div>
      {group.ask && <button type="button" className="hb-prep-ask" onClick={() => fill(group.ask!.text)}>{group.ask.label}</button>}
    </article>
  );
}

export function Prepared({ groups }: PreparedBlock) {
  return (
    <div className="hb-prep">
      <span className="hb-prep-label">Prepared for you</span>
      {groups.map((g, i) => <GroupView key={i} group={g} />)}
    </div>
  );
}

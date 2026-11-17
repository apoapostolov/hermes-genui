// The top of Today: a short band whose sky matches the weather, holding the greeting, the weather and one sentence
// about the day ("1 overdue, 9 need you, and ✓ 4 handled"). Small and calm: the rest of the page does the detail.
import type { ReactNode } from "react";
import type { BriefingBlock, Counts } from "./read";

const deg = (v: number) => `${Math.round(v)}°`;

function Line({ counts }: { counts: Counts }) {
  const parts: ReactNode[] = [];
  if (counts.need) {
    if (counts.overdue) parts.push(<span key="o" className="hb-brief-bad">{counts.overdue} overdue</span>);
    parts.push(<span key="n">{counts.need} need you</span>);
  } else {
    parts.push(<span key="n">Nothing needs you today</span>);
  }
  const handled = counts.handled ? <span className="hb-brief-good">✓ {counts.handled} handled</span> : null;
  const joined = parts.flatMap((p, i) => (i ? [", ", p] : [p]));
  return (
    <p className="hb-brief-line">{joined}{handled && <>, and {handled}</>}.</p>
  );
}

export function Briefing({ greeting, date, place, temp, condition, high, low, sky, counts }: BriefingBlock) {
  const range = [high !== undefined ? `H ${deg(high)}` : null, low !== undefined ? `L ${deg(low)}` : null]
    .filter(Boolean).join(" · ");
  return (
    <section className={`hb-brief hb-brief-${sky}`}>
      <div className="hb-brief-top">
        <div className="hb-brief-hello">
          {(date || place) && <span className="hb-brief-date">{[date, place].filter(Boolean).join(" · ")}</span>}
          <h2>{greeting}</h2>
        </div>
        {temp !== undefined && (
          <div className="hb-brief-wx">
            <span className="hb-brief-temp">{deg(temp)}</span>
            <span className="hb-brief-sky">{[condition, range].filter(Boolean).join(" · ")}</span>
          </div>
        )}
      </div>
      <Line counts={counts} />
    </section>
  );
}

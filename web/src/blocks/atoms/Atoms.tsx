// The small pieces: heading, text, divider, badge, link, image and bar.
import { useState } from "react";
import { formatAmount, formatNumber } from "../../lib/format";
import { Icon } from "../../lib/Icon";
import { InlineText } from "../../lib/InlineText";
import type { BadgeBlock, BarBlock, ImageBlock, LinkBlock } from "./read";

export function Heading({ text }: { text: string }) {
  return <div className="hb-heading"><InlineText text={text} /></div>;
}

export function Text({ text }: { text: string }) {
  return <div className="hb-text"><InlineText text={text} /></div>;
}

export function Divider() {
  return <div className="hb-divider" role="separator" />;
}

export function Badge({ text, tone }: BadgeBlock) {
  return <div className="hb-badge"><span className={`hb-chip hb-chip-${tone ?? "plain"}`}>{text}</span></div>;
}

export function LinkLine({ text, url }: LinkBlock) {
  return (
    <div className="hb-link">
      <a href={url} target="_blank" rel="noreferrer"><Icon name="globe" size={14} stroke={2.2} />{text}</a>
    </div>
  );
}

/** One photo with its caption. A photo that fails to load (a dead link, a hotlink block) takes its caption with it. */
export function Picture({ url, caption }: ImageBlock) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <figure className="hb-image">
      <img src={url} alt={caption ?? ""} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}

/**
 * A bar's amount as it reads on the right: a share when it is out of 100 with no unit, money through formatAmount,
 * else "value / max" in the user's locale with the unit after. An unknown value reads "no data", never 0.
 *   (62, 100) → "62%";  (6, 9, "items") → "6 / 9 items";  (7200, 8000, "₹") → "₹7,200 / ₹8,000";  (3, 4) → "3 / 4";
 *   in de-DE (1234.5, 2000, "steps") → "1.234,5 / 2.000 steps";  (null, 500, "₹") → "no data"
 */
export function barAmount(value: number | null, max: number, unit?: string): string {
  if (value === null) return "no data";
  if (max === 100 && !unit) return `${value}%`;
  const money = formatAmount(value, unit);
  if (money !== null) return `${money} / ${formatAmount(max, unit)}`;
  const amount = `${formatNumber(value, { digits: 3 })} / ${formatNumber(max, { digits: 3 })}`;
  return unit ? `${amount} ${unit}` : amount;
}

/** One progress bar in a small card: label on the left, the amount on the right, the fill never past full (and empty
 *  when the value is unknown, so a gap is not drawn as a zero). */
export function Bar({ label, value, max, unit }: BarBlock) {
  const share = value === null ? 0 : Math.max(0, Math.min(1, value / max));
  return (
    <div className="hb-card hb-bar">
      <div className="hb-bar-head">
        <span className="hb-bar-label">{label}</span>
        <span className="hb-bar-amount">{barAmount(value, max, unit)}</span>
      </div>
      <div className="hb-bar-track"><span className="hb-bar-fill" style={{ width: `${share * 100}%` }} /></div>
    </div>
  );
}

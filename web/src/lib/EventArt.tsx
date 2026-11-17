// Small hand-drawn illustrations for kinds of events and items (cake, plane, parcel, bill …), ported from Odie
// (github.com/sagarmainkar/odie, MIT, same author): web/src/components/EventArt.tsx. Kinds and their card colours.
import { useId } from "react";

/** Each kind's background: a soft pastel by day, a deep jewel tone of the same hue at night. */
export const KIND_BG: Record<string, { day: [string, string]; night: [string, string] }> = {
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
  general: { day: ["#eef0f6", "#e5e0f5"], night: ["#2a2d3e", "#332c4a"] },
};

/** CSS variables for a kind's card; styles.css picks day or night with the time-of-day look. */
export function kindVars(kind: string): Record<string, string> {
  const k = KIND_BG[kind] ?? KIND_BG.general;
  return { "--ka": k.day[0], "--kb": k.day[1], "--kda": k.night[0], "--kdb": k.night[1] };
}

export const KIND_LABEL: Record<string, string> = {
  medical: "Doctor", meeting: "Meeting", call: "Call", birthday: "Birthday", celebration: "Celebration", travel: "Travel",
  meal: "Meal", fitness: "Fitness", card: "Card due", bill: "Bill due", insurance: "Insurance", delivery: "Delivery",
  school: "School", show: "Event", general: "Event",
};

/** A small hand-drawn illustration for an event's kind: stethoscope, briefcase, cake, plane, cup, card, shield... */
export function EventArt({ kind, size = 120 }: { kind: string; size?: number }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const g = (n: string) => `url(#${id}${n})`;
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}a`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffffff" /><stop offset="1" stopColor="#dfe3ee" /></linearGradient>
        <linearGradient id={`${id}teal`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#5fd3c4" /><stop offset="1" stopColor="#2a8fb0" /></linearGradient>
        <linearGradient id={`${id}metal`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f4f6fa" /><stop offset=".5" stopColor="#b9c1cf" /><stop offset="1" stopColor="#7f8898" /></linearGradient>
        <linearGradient id={`${id}navy`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#5a6ad8" /><stop offset="1" stopColor="#2f3a8f" /></linearGradient>
        <linearGradient id={`${id}pink`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffb6c8" /><stop offset="1" stopColor="#f07a9b" /></linearGradient>
        <linearGradient id={`${id}cream`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff6e6" /><stop offset="1" stopColor="#f6dcb8" /></linearGradient>
        <linearGradient id={`${id}gold`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffe08a" /><stop offset="1" stopColor="#f2a33a" /></linearGradient>
        <linearGradient id={`${id}sky`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#7cc4ff" /><stop offset="1" stopColor="#3f7de0" /></linearGradient>
        <linearGradient id={`${id}violet`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#b7a3ff" /><stop offset="1" stopColor="#6f5ae6" /></linearGradient>
        <linearGradient id={`${id}green`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#8be0a4" /><stop offset="1" stopColor="#2fae86" /></linearGradient>
        <linearGradient id={`${id}kraft`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#e9c592" /><stop offset="1" stopColor="#c08a52" /></linearGradient>
        <linearGradient id={`${id}coral`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffb08a" /><stop offset="1" stopColor="#f0636b" /></linearGradient>
      </defs>
      <ellipse cx="60" cy="108" rx="34" ry="5" fill="rgba(40,30,60,.12)" />
      {art(kind, g)}
    </svg>
  );
}

function art(kind: string, g: (n: string) => string) {
  switch (kind) {
    case "medical":  // stethoscope
      return (<g>
        <path d="M36 18 C30 40 34 56 52 60 C70 56 74 40 68 18" fill="none" stroke={g("teal")} strokeWidth="6" strokeLinecap="round" />
        <circle cx="36" cy="16" r="5" fill={g("metal")} /><circle cx="68" cy="16" r="5" fill={g("metal")} />
        <path d="M52 60 C52 76 58 88 76 88" fill="none" stroke={g("teal")} strokeWidth="6" strokeLinecap="round" />
        <circle cx="84" cy="86" r="14" fill={g("metal")} /><circle cx="84" cy="86" r="8" fill="#dfe6ef" stroke="#9aa4b4" strokeWidth="1.5" />
        <circle cx="80" cy="82" r="2.5" fill="#fff" opacity=".9" />
      </g>);
    case "meeting":  // briefcase
      return (<g>
        <rect x="46" y="22" width="28" height="16" rx="6" fill="none" stroke="#3a4594" strokeWidth="5" />
        <rect x="20" y="34" width="80" height="58" rx="12" fill={g("navy")} />
        <rect x="20" y="34" width="80" height="22" rx="12" fill="#6c7ce6" opacity=".55" />
        <rect x="53" y="52" width="14" height="12" rx="3" fill={g("gold")} />
        <path d="M26 40 h68" stroke="#fff" strokeOpacity=".35" strokeWidth="2" strokeLinecap="round" />
      </g>);
    case "call":  // video camera
      return (<g>
        <rect x="16" y="36" width="64" height="48" rx="12" fill={g("sky")} />
        <path d="M80 52 L104 38 V82 L80 68 Z" fill="#2f63c4" />
        <circle cx="34" cy="50" r="5" fill="#fff" opacity=".85" />
        <path d="M24 44 h22" stroke="#fff" strokeOpacity=".4" strokeWidth="2" strokeLinecap="round" />
      </g>);
    case "birthday":  // cake with candles and a flower
      return (<g>
        <rect x="26" y="66" width="68" height="30" rx="8" fill={g("pink")} />
        <path d="M26 72 q8 8 17 0 t17 0 t17 0 t17 0" fill="#fff4f7" />
        <rect x="36" y="44" width="48" height="24" rx="7" fill={g("cream")} />
        <path d="M36 50 q6 6 12 0 t12 0 t12 0 t12 0" fill="#fff" />
        {[48, 60, 72].map((x) => (<g key={x}><rect x={x - 2.5} y="28" width="5" height="16" rx="2" fill={x === 60 ? "#7cc4ff" : "#b7a3ff"} />
          <path d={`M${x} 18 q4 5 0 9 q-4 -4 0 -9`} fill={g("gold")} /></g>))}
        <g transform="translate(96 32)">{[0, 72, 144, 216, 288].map((r) => <ellipse key={r} cx="0" cy="-7" rx="4.5" ry="7" fill="#ff8fb0" transform={`rotate(${r})`} />)}
          <circle r="4" fill={g("gold")} /></g>
      </g>);
    case "celebration":  // gift box
      return (<g>
        <rect x="24" y="50" width="72" height="46" rx="8" fill={g("violet")} />
        <rect x="20" y="38" width="80" height="18" rx="6" fill="#9b86f5" />
        <rect x="55" y="38" width="10" height="58" fill={g("gold")} />
        <path d="M60 38 C44 18 30 30 46 38 Z M60 38 C76 18 90 30 74 38 Z" fill={g("gold")} />
      </g>);
    case "travel":  // plane over a cloud
      return (<g>
        <path d="M20 86 a14 14 0 0 1 22 -12 a18 18 0 0 1 34 4 a12 12 0 0 1 4 24 H26 a12 12 0 0 1 -6 -16 z" fill="#ffffff" opacity=".95" />
        <g transform="rotate(-18 60 46)">
          <path d="M14 50 C40 44 80 44 104 48 C110 50 110 54 104 56 C80 60 40 60 14 54 Z" fill={g("sky")} />
          <path d="M54 50 L40 24 L50 24 L74 50 Z M54 56 L44 76 L54 76 L72 56 Z" fill="#2f63c4" />
          <path d="M18 50 L10 38 L18 38 L28 50 Z" fill="#2f63c4" />
          {[66, 74, 82, 90].map((x) => <circle key={x} cx={x} cy="50" r="2" fill="#fff" />)}
        </g>
      </g>);
    case "meal":  // cup with steam
      return (<g>
        <path d="M28 50 h56 v26 a22 22 0 0 1 -22 22 h-12 a22 22 0 0 1 -22 -22 z" fill={g("coral")} />
        <path d="M84 56 a12 12 0 0 1 0 24" fill="none" stroke="#e5556a" strokeWidth="6" />
        <ellipse cx="56" cy="50" rx="28" ry="5" fill="#7a3b2a" opacity=".8" />
        {[44, 56, 68].map((x) => <path key={x} d={`M${x} 40 q-6 -8 0 -14 q6 -6 0 -14`} fill="none" stroke="#c9b6d8" strokeWidth="3" strokeLinecap="round" />)}
      </g>);
    case "fitness":  // dumbbell
      return (<g transform="rotate(-20 60 60)">
        <rect x="34" y="56" width="52" height="8" rx="4" fill={g("metal")} />
        <rect x="18" y="40" width="16" height="40" rx="5" fill={g("green")} /><rect x="86" y="40" width="16" height="40" rx="5" fill={g("green")} />
        <rect x="10" y="48" width="10" height="24" rx="4" fill="#2a9e7b" /><rect x="100" y="48" width="10" height="24" rx="4" fill="#2a9e7b" />
      </g>);
    case "card":  // credit card over a receipt
      return (<g>
        <path d="M58 16 h36 v70 l-6 -4 l-6 4 l-6 -4 l-6 4 l-6 -4 l-6 4 z" fill="#fff" stroke="#e3dcf2" />
        {[30, 40, 50].map((y) => <path key={y} d={`M64 ${y} h24`} stroke="#c9c1e0" strokeWidth="3" strokeLinecap="round" />)}
        <g transform="rotate(-12 50 70)">
          <rect x="12" y="50" width="78" height="48" rx="9" fill={g("violet")} />
          <rect x="12" y="62" width="78" height="9" fill="#4a3bb0" opacity=".7" />
          <rect x="22" y="78" width="16" height="11" rx="2.5" fill={g("gold")} />
          <path d="M56 86 h24" stroke="#fff" strokeOpacity=".7" strokeWidth="3" strokeLinecap="round" />
        </g>
      </g>);
    case "bill":  // receipt with a dollar sign
      return (<g>
        <path d="M30 14 h60 v84 l-7.5 -6 l-7.5 6 l-7.5 -6 l-7.5 6 l-7.5 -6 l-7.5 6 l-7.5 -6 l-7.5 6 z" fill="#fff" stroke="#dfe3f0" />
        <circle cx="60" cy="40" r="15" fill={g("violet")} />
        <path d="M60 30 v20 M65 35.5 c0 -2.5 -2.2 -3.5 -5 -3.5 c-3 0 -5 1.5 -5 3.8 c0 5.7 10 2.7 10 8.4 c0 2.4 -2.2 3.8 -5 3.8 c-2.8 0 -5 -1.1 -5 -3.6" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {[64, 72, 80].map((y, i) => <path key={y} d={`M40 ${y} h${i === 2 ? 22 : 40}`} stroke="#cfd4e6" strokeWidth="3" strokeLinecap="round" />)}
      </g>);
    case "insurance":  // shield with a tick
      return (<g>
        <path d="M60 14 L94 26 V54 C94 78 78 94 60 102 C42 94 26 78 26 54 V26 Z" fill={g("green")} />
        <path d="M60 22 L86 31 V54 C86 73 74 86 60 93 Z" fill="#fff" opacity=".18" />
        <path d="M44 58 L56 70 L78 46" fill="none" stroke="#fff" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
      </g>);
    case "delivery":  // parcel
      return (<g>
        <path d="M60 18 L100 36 V82 L60 100 L20 82 V36 Z" fill={g("kraft")} />
        <path d="M20 36 L60 54 L100 36" fill="none" stroke="#a86f3a" strokeWidth="2" />
        <path d="M60 54 V100" stroke="#a86f3a" strokeWidth="2" />
        <path d="M40 27 L80 45 V60 L72 56 V49 L33 31 Z" fill="#f6e2bf" />
      </g>);
    case "school":  // graduation cap
      return (<g>
        <path d="M60 24 L108 44 L60 64 L12 44 Z" fill={g("navy")} />
        <path d="M32 54 V76 C32 84 88 84 88 76 V54 L60 66 Z" fill="#3a4594" />
        <path d="M100 47 V74" stroke={g("gold")} strokeWidth="3" /><circle cx="100" cy="78" r="5" fill={g("gold")} />
      </g>);
    case "show":  // ticket
      return (<g transform="rotate(-10 60 60)">
        <path d="M14 36 h92 v14 a10 10 0 0 0 0 20 v14 h-92 v-14 a10 10 0 0 0 0 -20 z" fill={g("coral")} />
        <path d="M78 38 v44" stroke="#fff" strokeOpacity=".7" strokeWidth="2.5" strokeDasharray="4 5" />
        <path d="M30 52 h36 M30 64 h24" stroke="#fff" strokeOpacity=".85" strokeWidth="4" strokeLinecap="round" />
        <path d="M92 52 l3 6 6 1 -4.5 4 1 6 -5.5 -3 -5.5 3 1 -6 -4.5 -4 6 -1 z" fill={g("gold")} />
      </g>);
    default:  // a calendar page
      return (<g>
        <rect x="22" y="24" width="76" height="74" rx="14" fill="#fff" stroke="#e1e4ef" />
        <path d="M22 38 a14 14 0 0 1 14 -14 h48 a14 14 0 0 1 14 14 v8 h-76 z" fill={g("coral")} />
        <rect x="38" y="16" width="6" height="16" rx="3" fill="#8a91a6" /><rect x="76" y="16" width="6" height="16" rx="3" fill="#8a91a6" />
        {[0, 1, 2].map((r) => [0, 1, 2, 3].map((c) => <rect key={`${r}${c}`} x={34 + c * 14} y={56 + r * 12} width="8" height="6" rx="2" fill={r === 1 && c === 2 ? "#f0636b" : "#d8dceb"} />))}
      </g>);
  }
}

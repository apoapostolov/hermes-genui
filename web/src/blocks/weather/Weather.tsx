// The weather now, after Odie's Today: the temperature large on the left; the sky and the place, then today's high
// and tonight's low, beside it. One wide strip on a soft sky-to-sun gradient.
import type { WeatherBlock } from "./read";

const deg = (v: number) => `${Math.round(v)}°`;

export function Weather({ temp, place, condition, high, low }: WeatherBlock) {
  const range = [high !== undefined ? `High ${deg(high)}` : null, low !== undefined ? `${deg(low)} tonight` : null]
    .filter(Boolean).join(" · ");
  return (
    <div className="hb-card hb-weather">
      <span className="hb-weather-temp">{deg(temp)}</span>
      <span className="hb-weather-text">
        <span className="hb-weather-where">{condition ? `${condition} in ${place}` : place}</span>
        {range && <span className="hb-weather-range">{range}</span>}
      </span>
    </div>
  );
}

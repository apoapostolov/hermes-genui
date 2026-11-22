// The plugin's one stylesheet, put together from the shared files and each block's own css (each imported as text).
// The order is fixed: tokens and shared pieces first, so a block's rules can build on them (a chart's padding
// replaces a card's), then the blocks. A new block's css goes in this list.
import tokens from "./tokens.css";
import shared from "./shared.css";
import blockTag from "../host/blockTag.css";
import atoms from "../blocks/atoms/atoms.css";
import source from "../blocks/source/source.css";
import callout from "../blocks/callout/callout.css";
import kpis from "../blocks/kpis/kpis.css";
import timeline from "../blocks/timeline/timeline.css";
import layout from "../blocks/layout/layout.css";
import chart from "../blocks/chart/chart.css";
import images from "../blocks/images/images.css";
import table from "../blocks/table/table.css";
import list from "../blocks/list/list.css";
import heatmap from "../blocks/heatmap/heatmap.css";
import flip from "../blocks/flip/flip.css";
import flow from "../blocks/flow/flow.css";
import steps from "../blocks/steps/steps.css";
import layers from "../blocks/layers/layers.css";
import progress from "../blocks/progress/progress.css";
import streak from "../blocks/streak/streak.css";
import actions from "../blocks/actions/actions.css";
import tiles from "../blocks/tiles/tiles.css";
import checklist from "../blocks/checklist/checklist.css";
import calculator from "../blocks/calculator/calculator.css";
import simulate from "../blocks/simulate/simulate.css";
import form from "../blocks/form/form.css";
import briefing from "../blocks/briefing/briefing.css";
import tracker from "../blocks/tracker/tracker.css";
import prepared from "../blocks/prepared/prepared.css";
import calendar from "../blocks/calendar/calendar.css";
import upnext from "../blocks/upnext/upnext.css";
import weather from "../blocks/weather/weather.css";
import widget from "../blocks/widget/widget.css";
import dashboard from "../live/dashboard.css";

export const STYLE_PARTS = [
  tokens, shared, blockTag, atoms, source, callout, kpis, timeline, layout, chart, images, table, list, heatmap, flip,
  flow, steps, layers, progress, streak, actions, tiles, checklist, calculator, simulate, form, briefing, tracker,
  prepared, calendar, upnext, weather, widget, dashboard,
];

export default STYLE_PARTS.join("\n");

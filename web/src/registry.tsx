// Every block type, in one place: how it is read from stored JSON and how it is drawn. readBlocks (core/readBlocks.ts)
// and the Blocks renderer (core/Blocks.tsx) both look types up here, so a type missing here is unknown: dropped, with
// a note. Adding a type is a folder in blocks/ plus a line in Block and a line in REGISTRY (see CONTRIBUTING.md).
import { Actions, Button } from "./blocks/actions/Actions";
import { readActions, readButton, type ActionsBlock, type ButtonBlock } from "./blocks/actions/read";
import { Badge, Bar, Divider, Heading, LinkLine, Picture, Text } from "./blocks/atoms/Atoms";
import {
  readBadge, readBar, readDivider, readHeading, readImage, readLink, readText, type BadgeBlock, type BarBlock,
  type DividerBlock, type HeadingBlock, type ImageBlock, type LinkBlock, type TextBlock,
} from "./blocks/atoms/read";
import { Calculator } from "./blocks/calculator/Calculator";
import { readCalculator, type CalculatorBlock } from "./blocks/calculator/read";
import { Calendar } from "./blocks/calendar/Calendar";
import { readCalendar, type CalendarBlock } from "./blocks/calendar/read";
import { Callout } from "./blocks/callout/Callout";
import { UpNext } from "./blocks/upnext/UpNext";
import { readUpNext, type UpNextBlock } from "./blocks/upnext/read";
import { Weather } from "./blocks/weather/Weather";
import { readWeather, type WeatherBlock } from "./blocks/weather/read";
import { readCallout, type CalloutBlock } from "./blocks/callout/read";
import { Chart } from "./blocks/chart/Chart";
import { readChart, type ChartBlock } from "./blocks/chart/read";
import { Checklist } from "./blocks/checklist/Checklist";
import { readChecklist, type ChecklistBlock } from "./blocks/checklist/read";
import { Flip } from "./blocks/flip/Flip";
import { readFlip, type FlipBlock } from "./blocks/flip/read";
import { Flow } from "./blocks/flow/Flow";
import { readFlow, type FlowBlock } from "./blocks/flow/read";
import { Form } from "./blocks/form/Form";
import { readForm, type FormBlock } from "./blocks/form/read";
import { Heatmap } from "./blocks/heatmap/Heatmap";
import { readHeatmap, type HeatmapBlock } from "./blocks/heatmap/read";
import { Images } from "./blocks/images/Images";
import { readImages, type ImagesBlock } from "./blocks/images/read";
import { KpiCard, Kpis } from "./blocks/kpis/Kpis";
import { readKpis, readStat, type KpisBlock, type StatBlock } from "./blocks/kpis/read";
import { Columns, Grid, Row, Section } from "./blocks/layout/Containers";
import { readContainer, type ContainerBlock } from "./blocks/layout/read";
import { readTabs, type TabsBlock } from "./blocks/layout/readTabs";
import { Tabs } from "./blocks/layout/Tabs";
import { List } from "./blocks/list/List";
import { Layers } from "./blocks/layers/Layers";
import { readLayers, type LayersBlock } from "./blocks/layers/read";
import { readList, type ListBlock } from "./blocks/list/read";
import { Progress } from "./blocks/progress/Progress";
import { readProgress, type ProgressBlock } from "./blocks/progress/read";
import { readSimulate, type SimulateBlock } from "./blocks/simulate/read";
import { Simulate } from "./blocks/simulate/Simulate";
import { readSource, type SourceBlock } from "./blocks/source/read";
import { Source } from "./blocks/source/Source";
import { readSteps, type StepsBlock } from "./blocks/steps/read";
import { Steps } from "./blocks/steps/Steps";
import { readStreak, type StreakBlock } from "./blocks/streak/read";
import { Streak } from "./blocks/streak/Streak";
import { readTable, type TableBlock } from "./blocks/table/read";
import { Table } from "./blocks/table/Table";
import { readTiles, type TilesBlock } from "./blocks/tiles/read";
import { Tiles } from "./blocks/tiles/Tiles";
import { readTimeline, type TimelineBlock } from "./blocks/timeline/read";
import { Briefing } from "./blocks/briefing/Briefing";
import { readBriefing, type BriefingBlock } from "./blocks/briefing/read";
import { Prepared } from "./blocks/prepared/Prepared";
import { readPrepared, type PreparedBlock } from "./blocks/prepared/read";
import { readTracker, type TrackerBlock } from "./blocks/tracker/read";
import { Tracker } from "./blocks/tracker/Tracker";
import { Timeline } from "./blocks/timeline/Timeline";
import type { BlockEntry } from "./core/types";

/** Every block that can be drawn, as its reader returns it. */
export type Block =
  | ChartBlock | KpisBlock | SourceBlock | TimelineBlock | ImagesBlock | CalloutBlock | TableBlock
  | ListBlock | ProgressBlock | StreakBlock | HeatmapBlock | FlipBlock | FlowBlock | StepsBlock | LayersBlock
  | ActionsBlock | TilesBlock | ChecklistBlock | CalendarBlock | UpNextBlock | WeatherBlock | CalculatorBlock | SimulateBlock | FormBlock
  | HeadingBlock | TextBlock | StatBlock | DividerBlock | BadgeBlock | ButtonBlock | LinkBlock | ImageBlock | BarBlock
  | ContainerBlock | TabsBlock | BriefingBlock | TrackerBlock | PreparedBlock;

/** The Today page's own blocks: drawn from the plugin's data, never offered to the model (not in the catalog). */
export const PAGE_KINDS = ["briefing", "tracker", "prepared"] as const;

type Registry = { [K in Block["type"]]: BlockEntry<Extract<Block, { type: K }>> };

/** type → its reader and its drawing. Containers (row, section, grid, columns, tabs) draw their children with `draw`. */
export const REGISTRY: Registry = {
  chart: { read: readChart, Component: ({ block }) => <Chart spec={block.spec} /> },
  kpis: { read: readKpis, Component: ({ block }) => <Kpis items={block.items} /> },
  source: { read: readSource, Component: ({ block }) => <Source text={block.text} url={block.url} /> },
  timeline: { read: readTimeline, Component: ({ block }) => <Timeline {...block} /> },
  images: { read: readImages, Component: ({ block }) => <Images block={block} /> },
  callout: { read: readCallout, Component: ({ block }) => <Callout {...block} /> },
  calendar: { read: readCalendar, Component: ({ block }) => <Calendar {...block} /> },
  upnext: { read: readUpNext, Component: ({ block }) => <UpNext {...block} /> },
  weather: { read: readWeather, Component: ({ block }) => <Weather {...block} /> },
  briefing: { read: readBriefing, Component: ({ block }) => <Briefing {...block} /> },
  tracker: { read: readTracker, Component: ({ block }) => <Tracker {...block} /> },
  prepared: { read: readPrepared, Component: ({ block }) => <Prepared {...block} /> },
  table: { read: readTable, Component: ({ block }) => <Table {...block} /> },
  list: { read: readList, Component: ({ block }) => <List {...block} /> },
  progress: { read: readProgress, Component: ({ block }) => <Progress {...block} /> },
  streak: { read: readStreak, Component: ({ block }) => <Streak {...block} /> },
  heatmap: { read: readHeatmap, Component: ({ block }) => <Heatmap {...block} /> },
  flip: { read: readFlip, Component: ({ block }) => <Flip {...block} /> },
  flow: { read: readFlow, Component: ({ block }) => <Flow {...block} /> },
  steps: { read: readSteps, Component: ({ block }) => <Steps {...block} /> },
  layers: { read: readLayers, Component: ({ block }) => <Layers {...block} /> },
  heading: { read: readHeading, Component: ({ block }) => <Heading text={block.text} /> },
  text: { read: readText, Component: ({ block }) => <Text text={block.text} /> },
  stat: { read: readStat, Component: ({ block }) => <KpiCard item={block} /> },
  divider: { read: readDivider, Component: () => <Divider /> },
  badge: { read: readBadge, Component: ({ block }) => <Badge {...block} /> },
  link: { read: readLink, Component: ({ block }) => <LinkLine {...block} /> },
  image: { read: readImage, Component: ({ block }) => <Picture {...block} /> },
  bar: { read: readBar, Component: ({ block }) => <Bar {...block} /> },
  actions: { read: readActions, Component: ({ block }) => <Actions items={block.items} /> },
  button: { read: readButton, Component: ({ block }) => <Button {...block} /> },
  tiles: { read: readTiles, Component: ({ block }) => <Tiles items={block.items} /> },
  checklist: { read: readChecklist, Component: ({ block }) => <Checklist {...block} /> },
  calculator: { read: readCalculator, Component: ({ block }) => <Calculator {...block} /> },
  simulate: { read: readSimulate, Component: ({ block }) => <Simulate {...block} /> },
  form: { read: readForm, Component: ({ block }) => <Form {...block} /> },
  row: { read: readContainer, Component: ({ block, draw }) => <Row kinds={block.children.map((c) => c.type)}>{draw(block.children)}</Row> },
  section: { read: readContainer, Component: ({ block, draw }) => <Section title={block.title} collapsed={block.collapsed}>{draw(block.children)}</Section> },
  grid: { read: readContainer, Component: ({ block, draw }) => <Grid>{draw(block.children)}</Grid> },
  columns: { read: readContainer, Component: ({ block, draw }) => <Columns>{draw(block.children)}</Columns> },
  tabs: { read: readTabs, Component: ({ block, draw }) => <Tabs labels={block.tabs.map((t) => t.label)} badges={block.tabs.map((t) => t.badge)} panel={(i) => draw(block.tabs[i].children)} /> },
};

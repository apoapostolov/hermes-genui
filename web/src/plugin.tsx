// The Hermes Desktop half: claims the `::blocks{id="..."}` tag and draws the stored blocks inside the reply. Buttons,
// tiles and forms in them act through the app's composer; checklists save their ticks through the plugin's REST routes.
import { host, TRANSCRIPT_DIRECTIVE_AREA } from "@hermes/plugin-sdk";
import { BlockActions, composerActions, type Rest } from "./host/actions";
import { BlockTag } from "./host/BlockTag";
import { registerLive } from "./live/register";
import { openAndFill } from "./live/open";
import css from "./styles";

const ID = "hermes-genui";
const STYLE_ID = "hermes-genui-css";

/** Adds the plugin's stylesheet once; on a hot reload the same element gets the new rules. */
function injectStyles(): void {
  let el = document.getElementById(STYLE_ID);
  if (!el) {
    el = document.createElement("style");
    el.id = STYLE_ID;
    document.head.appendChild(el);
  }
  el.textContent = css;
}

export default {
  id: ID,
  name: "Hermes GenUI",
  register(ctx: any) {
    injectStyles();
    const load = (blockId: string) => ctx.rest(`/blocks/${blockId}`);
    const rest: Rest = (path, init) => ctx.rest(path, init);
    // host.composer is looked up on each tap, not once here, so a composer the app sets up later is still found.
    const send = (text: string) => composerActions(host?.composer).send(text);
    const fill = (text: string) => composerActions(host?.composer).fill(text);
    ctx.register({
      id: "hermes-genui-tag",
      area: TRANSCRIPT_DIRECTIVE_AREA,
      data: {
        name: "blocks",
        render: ({ attrs, streaming }: { attrs: Record<string, string>; streaming: boolean }) => (
          <BlockActions.Provider value={{ send, fill, rest, blockId: attrs?.id }}>
            <BlockTag id={attrs?.id} streaming={Boolean(streaming)} load={load} />
          </BlockActions.Provider>
        ),
      },
    });
    // The plugin's pages: Today, an assembled dashboard, and each kept dashboard.
    // A tap on a page opens a chat first: a page has no message box.
    const open = (text: string) => void openAndFill(text, host ?? {});
    registerLive(ctx, open);
  },
};

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BlockActions, type SendResult } from "../../host/actions";
import { Blocks } from "../../core/Blocks";
import { readBlocks } from "../../core/readBlocks";
import { pinLocale } from "../../lib/locale.testing";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

type Row = Record<string, unknown>;

const table = (rows: Row[], extra: Record<string, unknown> = {}) => [{
  type: "table", caption: "Spend", interactive: true, columns: [
    { id: "shop", label: "Shop" },
    { id: "spend", label: "Spend", kind: "currency", unit: "$" },
  ], rows, ...extra,
}];

const THREE: Row[] = [{ shop: "A", spend: 1200 }, { shop: "B", spend: 1800 }, { shop: "C", spend: 900 }];

/** Draws blocks with the app's actions stubbed, and can redraw them the way a live board refresh does: the same
 *  tree shape, so the table keeps its own state across the new data. */
function draw(blocks: unknown[], send = vi.fn(async () => "sent" as SendResult)) {
  const tree = (next: unknown[]) => (
    <BlockActions.Provider value={{ send, fill: () => {} }}>
      <Blocks blocks={readBlocks(next)} />
    </BlockActions.Provider>
  );
  const view = render(tree(blocks));
  return { ...view, send, redraw: (next: unknown[]) => view.rerender(tree(next)) };
}

const tick = (name: string) => fireEvent.click(screen.getByRole("checkbox", { name }));
const sendButton = () => screen.getByRole("button", { name: /to the chat/ });
const status = (container: HTMLElement) => container.querySelector(".hb-table-status")!;

describe("a structured table without the word", () => {
  it("draws no ticks, no send button and no status region, exactly as before", () => {
    const { container } = draw([{ type: "table", filterable: true, columns: [
      { id: "shop", label: "Shop" }, { id: "spend", label: "Spend", kind: "currency", unit: "$" }],
    rows: [{ shop: "A", spend: 1200 }] }]);
    expect(container.querySelectorAll(".hb-pick").length).toBe(0);
    expect(container.querySelectorAll("input[type=checkbox]").length).toBe(0);
    expect(container.querySelector(".hb-table-send")).toBeNull();
    expect(container.querySelector(".hb-table-status")).toBeNull();
    expect(screen.getByRole("searchbox", { name: "Filter rows" })).toBeTruthy(); // its own filter still ships
  });

  it("is not made structured by the word alone: a legacy table keeps drawing as one, with no controls", () => {
    const { container } = draw([{ type: "table", interactive: true, columns: ["Shop", "Spend"], rows: [["A", "1200"]] }]);
    expect(container.querySelector(".hb-table-structured")).toBeNull();
    expect(container.querySelector("input[type=checkbox]")).toBeNull();
    expect(container.querySelector(".hb-table-send")).toBeNull();
  });

  it("reads the word strictly true, the way every other block word is read", () => {
    for (const word of [false, "true", 1, "yes", undefined]) {
      const { container } = draw(table(THREE, { interactive: word }));
      expect(container.querySelector("input[type=checkbox]")).toBeNull();
      cleanup();
    }
  });
});

describe("the filter row an interactive table brings", () => {
  it("searches the rows even when `filterable` is not set", () => {
    pinLocale("en-US");
    draw(table(THREE));
    expect(screen.getByText("A")).toBeTruthy();
    fireEvent.change(screen.getByRole("searchbox", { name: "Filter rows" }), { target: { value: "b" } });
    expect(screen.getByText("B")).toBeTruthy();
    expect(screen.queryByText("A")).toBeNull();
    expect(screen.queryByText("$900")).toBeNull();
  });

  it("finds a number written only as a value, not only as cell text", () => {
    pinLocale("en-US");
    draw(table([{ shop: "A", spend: 44999 }, { shop: "B", spend: 39999 }]));
    fireEvent.change(screen.getByRole("searchbox", { name: "Filter rows" }), { target: { value: "44999" } });
    expect(screen.getByText("A")).toBeTruthy();
    expect(screen.queryByText("B")).toBeNull();
  });

  it("says when the query left nothing", () => {
    draw(table(THREE));
    fireEvent.change(screen.getByRole("searchbox", { name: "Filter rows" }), { target: { value: "zzz" } });
    expect(screen.getByText("Nothing matches “zzz”.")).toBeTruthy();
  });
});

describe("ticking rows", () => {
  it("puts one tick on each row, named after the row's first cell", () => {
    draw(table(THREE));
    expect(screen.getByRole("checkbox", { name: "Select row A" })).toBeTruthy();
    expect(screen.getByRole("checkbox", { name: "Select row C" })).toBeTruthy();
  });

  it("says Select, disabled, until a row is ticked, then Send", () => {
    draw(table(THREE));
    expect(screen.getByRole("button", { name: "Select a row to send to the chat" }).textContent).toBe("Select");
    expect((screen.getByRole("button", { name: "Select a row to send to the chat" }) as HTMLButtonElement).disabled).toBe(true);
    tick("Select row B");
    const send = screen.getByRole("button", { name: "Send 1 selected row to the chat" });
    expect(send.textContent).toBe("Send");
    expect((send as HTMLButtonElement).disabled).toBe(false);
    tick("Select row B");
    expect(screen.getByRole("button", { name: "Select a row to send to the chat" }).textContent).toBe("Select");
  });

  it("keeps a tick through the filter, and through the pages, because it is the row's data", () => {
    pinLocale("en-US");
    const twelve: Row[] = Array.from({ length: 12 }, (_, i) => ({ shop: `S${i}`, spend: i + 1 }));
    const { send } = draw(table(twelve));
    tick("Select row S0");
    fireEvent.change(screen.getByRole("searchbox", { name: "Filter rows" }), { target: { value: "S1" } });
    expect(screen.queryByText("S0")).toBeNull(); // hidden by the reader's own query, not removed
    fireEvent.change(screen.getByRole("searchbox", { name: "Filter rows" }), { target: { value: "" } });
    expect((screen.getByRole("checkbox", { name: "Select row S0" }) as HTMLInputElement).checked).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(screen.getByText("S10")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Previous page" }));
    expect((screen.getByRole("checkbox", { name: "Select row S0" }) as HTMLInputElement).checked).toBe(true);
    act(() => { fireEvent.click(sendButton()); });
    expect(send).toHaveBeenCalledWith("Spend:\nShop | Spend\nS0 | $1", { force: true });
  });

  it("keeps focus on a row's own tick when a refresh reorders the rows", () => {
    const { redraw } = draw(table(THREE));
    const ticked = screen.getByRole("checkbox", { name: "Select row A" });
    ticked.focus();
    expect(document.activeElement).toBe(ticked);
    redraw(table([THREE[2], THREE[1], THREE[0]])); // the same data, in another order
    // the row's DOM node travelled with its data, so Space still ticks the row the reader had focused
    expect(document.activeElement).toBe(screen.getByRole("checkbox", { name: "Select row A" }));
  });

  it("tells identical rows apart on screen while a tick still means the same data", () => {
    const { container } = draw(table([THREE[0], THREE[0]]));
    const boxes = container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    expect(boxes.length).toBe(2);
    fireEvent.click(boxes[0]);
    expect(boxes[0].checked).toBe(true);
    expect(boxes[1].checked).toBe(true); // equal data is one selection
  });

  it("sends the ticked rows in board order, as the reader's own message", () => {
    pinLocale("en-US");
    const { send } = draw(table(THREE));
    tick("Select row C");
    tick("Select row A");
    act(() => { fireEvent.click(sendButton()); });
    expect(send).toHaveBeenCalledWith("Spend:\nShop | Spend\nA | $1,200\nC | $900", { force: true });
  });
});

describe("the word after a tap is the host's own", () => {
  const words: Array<[SendResult, string]> = [
    ["sent", "Sent to chat."],
    ["drafted", "In the composer. Press Send."],
    ["blocked", "In the composer. Blocked from sending."],
    ["failed", "Send failed. Nothing was kept."],
    ["nowhere", "No chat here."],
  ];

  for (const [result, words_] of words) {
    it(`says "${words_}" when the host answered ${result}`, async () => {
      const { container } = draw(table(THREE), vi.fn(async () => result));
      tick("Select row A");
      await act(async () => { fireEvent.click(sendButton()); });
      expect(status(container).textContent).toBe(words_);
      expect(status(container).getAttribute("role")).toBe("status");
      expect(status(container).getAttribute("aria-live")).toBe("polite");
    });
  }

  it("keeps the ticks after a failed send, so the tap can be retried", async () => {
    const { container, send } = draw(table(THREE), vi.fn(async () => "failed" as SendResult));
    tick("Select row A");
    await act(async () => { fireEvent.click(sendButton()); });
    expect(status(container).textContent).toBe("Send failed. Nothing was kept.");
    expect((screen.getByRole("checkbox", { name: "Select row A" }) as HTMLInputElement).checked).toBe(true);
    await act(async () => { fireEvent.click(sendButton()); });
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("clears the word when the choice changes: a stale word never labels a new selection", async () => {
    const { container } = draw(table(THREE), vi.fn(async () => "sent" as SendResult));
    tick("Select row A");
    await act(async () => { fireEvent.click(sendButton()); });
    expect(status(container).textContent).toBe("Sent to chat.");
    tick("Select row B");
    expect(status(container).textContent).toBe("");
  });

  it("drops an answer that arrives after the choice changed, so a word never labels a different message", async () => {
    const answers: Array<(where: SendResult) => void> = [];
    const send = vi.fn(() => new Promise<SendResult>((resolve) => { answers.push(resolve); }));
    const { container } = draw(table(THREE), send);
    tick("Select row A");
    act(() => { fireEvent.click(sendButton()); });
    tick("Select row B"); // the selection changed while the host was still thinking
    await act(async () => { answers[0]("sent"); });
    expect(status(container).textContent).toBe(""); // A's word belongs to a message that is no longer the selection
    act(() => { fireEvent.click(sendButton()); });
    await act(async () => { answers[1]("sent"); }); // the message on screen gets its own word
    expect(status(container).textContent).toBe("Sent to chat.");
  });

  it("drops an answer from an older tap: only the last tap may put a word on the row", async () => {
    const answers: Array<(where: SendResult) => void> = [];
    const send = vi.fn(() => new Promise<SendResult>((resolve) => { answers.push(resolve); }));
    const { container } = draw(table(THREE), send);
    tick("Select row A");
    act(() => { fireEvent.click(sendButton()); });
    tick("Select row B");
    act(() => { fireEvent.click(sendButton()); });
    await act(async () => { answers[1]("drafted"); });
    expect(status(container).textContent).toBe("In the composer. Press Send.");
    await act(async () => { answers[0]("sent"); }); // the old answer arrives late
    expect(status(container).textContent).toBe("In the composer. Press Send.");
  });
});

describe("a live board refreshing underneath the ticks", () => {
  it("discards the tick of a row whose data went, and never resurrects it", () => {
    pinLocale("en-US");
    const { send, redraw } = draw(table(THREE));
    tick("Select row B");
    redraw(table([THREE[0], THREE[2]])); // B was removed upstream
    expect(screen.queryByRole("checkbox", { name: "Select row B" })).toBeNull();
    expect(screen.getByRole("button", { name: "Select a row to send to the chat" }).textContent).toBe("Select");
    redraw(table(THREE)); // B comes back: the same data is a NEW row and starts unselected
    expect((screen.getByRole("checkbox", { name: "Select row B" }) as HTMLInputElement).checked).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });

  it("keeps the tick when the row only moved, and sends it from where it now sits", () => {
    pinLocale("en-US");
    const { redraw, send } = draw(table(THREE));
    tick("Select row A");
    redraw(table([THREE[2], THREE[1], THREE[0]]));
    act(() => { fireEvent.click(sendButton()); });
    expect(send).toHaveBeenCalledWith("Spend:\nShop | Spend\nA | $1,200", { force: true });
  });
});

describe("the drawing keeps its columns straight with a tick column added", () => {
  it("spans the tick column in the footer, so every total stays under its own column", () => {
    pinLocale("en-US");
    const { container } = draw(table(THREE, { aggregates: [{ column: "spend", op: "sum", label: "Total" }] }));
    const footer = container.querySelector("tfoot tr")!;
    expect(footer.querySelectorAll("td").length).toBe(3); // the tick cell plus the two columns
    expect(footer.querySelector("td")!.className).toBe("hb-pick");
    expect(footer.querySelectorAll("td")[2].textContent).toContain("3,900");
  });

  it("spans the tick column in the empty state, so the row fills the table", () => {
    const { container } = draw(table(THREE));
    fireEvent.change(screen.getByRole("searchbox", { name: "Filter rows" }), { target: { value: "zzz" } });
    expect(container.querySelector("td.hb-table-empty-cell")!.getAttribute("colspan")).toBe("3");
  });
});

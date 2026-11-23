// The one message a form sends.
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { act, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { forgetBoards } from "../checklist/savedState";
import { drawWithActions as draw } from "../../core/testing";
import { answerMessage, startingValues } from "./formMessage";
import type { FormBlock } from "./read";
import { readBlocks } from "../../core/readBlocks";

afterEach(cleanup);
beforeEach(() => forgetBoards());

describe("form", () => {
  const trip = { type: "form", id: "trip", title: "Weekend", fields: [
    { id: "where", kind: "select", label: "Where", value: "Hills", options: ["Hills", "Beach"] },
    { id: "pace", kind: "radio", label: "Pace", value: "Easy", options: ["Easy", "Packed"] },
    { id: "add", kind: "checkbox", label: "Add", value: ["Music"], options: ["Music", "Food stops"] },
    { id: "spend", kind: "slider", label: "Budget", min: 5, max: 30, step: 1, value: 12, unit: "k" },
    { id: "who", kind: "text", label: "Who's coming", required: true, placeholder: "e.g. Asha" },
    { id: "notes", kind: "text", label: "Notes", multiline: true },
  ] };
  const send = () => screen.getByRole("button", { name: "Send" }) as HTMLButtonElement;

  it("writes one plain message: the title, then a line per field", () => {
    const form = readBlocks([trip])[0] as FormBlock;
    const values = { ...startingValues(form), add: ["Music", "Food stops"], who: "  Asha  " };
    expect(answerMessage(form, values)).toBe(
      "Form: Weekend (trip)\nWhere: Hills\nPace: Easy\nAdd: Music, Food stops\nBudget: 12 k\nWho's coming: Asha\nNotes: (none)");
  });

  it("uses option labels, and (none) for an empty choice or no ticked box", () => {
    const form = readBlocks([{ type: "form", id: "f", fields: [
      { id: "s", kind: "select", label: "Size", options: [{ value: "m", label: "Medium" }] },
      { id: "c", kind: "checkbox", label: "Extras", options: ["Cheese"] },
      { id: "r", kind: "radio", label: "Crust", value: "t", options: [{ value: "t", label: "Thin" }] }] }])[0] as FormBlock;
    expect(answerMessage(form, startingValues(form))).toBe("Form: f\nSize: (none)\nExtras: (none)\nCrust: Thin");
  });

  it("keeps Send off until required fields are filled, sends once, then shows as sent", () => {
    const { send: sent, container } = draw([trip]);
    expect(send().disabled).toBe(true);
    fireEvent.change(screen.getByPlaceholderText("e.g. Asha"), { target: { value: "Asha" } });
    fireEvent.click(screen.getByRole("radio", { name: "Packed" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Food stops" }));
    fireEvent.change(container.querySelector("select")!, { target: { value: "Beach" } });
    fireEvent.change(container.querySelector("input[type=range]")!, { target: { value: "20" } });
    expect(send().disabled).toBe(false);
    fireEvent.click(send());
    expect(sent).toHaveBeenCalledTimes(1);
    expect(sent).toHaveBeenCalledWith(
      "Form: Weekend (trip)\nWhere: Beach\nPace: Packed\nAdd: Music, Food stops\nBudget: 20 k\nWho's coming: Asha\nNotes: (none)");
    expect(container.querySelector("fieldset")!.disabled).toBe(true);
    expect(screen.getByText(/Sent/)).toBeTruthy();
    expect(send().disabled).toBe(true);
    fireEvent.click(send());
    expect(sent).toHaveBeenCalledTimes(1);
  });
});

describe("form message", () => {
  it("puts a group's heading before its fields, joins a multiline answer with \" / \", and names the form", () => {
    const form = readBlocks([{ type: "form", id: "goa", title: "Goa weekend", fields: [
      { id: "dates", kind: "text", label: "Dates", group: "The basics", value: "14-16 Nov" },
      { id: "people", kind: "slider", label: "Travellers", group: "The basics", min: 1, max: 10, value: 2 },
      { id: "pace", kind: "radio", label: "Pace", group: "Your style", value: "easy", options: [{ value: "easy", label: "Easy", note: "Naps" }] },
      { id: "extra", kind: "text", label: "Must-dos", multiline: true },
    ] }])[0] as FormBlock;
    const values = { ...startingValues(form), extra: "Fort Aguada\n  sunset cruise\n" };
    expect(answerMessage(form, values)).toBe(
      "Form: Goa weekend (goa)\n— The basics —\nDates: 14-16 Nov\nTravellers: 2\n— Your style —\nPace: Easy\n" +
      "Must-dos: Fort Aguada / sunset cruise");
  });
});

describe("form extras on screen", () => {
  it("draws a group heading once per run, option notes and slider ends", () => {
    draw([{ type: "form", id: "goa", fields: [
      { id: "a", kind: "text", label: "Dates", group: "The basics" },
      { id: "b", kind: "slider", label: "Budget", group: "The basics", ends: ["Shoestring", "Splurge"] },
      { id: "c", kind: "radio", label: "Pace", group: "Your style", options: [{ value: "easy", label: "Easy", note: "Beach, long lunches" }, "Full"] },
      { id: "d", kind: "select", label: "Stay", value: "villa", options: [{ value: "villa", label: "Villa", note: "Quiet, a pool" }, "Hotel"] },
    ] }]);
    expect(screen.getAllByText("The basics")).toHaveLength(1);
    expect(screen.getAllByText("Your style")).toHaveLength(1);
    expect(screen.getByText("Shoestring")).toBeTruthy();
    expect(screen.getByText("Splurge")).toBeTruthy();
    expect(screen.getByText("Beach, long lunches")).toBeTruthy();
    expect(screen.getByText("Quiet, a pool")).toBeTruthy();
  });
});

describe("form sent state", () => {
  const trip = { type: "form", id: "trip", title: "Weekend", fields: [
    { id: "pace", kind: "radio", label: "Pace", value: "Easy", options: ["Easy", "Packed"] },
    { id: "who", kind: "text", label: "Who", value: "Asha" },
  ] };
  const send = () => screen.getByRole("button", { name: "Send" }) as HTMLButtonElement;

  it("saves Send with the answers under the form's place in the board", async () => {
    const rest = vi.fn(async (_path: string, init?: { method?: string; body?: unknown }) => (init ? { ok: true } : {}));
    const { send: sent } = draw([{ type: "text", text: "First" }, trip], { rest, blockId: "7f3a09bc" });
    await waitFor(() => expect(rest).toHaveBeenCalledWith("/blocks/7f3a09bc/state"));
    fireEvent.click(screen.getByRole("radio", { name: "Packed" }));
    await act(async () => { fireEvent.click(send()); });
    expect(sent).toHaveBeenCalledTimes(1);
    // The draft typed BEFORE the send now files by identity at the edit itself — the sent record's
    // POSITIONAL filing ("1") is the accepted truth, unchanged, riding the same snapshot.
    await waitFor(() => {
      const puts = rest.mock.calls.filter(([, init]) => (init as { method?: string } | undefined)?.method === "PUT");
      const last = puts[puts.length - 1]?.[1] as { body?: { state?: Record<string, unknown> } } | undefined;
      expect(last?.body?.state?.["1"]).toEqual({ sent: true, values: { pace: "Packed", who: "Asha" } });
    });
    const puts = rest.mock.calls.filter(([, init]) => (init as { method?: string } | undefined)?.method === "PUT");
    const lastState = (puts[puts.length - 1]![1] as { body: { state: Record<string, unknown> } }).body.state;
    expect(Object.keys(lastState).some((k) => k.startsWith("k:") && k.endsWith("~v")))
      .toBe(true);  // the unsent draft's identity byte filed at edit time (board-held durability)
  });

  it("shows a form sent before (after a reload) as sent, with its answers, and never sends it again", async () => {
    const saved = { state: { "0": { sent: true, values: { pace: "Packed", who: "Ravi" } } } };
    const rest = vi.fn(async () => saved);
    const { send: sent, container } = draw([trip], { rest, blockId: "7f3a09bc" });
    await waitFor(() => expect(screen.getByText(/Sent/)).toBeTruthy());
    expect(container.querySelector("fieldset")!.disabled).toBe(true);
    expect(screen.getByRole("radio", { name: "Packed" }).getAttribute("aria-checked")).toBe("true");
    expect((container.querySelector("input[type=text]") as HTMLInputElement).value).toBe("Ravi");
    expect(send().disabled).toBe(true);
    fireEvent.click(send());
    expect(sent).not.toHaveBeenCalled();
  });

  it("still sends once and shows as sent when the server can't be reached", async () => {
    const rest = vi.fn(async () => { throw new Error("offline"); });
    const { send: sent } = draw([trip], { rest, blockId: "7f3a09bc" });
    await act(async () => { fireEvent.click(send()); });
    expect(sent).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Sent/)).toBeTruthy();
    expect(screen.queryByText(/offline|error/i)).toBeNull();
    fireEvent.click(send());
    expect(sent).toHaveBeenCalledTimes(1);
  });
});

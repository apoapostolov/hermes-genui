// The interactive table: search narrows rows, headers still sort the survivors, ticks pick rows, and one
// tap sends the picked rows to the chat. A table without `interactive: true` must draw EXACTLY what it drew
// before this feature existed.
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readBlocks } from "../../core/readBlocks";
import { Blocks } from "../../core/Blocks";
import { drawWithActions as draw } from "../../core/testing";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const phones = (extra: object = {}) => [
  {
    type: "table",
    caption: "Phones under ₹50k",
    columns: ["Phone", "Price", "Camera"],
    ...extra,
    rows: [["Pixel 10a", "₹44,999", "Great"], ["Nothing 4", "₹39,999", "OK"], ["Galaxy A56", "₹42,999", "Fine"]],
  },
];
const optIn = { interactive: true };

const shownPhones = (container: HTMLElement) =>
  [...container.querySelectorAll("tbody tr td.hb-first")].map((td) => td.textContent!.trim());

describe("a table without the opt-in draws exactly as before", () => {
  it("grows no search box, no ticks, no send control — only the headers it always had", () => {
    const { container } = render(<Blocks blocks={readBlocks(phones())} />);
    expect(container.querySelector(".hb-table-tools")).toBeNull();
    expect(container.querySelectorAll("input")).toHaveLength(0);
    expect(screen.getAllByRole("button")).toHaveLength(3); // the three column headers, nothing else
    expect(shownPhones(container)).toEqual(["Pixel 10a", "Nothing 4", "Galaxy A56"]);
  });

  it("sorts on the header as it always did", () => {
    const { container } = render(<Blocks blocks={readBlocks(phones())} />);
    fireEvent.click(screen.getByRole("button", { name: /Price/ }));
    expect(shownPhones(container)).toEqual(["Nothing 4", "Galaxy A56", "Pixel 10a"]);
  });
});

describe("the interactive table — filter narrows", () => {
  it("keeps only the rows the query reads, whatever the case, and brings them back when it clears", () => {
    const { container } = draw(phones(optIn));
    const box = screen.getByRole("searchbox", { name: "Filter rows" });
    expect(shownPhones(container)).toHaveLength(3);
    fireEvent.change(box, { target: { value: "nothing" } });
    expect(shownPhones(container)).toEqual(["Nothing 4"]);
    fireEvent.change(box, { target: { value: "42,999" } }); // a word from any cell counts
    expect(shownPhones(container)).toEqual(["Galaxy A56"]);
    fireEvent.change(box, { target: { value: "" } });
    expect(shownPhones(container)).toEqual(["Pixel 10a", "Nothing 4", "Galaxy A56"]);
  });

  it("sorts the survivors: the header orders what the query left", () => {
    const { container } = draw(phones(optIn));
    fireEvent.click(screen.getByRole("button", { name: /Price/ }));
    expect(shownPhones(container)).toEqual(["Nothing 4", "Galaxy A56", "Pixel 10a"]);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "99" } }); // every price has it
    expect(shownPhones(container)).toEqual(["Nothing 4", "Galaxy A56", "Pixel 10a"]);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "44,999" } });
    expect(shownPhones(container)).toEqual(["Pixel 10a"]);
  });

  it("says so plainly when the query keeps nothing", () => {
    const { container } = draw(phones(optIn));
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "foldable" } });
    expect(container.querySelectorAll("tbody tr")).toHaveLength(1);
    expect(container.querySelector("tbody")!.textContent).toContain("Nothing matches “foldable”");
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Pixel" } });
    expect(shownPhones(container)).toEqual(["Pixel 10a"]);
  });
});

describe("the interactive table — selection sends as context", () => {
  it("ticking rows arms the control and one tap posts them to the chat", () => {
    const { send } = draw(phones(optIn));
    const pill = screen.getByRole("button", { name: "Send selected rows as context" });
    expect(pill.hasAttribute("disabled")).toBe(true);
    fireEvent.click(screen.getByRole("checkbox", { name: "Select row Pixel 10a" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Select row Galaxy A56" }));
    expect(pill.hasAttribute("disabled")).toBe(false);
    expect(pill.getAttribute("title")).toBe(
      "Phones under ₹50k:\nPhone | Price | Camera\nPixel 10a | ₹44,999 | Great\nGalaxy A56 | ₹42,999 | Fine",
    );
    fireEvent.click(pill);
    // the selection is the user's own message: it goes through the force path (the real seam is proven
    // end-to-end, submit-vs-draft, in Table.send.test.tsx — this one only pins the exact words sent)
    expect(send.mock.calls).toEqual([
      [
        "Phones under ₹50k:\nPhone | Price | Camera\nPixel 10a | ₹44,999 | Great\nGalaxy A56 | ₹42,999 | Fine",
        { force: true },
      ],
    ]);
  });

  it("keeps a tick through filtering and sorting", () => {
    const { container } = draw(phones(optIn));
    fireEvent.click(screen.getByRole("checkbox", { name: "Select row Nothing 4" }));
    fireEvent.click(screen.getByRole("button", { name: /Price/ }));
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "99" } });
    const ticked = [...container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]:checked')];
    expect(ticked).toHaveLength(1);
    expect(ticked[0].getAttribute("aria-label")).toBe("Select row Nothing 4");
  });
});

describe("the interactive table — a11y", () => {
  it("labels every control it adds", () => {
    draw(phones(optIn));
    expect(screen.getByRole("searchbox", { name: "Filter rows" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Send selected rows as context" })).toBeTruthy();
    for (const name of ["Select row Pixel 10a", "Select row Nothing 4", "Select row Galaxy A56"]) {
      expect(screen.getByRole("checkbox", { name })).toBeTruthy();
    }
    // the column headers stay named buttons with the sort state on their th
    expect(screen.getByRole("button", { name: /Phone/ })).toBeTruthy();
  });
});

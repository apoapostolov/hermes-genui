import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { pinLocale } from "../../lib/locale.testing";
import { readBlocks } from "../../core/readBlocks";
import { Blocks } from "../../core/Blocks";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const stocks = (rows = [["GOOGL", "$279.84", "-18.67%"], ["MSFT", "$521.91", "+1.76%"]]) =>
  readBlocks([{ type: "table", caption: "1 month", columns: ["Stock", "Price", "1mo"], highlight: { row: 1 }, rows }]);
const threeStocks = [["GOOGL", "$279.84", "-18.67%"], ["MSFT", "$521.91", "+1.76%"], ["AAPL", "$230.10", "+9.34%"]];

describe("Table", () => {
  it("draws the caption, headers and a Best chip on the highlighted row", () => {
    const { container } = render(<Blocks blocks={stocks()} />);
    expect(screen.getByText("1 month")).toBeTruthy();
    const best = container.querySelector("tr.hb-best")!;
    expect(best.textContent).toContain("MSFT");
    expect(best.querySelector("td.hb-first .hb-chip")!.textContent).toBe("Best");
  });
  it("sorts by a column when its header is clicked, showing which way", () => {
    const { container } = render(<Blocks blocks={stocks()} />);
    const firstCells = () => [...container.querySelectorAll("tbody tr")].map((r) => r.querySelector("td")!.textContent!.replace("Best", "").trim());
    const header = () => screen.getByRole("button", { name: /1mo/ });
    expect(header().querySelector(".hb-sort")!.textContent).toBe("↕");
    fireEvent.click(header());
    expect(firstCells()).toEqual(["GOOGL", "MSFT"]);
    expect(header().querySelector(".hb-sort")!.textContent).toBe("↑");
    expect(header().closest("th")!.getAttribute("aria-sort")).toBe("ascending");
    fireEvent.click(header());
    expect(firstCells()).toEqual(["MSFT", "GOOGL"]);
    expect(header().querySelector(".hb-sort")!.textContent).toBe("↓");
  });
  it("colours rises and falls in a change column", () => {
    const { container } = render(<Blocks blocks={stocks()} />);
    const cells = [...container.querySelectorAll("tbody td:nth-child(3)")];
    expect(cells.map((td) => td.className.includes("hb-up"))).toEqual([false, true]);
    expect(cells.map((td) => td.className.includes("hb-down"))).toEqual([true, false]);
    expect(container.querySelector("tbody td:nth-child(2)")!.className).not.toMatch(/hb-up|hb-down/);
  });
  it("puts a mini bar before each change from 3 rows up", () => {
    const two = render(<Blocks blocks={stocks()} />);
    expect(two.container.querySelector(".hb-mini")).toBeNull();
    cleanup();
    const { container } = render(<Blocks blocks={stocks(threeStocks)} />);
    const bars = [...container.querySelectorAll("tbody td:nth-child(3) .hb-mini")];
    expect(bars.length).toBe(3);
    expect(bars[0].getAttribute("aria-hidden")).toBe("true");
    expect((bars[0].querySelector(".hb-mini-bar") as HTMLElement).style.width).toBe("50%");
  });
  it("shortens a big amount and keeps every digit in its title", () => {
    pinLocale("en-US");
    const blocks = readBlocks([{ type: "table", columns: ["Company", "Revenue"], rows: [["Acme", "$4,213,500,000"], ["Small Co", "$95,000"]] }]);
    const { container } = render(<Blocks blocks={blocks} />);
    const [big, small] = [...container.querySelectorAll("tbody td:nth-child(2)")];
    expect(big.textContent).toBe("$4.21B");
    expect(big.getAttribute("title")).toBe("$4,213,500,000");
    expect(small.textContent).toBe("$95,000");
    expect(small.getAttribute("title")).toBeNull();
  });
  it("keeps a table of 3 or more columns readable when narrow", () => {
    const { container } = render(<Blocks blocks={stocks()} />);
    expect(container.querySelector("table")!.className).toContain("hb-table-wide");
    cleanup();
    const narrow = render(<Blocks blocks={readBlocks([{ type: "table", columns: ["A", "B"], rows: [["1", "2"]] }])} />);
    expect(narrow.container.querySelector("table")!.className).not.toContain("hb-table-wide");
  });
  it("says so when no row could be read", () => {
    render(<Blocks blocks={readBlocks([{ type: "table", columns: ["A", "B"], rows: [5] }])} />);
    expect(screen.getByText("No rows to show.")).toBeTruthy();
  });
});

describe("structured table", () => {
  const spend = () => readBlocks([{ type: "table", caption: "Spend", filterable: true, columns: [
    { id: "shop", label: "Shop" },
    { id: "spend", label: "Spend", kind: "currency", unit: "$" },
    { id: "share", label: "Share", kind: "percent" },
    { id: "from", label: "From", kind: "sources" },
    { id: "rank", label: "Rank", kind: "bar", max: 10 },
  ], rows: [
    { shop: "A", spend: 1200, share: 40, sources: [{ label: "POS", url: "https://example.org/a" }], rank: 8 },
    { shop: "B", spend: 1800, share: 60, from: "Manual", rank: 10 },
  ], aggregates: [{ column: "spend", op: "sum" }] }]);

  it("formats typed cells, sources and the aggregate footer", () => {
    pinLocale("en-US");
    const { container } = render(<Blocks blocks={spend()} />);
    expect(screen.getAllByText("Spend").length).toBeGreaterThan(0);
    expect(screen.getByText("$1,200")).toBeTruthy();
    expect(screen.getByText("40%")).toBeTruthy();
    expect(screen.getByRole("link", { name: "POS" }).getAttribute("href")).toBe("https://example.org/a");
    expect(container.querySelector("tfoot")!.textContent).toContain("3,000");
    expect(container.querySelector(".hb-table-bar-fill")!.getAttribute("style")).toContain("80%");
  });

  it("filters rows", () => {
    pinLocale("en-US");
    render(<Blocks blocks={spend()} />);
    fireEvent.change(screen.getByRole("searchbox", { name: "Filter rows" }), { target: { value: "Manual" } });
    expect(screen.queryByText("$1,200")).toBeNull();
    expect(screen.getByText("$1,800")).toBeTruthy();
  });

  it("pages after ten rows", () => {
    pinLocale("en-US");
    const rows = Array.from({ length: 12 }, (_, i) => ({ shop: `S${i}`, spend: i + 1 }));
    render(<Blocks blocks={readBlocks([{ type: "table", columns: [{ id: "shop", label: "Shop" }, { id: "spend", label: "Spend", kind: "number" }], rows }])} />);
    expect(screen.getByText("Page 1 of 2")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(screen.getByText("S10")).toBeTruthy();
  });
});

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Blocks } from "../../core/Blocks";
import { readBlocks } from "../../core/readBlocks";

afterEach(cleanup);

const draw = (blocks: unknown[]) => render(<Blocks blocks={readBlocks(blocks)} />).container;

describe("source list", () => {
  it("draws numbered rows with links, kind, accessed date and note", () => {
    const c = draw([{ type: "source", title: "Sources", items: [
      { label: "Screener", url: "https://screener.in/x", kind: "web", accessed: "2026-11-17", note: "Quarterly results" },
      { label: "Local export", kind: "file" },
    ] }]);
    expect(screen.getByText("Sources")).toBeTruthy();
    const link = screen.getByRole("link", { name: "Screener" });
    expect(link.getAttribute("href")).toBe("https://screener.in/x");
    expect(link.getAttribute("rel")).toBe("noreferrer");
    expect(screen.getByText("web").className).toContain("hb-source-kind-web");
    expect(screen.getByText("accessed 2026-11-17")).toBeTruthy();
    expect(screen.getByText("Quarterly results").className).toContain("hb-source-note");
    expect(c.querySelectorAll(".hb-source-row").length).toBe(2);
  });
  it("keeps a plain source line unchanged", () => {
    draw([{ type: "source", text: "screener.in", url: "https://screener.in/x" }]);
    expect(screen.getByRole("link", { name: "screener.in" })).toBeTruthy();
  });
});

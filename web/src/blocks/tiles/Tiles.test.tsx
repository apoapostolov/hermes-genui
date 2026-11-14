import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { forgetBoards } from "../checklist/savedState";
import { drawWithActions as draw } from "../../core/testing";

afterEach(cleanup);
beforeEach(() => forgetBoards());

describe("tiles", () => {
  const tiles = { type: "tiles", items: [
    { title: "Arashiyama", subtitle: "Bamboo grove", icon: "leaf", image: "https://x.example/a.jpg", ask: "Add Arashiyama" },
    { title: "Gion", run: "Add a Gion walk" }] };

  it("fills the composer with ask, sends run", () => {
    const { fill, send } = draw([tiles]);
    fireEvent.click(screen.getByRole("button", { name: /Arashiyama/ }));
    fireEvent.click(screen.getByRole("button", { name: /Gion/ }));
    expect(fill).toHaveBeenCalledWith("Add Arashiyama");
    expect(send).toHaveBeenCalledWith("Add a Gion walk");
    expect(screen.getByText("Bamboo grove")).toBeTruthy();
  });

  it("renders informational tiles as noninteractive gradient cards", () => {
    const { container, fill, send } = draw([{
      type: "tiles",
      items: [
        { title: "Scenic drive", subtitle: "Hudson Valley views" },
        { title: "Village stroll", subtitle: "Browse local shops" },
      ],
    }]);

    const cards = container.querySelectorAll(".hb-tile");
    expect(cards).toHaveLength(2);
    expect(cards[0].tagName).toBe("DIV");
    expect(cards[1].tagName).toBe("DIV");
    expect(cards[0].getAttribute("style")).toContain("linear-gradient");
    expect(screen.queryByRole("button")).toBeNull();
    expect(fill).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it("draws a photo without a referrer, and hides it when it fails to load", () => {
    const { container } = draw([tiles]);
    const img = container.querySelector(".hb-tile img") as HTMLImageElement;
    expect(img.getAttribute("src")).toBe("https://x.example/a.jpg");
    expect(img.getAttribute("referrerpolicy")).toBe("no-referrer");
    fireEvent.error(img);
    expect(container.querySelector(".hb-tile img")).toBeNull();
  });
});

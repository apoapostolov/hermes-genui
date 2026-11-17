/// <reference types="vite/client" />
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { forgetBoards } from "../checklist/savedState";
import { drawWithActions as draw, withStyles } from "../../core/testing";
import tilesCss from "./tiles.css?raw";

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

  // The design the cover asks for (PR #12 review): every card keeps its cover shape — its height comes from its
  // aspect-ratio, never from the text — the reason reads in up to three lines cut between words, and the photo
  // stays bright because only the caption darkens behind the text. Behaviour checks only: exact pixel sizes and
  // rgba values went stale at every design tweak, so nothing here pins one.
  describe("reads at a glance without growing the cover", () => {
    const longReason =
      "Take the 08:12 local to Omiya and the Keihin-Tohoku line direct to Tokyo Station — about 85 minutes, and it skips the shinkansen fare. Arriving before nine leaves the whole morning free for the east side, which the later trains cannot give you.";
    const board = [{ type: "tiles", items: [{ title: "Local train", subtitle: longReason, run: "Book the 08:12 local" }] }];

    it("paints the reason cut between words with an ellipsis, never mid-word", () => {
      const { container } = draw(board);
      const text = container.querySelector(".hb-tile-subtitle")!.textContent!;
      expect(longReason.length).toBeGreaterThan(120);
      expect(text.length).toBeLessThanOrEqual(120);
      expect(text.endsWith("…")).toBe(true);
      const kept = text.slice(0, -1);
      expect(longReason.startsWith(kept)).toBe(true);
      expect(longReason[kept.length]).toMatch(/[\s\p{P}]/u);  // the cut fell on a word boundary, not inside a word
    });

    it("paints no subtitle rather than a sliced word when one unbroken word cannot fit", () => {
      const { container } = draw([{ type: "tiles", items: [{ title: "Kyoto", subtitle: "u".repeat(200), ask: "Plan Kyoto" }] }]);
      expect(container.querySelector(".hb-tile-subtitle")).toBeNull();  // never half a word on the cover
      expect(screen.getByText("Kyoto")).toBeTruthy();                   // the card itself stays, title-only
    });

    it("paints a fitting word whole where the helper cut after its comma", () => {
      // The comma itself is the helper's to drop; the word before it is content the cover must keep.
      const { container } = draw([{
        type: "tiles",
        items: [{ title: "Flights", subtitle: "Airport ".repeat(10) + "express, " + "b".repeat(60), run: "Compare flights" }],
      }]);
      const shown = container.querySelector(".hb-tile-subtitle")!.textContent!;
      expect(shown.endsWith("express…")).toBe(true);   // not trimmed back before a fitting whole word
    });

    it("keeps the cover shape: the card sizes from its aspect-ratio, not from the text", () => {
      const { container } = draw(board);
      const unstyle = withStyles(tilesCss);
      try {
        const style = getComputedStyle(container.querySelector(".hb-tile")!);
        expect(style.aspectRatio, "every card keeps a cover shape").not.toBe("auto");
        expect(style.aspectRatio).toMatch(/\//);              // a ratio, whatever it is
        expect(style.minHeight, "no pixel floor: the ratio, not the text, sizes the card").not.toMatch(/\d/);
      } finally {
        unstyle();
      }
    });

    it("shows up to three lines of the reason", () => {
      const { container } = draw(board);
      const unstyle = withStyles(tilesCss);
      try {
        const style = getComputedStyle(container.querySelector(".hb-tile-subtitle")!);
        expect(style.webkitLineClamp, "the reason reads in up to three lines").toBe("3");
        expect(style.overflow, "anything past the third line is clipped away").toBe("hidden");
      } finally {
        unstyle();
      }
    });

    it("keeps the text full white with a shadow", () => {
      const { container } = draw(board);
      const unstyle = withStyles(tilesCss);
      try {
        const style = getComputedStyle(container.querySelector(".hb-tile-subtitle")!);
        expect(style.color, "full white, never translucent").toMatch(/^(rgb\(255, 255, 255\)|#(?:fff|ffffff))$/i);
        expect(style.textShadow, "a shadow keeps it legible on a bright photo").not.toMatch(/^(none|rgba\(0, 0, 0, 0\))$/);
      } finally {
        unstyle();
      }
    });

    it("darkens only behind the text, so the photo stays bright", () => {
      const { container } = draw(board);
      const unstyle = withStyles(tilesCss);
      try {
        expect(container.querySelector(".hb-tile-shade"), "no overlay dims the whole photo").toBeNull();
        const style = getComputedStyle(container.querySelector(".hb-tile-text")!);
        expect(style.backgroundImage, "the scrim sits behind the caption block alone").toMatch(/gradient/i);
      } finally {
        unstyle();
      }
    });

    it("keeps hover a supplement: the tap message still rides in the native title", () => {
      draw(board);
      expect(screen.getByRole("button", { name: /Local train/ }).getAttribute("title")).toBe("Book the 08:12 local");
    });
  });
});

describe("what a row of tiles is called", () => {
  it("takes the model's group name, and says what it is without one", () => {
    const cards = (raw: object) => draw([{ type: "tiles", ...raw, items: [{ title: "Gion", run: "Add a Gion walk" }, { title: "Nara", run: "Add Nara" }] }]);
    cards({ name: "Pick a walk" });
    expect(screen.getByRole("group", { name: "Pick a walk" })).toBeTruthy();
    cleanup();
    cards({});
    expect(screen.getByRole("group", { name: "Choices" })).toBeTruthy();
  });
});

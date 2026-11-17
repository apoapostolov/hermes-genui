import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { drawWithActions as draw } from "../../core/testing";
import { readBlocks } from "../../core/readBlocks";

afterEach(cleanup);

const BLOCK = { type: "prepared", groups: [{ title: "Anna's birthday", date: "Wed 25 Nov", ideas: [
  { title: "Chocolate layer cake", note: "Fremont bakery", photo: "https://upload.wikimedia.org/a.jpg" },
  { title: "Peonies", photo: "https://upload.wikimedia.org/b.jpg" }],
  ask: { label: "Help me pick a gift", text: "Help me pick a gift for Anna's birthday" } }] };

describe("prepared", () => {
  it("draws a group with photo cards and a button", () => {
    draw([BLOCK]);
    expect(document.querySelector(".hb-prep-head")?.textContent).toContain("Anna's birthday");
    expect(document.querySelectorAll(".hb-prep-idea img")).toHaveLength(2);
    expect(document.querySelector(".hb-prep-idea")?.textContent).toContain("Fremont bakery");
  });

  it("a tap on an idea or the button fills the composer", () => {
    const { fill } = draw([BLOCK]);
    fireEvent.click(screen.getByRole("button", { name: /Chocolate layer cake/ }));
    fireEvent.click(screen.getByRole("button", { name: "Help me pick a gift" }));
    expect(fill).toHaveBeenNthCalledWith(1, "Tell me more about Chocolate layer cake for Anna's birthday");
    expect(fill).toHaveBeenNthCalledWith(2, "Help me pick a gift for Anna's birthday");
  });

  it("drops ideas without an https photo and groups with fewer than two ideas", () => {
    const one = { ...BLOCK.groups[0], ideas: [BLOCK.groups[0].ideas[0], { title: "x", photo: "http://y" }] };
    expect(readBlocks([{ type: "prepared", groups: [one] }])).toEqual([]);
  });

  it("drops an idea whose title would act before the model", () => {
    const [b] = readBlocks([{ type: "prepared", groups: [{ title: "Dinner", ideas: [
      { title: "@file:secrets", photo: "https://upload.wikimedia.org/x.jpg" },
      { title: "Pie", photo: "https://upload.wikimedia.org/y.jpg" },
      { title: "Turkey", photo: "https://upload.wikimedia.org/z.jpg" }] }] }]) as any[];
    expect(b.groups[0].ideas.map((i: any) => i.title)).toEqual(["Pie", "Turkey"]);
  });
});


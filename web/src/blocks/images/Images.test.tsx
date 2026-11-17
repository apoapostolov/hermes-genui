import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { withStyles } from "../../core/testing";
import type { ImagesBlock } from "./read";
import { Images } from "./Images";
import imagesCss from "./images.css?raw";

afterEach(cleanup);

const block: ImagesBlock = { type: "images", title: "Lisbon", images: [
  { url: "https://a.example/alfama.jpg", caption: "Alfama rooftops", source: "a.example" },
  { url: "https://b.example/tram.jpg", caption: "Tram 28", source: "b.example" },
] };

describe("Images", () => {
  it("shows each photo with its caption and credit", () => {
    render(<Images block={block} />);
    expect(screen.getByText("Lisbon")).toBeTruthy();
    expect(screen.getByText("Alfama rooftops")).toBeTruthy();
    expect(screen.getByText("b.example")).toBeTruthy();
    expect(document.querySelectorAll(".hb-photo img").length).toBe(2);
  });

  it("hides a photo that fails to load and keeps the rest", () => {
    render(<Images block={block} />);
    fireEvent.error(document.querySelector('img[src="https://a.example/alfama.jpg"]')!);
    expect(screen.queryByText("Alfama rooftops")).toBeNull();
    expect(screen.getByText("Tram 28")).toBeTruthy();
  });

  it("draws nothing when every photo fails", () => {
    const { container } = render(<Images block={block} />);
    for (const img of [...document.querySelectorAll(".hb-photo img")]) fireEvent.error(img);
    expect(container.innerHTML).toBe("");
  });

  it("opens a photo full size on click and closes it again", () => {
    render(<Images block={block} />);
    fireEvent.click(screen.getByRole("button", { name: /Tram 28/ }));
    const big = document.querySelector(".hb-photo-overlay img") as HTMLImageElement;
    expect(big.getAttribute("src")).toBe("https://b.example/tram.jpg");
    fireEvent.click(document.querySelector(".hb-photo-overlay")!);
    expect(document.querySelector(".hb-photo-overlay")).toBeNull();
  });

  it("offers a download link on each photo without opening the overlay", () => {
    const { container } = render(<Images block={block} />);
    const link = screen.getByRole("link", { name: "Download Tram 28" }) as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("https://b.example/tram.jpg");
    expect(link.hasAttribute("download")).toBe(true);
    fireEvent.click(link);
    expect(container.querySelector(".hb-photo-overlay")).toBeNull();
  });

  it("keeps a strip up to three photos and opens a two-column grid at four", () => {
    const unstyle = withStyles(imagesCss);
    try {
      const three: ImagesBlock = { ...block, images: [...block.images, { url: "https://c.example/third.jpg" }] };
      const small = render(<Images block={three} />).container;
      expect(small.querySelector(".hb-photos")!.className).not.toContain("hb-photos-grid");
      expect(small.querySelector(".hb-photo-strip")!.firstElementChild!.querySelector(".hb-photo-download")!.parentElement!.className).not.toContain("hb-photo-text");
      expect(getComputedStyle(small.querySelector(".hb-photo-strip")!).display).toBe("flex");
      cleanup();
      const four: ImagesBlock = { ...three, images: [...three.images, { url: "https://d.example/fourth.jpg" }] };
      const big = render(<Images block={four} />).container;
      expect(big.querySelector(".hb-photos")!.className).toContain("hb-photos-grid");
      expect(big.querySelector(".hb-photo-strip")!.firstElementChild!.querySelector(".hb-photo-download")!.parentElement!.className).toContain("hb-photo-text");
      expect(getComputedStyle(big.querySelector(".hb-photo-strip")!).display).toBe("grid");
      expect(getComputedStyle(big.querySelector(".hb-photo-download")!).position).toBe("static");
      expect(getComputedStyle(big.querySelector(".hb-photo-strip")!).overflow).toBe("visible");
      expect(screen.getAllByRole("link", { name: /^Download / }).length).toBe(4);
    } finally {
      unstyle();
    }
  });
});

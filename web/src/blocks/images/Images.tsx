// A strip of real photos, each with its caption and credit. A photo that fails to load (a dead link, a hotlink
// block) hides itself; when none load the strip disappears. Clicking one opens it full size.
import { useEffect, useState } from "react";
import type { ImagesBlock, Photo } from "./read";

const GRID_FROM = 4; // four or more pictures open a compact grid; no layout field for the model to write

export function Images({ block }: { block: ImagesBlock }) {
  const [failed, setFailed] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<Photo | null>(null);
  const shown = block.images.filter((p) => !failed.has(p.url));
  if (!shown.length) return null;
  const fail = (url: string) => setFailed((before) => new Set(before).add(url));
  const grid = shown.length >= GRID_FROM;
  const download = (p: Photo) => (
    <a className="hb-photo-download" href={p.url} download={p.caption || "photo"} aria-label={`Download ${p.caption ?? "photo"}`}
       onClick={(e) => e.stopPropagation()}><span aria-hidden="true">↓</span></a>
  );

  return (
    <figure className={grid ? "hb-photos hb-photos-grid" : "hb-photos"}>
      {block.title && <figcaption className="hb-chart-title">{block.title}</figcaption>}
      <div className="hb-photo-strip">
        {shown.map((p) => grid ? (
          <div key={p.url} className="hb-photo">
            <button type="button" className="hb-photo-open" onClick={() => setOpen(p)} aria-label={p.caption ?? "Open photo"}>
              <img src={p.url} alt={p.caption ?? ""} loading="lazy" referrerPolicy="no-referrer" onError={() => fail(p.url)} />
            </button>
            <div className="hb-photo-text">
              <button type="button" className="hb-photo-label" onClick={() => setOpen(p)}>
                {p.caption && <span className="hb-photo-caption">{p.caption}</span>}
                {p.source && <span className="hb-photo-source">{p.source}</span>}
              </button>
              {download(p)}
            </div>
          </div>
        ) : (
          <div key={p.url} className="hb-photo">
            <button type="button" className="hb-photo-open" onClick={() => setOpen(p)} aria-label={p.caption ?? "Open photo"}>
              <img src={p.url} alt={p.caption ?? ""} loading="lazy" referrerPolicy="no-referrer" onError={() => fail(p.url)} />
              {(p.caption || p.source) && (
                <span className="hb-photo-text">
                  {p.caption && <span className="hb-photo-caption">{p.caption}</span>}
                  {p.source && <span className="hb-photo-source">{p.source}</span>}
                </span>
              )}
            </button>
            {download(p)}
          </div>
        ))}
      </div>
      {open && <Overlay photo={open} onClose={() => setOpen(null)} />}
    </figure>
  );
}

/** The photo full size, fixed over the window (plugins get no react-dom, so no portal); a click anywhere
 *  or Escape closes it. */
function Overlay({ photo, onClose }: { photo: Photo; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="hb-photo-overlay" role="dialog" aria-label={photo.caption ?? "Photo"} onClick={onClose}>
      <img src={photo.url} alt={photo.caption ?? ""} referrerPolicy="no-referrer" />
      {(photo.caption || photo.source) && (
        <div className="hb-photo-overlay-text">
          {photo.caption}
          {photo.source && <span> · {photo.source}</span>}
        </div>
      )}
    </div>
  );
}

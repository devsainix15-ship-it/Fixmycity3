import { useState } from "react";

const src = (u) => (!u ? u : u.startsWith("http") ? u : `${process.env.REACT_APP_BACKEND_URL}${u}`);

export default function MediaGallery({ media = [], legacyImage, compact = false }) {
  const items = media.length ? media : legacyImage ? [{ url: legacyImage, type: "image" }] : [];
  const [active, setActive] = useState(0);
  if (!items.length) return null;
  const cur = items[Math.min(active, items.length - 1)];

  return (
    <div data-testid="media-gallery">
      {cur.type === "video" && !compact
        ? <video src={src(cur.url)} poster={src(cur.thumbnail_url)} controls playsInline preload="metadata" className="w-full rounded-xl" />
        : <img src={src(cur.type === "video" ? cur.thumbnail_url : cur.url)} alt="" className="w-full rounded-xl object-cover" loading="lazy" />}
      {items.length > 1 && (
        <div className="flex gap-2 mt-2 overflow-x-auto">
          {items.map((m, idx) => (
            <button key={idx} onClick={() => setActive(idx)} data-testid={`media-thumb-${idx}`}
              className={`h-14 w-14 shrink-0 rounded-md overflow-hidden border ${idx === active ? "border-cyan-400" : "border-transparent"}`}>
              <img src={src(m.type === "video" ? m.thumbnail_url : m.url)} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
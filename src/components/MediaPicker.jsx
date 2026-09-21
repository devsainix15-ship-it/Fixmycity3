import { useEffect, useState } from "react";
import { uploadFile } from "../lib/upload";
import { videoPoster } from "../lib/videoPoster";

const IMG = ["image/jpeg", "image/png", "image/webp"];
const VID = ["video/mp4", "video/webm", "video/quicktime"];
const MAX_PHOTOS = 5, MAX_IMG = 10 * 1024 ** 2, MAX_VID = 50 * 1024 ** 2;

export default function MediaPicker({ onChange }) {
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => { onChange(items); }, [items]); // eslint-disable-line

  const update = (id, patch) =>
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  async function startUpload(item) {
    try {
      const res = await uploadFile(item.file, (p) => update(item.id, { progress: p }));
      let thumbnail_url = null;
      if (item.type === "video") {
        try {
          const blob = await videoPoster(item.file);
          const poster = await uploadFile(new File([blob], "poster.jpg", { type: "image/jpeg" }));
          thumbnail_url = poster.url;
        } catch { /* poster is optional */ }
      }
      update(item.id, { status: "done", progress: 100, url: res.url, thumbnail_url });
    } catch {
      update(item.id, { status: "error" });
    }
  }

  function onPick(e) {
    const files = Array.from(e.target.files);
    e.target.value = "";
    setError("");
    let photos = items.filter((i) => i.type === "image").length;
    let videos = items.filter((i) => i.type === "video").length;

    for (const file of files) {
      const isImg = IMG.includes(file.type), isVid = VID.includes(file.type);
      if (!isImg && !isVid) { setError(`${file.name}: unsupported file type`); continue; }
      if (file.size > (isImg ? MAX_IMG : MAX_VID)) { setError(`${file.name}: file too large`); continue; }
      if (isImg && photos >= MAX_PHOTOS) { setError(`Max ${MAX_PHOTOS} photos`); continue; }
      if (isVid && videos >= 1) { setError("Only 1 video allowed"); continue; }
      isImg ? photos++ : videos++;

      const item = {
        id: crypto.randomUUID(), file,
        type: isImg ? "image" : "video",
        previewUrl: URL.createObjectURL(file),
        status: "uploading", progress: 0,
      };
      setItems((prev) => [...prev, item]);
      startUpload(item);           // not awaited, so uploads run in parallel
    }
  }

  function remove(id) {
    setItems((prev) => {
      const gone = prev.find((i) => i.id === id);
      if (gone) URL.revokeObjectURL(gone.previewUrl);
      return prev.filter((i) => i.id !== id);
    });
  }

  return (
    <div>
      <input type="file" multiple
        accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
        onChange={onPick} data-testid="report-media-input" />
      {error && <p className="text-rose-400 text-sm" data-testid="report-media-error">{error}</p>}
      <div className="grid grid-cols-3 gap-2 mt-3">
        {items.map((i) => (
          <div key={i.id} className="relative rounded-lg overflow-hidden" data-testid={`media-item-${i.id}`}>
            {i.type === "image"
              ? <img src={i.previewUrl} alt="" className="h-24 w-full object-cover" />
              : <video src={i.previewUrl} muted className="h-24 w-full object-cover" />}
            {i.status === "uploading" && <div className="absolute bottom-0 left-0 h-1 bg-cyan-400" style={{ width: `${i.progress}%` }} />}
            {i.status === "error" && <div className="absolute inset-0 bg-rose-900/70 grid place-items-center text-xs">Failed</div>}
            <button type="button" onClick={() => remove(i.id)}
              className="absolute top-1 right-1 bg-black/60 rounded-full px-2" data-testid={`media-remove-${i.id}`}>✕</button>
          </div>
        ))}
      </div>
    </div>
  );
}
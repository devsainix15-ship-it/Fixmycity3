import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ImagePlus, ScanSearch, Sparkles, LocateFixed, Send, Loader2, MapPin } from "lucide-react";
import { toast } from "sonner";
import api, { imgUrl } from "../api";
import { useAuth } from "../context/AuthContext";
import { CATEGORIES, CATEGORY_META } from "../components/CategoryTag";
import IssueMap from "../components/IssueMap";
import MediaPicker from "@/components/MediaPicker";

const DEFAULT_POS = { lat: 12.9716, lng: 77.5946 };

export default function Report() {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [preview, setPreview] = useState(null);
  const [imageUrl, setImageUrl] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [ai, setAi] = useState(null);
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [area, setArea] = useState("");
  const [address, setAddress] = useState("");
  const [pos, setPos] = useState(DEFAULT_POS);
  const [submitting, setSubmitting] = useState(false);

  const runAiClassification = async (targetUrl) => {
  setScanning(true);
  setAi(null);
  const start = Date.now();
  try {
    const { data } = await api.post("/issues/classify", {
      image_url: targetUrl,
      description,
    });
    const wait = Math.max(0, 1900 - (Date.now() - start));
    setTimeout(() => {
      setAi(data);
      if (data?.category) setCategory(data.category);
      setScanning(false);
    }, wait);
  } catch {
    setScanning(false);
    toast.error("AI scan unavailable — please pick a category manually");
  }
};

useEffect(() => {
  // Finds the first done photo, or the first done video that has a thumbnail
  const first = media.find(
    (m) => m.status === "done" && (m.type === "image" || m.thumbnail_url)
  );
  const scanUrl = first && (first.type === "image" ? first.url : first.thumbnail_url);

  // Run only when a new scanUrl becomes available
  if (scanUrl && scanUrl !== imageUrl) {
    setImageUrl(scanUrl);

    // If first has previewUrl, set it so the neon scanner can animate over it
    if (first.previewUrl) {
      setPreview(first.previewUrl);
    }

    runAiClassification(scanUrl);
  }
}, [media, imageUrl]);

  const onPhoto = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setPreview(URL.createObjectURL(f));
    setScanning(true);
    setAi(null);
    const start = Date.now();
    try {
      const fd = new FormData();
      fd.append("file", f);
      const { data } = await api.post("/upload", fd);
      setImageUrl(data.url);
      const c = await api.post("/issues/classify", { image_url: data.url, description });
      const wait = Math.max(0, 1900 - (Date.now() - start));
      setTimeout(() => {
        setAi(c.data);
        setCategory(c.data.category);
        setScanning(false);
      }, wait);
    } catch {
      setScanning(false);
      toast.error("AI scan unavailable — please pick a category manually");
    }
  };

  const locate = () => {
    navigator.geolocation?.getCurrentPosition(
      (p) => {
        setPos({ lat: +p.coords.latitude.toFixed(6), lng: +p.coords.longitude.toFixed(6) });
        toast.success("Location locked from GPS");
      },
      () => toast.error("GPS unavailable — tap or drag the pin instead")
    );
  };

  const submit = async () => {
    if (uploading) return;
    if (!description.trim()) return toast.error("Add a short description of the issue");
    setSubmitting(true);

    const payloadMedia = media
      .filter((m) => m.status === "done")
      .map(({ url, type, thumbnail_url }) => ({ url, type, thumbnail_url }));
    await api.post("/issues", { ...formFields, media: payloadMedia });

    try {
      await api.post("/issues", {
        description: description.trim(),
        category: category || "other",
        lat: pos.lat,
        lng: pos.lng,
        area: area.trim(),
        address: address.trim(),
        image_url: imageUrl,
        media: payloadMedia, // <--- Step 7 payload
        ai_confidence: ai?.confidence ?? null,
      });
      await refresh();
      toast.success("Report submitted — you earned +10 points!");
      navigate("/my");
    } catch (e) {
      toast.error("Couldn't submit the report");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div data-testid="report-page" className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Report an Issue</h1>
        <p className="text-sm text-slate-400">Snap it, let AI tag it, drop the pin. Done in 30 seconds.</p>
      </div>

      <section className="glass p-5">
        <p className="label-cap mb-3">1 · Photo evidence</p>
        {/* In your JSX form */}
        <MediaPicker onChange={setMedia} />

        <button 
          type="submit" 
          disabled={uploading} 
          data-testid="report-submit"
          className="disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Submit
        </button>
        {!preview ? (
          <label
            htmlFor="photo-input"
            data-testid="report-photo-dropzone"
            className="flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-white/15 py-12 transition-all hover:border-cyan-400/50 hover:bg-cyan-400/5"
          >
            <span className="grid h-14 w-14 place-items-center rounded-2xl border border-cyan-400/30 bg-cyan-400/10">
              <ImagePlus className="h-6 w-6 text-cyan-300" />
            </span>
            <span className="text-sm font-medium text-slate-300">Tap to snap or upload a photo</span>
            <span className="text-xs text-slate-500">AI will auto-detect the issue category</span>
          </label>
        ) : (
          <div className="relative overflow-hidden rounded-2xl">
            <img src={preview} alt="Issue" className="max-h-72 w-full object-cover" />
            <AnimatePresence>
              {scanning && (
                <motion.div
                  data-testid="ai-scan-overlay"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="pointer-events-none absolute inset-0"
                >
                  <div className="ai-scan-line absolute left-0 right-0 h-20 bg-gradient-to-b from-cyan-500/0 via-cyan-400/50 to-cyan-500/0" />
                  <div className="absolute inset-0 border-2 border-cyan-400/60 shadow-[inset_0_0_40px_rgba(0,240,255,0.15)]" />
                  <div className="absolute bottom-3 left-3 chip border-cyan-400/40 bg-slate-950/85 text-cyan-300">
                    <ScanSearch className="h-3.5 w-3.5 animate-spin-slow" /> AI analyzing photo…
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            {!scanning && (
              <label htmlFor="photo-input" className="absolute right-3 top-3 cursor-pointer chip border-white/20 bg-slate-950/80 text-slate-200 hover:text-cyan-300">
                Retake
              </label>
            )}
          </div>
        )}

        <AnimatePresence>
          {ai && (
            <motion.div
              data-testid="ai-category-result"
              initial={{ opacity: 0, y: 12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className="mt-4 rounded-xl border border-cyan-400/30 bg-cyan-400/5 p-4 shadow-[0_0_24px_rgba(0,240,255,0.1)]"
            >
              <div className="flex items-center gap-2 text-sm font-semibold text-cyan-300">
                <Sparkles className="h-4 w-4" />
                AI detected: {CATEGORY_META[ai.category]?.label}
                <span className="chip border-cyan-400/30 bg-cyan-400/10 text-cyan-200">{Math.round(ai.confidence * 100)}% sure</span>
              </div>
              {ai.reason && <p className="mt-1.5 text-xs text-slate-400">{ai.reason}</p>}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-4">
          <p className="mb-2 text-xs font-medium text-slate-400">Category {ai ? "(AI suggestion — tap to change)" : ""}</p>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => {
              const M = CATEGORY_META[c];
              const Icon = M.icon;
              return (
                <button
                  key={c}
                  data-testid={`report-category-${c}`}
                  onClick={() => setCategory(c)}
                  className={`chip transition-all ${category === c ? "border-cyan-400/60 bg-cyan-400/15 text-cyan-300 shadow-[0_0_12px_rgba(0,240,255,0.2)]" : "border-white/10 bg-white/5 text-slate-400 hover:text-slate-200"}`}
                >
                  <Icon className="h-3.5 w-3.5" /> {M.label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="glass p-5">
        <div className="mb-3 flex items-center justify-between">
          <p className="label-cap">2 · Location</p>
          <button data-testid="report-gps-button" onClick={locate} className="btn-ghost !px-3 !py-1.5 !text-xs">
            <LocateFixed className="h-3.5 w-3.5" /> Use my GPS
          </button>
        </div>
        <div className="h-52 overflow-hidden rounded-xl border border-white/10">
          <IssueMap
            center={[pos.lat, pos.lng]}
            zoom={14}
            pickerPos={pos}
            onPick={(lat, lng) => setPos({ lat: +lat.toFixed(6), lng: +lng.toFixed(6) })}
          />
        </div>
        <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
          <MapPin className="h-3.5 w-3.5 text-cyan-400" /> Tap the map or drag the pin to fine-tune · {pos.lat}, {pos.lng}
        </p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <input data-testid="report-area-input" className="input-dark" placeholder="Area (e.g. Koramangala)" value={area} onChange={(e) => setArea(e.target.value)} />
          <input data-testid="report-address-input" className="input-dark" placeholder="Landmark / street" value={address} onChange={(e) => setAddress(e.target.value)} />
        </div>
      </section>

      <section className="glass p-5">
        <p className="label-cap mb-3">3 · What's happening?</p>
        <textarea
          data-testid="report-description-input"
          className="input-dark min-h-[96px] resize-none"
          placeholder="e.g. Huge pothole near the bus stop, two-wheelers are skidding…"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={400}
        />
        <div className="mt-1 flex justify-between text-[11px] text-slate-500">
          <span>Keep it short — a photo says the rest</span>
          <span>{description.length}/400</span>
        </div>
      </section>

      <button data-testid="report-submit-button" onClick={submit} disabled={submitting || scanning} className="btn-primary w-full !py-3.5 !text-base">
        {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
        Submit Report · Earn 10 pts
      </button>
    </div>
  );
}

import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowBigUp, MapPin, Clock, Wrench, ChevronLeft, ChevronRight, Video } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import StatusBadge from "./StatusBadge";
import CategoryTag from "./CategoryTag";
import { imgUrl } from "../api";

// New issues have `media` ([{url, type, thumbnail_url}]). Older data only has `image_url`.
function getMedia(issue) {
  if (Array.isArray(issue.media) && issue.media.length > 0) return issue.media;
  if (issue.image_url) return [{ url: issue.image_url, type: "image", thumbnail_url: null }];
  return [];
}

function MediaGallery({ issue, media }) {
  const scrollRef = useRef(null);
  const [active, setActive] = useState(0);
  const many = media.length > 1;

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el || !el.clientWidth) return;
    const next = Math.round(el.scrollLeft / el.clientWidth);
    if (next !== active) {
      setActive(next);
      // stop any video that was swiped out of view
      el.querySelectorAll("video").forEach((v) => v.pause());
    }
  };

  const goTo = (i) => {
    const el = scrollRef.current;
    if (!el) return;
    const target = Math.max(0, Math.min(media.length - 1, i));
    el.scrollTo({ left: target * el.clientWidth, behavior: "smooth" });
  };

  return (
    <div
      className="group relative h-44 overflow-hidden bg-black/40"
      data-testid={`issue-media-gallery-${issue.id}`}
    >
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex h-full snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {media.map((m, i) => (
          <div
            key={`${m.url}-${i}`}
            data-testid={`issue-media-item-${issue.id}-${i}`}
            className="h-full w-full shrink-0 snap-center"
          >
            {m.type === "video" ? (
              <video
                src={imgUrl(m.url)}
                poster={m.thumbnail_url ? imgUrl(m.thumbnail_url) : undefined}
                controls
                playsInline
                preload="metadata"
                className="h-full w-full bg-black object-cover"
              />
            ) : (
              <img
                src={imgUrl(m.url)}
                alt={`${issue.category} ${i + 1}`}
                className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
                loading="lazy"
              />
            )}
          </div>
        ))}
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between bg-gradient-to-b from-black/60 to-transparent p-3">
        <CategoryTag category={issue.category} />
        <StatusBadge status={issue.status} />
      </div>

      {many && (
        <>
          <span
            data-testid={`issue-media-counter-${issue.id}`}
            className="pointer-events-none absolute right-3 top-12 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-semibold text-slate-200 backdrop-blur"
          >
            {media[active]?.type === "video" && <Video className="h-3 w-3 text-cyan-300" />}
            {active + 1}/{media.length}
          </span>
          {active > 0 && (
            <button
              type="button"
              aria-label="Previous media"
              data-testid={`issue-media-prev-${issue.id}`}
              onClick={() => goTo(active - 1)}
              className="absolute left-2 top-1/2 hidden -translate-y-1/2 rounded-full bg-black/60 p-1 text-white transition-opacity group-hover:block"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}
          {active < media.length - 1 && (
            <button
              type="button"
              aria-label="Next media"
              data-testid={`issue-media-next-${issue.id}`}
              onClick={() => goTo(active + 1)}
              className="absolute right-2 top-1/2 hidden -translate-y-1/2 rounded-full bg-black/60 p-1 text-white transition-opacity group-hover:block"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          )}
        </>
      )}
    </div>
  );
}

export default function IssueCard({ issue, index = 0, onUpvote }) {
  const media = getMedia(issue);
  const hasMedia = media.length > 0;

  return (
    <motion.article
      data-testid={`issue-card-${issue.id}`}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.06, 0.6), duration: 0.45, ease: "easeOut" }}
      className="glass overflow-hidden hover:border-white/20 transition-colors duration-300"
    >
      {hasMedia && <MediaGallery issue={issue} media={media} />}
      <div className="p-4 space-y-3">
        {!hasMedia && (
          <div className="flex items-center gap-2">
            <CategoryTag category={issue.category} />
            <StatusBadge status={issue.status} />
          </div>
        )}
        <p className="text-sm text-slate-200 leading-relaxed line-clamp-3">{issue.description}</p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5 text-cyan-400" />
            {issue.area}
            {issue.distance_km != null && <span className="text-cyan-300">· {issue.distance_km} km</span>}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {issue.created_at ? formatDistanceToNow(new Date(issue.created_at), { addSuffix: true }) : ""}
          </span>
        </div>
        {issue.assigned_to && (
          <div className="inline-flex items-center gap-1.5 text-xs text-violet-300">
            <Wrench className="h-3.5 w-3.5" />
            {issue.assigned_to.name} · {issue.assigned_to.dept}
          </div>
        )}
        <div className="flex items-center justify-between pt-1 border-t border-white/5">
          <div className="flex items-center gap-2 pt-2">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-cyan-500/30 to-violet-500/30 text-[11px] font-bold text-cyan-200 border border-white/10">
              {(issue.author?.name || "C").slice(0, 1)}
            </span>
            <span className="text-xs text-slate-400">{issue.author?.name}</span>
          </div>
          <button
            data-testid={`upvote-btn-${issue.id}`}
            onClick={() => onUpvote && onUpvote(issue)}
            className={`mt-2 inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all duration-200 active:scale-90 ${
              issue.upvoted
                ? "border-cyan-400/60 bg-cyan-400/15 text-cyan-300 shadow-[0_0_14px_rgba(0,240,255,0.25)]"
                : "border-white/10 bg-white/5 text-slate-300 hover:border-cyan-400/40 hover:text-cyan-300"
            }`}
          >
            <ArrowBigUp className={`h-4 w-4 ${issue.upvoted ? "fill-cyan-400/40" : ""}`} />
            {issue.upvotes}
          </button>
        </div>
      </div>
    </motion.article>
  );
}
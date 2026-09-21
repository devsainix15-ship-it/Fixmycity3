import { useEffect, useState } from "react";
import { ArrowBigUp, MapPin } from "lucide-react";
import api, { imgUrl } from "../api";
import IssueMap, { STATUS_COLORS } from "../components/IssueMap";
import StatusBadge from "../components/StatusBadge";
import CategoryTag from "../components/CategoryTag";

const FILTERS = ["all", "Pending", "Assigned", "In Progress", "Resolved"];

export default function MapView() {
  const [issues, setIssues] = useState([]);
  const [statusF, setStatusF] = useState("all");

  useEffect(() => {
    const params = statusF !== "all" ? { status: statusF } : {};
    api.get("/issues", { params }).then((r) => setIssues(r.data)).catch(() => {});
  }, [statusF]);

  const popup = (i) => (
    <div className="space-y-2">
      {i.image_url && <img src={imgUrl(i.image_url)} alt="" className="h-24 w-full rounded-lg object-cover" />}
      <div className="flex items-center gap-1.5">
        <CategoryTag category={i.category} />
        <StatusBadge status={i.status} pulse={false} />
      </div>
      <p className="text-xs leading-snug text-slate-300">{i.description}</p>
      <div className="flex items-center justify-between text-[11px] text-slate-400">
        <span className="inline-flex items-center gap-1">
          <MapPin className="h-3 w-3 text-cyan-400" /> {i.area}
        </span>
        <span className="inline-flex items-center gap-1 font-semibold text-cyan-300">
          <ArrowBigUp className="h-3.5 w-3.5" /> {i.upvotes}
        </span>
      </div>
    </div>
  );

  return (
    <div data-testid="map-view" className="relative h-full w-full">
      <IssueMap issues={issues} renderPopup={popup} className="h-full w-full" />

      <div className="absolute left-1/2 top-3 z-[500] flex -translate-x-1/2 gap-1.5 overflow-x-auto rounded-2xl border border-white/10 bg-[#0B0F16]/85 p-1.5 backdrop-blur-xl">
        {FILTERS.map((s) => (
          <button
            key={s}
            data-testid={`map-filter-${s.toLowerCase().replace(/\s+/g, "-")}`}
            onClick={() => setStatusF(s)}
            className={`whitespace-nowrap rounded-xl px-3 py-1.5 text-[11px] font-semibold transition-all ${
              statusF === s ? "bg-cyan-400/15 text-cyan-300 shadow-[0_0_12px_rgba(0,240,255,0.2)]" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {s === "all" ? "All" : s}
          </button>
        ))}
      </div>

      <div className="absolute bottom-4 right-3 z-[500] space-y-1.5 rounded-2xl border border-white/10 bg-[#0B0F16]/85 p-3 backdrop-blur-xl">
        {Object.entries(STATUS_COLORS).map(([s, c]) => (
          <div key={s} className="flex items-center gap-2 text-[11px] font-medium text-slate-300">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: c, boxShadow: `0 0 8px ${c}` }} />
            {s}
          </div>
        ))}
      </div>
    </div>
  );
}

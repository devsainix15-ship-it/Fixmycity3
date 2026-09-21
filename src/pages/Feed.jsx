import { useCallback, useEffect, useState } from "react";
import { LocateFixed, RefreshCw, SearchX } from "lucide-react";
import { toast } from "sonner";
import api from "../api";
import IssueCard from "../components/IssueCard";
import { CATEGORIES, CATEGORY_META } from "../components/CategoryTag";

const STATUS_OPTS = ["all", "Pending", "Assigned", "In Progress", "Resolved"];

export default function Feed() {
  const [issues, setIssues] = useState(null);
  const [cat, setCat] = useState("all");
  const [statusF, setStatusF] = useState("all");
  const [sort, setSort] = useState("recent");
  const [loc, setLoc] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (showSpin = false) => {
      if (showSpin) setRefreshing(true);
      try {
        const params = { sort };
        if (cat !== "all") params.category = cat;
        if (statusF !== "all") params.status = statusF;
        if (loc) {
          params.lat = loc.lat;
          params.lng = loc.lng;
        }
        const { data } = await api.get("/issues", { params });
        setIssues(data);
      } catch (e) {
        toast.error("Couldn't load the feed");
      } finally {
        setRefreshing(false);
      }
    },
    [cat, statusF, sort, loc]
  );

  useEffect(() => {
    load();
  }, [load]);

  const locate = () => {
    if (!navigator.geolocation) return toast.error("Geolocation not supported");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLoc({ lat: p.coords.latitude, lng: p.coords.longitude });
        setSort("nearest");
        toast.success("Showing issues nearest to you");
      },
      () => toast.error("Location unavailable")
    );
  };

  const upvote = async (issue) => {
    try {
      const { data } = await api.post(`/issues/${issue.id}/upvote`);
      setIssues((list) => list.map((i) => (i.id === data.id ? { ...i, upvotes: data.upvotes, upvoted: data.upvoted } : i)));
    } catch {
      toast.error("Couldn't register your vote");
    }
  };

  return (
    <div data-testid="feed-page" className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Community Feed</h1>
          <p className="text-sm text-slate-400">What your neighbors are reporting</p>
        </div>
        <div className="flex gap-2">
          <button
            data-testid="feed-near-me-button"
            onClick={locate}
            className={`grid h-10 w-10 place-items-center rounded-xl border transition-all ${
              loc ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-300" : "border-white/10 bg-white/5 text-slate-400 hover:text-cyan-300"
            }`}
            title="Near me"
          >
            <LocateFixed className="h-4.5 w-4.5" />
          </button>
          <button
            data-testid="feed-refresh-button"
            onClick={() => load(true)}
            className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/5 text-slate-400 transition-all hover:text-cyan-300"
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button
          data-testid="filter-category-all"
          onClick={() => setCat("all")}
          className={`chip transition-all ${cat === "all" ? "border-cyan-400/60 bg-cyan-400/15 text-cyan-300" : "border-white/10 bg-white/5 text-slate-400"}`}
        >
          All
        </button>
        {CATEGORIES.map((c) => {
          const M = CATEGORY_META[c];
          const Icon = M.icon;
          return (
            <button
              key={c}
              data-testid={`filter-category-${c}`}
              onClick={() => setCat(c)}
              className={`chip transition-all ${cat === c ? "border-cyan-400/60 bg-cyan-400/15 text-cyan-300" : "border-white/10 bg-white/5 text-slate-400"}`}
            >
              <Icon className="h-3.5 w-3.5" /> {M.label}
            </button>
          );
        })}
      </div>

      <div className="flex gap-2">
        <select data-testid="filter-status-select" value={statusF} onChange={(e) => setStatusF(e.target.value)} className="input-dark !w-auto !py-2 text-xs">
          {STATUS_OPTS.map((s) => (
            <option key={s} value={s}>
              {s === "all" ? "All statuses" : s}
            </option>
          ))}
        </select>
        <select data-testid="filter-sort-select" value={sort} onChange={(e) => setSort(e.target.value)} className="input-dark !w-auto !py-2 text-xs">
          <option value="recent">Most recent</option>
          <option value="top">Most upvoted</option>
          <option value="nearest" disabled={!loc}>
            Nearest {loc ? "" : "(enable location)"}
          </option>
        </select>
      </div>

      {issues === null ? (
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="glass h-64 animate-pulse" />
          ))}
        </div>
      ) : issues.length === 0 ? (
        <div className="glass flex flex-col items-center gap-3 py-16 text-center">
          <SearchX className="h-10 w-10 text-slate-600" />
          <p className="text-sm text-slate-400">No issues match these filters. Be the first to report one!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {issues.map((issue, i) => (
            <IssueCard key={issue.id} issue={issue} index={i} onUpvote={upvote} />
          ))}
        </div>
      )}
    </div>
  );
}

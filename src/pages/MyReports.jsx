import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Award, MapPin, Plus, Sparkles } from "lucide-react";
import { format } from "date-fns";
import api, { imgUrl } from "../api";
import { useAuth } from "../context/AuthContext";
import StatusBadge from "../components/StatusBadge";
import CategoryTag from "../components/CategoryTag";
import CountUp from "../components/CountUp";

const DOT = {
  Pending: "bg-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.8)]",
  Assigned: "bg-violet-400 shadow-[0_0_8px_rgba(139,92,246,0.8)]",
  "In Progress": "bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.8)]",
  Resolved: "bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]",
};

function Timeline({ timeline }) {
  return (
    <div className="mt-3 space-y-0 border-l border-white/10 pl-4">
      {(timeline || []).map((t, i) => (
        <div key={i} className="relative pb-3 last:pb-0">
          <span className={`absolute -left-[21.5px] top-1 h-2.5 w-2.5 rounded-full ${DOT[t.status] || DOT.Pending}`} />
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-200">{t.status}</span>
            {t.at && <span className="text-[10px] text-slate-500">{format(new Date(t.at), "dd MMM, hh:mm a")}</span>}
          </div>
          {t.note && <p className="text-[11px] text-slate-500">{t.note}</p>}
        </div>
      ))}
    </div>
  );
}

export default function MyReports() {
  const { user, refresh } = useAuth();
  const [issues, setIssues] = useState(null);

  useEffect(() => {
    refresh();
    api.get("/issues/mine").then((r) => setIssues(r.data)).catch(() => setIssues([]));
  }, []); // eslint-disable-line

  return (
    <div data-testid="my-reports-page" className="space-y-5">
      <h1 className="font-display text-2xl font-bold tracking-tight">My Reports</h1>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="glass relative overflow-hidden p-5">
        <div className="orb -right-10 -top-10 h-40 w-40 bg-cyan-500 opacity-20" />
        <div className="flex items-center justify-between">
          <div>
            <p className="label-cap">Civic score</p>
            <p className="font-display mt-1 text-3xl font-extrabold text-cyan-300">
              <CountUp value={user?.points ?? 0} />
              <span className="ml-1 text-sm font-semibold text-slate-400">pts</span>
            </p>
          </div>
          <span className="grid h-12 w-12 place-items-center rounded-2xl border border-cyan-400/30 bg-cyan-400/10">
            <Sparkles className="h-6 w-6 text-cyan-300" />
          </span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2" data-testid="my-badges">
          {(user?.badges || []).length === 0 ? (
            <span className="text-xs text-slate-500">Report issues to unlock badges</span>
          ) : (
            user.badges.map((b) => (
              <span key={b} data-testid={`badge-${b.toLowerCase().replace(/\s+/g, "-")}`} className="chip border-violet-400/30 bg-violet-400/10 text-violet-300">
                <Award className="h-3.5 w-3.5" /> {b}
              </span>
            ))
          )}
        </div>
      </motion.div>

      {issues === null ? (
        <div className="space-y-4">{[0, 1].map((i) => <div key={i} className="glass h-40 animate-pulse" />)}</div>
      ) : issues.length === 0 ? (
        <div className="glass flex flex-col items-center gap-4 py-16 text-center">
          <p className="text-sm text-slate-400">You haven't reported anything yet.</p>
          <Link to="/report" data-testid="my-first-report-btn" className="btn-primary">
            <Plus className="h-4 w-4" /> Report your first issue
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {issues.map((issue, idx) => (
            <motion.div
              key={issue.id}
              data-testid={`my-issue-${issue.id}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.07 }}
              className="glass p-4"
            >
              <div className="flex gap-4">
                {issue.image_url && (
                  <img src={imgUrl(issue.image_url)} alt="" className="h-20 w-20 shrink-0 rounded-xl object-cover" />
                )}
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <CategoryTag category={issue.category} />
                    <StatusBadge status={issue.status} />
                  </div>
                  <p className="line-clamp-2 text-sm text-slate-200">{issue.description}</p>
                  <p className="flex items-center gap-1 text-xs text-slate-500">
                    <MapPin className="h-3 w-3 text-cyan-400" /> {issue.area} · {issue.upvotes} upvotes
                  </p>
                </div>
                {issue.resolution_image && (
                  <div className="hidden shrink-0 sm:block">
                    <p className="mb-1 text-center text-[10px] font-semibold uppercase text-emerald-400">After</p>
                    <img src={imgUrl(issue.resolution_image)} alt="Resolved" className="h-16 w-16 rounded-xl border border-emerald-400/30 object-cover" />
                  </div>
                )}
              </div>
              <Timeline timeline={issue.timeline} />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

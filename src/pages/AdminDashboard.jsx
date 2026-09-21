import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  MapPin, LogOut, HardHat, BarChart3, ClipboardList, AlertTriangle, CheckCircle2,
  Timer, TrendingUp, CalendarDays, ArrowBigUp, X, Loader2, Download,
} from "lucide-react";
import { format } from "date-fns";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, AreaChart, Area, Legend,
} from "recharts";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import api, { imgUrl } from "../api";
import { useAuth } from "../context/AuthContext";
import StatusBadge from "../components/StatusBadge";
import CategoryTag, { CATEGORIES, CATEGORY_META } from "../components/CategoryTag";
import CountUp from "../components/CountUp";

const STATUS_OPTS = ["all", "Pending", "Assigned", "In Progress", "Resolved"];
const PIE_COLORS = ["#F43F5E", "#8B5CF6", "#F59E0B", "#10B981"];
const TOOLTIP_STYLE = {
  contentStyle: { background: "rgba(13,17,26,0.95)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, fontSize: 12 },
  labelStyle: { color: "#9CA3AF" },
  itemStyle: { color: "#E5E7EB" },
};

function MetricCard({ icon: Icon, label, value, decimals = 0, suffix = "", accent, testid }) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} data-testid={testid} className="glass p-5">
      <div className="flex items-center justify-between">
        <p className="label-cap !text-slate-500">{label}</p>
        <span className={`grid h-9 w-9 place-items-center rounded-xl border ${accent}`}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="font-display mt-2 text-3xl font-extrabold text-slate-100">
        <CountUp value={value} decimals={decimals} suffix={suffix} />
      </p>
    </motion.div>
  );
}

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState("overview");
  const [analytics, setAnalytics] = useState(null);
  const [issues, setIssues] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [statusF, setStatusF] = useState("all");
  const [catF, setCatF] = useState("all");
  const [areaF, setAreaF] = useState("");
  const [selected, setSelected] = useState(null);
  const [workerId, setWorkerId] = useState("");
  const [deadline, setDeadline] = useState("");
  const [note, setNote] = useState("");
  const [resFile, setResFile] = useState(null);
  const [resNote, setResNote] = useState("");
  const [resolveMode, setResolveMode] = useState(false);
  const [busy, setBusy] = useState(false);

  const loadAll = useCallback(async () => {
    try {
      const [a, w] = await Promise.all([api.get("/analytics"), api.get("/workers")]);
      setAnalytics(a.data);
      setWorkers(w.data);
    } catch {}
  }, []);

  const loadIssues = useCallback(async () => {
    try {
      const params = {};
      if (statusF !== "all") params.status = statusF;
      if (catF !== "all") params.category = catF;
      if (areaF) params.area = areaF;
      const { data } = await api.get("/issues", { params });
      setIssues(data);
    } catch {}
  }, [statusF, catF, areaF]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);
  useEffect(() => {
    loadIssues();
  }, [loadIssues]);

  const openIssue = (issue) => {
    setSelected(issue);
    setWorkerId(issue.assigned_to?.id || "");
    setDeadline(issue.deadline ? issue.deadline.slice(0, 10) : "");
    setNote("");
    setResFile(null);
    setResNote("");
    setResolveMode(false);
  };

  const applyUpdate = (updated) => {
    setIssues((list) => list.map((i) => (i.id === updated.id ? { ...i, ...updated } : i)));
    setSelected((s) => (s && s.id === updated.id ? { ...s, ...updated } : s));
    loadAll();
  };

  const assign = async () => {
    if (!workerId) return toast.error("Pick a field worker first");
    setBusy(true);
    try {
      const { data } = await api.patch(`/issues/${selected.id}/assign`, {
        worker_id: workerId,
        deadline: deadline || null,
        note,
      });
      applyUpdate(data);
      toast.success(`Assigned to ${data.assigned_to.name}`);
    } catch {
      toast.error("Assignment failed");
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (status, resolution_image = null, sNote = "") => {
    setBusy(true);
    try {
      const { data } = await api.patch(`/issues/${selected.id}/status`, {
        status,
        note: sNote,
        resolution_image,
      });
      applyUpdate(data);
      toast.success(`Status updated to ${status}`);
      setResolveMode(false);
      setResFile(null);
      setResNote("");
    } catch {
      toast.error("Status update failed");
    } finally {
      setBusy(false);
    }
  };

  const downloadPdf = async () => {
    try {
      const res = await api.get("/admin/report/pdf", { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = "fixmycity_report.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success("PDF downloaded");
    } catch {
      toast.error("PDF export failed");
    }
  };    
  const resolve = async () => {
    let resUrl = null;
    if (resFile) {
      const fd = new FormData();
      fd.append("file", resFile);
      try {
        const { data } = await api.post("/upload", fd);
        resUrl = data.url;
      } catch {
        return toast.error("Photo upload failed");
      }
    }
    await setStatus("Resolved", resUrl, resNote || "Resolved by field team with photo proof");
  };

  return (
    <div data-testid="admin-dashboard" className="min-h-screen bg-[#07090E]">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#07090E]/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-cyan-400 to-violet-500 shadow-[0_0_18px_rgba(0,240,255,0.4)]">
              <MapPin className="h-5 w-5 text-slate-950" />
            </span>
            <div>
              <p className="font-display text-base font-bold leading-none">
                Fix<span className="text-gradient">MyCity</span>
              </p>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Command Center</p>
            </div>
          </div>
          <div className="hidden items-center gap-1 rounded-xl border border-white/10 bg-white/5 p-1 sm:flex">
            <button data-testid="admin-tab-overview" onClick={() => setTab("overview")} className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${tab === "overview" ? "bg-cyan-400/15 text-cyan-300" : "text-slate-400 hover:text-slate-200"}`}>
              <BarChart3 className="h-3.5 w-3.5" /> Overview
            </button>
            <button data-testid="admin-tab-complaints" onClick={() => setTab("complaints")} className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${tab === "complaints" ? "bg-cyan-400/15 text-cyan-300" : "text-slate-400 hover:text-slate-200"}`}>
              <ClipboardList className="h-3.5 w-3.5" /> Complaints
            </button>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/worker" data-testid="admin-field-view-link" className="btn-ghost !px-3 !py-1.5 !text-xs">
              <HardHat className="h-3.5 w-3.5" /> Field View
            </Link>
            <Link to="/feed" className="hidden text-xs font-medium text-slate-400 hover:text-cyan-300 sm:block">
              Citizen app
            </Link>
            <button
              data-testid="admin-logout-button"
              onClick={() => {
                logout();
                navigate("/");
              }}
              className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/5 text-slate-400 transition hover:border-rose-400/40 hover:text-rose-300"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="flex gap-1 border-t border-white/5 px-4 py-2 sm:hidden">
          <button data-testid="admin-tab-overview-mobile" onClick={() => setTab("overview")} className={`flex-1 rounded-lg py-1.5 text-xs font-semibold ${tab === "overview" ? "bg-cyan-400/15 text-cyan-300" : "text-slate-400"}`}>
            Overview
          </button>
          <button data-testid="admin-tab-complaints-mobile" onClick={() => setTab("complaints")} className={`flex-1 rounded-lg py-1.5 text-xs font-semibold ${tab === "complaints" ? "bg-cyan-400/15 text-cyan-300" : "text-slate-400"}`}>
            Complaints
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        {tab === "overview" && (
          <div className="space-y-6" data-testid="admin-overview">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <MetricCard icon={ClipboardList} label="Total Reports" value={analytics?.total ?? 0} accent="border-cyan-400/30 bg-cyan-400/10 text-cyan-300" testid="metric-total" />
              <MetricCard icon={AlertTriangle} label="Active Issues" value={analytics?.active ?? 0} accent="border-rose-400/30 bg-rose-400/10 text-rose-300" testid="metric-active" />
              <MetricCard icon={CheckCircle2} label="Resolved" value={analytics?.resolved ?? 0} accent="border-emerald-400/30 bg-emerald-400/10 text-emerald-300" testid="metric-resolved" />
              <MetricCard icon={Timer} label="Avg Resolution" value={analytics?.avg_resolution_hours ?? 0} decimals={1} suffix="h" accent="border-amber-400/30 bg-amber-400/10 text-amber-300" testid="metric-avg-resolution" />
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass p-5 lg:col-span-2" data-testid="chart-trend">
                <p className="label-cap mb-4">14-day activity</p>
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={analytics?.trend || []}>
                    <defs>
                      <linearGradient id="gRep" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#00F0FF" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#00F0FF" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gRes" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10B981" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <XAxis dataKey="date" tick={{ fill: "#6B7280", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#6B7280", fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} width={24} />
                    <Tooltip {...TOOLTIP_STYLE} />
                    <Area type="monotone" dataKey="reported" stroke="#00F0FF" strokeWidth={2} fill="url(#gRep)" />
                    <Area type="monotone" dataKey="resolved" stroke="#10B981" strokeWidth={2} fill="url(#gRes)" />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="glass p-5" data-testid="chart-status">
                <p className="label-cap mb-4">By status</p>
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie data={analytics?.by_status || []} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3} strokeWidth={0}>
                      {(analytics?.by_status || []).map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip {...TOOLTIP_STYLE} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass p-5 lg:col-span-2" data-testid="chart-category">
                <p className="label-cap mb-4">Issues by category</p>
                <ResponsiveContainer width="100%" height={230}>
                  <BarChart data={(analytics?.by_category || []).map((c) => ({ ...c, name: CATEGORY_META[c.name]?.label || c.name }))}>
                    <defs>
                      <linearGradient id="gCat" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#00F0FF" />
                        <stop offset="100%" stopColor="#8B5CF6" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: "#6B7280", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#6B7280", fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} width={24} />
                    <Tooltip {...TOOLTIP_STYLE} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                    <Bar dataKey="value" fill="url(#gCat)" radius={[6, 6, 0, 0]} maxBarSize={42} />
                  </BarChart>
                </ResponsiveContainer>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="glass p-5" data-testid="chart-area">
                <p className="label-cap mb-4">Hotspot areas</p>
                <ResponsiveContainer width="100%" height={230}>
                  <BarChart data={analytics?.by_area || []} layout="vertical">
                    <CartesianGrid stroke="rgba(255,255,255,0.06)" horizontal={false} />
                    <XAxis type="number" tick={{ fill: "#6B7280", fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" tick={{ fill: "#9CA3AF", fontSize: 10 }} axisLine={false} tickLine={false} width={86} />
                    <Tooltip {...TOOLTIP_STYLE} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                    <Bar dataKey="value" fill="#8B5CF6" radius={[0, 6, 6, 0]} maxBarSize={16} />
                  </BarChart>
                </ResponsiveContainer>
              </motion.div>
            </div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass p-5" data-testid="workers-roster">
              <p className="label-cap mb-4">Field force</p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {workers.map((w) => (
                  <div key={w.id} data-testid={`worker-card-${w.id}`} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="flex items-center gap-2.5">
                      <span className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-gradient-to-br from-cyan-500/20 to-violet-500/20 text-sm font-bold text-cyan-200">
                        {w.name.slice(0, 1)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-100">{w.name}</p>
                        <p className="text-[10px] uppercase tracking-wider text-slate-500">{w.dept}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex gap-3 text-[11px] text-slate-400">
                      <span className="text-amber-300">{w.active_count} active</span>
                      <span className="text-emerald-300">{w.resolved_count} resolved</span>
                      <span className="text-cyan-300">{w.points} pts</span>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}

        {tab === "complaints" && (
          <div className="space-y-4" data-testid="admin-complaints">
            <div className="flex flex-wrap gap-2">
              <select data-testid="admin-filter-status" value={statusF} onChange={(e) => setStatusF(e.target.value)} className="input-dark !w-auto !py-2 text-xs">
                {STATUS_OPTS.map((s) => (
                  <option key={s} value={s}>{s === "all" ? "All statuses" : s}</option>
                ))}
              </select>
              <select data-testid="admin-filter-category" value={catF} onChange={(e) => setCatF(e.target.value)} className="input-dark !w-auto !py-2 text-xs">
                <option value="all">All categories</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{CATEGORY_META[c].label}</option>
                ))}
              </select>
              <input data-testid="admin-filter-area" value={areaF} onChange={(e) => setAreaF(e.target.value)} placeholder="Filter by area…" className="input-dark !w-44 !py-2 text-xs" />
              <span className="ml-auto self-center text-xs text-slate-500">{issues.length} complaints</span>
                              <button data-testid="export-pdf-button" onClick={downloadPdf} className="btn-primary !px-3 !py-2 !text-xs">
                  <Download className="h-3.5 w-3.5" /> Export PDF
                </button>

                <button data-testid="export-pdf-button" onClick={downloadPdf} className="btn-primary !px-3 !py-2 !text-xs">
                  <Download className="h-3.5 w-3.5" /> Export PDF
                </button>

              <button data-testid="export-pdf-button" onClick={downloadPdf} className="btn-primary !px-3 !py-2 !text-xs">
                <Download className="h-3.5 w-3.5" /> Export PDF
              </button>
            </div>


            <div className="glass overflow-x-auto">
              <div className="min-w-[860px]">
                <div className="grid grid-cols-[64px_1.6fr_0.8fr_0.8fr_0.9fr_0.7fr_0.7fr] gap-3 border-b border-white/10 px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  <span>Photo</span><span>Issue</span><span>Category</span><span>Status</span><span>Assigned to</span><span>Upvotes</span><span>Reported</span>
                </div>
                {issues.map((i) => (
                  <button
                    key={i.id}
                    data-testid={`complaint-row-${i.id}`}
                    onClick={() => openIssue(i)}
                    className="grid w-full grid-cols-[64px_1.6fr_0.8fr_0.8fr_0.9fr_0.7fr_0.7fr] items-center gap-3 border-b border-white/5 px-4 py-3 text-left transition-colors hover:bg-cyan-400/5"
                  >
                    {i.image_url ? (
                      <img src={imgUrl(i.image_url)} alt="" className="h-11 w-14 rounded-lg object-cover" loading="lazy" />
                    ) : (
                      <span className="grid h-11 w-14 place-items-center rounded-lg bg-white/5 text-slate-600"><X className="h-4 w-4" /></span>
                    )}
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-slate-100">{i.description}</span>
                      <span className="text-[11px] text-slate-500">{i.area} · {i.author?.name}</span>
                    </span>
                    <CategoryTag category={i.category} />
                    <StatusBadge status={i.status} pulse={false} />
                    <span className="truncate text-xs text-slate-400">{i.assigned_to ? i.assigned_to.name : "—"}</span>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-300">
                      <ArrowBigUp className="h-3.5 w-3.5" /> {i.upvotes}
                    </span>
                    <span className="text-[11px] text-slate-500">{i.created_at ? format(new Date(i.created_at), "dd MMM") : ""}</span>
                  </button>
                ))}
                {issues.length === 0 && <p className="px-4 py-10 text-center text-sm text-slate-500">No complaints match these filters.</p>}
              </div>
            </div>
          </div>
        )}
      </main>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto border-white/10 bg-[#0B0F16]/95 text-slate-100 backdrop-blur-xl">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display flex flex-wrap items-center gap-2 text-slate-100">
                  <CategoryTag category={selected.category} />
                  <StatusBadge status={selected.status} />
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-5" data-testid="complaint-detail">
                <div className="grid grid-cols-2 gap-3">
                  {selected.image_url && (
                    <div>
                      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Reported</p>
                      <img src={imgUrl(selected.image_url)} alt="" className="h-36 w-full rounded-xl object-cover" />
                    </div>
                  )}
                  {selected.resolution_image && (
                    <div>
                      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-400">After (proof)</p>
                      <img src={imgUrl(selected.resolution_image)} alt="" className="h-36 w-full rounded-xl border border-emerald-400/30 object-cover" />
                    </div>
                  )}
                </div>
                <p className="text-sm leading-relaxed text-slate-200">{selected.description}</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                  <span>{selected.area} · {selected.address}</span>
                  <span>by {selected.author?.name}</span>
                  <span className="inline-flex items-center gap-1 text-cyan-300"><ArrowBigUp className="h-3.5 w-3.5" />{selected.upvotes}</span>
                  {selected.deadline && (
                    <span className="inline-flex items-center gap-1 text-amber-300">
                      <CalendarDays className="h-3.5 w-3.5" /> Due {format(new Date(selected.deadline), "dd MMM yyyy")}
                    </span>
                  )}
                </div>

                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  {(selected.timeline || []).map((t, i) => (
                    <p key={i} className="py-1 text-[11px] text-slate-400">
                      <span className="font-semibold text-slate-200">{t.status}</span>
                      {t.at && <span className="text-slate-600"> · {format(new Date(t.at), "dd MMM, hh:mm a")}</span>}
                      {t.note && <span className="text-slate-500"> — {t.note}</span>}
                    </p>
                  ))}
                </div>

                {selected.status !== "Resolved" && (
                  <div className="space-y-3 rounded-xl border border-cyan-400/20 bg-cyan-400/5 p-4">
                    <p className="label-cap">Assign field team</p>
                    <div className="grid gap-2 sm:grid-cols-3">
                      <select data-testid="assign-worker-select" value={workerId} onChange={(e) => setWorkerId(e.target.value)} className="input-dark !py-2 text-xs">
                        <option value="">Select worker…</option>
                        {workers.map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.name} · {w.dept} ({w.active_count} active)
                          </option>
                        ))}
                      </select>
                      <input data-testid="assign-deadline-input" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="input-dark !py-2 text-xs" />
                      <input data-testid="assign-note-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" className="input-dark !py-2 text-xs" />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button data-testid="assign-submit-button" onClick={assign} disabled={busy} className="btn-primary !py-2 !text-xs">
                        {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Assign Team
                      </button>
                      {selected.status !== "In Progress" && (
                        <button data-testid="status-inprogress-button" onClick={() => setStatus("In Progress")} disabled={busy} className="btn-ghost !py-2 !text-xs">
                          <TrendingUp className="h-3.5 w-3.5" /> Mark In Progress
                        </button>
                      )}
                      <button data-testid="status-resolve-button" onClick={() => setResolveMode((v) => !v)} disabled={busy} className="btn-ghost !border-emerald-400/40 !py-2 !text-xs !text-emerald-300">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Resolve
                      </button>
                    </div>
                    {resolveMode && (
                      <div className="space-y-2 border-t border-white/10 pt-3">
                        <input data-testid="resolve-photo-input" type="file" accept="image/*" onChange={(e) => setResFile(e.target.files?.[0] || null)} className="block w-full text-xs text-slate-400 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-500/15 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-emerald-300" />
                        <input data-testid="resolve-note-input" value={resNote} onChange={(e) => setResNote(e.target.value)} placeholder="Resolution note (optional)" className="input-dark !py-2 text-xs" />
                        <button data-testid="resolve-confirm-button" onClick={resolve} disabled={busy} className="btn-primary !bg-emerald-500 !py-2 !text-xs !shadow-[0_0_24px_rgba(16,185,129,0.35)]">
                          {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Confirm Resolution
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

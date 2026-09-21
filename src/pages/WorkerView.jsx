import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { MapPin, LogOut, Timer, CheckCircle2, Play, Loader2, LayoutDashboard, Camera } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import api, { imgUrl } from "../api";
import { useAuth } from "../context/AuthContext";
import StatusBadge from "../components/StatusBadge";
import CategoryTag from "../components/CategoryTag";

function DeadlineChip({ deadline, done }) {
  if (!deadline) return null;
  const days = Math.ceil((new Date(deadline) - Date.now()) / 86400000);
  if (done) return null;
  const overdue = days < 0;
  return (
    <span
      data-testid="task-deadline-chip"
      className={`chip ${
        overdue
          ? "border-rose-500/30 bg-rose-500/10 text-rose-400 animate-pulse"
          : days <= 1
          ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
          : "border-white/10 bg-white/5 text-slate-300"
      }`}
    >
      <Timer className="h-3.5 w-3.5" />
      {overdue ? `Overdue by ${-days}d` : days === 0 ? "Due today" : `Due in ${days}d`}
    </span>
  );
}

export default function WorkerView() {
  const { user, logout, refresh } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === "admin";
  const [workers, setWorkers] = useState([]);
  const [wid, setWid] = useState(null);
  const [tasks, setTasks] = useState(null);
  const [completing, setCompleting] = useState(null);
  const [resFile, setResFile] = useState(null);
  const [resNote, setResNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isAdmin) api.get("/workers").then((r) => setWorkers(r.data)).catch(() => {});
  }, [isAdmin]);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/tasks", { params: isAdmin && wid ? { worker_id: wid } : {} });
      setTasks(data);
    } catch {
      setTasks([]);
    }
  }, [isAdmin, wid]);

  useEffect(() => {
    load();
  }, [load]);

  const startWork = async (task) => {
    try {
      await api.patch(`/issues/${task.id}/status`, { status: "In Progress", note: "Field team started work on site" });
      toast.success("Task marked In Progress");
      load();
    } catch {
      toast.error("Couldn't update task");
    }
  };

  const complete = async () => {
    if (!resFile) return toast.error("Upload an after-photo as proof");
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", resFile);
      const { data } = await api.post("/upload", fd);
      await api.patch(`/issues/${completing.id}/status`, {
        status: "Resolved",
        resolution_image: data.url,
        note: resNote || "Resolved with photo proof",
      });
      toast.success("Task completed! +15 pts for you, +25 for the citizen");
      setCompleting(null);
      setResFile(null);
      setResNote("");
      refresh();
      load();
    } catch {
      toast.error("Couldn't complete the task");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-testid="worker-view" className="min-h-screen bg-[#07090E]">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#07090E]/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-[0_0_18px_rgba(245,158,11,0.4)]">
              <MapPin className="h-5 w-5 text-slate-950" />
            </span>
            <div>
              <p className="font-display text-base font-bold leading-none">
                Fix<span className="text-gradient">MyCity</span>
              </p>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Field Ops</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Link to="/admin" data-testid="worker-back-admin" className="btn-ghost !px-3 !py-1.5 !text-xs">
                <LayoutDashboard className="h-3.5 w-3.5" /> Dashboard
              </Link>
            )}
            <Link to="/feed" className="text-xs font-medium text-slate-400 hover:text-cyan-300">Citizen app</Link>
            <button
              data-testid="worker-logout-button"
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
      </header>

      <main className="mx-auto max-w-4xl space-y-5 px-4 py-6">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Task Queue</h1>
          <p className="text-sm text-slate-400">
            {isAdmin ? "Preview any worker's queue" : `Assigned to ${user?.name} · ${user?.dept || "Field Ops"}`}
          </p>
        </div>

        {isAdmin && (
          <div className="flex gap-2 overflow-x-auto pb-1" data-testid="worker-selector">
            <button
              data-testid="worker-filter-all"
              onClick={() => setWid(null)}
              className={`chip transition-all ${!wid ? "border-cyan-400/60 bg-cyan-400/15 text-cyan-300" : "border-white/10 bg-white/5 text-slate-400"}`}
            >
              All workers
            </button>
            {workers.map((w) => (
              <button
                key={w.id}
                data-testid={`worker-filter-${w.id}`}
                onClick={() => setWid(w.id)}
                className={`chip transition-all ${wid === w.id ? "border-cyan-400/60 bg-cyan-400/15 text-cyan-300" : "border-white/10 bg-white/5 text-slate-400"}`}
              >
                {w.name} · {w.dept}
              </button>
            ))}
          </div>
        )}

        {tasks === null ? (
          <div className="space-y-4">{[0, 1].map((i) => <div key={i} className="glass h-36 animate-pulse" />)}</div>
        ) : tasks.length === 0 ? (
          <div className="glass flex flex-col items-center gap-3 py-16 text-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-400/50" />
            <p className="text-sm text-slate-400">No tasks assigned right now. Enjoy the calm.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {tasks.map((t, i) => (
              <motion.div
                key={t.id}
                data-testid={`task-card-${t.id}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                className={`glass p-4 ${t.status === "Resolved" ? "opacity-70" : ""}`}
              >
                <div className="flex flex-col gap-4 sm:flex-row">
                  {t.image_url && (
                    <img src={imgUrl(t.image_url)} alt="" className="h-32 w-full shrink-0 rounded-xl object-cover sm:w-40" />
                  )}
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <CategoryTag category={t.category} />
                      <StatusBadge status={t.status} />
                      <DeadlineChip deadline={t.deadline} done={t.status === "Resolved"} />
                    </div>
                    <p className="text-sm text-slate-200">{t.description}</p>
                    <p className="text-xs text-slate-500">
                      {t.area} · {t.address} · reported by {t.author?.name}
                      {t.deadline && <> · deadline {format(new Date(t.deadline), "dd MMM")}</>}
                    </p>
                    {isAdmin && t.assigned_to && (
                      <p className="text-xs text-violet-300">{t.assigned_to.name} · {t.assigned_to.dept}</p>
                    )}
                    <div className="flex flex-wrap gap-2 pt-1">
                      {t.status === "Assigned" && (
                        <button data-testid={`task-start-button-${t.id}`} onClick={() => startWork(t)} className="btn-ghost !border-amber-400/40 !py-2 !text-xs !text-amber-300">
                          <Play className="h-3.5 w-3.5" /> Start Work
                        </button>
                      )}
                      {t.status === "In Progress" && (
                        <button
                          data-testid={`task-complete-button-${t.id}`}
                          onClick={() => {
                            setCompleting(t);
                            setResFile(null);
                            setResNote("");
                          }}
                          className="btn-primary !bg-emerald-500 !py-2 !text-xs !shadow-[0_0_20px_rgba(16,185,129,0.35)]"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" /> Mark Complete
                        </button>
                      )}
                      {t.status === "Resolved" && (
                        <span className="chip border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Completed
                          {t.resolved_at && <> · {format(new Date(t.resolved_at), "dd MMM")}</>}
                        </span>
                      )}
                    </div>
                  </div>
                  {t.resolution_image && (
                    <div className="hidden shrink-0 sm:block">
                      <p className="mb-1 text-center text-[10px] font-semibold uppercase text-emerald-400">After</p>
                      <img src={imgUrl(t.resolution_image)} alt="" className="h-24 w-24 rounded-xl border border-emerald-400/30 object-cover" />
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>

      <Dialog open={!!completing} onOpenChange={(o) => !o && setCompleting(null)}>
        <DialogContent className="max-w-md border-white/10 bg-[#0B0F16]/95 text-slate-100 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="font-display text-slate-100">Complete task</DialogTitle>
          </DialogHeader>
          <div className="space-y-4" data-testid="complete-modal">
            <p className="text-sm text-slate-400">Upload an after-photo as proof. The citizen earns +25 pts, you earn +15.</p>
            <label
              htmlFor="complete-photo"
              className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-white/15 py-8 transition-all hover:border-emerald-400/50 hover:bg-emerald-400/5"
            >
              <Camera className="h-6 w-6 text-emerald-300" />
              <span className="text-xs text-slate-300">{resFile ? resFile.name : "Upload after-photo"}</span>
            </label>
            <input id="complete-photo" data-testid="complete-photo-input" type="file" accept="image/*" className="hidden" onChange={(e) => setResFile(e.target.files?.[0] || null)} />
            <input data-testid="complete-note-input" value={resNote} onChange={(e) => setResNote(e.target.value)} placeholder="Field notes (optional)" className="input-dark" />
            <button data-testid="complete-submit-button" onClick={complete} disabled={busy} className="btn-primary w-full !bg-emerald-500 !shadow-[0_0_24px_rgba(16,185,129,0.35)]">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Submit Completion
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const STYLES = {
  Pending: "bg-rose-500/10 text-rose-400 border-rose-500/30 shadow-[0_0_12px_rgba(244,63,94,0.25)]",
  Assigned: "bg-violet-500/10 text-violet-300 border-violet-500/30 shadow-[0_0_12px_rgba(139,92,246,0.25)]",
  "In Progress": "bg-amber-500/10 text-amber-400 border-amber-500/30 shadow-[0_0_12px_rgba(245,158,11,0.25)]",
  Resolved: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.25)]",
};

export default function StatusBadge({ status, pulse = true }) {
  return (
    <span
      data-testid={`status-badge-${(status || "pending").toLowerCase().replace(/\s+/g, "-")}`}
      className={`chip backdrop-blur-md ${STYLES[status] || STYLES.Pending} ${
        pulse && status !== "Resolved" ? "animate-pulse" : ""
      }`}
    >
      {status}
    </span>
  );
}

import { Outlet, NavLink, Link, useLocation, useNavigate } from "react-router-dom";
import { Newspaper, Map as MapIcon, Plus, ClipboardList, Trophy, LogOut, Sparkles, LayoutDashboard, HardHat, MapPin } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const NAV = [
  { to: "/feed", label: "Feed", icon: Newspaper, testid: "nav-feed" },
  { to: "/map", label: "Map", icon: MapIcon, testid: "nav-map" },
  { to: "/report", label: "Report", icon: Plus, testid: "nav-report", main: true },
  { to: "/my", label: "My Reports", icon: ClipboardList, testid: "nav-my" },
  { to: "/leaderboard", label: "Leaders", icon: Trophy, testid: "nav-leaderboard" },
];

export default function CitizenLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isMap = location.pathname === "/map";

  return (
    <div className="min-h-screen bg-[#07090E]">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#07090E]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link to="/feed" data-testid="nav-logo" className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-cyan-400 to-violet-500 shadow-[0_0_18px_rgba(0,240,255,0.4)]">
              <MapPin className="h-5 w-5 text-slate-950" />
            </span>
            <span className="font-display text-lg font-bold tracking-tight">
              Fix<span className="text-gradient">MyCity</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                data-testid={`${n.testid}-desktop`}
                className={({ isActive }) =>
                  `rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
                    isActive ? "bg-cyan-400/10 text-cyan-300" : "text-slate-400 hover:text-slate-100"
                  }`
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-2.5">
            <span
              data-testid="user-points-chip"
              className="chip border-cyan-400/30 bg-cyan-400/10 text-cyan-300"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {user?.points ?? 0} pts
            </span>
            {user?.role === "admin" && (
              <Link to="/admin" data-testid="nav-admin-dashboard" className="btn-ghost !px-3 !py-1.5 text-xs">
                <LayoutDashboard className="h-3.5 w-3.5" /> Admin
              </Link>
            )}
            {user?.role === "worker" && (
              <Link to="/worker" data-testid="nav-worker-view" className="btn-ghost !px-3 !py-1.5 text-xs">
                <HardHat className="h-3.5 w-3.5" /> Tasks
              </Link>
            )}
            <button
              data-testid="logout-button"
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

      <main className={isMap ? "h-[calc(100dvh-8rem)] md:h-[calc(100dvh-4rem)]" : "mx-auto max-w-2xl px-4 pb-28 pt-6 md:pb-10"}>
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#0B0F16]/90 backdrop-blur-xl pb-safe md:hidden">
        <div className="grid h-16 grid-cols-5">
          {NAV.map((n) => {
            const Icon = n.icon;
            const active = location.pathname === n.to;
            if (n.main) {
              return (
                <NavLink key={n.to} to={n.to} data-testid={n.testid} className="relative flex items-center justify-center">
                  <span
                    className={`absolute -top-5 grid h-12 w-12 place-items-center rounded-2xl transition-all duration-300 ${
                      active
                        ? "bg-gradient-to-br from-cyan-400 to-violet-500 shadow-[0_0_26px_rgba(0,240,255,0.6)] scale-105"
                        : "bg-gradient-to-br from-cyan-500 to-violet-600 shadow-[0_0_16px_rgba(0,240,255,0.35)]"
                    }`}
                  >
                    <Icon className="h-6 w-6 text-slate-950" />
                  </span>
                  <span className={`mt-7 text-[10px] font-medium ${active ? "text-cyan-300" : "text-slate-500"}`}>
                    {n.label}
                  </span>
                </NavLink>
              );
            }
            return (
              <NavLink
                key={n.to}
                to={n.to}
                data-testid={n.testid}
                className={`flex flex-col items-center justify-center gap-1 transition-colors ${
                  active ? "text-cyan-300" : "text-slate-500 hover:text-slate-300"
                }`}
              >
                <Icon className={`h-5 w-5 ${active ? "drop-shadow-[0_0_8px_rgba(0,240,255,0.7)]" : ""}`} />
                <span className="text-[10px] font-medium">{n.label}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

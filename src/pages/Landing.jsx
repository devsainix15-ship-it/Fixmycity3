import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { MapPin, ScanSearch, MapPinned, Trophy, Camera, Navigation, CheckCircle2, ChevronRight } from "lucide-react";
import CountUp from "../components/CountUp";
import { useAuth } from "../context/AuthContext";
import api from "../api";

const FEATURES = [
  {
    icon: ScanSearch,
    title: "AI Auto-Categorization",
    desc: "Snap a photo — our vision AI instantly tags it as roads, water, electricity, sanitation or streetlights.",
    accent: "text-cyan-300 border-cyan-400/30 bg-cyan-400/10",
  },
  {
    icon: MapPinned,
    title: "Live Issue Map",
    desc: "Every report drops onto a live city map, color-coded by status with pulsing urgency rings.",
    accent: "text-violet-300 border-violet-400/30 bg-violet-400/10",
  },
  {
    icon: Trophy,
    title: "Civic Gamification",
    desc: "Earn points and badges like Community Hero as your reports get verified and resolved.",
    accent: "text-emerald-300 border-emerald-400/30 bg-emerald-400/10",
  },
];

const STEPS = [
  { icon: Camera, title: "Snap & Report", desc: "Photo, auto-location, one-line description. AI does the tagging." },
  { icon: Navigation, title: "Track Live", desc: "Watch your report move from Pending to Assigned to Resolved." },
  { icon: CheckCircle2, title: "Get It Fixed", desc: "Field teams close the loop with photo proof. You earn rewards." },
];

export default function Landing() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ total: 0, resolved: 0, citizens: 0 });
  useEffect(() => {
    api.get("/public/stats").then((r) => setStats(r.data)).catch(() => {});
  }, []);

  const ctaTo = user ? "/feed" : "/auth";

  return (
    <div className="min-h-screen bg-[#07090E] text-slate-100">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/5 bg-[#07090E]/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-cyan-400 to-violet-500 shadow-[0_0_18px_rgba(0,240,255,0.4)]">
              <MapPin className="h-5 w-5 text-slate-950" />
            </span>
            <span className="font-display text-lg font-bold tracking-tight">
              Fix<span className="text-gradient">MyCity</span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            {!user && (
              <Link to="/auth" data-testid="nav-login-btn" className="text-sm font-medium text-slate-300 hover:text-cyan-300 transition-colors">
                Log in
              </Link>
            )}
            <Link to={ctaTo} data-testid="nav-get-started-btn" className="btn-primary !px-4 !py-2">
              {user ? "Open App" : "Get Started"} <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden pt-16">
        <div className="absolute inset-0 bg-grid" />
        <div className="orb left-[8%] top-[12%] h-72 w-72 bg-cyan-500 animate-float" />
        <div className="orb right-[6%] top-[36%] h-80 w-80 bg-violet-600 animate-float" style={{ animationDelay: "-3s" }} />
        <div className="orb left-[38%] bottom-[0%] h-64 w-64 bg-emerald-500 opacity-20" />

        <div className="relative mx-auto max-w-6xl px-4 pb-24 pt-20 text-center sm:pt-28">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-1.5 text-xs font-semibold text-cyan-300 shadow-[0_0_20px_rgba(0,240,255,0.15)]"
          >
            <ScanSearch className="h-3.5 w-3.5" /> AI-Powered Civic Issue Reporting
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="font-display text-4xl font-extrabold tracking-tight sm:text-6xl lg:text-7xl"
          >
            Report it. Track it.
            <br />
            <span className="text-gradient drop-shadow-[0_0_30px_rgba(0,240,255,0.25)]">Get it fixed.</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mx-auto mt-6 max-w-xl text-base text-slate-400 sm:text-lg"
          >
            The social network for your streets. Citizens flag potholes, outages and leaks — AI routes them,
            city crews fix them, and everyone watches it happen live.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-9 flex flex-wrap items-center justify-center gap-4"
          >
            <Link to={ctaTo} data-testid="hero-report-btn" className="btn-primary !px-7 !py-3 !text-base">
              <Camera className="h-5 w-5" /> Report an Issue
            </Link>
            <Link to={user ? "/map" : "/auth"} data-testid="hero-explore-btn" className="btn-ghost !px-7 !py-3 !text-base">
              <MapPinned className="h-5 w-5" /> Explore Live Map
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.45 }}
            className="mx-auto mt-16 grid max-w-2xl grid-cols-3 gap-4"
          >
            {[
              { v: stats.total, label: "Issues Reported", testid: "stat-total" },
              { v: stats.resolved, label: "Issues Resolved", testid: "stat-resolved" },
              { v: stats.citizens, label: "Active Citizens", testid: "stat-citizens" },
            ].map((s) => (
              <div key={s.label} data-testid={s.testid} className="glass px-4 py-5">
                <CountUp value={s.v} className="font-display text-2xl font-extrabold text-cyan-300 sm:text-3xl" />
                <p className="mt-1 text-[11px] font-medium uppercase tracking-wider text-slate-500">{s.label}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      <section className="relative mx-auto max-w-6xl px-4 py-20">
        <h2 className="font-display text-center text-2xl font-bold tracking-tight sm:text-3xl">
          Built for cities that <span className="text-gradient">listen</span>
        </h2>
        <div className="mt-12 grid gap-5 sm:grid-cols-3">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.12, duration: 0.5 }}
              className="glass p-6 transition-all duration-300 hover:border-cyan-400/30 hover:shadow-[0_0_30px_rgba(0,240,255,0.08)]"
            >
              <span className={`inline-grid h-11 w-11 place-items-center rounded-xl border ${f.accent}`}>
                <f.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 font-display text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{f.desc}</p>
            </motion.div>
          ))}
        </div>

        <div className="mt-20 grid gap-5 sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <motion.div
              key={s.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.12, duration: 0.5 }}
              className="relative"
            >
              <span className="font-display text-5xl font-extrabold text-white/5">0{i + 1}</span>
              <div className="-mt-6 flex items-center gap-3">
                <s.icon className="h-5 w-5 text-cyan-400" />
                <h4 className="font-display font-semibold">{s.title}</h4>
              </div>
              <p className="mt-2 text-sm text-slate-400">{s.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <footer className="border-t border-white/5 py-10 text-center">
        <p className="text-sm text-slate-500">
          FixMyCity — civic tech for sharper cities. Future scope: real incentive programs, government API
          integration & SMS alerts.
        </p>
      </footer>
    </div>
  );
}

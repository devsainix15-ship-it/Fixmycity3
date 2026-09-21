import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { MapPin, Mail, Lock, User, Loader2, Sparkles, ShieldCheck, HardHat } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { fmtErr } from "../api";

const homeFor = (role) => (role === "admin" ? "/admin" : role === "worker" ? "/worker" : "/feed");

export default function AuthPage() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e?.preventDefault();
    setError("");
    setBusy(true);
    try {
      const u = mode === "login" ? await login(email, password) : await register(name, email, password);
      navigate(homeFor(u.role));
    } catch (err) {
      setError(fmtErr(err));
    } finally {
      setBusy(false);
    }
  };

  const demo = async (em, pw) => {
    setError("");
    setBusy(true);
    try {
      const u = await login(em, pw);
      navigate(homeFor(u.role));
    } catch (err) {
      setError(fmtErr(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen bg-[#07090E] md:grid-cols-2">
      <div className="relative hidden overflow-hidden md:flex md:flex-col md:justify-between md:p-12">
        <div className="absolute inset-0 bg-grid" />
        <div className="orb left-[10%] top-[20%] h-80 w-80 bg-cyan-500 animate-float" />
        <div className="orb bottom-[10%] right-[5%] h-72 w-72 bg-violet-600 animate-float" style={{ animationDelay: "-3s" }} />
        <Link to="/" className="relative flex items-center gap-2.5">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-cyan-400 to-violet-500 shadow-[0_0_18px_rgba(0,240,255,0.4)]">
            <MapPin className="h-5 w-5 text-slate-950" />
          </span>
          <span className="font-display text-xl font-bold tracking-tight text-slate-100">
            Fix<span className="text-gradient">MyCity</span>
          </span>
        </Link>
        <div className="relative">
          <h1 className="font-display text-4xl font-extrabold leading-tight tracking-tight text-slate-100 lg:text-5xl">
            Your city,
            <br />
            <span className="text-gradient">fixed together.</span>
          </h1>
          <p className="mt-4 max-w-md text-slate-400">
            Join thousands of citizens turning broken streets, dead streetlights and overflowing bins into
            resolved tickets — with AI doing the paperwork.
          </p>
        </div>
        <p className="relative text-xs text-slate-600">Report it. Track it. Get it fixed.</p>
      </div>

      <div className="flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="glass-strong w-full max-w-md p-8"
        >
          <Link to="/" className="mb-6 flex items-center gap-2 md:hidden">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-cyan-400 to-violet-500">
              <MapPin className="h-4 w-4 text-slate-950" />
            </span>
            <span className="font-display font-bold text-slate-100">FixMyCity</span>
          </Link>

          <div className="mb-6 grid grid-cols-2 gap-1 rounded-xl border border-white/10 bg-white/5 p-1">
            {["login", "register"].map((m) => (
              <button
                key={m}
                data-testid={`auth-tab-${m}`}
                onClick={() => {
                  setMode(m);
                  setError("");
                }}
                className={`rounded-lg py-2 text-sm font-semibold transition-all ${
                  mode === m ? "bg-cyan-400/15 text-cyan-300 shadow-[0_0_14px_rgba(0,240,255,0.15)]" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {m === "login" ? "Log in" : "Sign up"}
              </button>
            ))}
          </div>

          <h2 className="font-display text-2xl font-bold text-slate-100">
            {mode === "login" ? "Welcome back" : "Create your account"}
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            {mode === "login" ? "Pick up where your city left off." : "Start fixing your neighborhood today."}
          </p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            {mode === "register" && (
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  data-testid="register-name-input"
                  className="input-dark !pl-10"
                  placeholder="Full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
            )}
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                data-testid="auth-email-input"
                type="email"
                className="input-dark !pl-10"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                data-testid="auth-password-input"
                type="password"
                className="input-dark !pl-10"
                placeholder="Password (min 6 chars)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            {error && (
              <p data-testid="auth-error" className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
                {error}
              </p>
            )}
            <button data-testid="auth-submit-button" type="submit" disabled={busy} className="btn-primary w-full !py-3">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "login" ? "Log in" : "Create account"}
            </button>
          </form>

          <div className="mt-6 border-t border-white/10 pt-5">
            <p className="mb-3 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              One-click demo logins
            </p>
            <div className="grid grid-cols-3 gap-2">
              <button data-testid="demo-login-citizen" onClick={() => demo("demo@fixmycity.app", "demo123")} disabled={busy} className="btn-ghost !px-2 !py-2 !text-xs">
                <Sparkles className="h-3.5 w-3.5" /> Citizen
              </button>
              <button data-testid="demo-login-admin" onClick={() => demo("prathamgiri2005@gmail.com", "admin123")} disabled={busy} className="btn-ghost !px-2 !py-2 !text-xs">
                <ShieldCheck className="h-3.5 w-3.5" /> Admin
              </button>
              <button data-testid="demo-login-worker" onClick={() => demo("worker1@fixmycity.gov", "worker123")} disabled={busy} className="btn-ghost !px-2 !py-2 !text-xs">
                <HardHat className="h-3.5 w-3.5" /> Worker
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

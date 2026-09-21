import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Award, Crown, Medal } from "lucide-react";
import api from "../api";
import { useAuth } from "../context/AuthContext";
import CountUp from "../components/CountUp";

const RANK_STYLE = [
  "border-yellow-400/40 bg-yellow-400/10 text-yellow-300",
  "border-slate-300/40 bg-slate-300/10 text-slate-200",
  "border-amber-600/40 bg-amber-600/10 text-amber-500",
];

export default function Leaderboard() {
  const { user } = useAuth();
  const [rows, setRows] = useState(null);

  useEffect(() => {
    api.get("/leaderboard").then((r) => setRows(r.data)).catch(() => setRows([]));
  }, []);

  const top3 = rows?.slice(0, 3) || [];
  const rest = rows?.slice(3) || [];
  const podiumOrder = [top3[1], top3[0], top3[2]].filter(Boolean);

  return (
    <div data-testid="leaderboard-page" className="space-y-6">
      <div className="text-center">
        <h1 className="font-display text-2xl font-bold tracking-tight">Community Heroes</h1>
        <p className="text-sm text-slate-400">Citizens earning points as their reports get fixed</p>
      </div>

      {rows === null ? (
        <div className="glass h-64 animate-pulse" />
      ) : (
        <>
          <div className="grid grid-cols-3 items-end gap-3">
            {podiumOrder.map((r) => {
              const isFirst = r.rank === 1;
              return (
                <motion.div
                  key={r.id}
                  data-testid={`podium-rank-${r.rank}`}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: r.rank * 0.1 }}
                  className={`glass relative flex flex-col items-center gap-1.5 p-4 ${isFirst ? "border-yellow-400/40 pb-8 pt-6 shadow-[0_0_30px_rgba(250,204,21,0.12)]" : "mt-6"}`}
                >
                  {isFirst && <Crown className="absolute -top-3 h-6 w-6 text-yellow-300 drop-shadow-[0_0_8px_rgba(250,204,21,0.8)]" />}
                  <span className={`grid h-11 w-11 place-items-center rounded-full border font-display text-lg font-bold ${RANK_STYLE[r.rank - 1]}`}>
                    {r.name.slice(0, 1)}
                  </span>
                  <p className="max-w-full truncate text-xs font-semibold text-slate-200">{r.name}</p>
                  <p className="font-display text-xl font-extrabold text-cyan-300">
                    <CountUp value={r.points} />
                  </p>
                  <span className={`chip border ${RANK_STYLE[r.rank - 1]} !px-2 !py-0.5 text-[10px]`}>#{r.rank}</span>
                </motion.div>
              );
            })}
          </div>

          <div className="space-y-2.5">
            {rest.map((r, i) => (
              <motion.div
                key={r.id}
                data-testid={`leaderboard-row-${r.id}`}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.05 }}
                className={`glass flex items-center gap-3 p-3.5 ${r.id === user?.id ? "border-cyan-400/50 shadow-[0_0_20px_rgba(0,240,255,0.12)]" : ""}`}
              >
                <span className="w-7 text-center font-display text-sm font-bold text-slate-500">#{r.rank}</span>
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/10 bg-gradient-to-br from-cyan-500/20 to-violet-500/20 text-sm font-bold text-cyan-200">
                  {r.name.slice(0, 1)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-100">
                    {r.name} {r.id === user?.id && <span className="text-[10px] text-cyan-300">(you)</span>}
                  </p>
                  <div className="mt-0.5 flex flex-wrap gap-1">
                    {r.badges.slice(0, 3).map((b) => (
                      <span key={b} className="inline-flex items-center gap-1 rounded-full border border-violet-400/20 bg-violet-400/5 px-1.5 py-0.5 text-[9px] font-medium text-violet-300">
                        <Award className="h-2.5 w-2.5" /> {b}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-display text-base font-bold text-cyan-300">{r.points}</p>
                  <p className="text-[10px] text-slate-500">{r.resolved} fixed</p>
                </div>
              </motion.div>
            ))}
            {rows.length > 0 && rest.length === 0 && (
              <p className="pt-2 text-center text-xs text-slate-500">
                <Medal className="mr-1 inline h-3.5 w-3.5" /> Report more issues to climb the board
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

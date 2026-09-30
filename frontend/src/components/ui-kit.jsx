import { Coins, Wheat, Mountain, Heart, Shield, Users, Hammer } from "lucide-react";
import { productionRates } from "@/game/logic";

export function NeonPanel({ children, className = "", ...p }) {
  return <div className={`glass rounded-xl ${className}`} {...p}>{children}</div>;
}

export function SectionTitle({ children, color = "cyan" }) {
  const map = { cyan: "text-cyan-400 text-glow-cyan", magenta: "text-fuchsia-400 text-glow-magenta", yellow: "text-yellow-300 text-glow-yellow" };
  return <h2 className={`font-display font-extrabold uppercase tracking-wider text-xl ${map[color]}`}>{children}</h2>;
}

export function NeonButton({ children, color = "cyan", className = "", active, ...p }) {
  const map = {
    cyan: "border-cyan-400/60 text-cyan-300 hover:bg-cyan-500 hover:text-black shadow-[0_0_12px_rgba(0,243,255,0.35)]",
    magenta: "border-fuchsia-400/60 text-fuchsia-300 hover:bg-fuchsia-500 hover:text-black shadow-[0_0_12px_rgba(255,0,127,0.35)]",
    yellow: "border-yellow-400/60 text-yellow-300 hover:bg-yellow-400 hover:text-black shadow-[0_0_12px_rgba(255,230,0,0.35)]",
    red: "border-rose-500/60 text-rose-300 hover:bg-rose-500 hover:text-black shadow-[0_0_12px_rgba(255,0,85,0.4)]",
    green: "border-green-400/60 text-green-300 hover:bg-green-400 hover:text-black shadow-[0_0_12px_rgba(57,255,20,0.35)]",
  };
  return (
    <button
      className={`neon-btn font-mono-g uppercase tracking-wide text-xs font-bold px-4 py-2 rounded-md border bg-black/40 disabled:opacity-30 disabled:cursor-not-allowed ${map[color]} ${active ? "bg-white/10" : ""} ${className}`}
      {...p}
    >{children}</button>
  );
}

export function StatBar({ frac, color = "#00F3FF", height = 8 }) {
  return (
    <div className="w-full rounded-full bg-black/50 overflow-hidden" style={{ height }}>
      <div className="h-full rounded-full transition-all duration-300"
        style={{ width: `${Math.max(0, Math.min(1, frac)) * 100}%`, background: color, boxShadow: `0 0 8px ${color}` }} />
    </div>
  );
}

export function ResourceChip({ icon, value, sub, color, testid }) {
  return (
    <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg glass-card" data-testid={testid}>
      <span style={{ color }}>{icon}</span>
      <div className="leading-tight">
        <div className="font-mono-g font-bold text-sm" style={{ color }}>{Math.floor(value).toLocaleString()}</div>
        {sub != null && <div className="font-mono-g text-[10px] text-slate-400">{sub}</div>}
      </div>
    </div>
  );
}

export function TopResourceHUD({ state, compact }) {
  const rates = productionRates(state);
  const castleFrac = state.castleHp / state.castleMaxHp;
  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="top-resource-hud">
      <ResourceChip testid="hud-gold" icon={<Coins size={16} />} value={state.gold} color="#FFE600"
        sub={compact ? null : `${state.workersGold}w · +${rates.gold.toFixed(1)}/m`} />
      <ResourceChip testid="hud-food" icon={<Wheat size={16} />} value={state.food} color="#FF6600"
        sub={compact ? null : `${state.farmers}f · +${rates.food.toFixed(1)}/m`} />
      <ResourceChip testid="hud-stone" icon={<Mountain size={16} />} value={state.stone} color="#00F3FF"
        sub={compact ? null : `${state.workersStone}w · +${rates.stone.toFixed(1)}/m`} />
      <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg glass-card min-w-[110px]" data-testid="hud-morale">
        <Heart size={16} className="text-green-400" />
        <div className="flex-1">
          <div className="font-mono-g text-[10px] text-slate-400">MORALE {Math.round(state.morale)}</div>
          <StatBar frac={state.morale / 100} color={state.morale <= 0 ? "#FF0055" : "#39FF14"} height={5} />
        </div>
      </div>
      <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg glass-card min-w-[120px]" data-testid="hud-castle-hp">
        <Shield size={16} className="text-rose-400" />
        <div className="flex-1">
          <div className="font-mono-g text-[10px] text-slate-400">CASTLE {Math.round(state.castleHp)}/{state.castleMaxHp}</div>
          <StatBar frac={castleFrac} color="#FF0055" height={5} />
        </div>
      </div>
    </div>
  );
}

export const TowerIcon = ({ type, size = 18 }) => {
  const map = { archer: <Users size={size} />, catapult: <Hammer size={size} />, wizard: <Heart size={size} />, ballista: <Shield size={size} /> };
  return map[type] || <Hammer size={size} />;
};

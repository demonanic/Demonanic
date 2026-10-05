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


export function HeroMiniSprite({ cls = "knight", color, size = "md", dead = false }) {
  const c = color || ({
    knight: "#00F3FF",
    rouge: "#FF007F",
    mage: "#A855F7",
    archer: "#39FF14",
  }[cls] || "#00F3FF");
  const scale = size === "sm" ? 0.72 : size === "lg" ? 1.15 : 1;
  const shell = {
    width: (32 * scale) + "px",
    height: (36 * scale) + "px",
    "--hero-color": c,
    opacity: dead ? 0.3 : 1,
    filter: dead ? "grayscale(0.6)" : ("drop-shadow(0 0 6px " + c + ")"),
  };

  return (
    <div className="relative shrink-0 flex items-center justify-center" style={shell} aria-hidden="true">
      <div
        className="absolute rounded-t-[45%] rounded-b-[35%] border"
        style={{
          width: (19 * scale) + "px",
          height: (22 * scale) + "px",
          top: (7 * scale) + "px",
          background: "rgba(7,10,18,.92)",
          borderColor: c,
          boxShadow: "0 0 5px " + c,
        }}
      />
      <div
        className="absolute rounded-full"
        style={{
          width: (8 * scale) + "px",
          height: (6 * scale) + "px",
          top: (11 * scale) + "px",
          background: c,
          boxShadow: "0 0 5px " + c,
        }}
      />
      <div
        className="absolute"
        style={{
          width: (24 * scale) + "px",
          height: (10 * scale) + "px",
          bottom: (3 * scale) + "px",
          borderRadius: "45% 45% 25% 25%",
          background: "rgba(12,18,28,.96)",
          border: "1.5px solid " + c,
          boxShadow: "0 0 5px " + c,
        }}
      />
      {cls === "knight" && (
        <div className="absolute rounded-sm" style={{ width: (4 * scale) + "px", height: (15 * scale) + "px", right: (1 * scale) + "px", top: (3 * scale) + "px", background: c, boxShadow: "0 0 5px " + c, transform: "rotate(18deg)" }} />
      )}
      {cls === "rouge" && (
        <>
          <div className="absolute" style={{ width: (2 * scale) + "px", height: (15 * scale) + "px", left: (2 * scale) + "px", top: (2 * scale) + "px", background: c, transform: "rotate(-24deg)" }} />
          <div className="absolute" style={{ width: (2 * scale) + "px", height: (15 * scale) + "px", right: (2 * scale) + "px", top: (2 * scale) + "px", background: c, transform: "rotate(24deg)" }} />
        </>
      )}
      {cls === "mage" && (
        <div className="absolute rounded-full" style={{ width: (7 * scale) + "px", height: (7 * scale) + "px", right: (1 * scale) + "px", top: (1 * scale) + "px", background: c, boxShadow: "0 0 8px " + c }} />
      )}
      {cls === "archer" && (
        <div className="absolute rounded-full border" style={{ width: (16 * scale) + "px", height: (16 * scale) + "px", right: (-2 * scale) + "px", top: (5 * scale) + "px", borderColor: c, borderLeftColor: "transparent", transform: "rotate(-18deg)" }} />
      )}
      {dead && <div className="absolute inset-0 flex items-center justify-center text-rose-500 font-black text-lg">×</div>}
    </div>
  );
}

export const TACTICAL_HUD_KEY = "demonanic.tacticalHudOpaque";

export function getTacticalHudOpaque() {
  try { return localStorage.getItem(TACTICAL_HUD_KEY) === "1"; } catch { return false; }
}

export function setTacticalHudOpaque(value) {
  try { localStorage.setItem(TACTICAL_HUD_KEY, value ? "1" : "0"); } catch {}
}

export const TowerIcon = ({ type, size = 18 }) => {
  const map = { archer: <Users size={size} />, catapult: <Hammer size={size} />, wizard: <Heart size={size} />, ballista: <Shield size={size} /> };
  return map[type] || <Hammer size={size} />;
};

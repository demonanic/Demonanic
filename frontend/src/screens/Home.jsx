import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "../context/AuthContext";
import { useGame } from "../context/GameProvider";
import { castlePower, slotCap, deployedTowers } from "../game/logic";
import {
  Backpack, Coins, Eye, Heart, LogOut, Mountain, Pickaxe,
  Settings2, Shield, ShoppingBag, Skull, Swords, User, Wheat, Zap,
} from "lucide-react";
import { getTacticalHudOpaque, setTacticalHudOpaque } from "../components/ui-kit";

const MENU_RESOURCES = [
  { key: "gold", label: "GOLD", icon: Coins, color: "#FFE36E" },
  { key: "stone", label: "STONE", icon: Mountain, color: "#54E7F2" },
  { key: "metal", label: "METAL", icon: Pickaxe, color: "#FF9B59" },
];

export default function Home() {
  const { logout } = useAuth();
  const [hudOpaque, setHudOpaque] = useState(false);
  const { state, setScreen, offlineGains, setOfflineGains } = useGame();

  useEffect(() => {
    setHudOpaque(getTacticalHudOpaque());
  }, []);

  useEffect(() => {
    if (offlineGains) {
      toast.success(`Offline production (${offlineGains.minutes}m capped 12h)`, {
        description: `+${offlineGains.gold} gold · +${offlineGains.stone} stone${offlineGains.metal ? ` · +${offlineGains.metal} metal` : ""}`,
      });
      setOfflineGains(null);
    }
  }, [offlineGains, setOfflineGains]);

  if (!state) return null;
  const cp = castlePower(state);
  const towers = deployedTowers(state).length;
  const castleFrac = state.castleHp / Math.max(1, state.castleMaxHp);

  return (
    <main className="h-full w-full overflow-y-auto thin-scroll relative bg-[#090b12]" data-testid="home-screen">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-48 left-1/2 h-96 w-[min(44rem,120vw)] -translate-x-1/2 rounded-full opacity-30"
          style={{ background: "radial-gradient(ellipse, rgba(0,243,255,.15), rgba(255,0,127,.08) 48%, transparent 72%)" }} />
        <div className="absolute inset-0 opacity-[.08]" style={{ backgroundImage: "linear-gradient(rgba(84,231,242,.18) 1px, transparent 1px), linear-gradient(90deg, rgba(84,231,242,.18) 1px, transparent 1px)", backgroundSize: "32px 32px", maskImage: "linear-gradient(to bottom, black, transparent 65%)" }} />
      </div>

      <div className="relative mx-auto flex min-h-full w-full max-w-3xl flex-col gap-3 px-3 py-3 sm:gap-4 sm:px-6 sm:py-5">
        <header className="flex items-center justify-between gap-3">
          <div className="font-mono-g text-[10px] font-bold tracking-[.2em] text-slate-400 sm:text-xs">KEEP COMMAND</div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => { const next = !hudOpaque; setHudOpaque(next); setTacticalHudOpaque(next); }}
              className="flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-cyan-400/25 bg-slate-950/70 text-cyan-200 active:bg-cyan-950"
              data-testid="tactical-hud-setting" title="Tactical HUD opacity" aria-label={`Tactical HUD: ${hudOpaque ? "opaque" : "floating"}`}>
              <Settings2 size={18} />
            </button>
            <button type="button" onClick={logout}
              className="flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-rose-400/25 bg-slate-950/70 text-rose-200 active:bg-rose-950"
              data-testid="logout-button" title="Log out" aria-label="Log out"><LogOut size={18} /></button>
          </div>
        </header>

        <section className="grid grid-cols-3 gap-2" aria-label="Resources" data-testid="home-resources">
          {MENU_RESOURCES.map(({ key, label, icon: Icon, color }) => (
            <Resource key={key} label={label} value={state[key] || 0} icon={<Icon size={17} />} color={color} />
          ))}
          <Resource label="FOOD" value="N/A" icon={<Wheat size={17} />} color="#A8B0BF" detail="NOT TRACKED" testId="home-food" />
          <Resource label="MORALE" value={`${Math.round(state.morale)}%`} icon={<Heart size={17} />} color="#63E6A8" detail={<Meter value={state.morale / 100} color="#63E6A8" />} testId="home-morale" />
          <Resource label="CASTLE HP" value={`${Math.round(state.castleHp)}/${state.castleMaxHp}`} icon={<Shield size={17} />} color="#FF718B" detail={<Meter value={castleFrac} color="#FF718B" />} testId="home-castle-hp" />
        </section>

        <section className="relative overflow-hidden rounded-2xl border border-cyan-300/20 bg-slate-950/75 px-4 py-4 text-center sm:px-6 sm:py-5" aria-label="Demonanic keep">
          <div aria-hidden="true" className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-fuchsia-400/70 to-transparent" />
          <DemonSkull />
          <h1 className="mt-1 font-display text-3xl font-black tracking-[.12em] text-slate-100 sm:text-5xl">DEMONANIC</h1>
          <p className="mt-1 font-mono-g text-[10px] font-bold tracking-[.28em] text-cyan-300 sm:text-xs">DEFEND THE KEEP</p>
          <div className="mx-auto mt-4 grid max-w-xl grid-cols-2 gap-2 rounded-xl border border-white/10 bg-black/40 p-2 sm:grid-cols-4 sm:gap-3 sm:p-3" data-testid="home-stats">
            <Status label="CURRENT WAVE" value={state.wave} color="#54E7F2" />
            <Status label="CASTLE POWER" value={cp} color="#FFE36E" icon={<Zap size={13} />} />
            <Status label="TOWER SLOTS" value={`${towers}/${slotCap(state)}`} color="#80E8B1" />
            <Status label="BEST WAVE" value={state.bests.highestWave} color="#F48ACB" />
          </div>
        </section>

        <nav className="grid grid-cols-2 gap-2" aria-label="Main menu">
          <button type="button" onClick={() => setScreen("prep")} data-testid="enter-preparation-button"
            className="col-span-2 flex min-h-14 items-center justify-center gap-2 rounded-xl border border-fuchsia-300/60 bg-fuchsia-950/55 px-4 py-3 font-display text-sm font-extrabold tracking-wide text-fuchsia-100 shadow-[inset_0_0_24px_rgba(255,0,127,.12)] active:bg-fuchsia-900 sm:text-base">
            <Swords size={19} /> ENTER PREPARATION
          </button>
          <button type="button" onClick={() => setScreen("armory")} data-testid="home-armory-button"
            className="col-span-2 flex min-h-12 items-center justify-center gap-2 rounded-xl border border-yellow-300/35 bg-yellow-950/25 px-3 py-2.5 font-mono-g text-xs font-bold text-yellow-100 active:bg-yellow-900/40 sm:col-span-1">
            <Backpack size={17} /> ARMORY · INVENTORY · SHOPPE
          </button>
          <button type="button" onClick={() => setScreen("profile")} data-testid="open-profile-button"
            className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-cyan-300/30 bg-cyan-950/25 px-3 py-2.5 font-mono-g text-xs font-bold text-cyan-100 active:bg-cyan-900/40">
            <User size={17} /> PROFILE
          </button>
          <button type="button" onClick={() => setScreen("roster")} data-testid="open-roster-button"
            className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-fuchsia-300/30 bg-fuchsia-950/25 px-3 py-2.5 font-mono-g text-xs font-bold text-fuchsia-100 active:bg-fuchsia-900/40">
            <User size={17} /> ROSTER
          </button>
        </nav>

        <footer className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-1 font-mono-g text-[10px] text-slate-500" data-testid="home-inventory-summary">
          <span><Eye size={12} className="mr-1 inline" />HUD · {hudOpaque ? "OPAQUE" : "FLOATING"}</span>
          <span><ShoppingBag size={12} className="mr-1 inline" />VAULT {state.vault?.length || 0} · SHOPPE {state.shoppe?.inventory?.length || 0}</span>
        </footer>

        {state.surrenderTaxRate > 0 && (
          <p className="rounded-lg border border-rose-400/30 bg-rose-950/40 px-3 py-2 text-center font-mono-g text-xs text-rose-200" data-testid="surrender-tax-banner">
            Surrender tax applied: {(state.surrenderTaxRate * 100).toFixed(0)}% of exposed Gold · Wave {state.surrenderDebtWave}
          </p>
        )}
      </div>
    </main>
  );
}

function Resource({ label, value, icon, color, detail, testId }) {
  return (
    <div className="min-w-0 rounded-lg border border-white/10 bg-slate-950/75 px-2.5 py-2" data-testid={testId || `home-resource-${label.toLowerCase().replace(/\s/g, "-")}`}>
      <div className="flex items-center gap-1.5 font-mono-g text-[9px] font-bold tracking-wide text-slate-400">
        <span style={{ color }}>{icon}</span><span className="truncate">{label}</span>
      </div>
      <div className="mt-0.5 truncate font-display text-sm font-bold tabular-nums sm:text-base" style={{ color }}>{typeof value === "number" ? Math.floor(value).toLocaleString() : value}</div>
      {detail && <div className="mt-1 min-h-[5px] font-mono-g text-[8px] text-slate-500">{detail}</div>}
    </div>
  );
}

function Meter({ value, color }) {
  return <span className="block h-1 overflow-hidden rounded-full bg-white/10"><span className="block h-full rounded-full" style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, background: color }} /></span>;
}

function Status({ label, value, color, icon }) {
  return (
    <div className="min-w-0 rounded-lg px-1 py-1 text-center">
      <div className="flex items-center justify-center gap-1 font-mono-g text-[8px] font-bold tracking-wide text-slate-500 sm:text-[9px]">{icon}{label}</div>
      <div className="mt-0.5 truncate font-display text-lg font-bold tabular-nums sm:text-xl" style={{ color }}>{value}</div>
    </div>
  );
}

function DemonSkull() {
  return (
    <div className="relative mx-auto flex h-14 w-20 items-center justify-center" aria-label="Demonanic skull crest" role="img" data-testid="demonanic-skull-crest">
      <Skull size={44} strokeWidth={1.5} className="relative z-10 text-fuchsia-200" />
      <svg className="absolute h-14 w-20" viewBox="0 0 96 64" fill="none" aria-hidden="true">
        <path d="M31 24C22 18 18 10 18 4C29 7 37 13 41 22M65 24C74 18 78 10 78 4C67 7 59 13 55 22" stroke="#FFE36E" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M12 33H27M69 33H84" stroke="#54E7F2" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="48" cy="32" r="29" stroke="#54E7F2" strokeOpacity=".55" />
      </svg>
    </div>
  );
}

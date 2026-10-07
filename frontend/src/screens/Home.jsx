import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { useGame } from "@/context/GameProvider";
import { NeonButton, TopResourceHUD, getTacticalHudOpaque, setTacticalHudOpaque } from "@/components/ui-kit";
import { castlePower, slotCap, deployedTowers } from "@/game/logic";
import { Swords, User, LogOut, Zap, Skull, Settings2, Eye, EyeOff, Backpack, ShoppingBag } from "lucide-react";

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
        description: `+${offlineGains.gold} gold · +${offlineGains.food} food · +${offlineGains.stone} stone`,
      });
      setOfflineGains(null);
    }
  }, [offlineGains, setOfflineGains]);

  if (!state) return null;
  const cp = castlePower(state);

  return (
    <div className="h-full w-full flex flex-col relative overflow-hidden">
      <div className="absolute inset-0 opacity-30"
        style={{ background: "radial-gradient(circle at 50% 0%, rgba(255,0,85,0.25), transparent 55%)" }} />
      <div className="relative flex items-center justify-between p-4">
        <TopResourceHUD state={state} />
        <div className="flex items-center gap-2">
          <NeonButton color="cyan" onClick={() => { const next = !hudOpaque; setHudOpaque(next); setTacticalHudOpaque(next); }} data-testid="tactical-hud-setting" title="Tactical HUD opacity">
            <Settings2 size={14} />
          </NeonButton>
          <NeonButton color="red" onClick={logout} data-testid="logout-button"><LogOut size={14} /></NeonButton>
        </div>
      </div>

      <div className="relative flex-1 flex flex-col items-center justify-center px-6 text-center">
        <div className="absolute top-3 right-4 glass-card rounded-lg px-2 py-1.5 flex items-center gap-1.5 font-mono-g text-[8px] text-slate-400" data-testid="tactical-hud-setting-status">
          {hudOpaque ? <EyeOff size={11} className="text-fuchsia-400" /> : <Eye size={11} className="text-cyan-400" />}
          TACTICAL HUD · {hudOpaque ? "OPAQUE" : "FLOATING"}
        </div>
        <Skull className="text-fuchsia-500 mb-3 animate-pulse-glow" size={64} style={{ filter: "drop-shadow(0 0 22px #FF007F)" }} />
        <h1 className="font-display text-6xl font-black text-fuchsia-500 text-glow-magenta tracking-wider">DEMONANIC</h1>
        <p className="font-mono-g text-cyan-400 tracking-[0.3em] text-xs mt-2 mb-8">DEFEND THE KEEP</p>

        <div className="glass rounded-2xl px-6 py-4 mb-8 flex gap-8" data-testid="home-stats">
          <Stat label="WAVE" value={state.wave} color="#00F3FF" />
          <Stat label="CASTLE PWR" value={cp} color="#FFE600" icon={<Zap size={14} />} />
          <Stat label="TOWERS" value={`${deployedTowers(state).length}/${slotCap(state)}`} color="#39FF14" />
          <Stat label="BEST WAVE" value={state.bests.highestWave} color="#FF007F" />
        </div>

        <div className="flex flex-col gap-3 w-full max-w-xs">
          <NeonButton color="magenta" className="py-4 text-base" onClick={() => setScreen("prep")} data-testid="enter-preparation-button">
            <Swords size={16} className="inline mr-2" /> Enter Preparation
          </NeonButton>
          <NeonButton color="yellow" className="py-3 text-sm" onClick={() => setScreen("armory")} data-testid="home-armory-button">
            <Backpack size={15} className="inline mr-2" /> Armory · Inventory · Shoppe
          </NeonButton>
          <div className="flex items-center justify-center gap-4 font-mono-g text-[9px] text-slate-500 -mt-1">
            <span><Backpack size={10} className="inline mr-1" />Vault: {state.vault?.length || 0}</span>
            <span><ShoppingBag size={10} className="inline mr-1" />Shoppe: {state.shoppe?.inventory?.length || 0} items</span>
          </div>
          <div className="flex gap-3">
            <NeonButton color="cyan" className="flex-1 py-3" onClick={() => setScreen("profile")} data-testid="open-profile-button">
              <User size={14} className="inline mr-1" /> Profile
            </NeonButton>
            <NeonButton color="yellow" className="flex-1 py-3" onClick={() => setScreen("roster")} data-testid="open-roster-button">
              <User size={14} className="inline mr-1" /> Roster
            </NeonButton>
          </div>
        </div>
        {state.surrenderTaxRate > 0 && (
          <p className="mt-4 text-rose-400 font-mono-g text-xs" data-testid="surrender-tax-banner">
            ⚠ Gold tax active: {(state.surrenderTaxRate * 100).toFixed(0)}% until wave {state.surrenderDebtWave} is cleared
          </p>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, color, icon }) {
  return (
    <div className="text-center">
      <div className="font-mono-g text-[10px] text-slate-400 tracking-widest flex items-center justify-center gap-1">{icon}{label}</div>
      <div className="font-display font-black text-2xl" style={{ color, textShadow: `0 0 10px ${color}` }}>{value}</div>
    </div>
  );
}

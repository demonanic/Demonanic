import { useAuth } from "@/context/AuthContext";
import { useGame } from "@/context/GameProvider";
import { NeonButton, SectionTitle, TopResourceHUD } from "@/components/ui-kit";
import { castlePower, slotCap, deployedTowers } from "@/game/logic";
import { Home as HomeIcon, User } from "lucide-react";
import * as C from "@/game/config";

export default function Profile() {
  const { user, logout } = useAuth();
  const { state, setScreen } = useGame();
  if (!state) return null;
  const cp = castlePower(state);

  return (
    <div className="h-full w-full flex flex-col">
      <header className="p-3 flex items-center gap-2 border-b border-white/10">
        <NeonButton color="cyan" onClick={() => setScreen("home")} data-testid="profile-back"><HomeIcon size={14} /></NeonButton>
        <TopResourceHUD state={state} compact />
      </header>

      <div className="flex-1 overflow-y-auto thin-scroll p-4 space-y-4">
        <div className="glass rounded-2xl p-4 flex items-center gap-3" data-testid="profile-header">
          <div className="w-14 h-14 rounded-full bg-fuchsia-500 flex items-center justify-center" style={{ boxShadow: "0 0 18px #FF007F" }}>
            <User size={26} className="text-black" />
          </div>
          <div>
            <div className="font-display font-black text-2xl text-fuchsia-400 text-glow-magenta">{user?.username}</div>
            <div className="font-mono-g text-[11px] text-slate-400">Castle Power {cp} · Best Wave {state.bests.highestWave}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2" data-testid="profile-bests">
          <Card label="Highest Wave" value={state.bests.highestWave} color="#00F3FF" />
          <Card label="Total Kills" value={state.kills.total} color="#39FF14" />
          <Card label="Towers Deployed" value={`${deployedTowers(state).length}/${slotCap(state)}`} color="#FFE600" />
          <Card label="Free Life" value={state.freeLifeUsed ? "USED" : "AVAILABLE"} color="#A855F7" />
        </div>

        <div>
          <SectionTitle color="cyan">Castle Squad</SectionTitle>
          <div className="grid gap-2 mt-2" data-testid="profile-squad">
            {state.heroes.map((h, i) => {
              const cls = C.HERO_CLASSES[h.cls];
              return (
                <div key={i} className="glass-card rounded-lg p-2.5 flex items-center gap-3" style={{ borderLeft: `3px solid ${cls.color}` }}>
                  <div className="w-8 h-9 rounded" style={{ background: cls.color, boxShadow: `0 0 10px ${cls.color}` }} />
                  <div className="flex-1">
                    <div className="font-mono-g text-xs font-bold" style={{ color: cls.color }}>{cls.name} <span className="text-slate-500">L{h.level}</span></div>
                    <div className="font-mono-g text-[10px] text-slate-400">{h.attackConfig} · ATK{h.stats.attack} DEF{h.stats.defense} AGL{h.stats.agility} INT{h.stats.intelligence}</div>
                  </div>
                  <div className="font-mono-g text-[10px] text-slate-500">{h.perks.length} perks</div>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <SectionTitle color="yellow">Kill Log</SectionTitle>
          <div className="glass-card rounded-lg p-3 mt-2 flex flex-wrap gap-x-4 gap-y-1" data-testid="profile-kills">
            {Object.keys(state.kills.byType).length === 0 && <span className="font-mono-g text-xs text-slate-500">No kills yet</span>}
            {Object.entries(state.kills.byType).map(([type, n]) => (
              <span key={type} className="font-mono-g text-xs" style={{ color: C.ENEMIES[type]?.color || "#fff" }}>
                {C.ENEMIES[type]?.name || type}: <b>{n}</b>
              </span>
            ))}
          </div>
        </div>

        <NeonButton color="red" className="w-full py-3" onClick={logout} data-testid="profile-logout">Log Out</NeonButton>
      </div>
    </div>
  );
}

function Card({ label, value, color }) {
  return (
    <div className="glass-card rounded-lg px-3 py-2.5">
      <div className="font-mono-g text-[10px] text-slate-400 uppercase tracking-widest">{label}</div>
      <div className="font-display font-black text-xl" style={{ color, textShadow: `0 0 8px ${color}` }}>{value}</div>
    </div>
  );
}

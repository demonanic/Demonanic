import { useState } from "react";
import { useGame } from "@/context/GameProvider";
import { NeonButton } from "@/components/ui-kit";
import { setSquad } from "@/game/logic";
import * as C from "@/game/config";
import { X, Swords } from "lucide-react";

export default function SquadSelect() {
  const { mutate, setScreen, saveNow } = useGame();
  const [picks, setPicks] = useState([]);

  const add = (cls) => { if (picks.length < 4) setPicks([...picks, cls]); };
  const remove = (i) => setPicks(picks.filter((_, idx) => idx !== i));
  const confirm = () => {
    mutate((s) => setSquad(s, picks));
    saveNow();
    setScreen("home");
  };

  return (
    <div className="h-full w-full flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 opacity-30" style={{ background: "radial-gradient(circle at 50% 20%, rgba(255,0,127,0.25), transparent 55%)" }} />
      <div className="relative w-full max-w-md animate-rise">
        <h1 className="font-display font-black text-3xl text-fuchsia-500 text-glow-magenta uppercase tracking-wider text-center">Assemble Your Squad</h1>
        <p className="font-mono-g text-xs text-cyan-400 text-center tracking-widest mb-5">PICK ANY 4 — DUPLICATES ALLOWED</p>

        <div className="grid grid-cols-2 gap-2.5 mb-5" data-testid="squad-class-grid">
          {C.HERO_ORDER.map((cls) => {
            const c = C.HERO_CLASSES[cls];
            return (
              <button key={cls} onClick={() => add(cls)} disabled={picks.length >= 4} data-testid={`squad-pick-${cls}`}
                className="neon-btn glass-card rounded-xl p-3 text-left disabled:opacity-30" style={{ borderLeft: `3px solid ${c.color}` }}>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-9 rounded" style={{ background: c.color, boxShadow: `0 0 12px ${c.color}` }} />
                  <div>
                    <div className="font-display font-bold text-sm" style={{ color: c.color }}>{c.name}</div>
                    <div className="font-mono-g text-[9px] text-slate-400">{c.role}</div>
                  </div>
                </div>
                <div className="font-mono-g text-[9px] text-slate-500 mt-1.5">{c.ability.name} · HP{c.baseHp}</div>
              </button>
            );
          })}
        </div>

        <div className="glass rounded-xl p-3 mb-4" data-testid="squad-selection">
          <div className="font-mono-g text-[10px] text-slate-400 uppercase tracking-widest mb-2">Your Squad ({picks.length}/4)</div>
          <div className="flex gap-2">
            {[0, 1, 2, 3].map((i) => {
              const cls = picks[i];
              const c = cls ? C.HERO_CLASSES[cls] : null;
              return (
                <div key={i} className="flex-1 aspect-square rounded-lg border border-white/10 flex items-center justify-center relative"
                  style={c ? { background: c.color + "22", borderColor: c.color } : {}} data-testid={`squad-slot-${i}`}>
                  {c ? (
                    <>
                      <div className="w-6 h-7 rounded" style={{ background: c.color, boxShadow: `0 0 10px ${c.color}` }} />
                      <button onClick={() => remove(i)} className="absolute -top-1.5 -right-1.5 bg-black rounded-full" data-testid={`squad-remove-${i}`}><X size={14} className="text-rose-400" /></button>
                    </>
                  ) : <span className="font-mono-g text-slate-600 text-xs">+</span>}
                </div>
              );
            })}
          </div>
        </div>

        <NeonButton color="magenta" className="w-full py-3.5 text-base" disabled={picks.length !== 4} onClick={confirm} data-testid="squad-confirm">
          <Swords size={16} className="inline mr-2" /> Confirm Squad
        </NeonButton>
        <p className="font-mono-g text-[10px] text-slate-500 text-center mt-3">Recruit more heroes with Gold during Preparation as you progress.</p>
      </div>
    </div>
  );
}

import { toast } from "sonner";
import { useGame } from "@/context/GameProvider";
import { NeonButton } from "@/components/ui-kit";
import { gameApi } from "@/api";
import { freeLife, surrender } from "@/game/logic";
import { heroDerived } from "@/game/logic";
import { Trophy, Skull, Coins, Wheat, Mountain, Zap, Swords } from "lucide-react";

export default function Results() {
  const { state, lastResult, mutate, setScreen, saveNow } = useGame();
  if (!lastResult || !state) { setScreen("prep"); return null; }
  const r = lastResult;

  const goPrep = () => { saveNow(); setScreen("prep"); };
  const goHome = () => { saveNow(); setScreen("home"); };

  const doFreeLife = () => { mutate((s) => freeLife(s)); toast.success("Free life used — squad & castle restored (30% resources kept)"); setScreen("prep"); };

  const doRevive = async () => {
    try { await gameApi.reward("revive_hero", "mock_admob", { wave: r.wave }); } catch {}
    mutate((s) => {
      s.heroes.forEach((h) => { h.hp = heroDerived(h).maxHp; });
      s.towers.forEach((t) => { if (t) t.hp = t.maxHp; });
      s.castleHp = s.castleMaxHp;
    });
    toast.success("[MOCK AD] Reward granted — squad revived");
    setScreen("prep");
  };

  const doSurrender = () => { mutate((s) => surrender(s)); toast.error("Surrendered — Gold tax & morale penalty applied"); goHome(); };

  return (
    <div className="h-full w-full flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 opacity-30" style={{ background: r.victory ? "radial-gradient(circle at 50% 30%, rgba(57,255,20,0.25), transparent 55%)" : "radial-gradient(circle at 50% 40%, rgba(255,0,85,0.3), transparent 55%)" }} />
      <div className="relative glass rounded-2xl w-full max-w-md p-6 animate-rise text-center">
        {r.victory ? (
          <>
            <Trophy className="mx-auto text-green-400 mb-2" size={48} style={{ filter: "drop-shadow(0 0 16px #39FF14)" }} />
            <h1 className="font-display font-black text-4xl text-green-400 text-glow-cyan uppercase tracking-wider">Wave Cleared</h1>
            <p className="font-mono-g text-xs text-slate-400 mb-4">Wave {r.wave} defeated</p>
          </>
        ) : (
          <>
            <Skull className="mx-auto text-rose-500 mb-2 animate-pulse-glow" size={48} style={{ filter: "drop-shadow(0 0 16px #FF0055)" }} />
            <h1 className="font-display font-black text-4xl text-rose-500 text-glow-red uppercase tracking-wider">Castle Fallen</h1>
            <p className="font-mono-g text-xs text-slate-400 mb-4">The keep was breached on wave {r.wave}</p>
          </>
        )}

        <div className="grid grid-cols-2 gap-2 mb-5 text-left">
          <Stat icon={<Swords size={14} />} label="Enemies Killed" value={r.killed} color="#39FF14" />
          <Stat icon={<Zap size={14} />} label="XP Gained" value={r.totalXp} color="#00F3FF" />
          <Stat icon={<Coins size={14} />} label="Gold" value={r.goldAfter} color="#FFE600" />
          <Stat icon={<Wheat size={14} />} label="Food" value={r.foodAfter} color="#FF6600" />
          <Stat icon={<Mountain size={14} />} label="Stone" value={r.stoneAfter} color="#00F3FF" />
          <Stat icon={<Trophy size={14} />} label="Level-Ups" value={r.leveledUp} color="#A855F7" />
        </div>

        {r.victory ? (
          <NeonButton color="green" className="w-full py-3" onClick={goPrep} data-testid="results-continue">Continue → Preparation</NeonButton>
        ) : (
          <div className="space-y-2">
            {!state.freeLifeUsed && (
              <NeonButton color="cyan" className="w-full py-3" onClick={doFreeLife} data-testid="results-free-life">
                Use Free Life (retain 30% resources)
              </NeonButton>
            )}
            <NeonButton color="magenta" className="w-full py-3" onClick={doRevive} data-testid="results-revive-ad">
              📺 Watch Ad to Revive Squad (mock)
            </NeonButton>
            <NeonButton color="red" className="w-full py-3" onClick={doSurrender} data-testid="results-surrender">
              Surrender (tax + morale penalty)
            </NeonButton>
          </div>
        )}
        <p className="font-mono-g text-[9px] text-slate-500 mt-3">Revive rewards routed through the mocked provider-independent monetization service.</p>
      </div>
    </div>
  );
}

function Stat({ icon, label, value, color }) {
  return (
    <div className="glass-card rounded-lg px-3 py-2 flex items-center gap-2">
      <span style={{ color }}>{icon}</span>
      <div>
        <div className="font-mono-g text-[9px] text-slate-400 uppercase tracking-wide">{label}</div>
        <div className="font-mono-g font-bold text-sm" style={{ color }}>{value}</div>
      </div>
    </div>
  );
}

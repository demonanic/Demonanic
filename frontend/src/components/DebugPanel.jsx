import { useState } from "react";
import { useGame } from "@/context/GameProvider";
import { NeonButton } from "@/components/ui-kit";
import { Input } from "@/components/ui/input";
import { X } from "lucide-react";
import * as C from "@/game/config";
import { heroDerived, towerDerived, freeLife, produce, castlePower } from "@/game/logic";

export default function DebugPanel({ onClose, battleActions }) {
  const { state, mutate } = useGame();
  const [gold, setGold] = useState("");
  const [food, setFood] = useState("");
  const [stone, setStone] = useState("");
  const [wave, setWave] = useState("");
  const [morale, setMorale] = useState("");
  const [hLvl, setHLvl] = useState("");
  const [tLvl, setTLvl] = useState("");
  if (!state) return null;

  const setRes = () => mutate((s) => {
    if (gold !== "") s.gold = +gold;
    if (food !== "") s.food = +food;
    if (stone !== "") s.stone = +stone;
    if (morale !== "") s.morale = Math.max(0, Math.min(100, +morale));
  });
  const setWaveFn = () => mutate((s) => { if (wave !== "") s.wave = Math.max(1, +wave); });
  const setHeroLevels = () => mutate((s) => {
    const lvl = Math.max(1, Math.min(20, +hLvl || 1));
    s.heroes.forEach((h) => {
      h.level = lvl; h.xp = C.HERO_XP[lvl - 1]; h.sp = lvl - 1; h.ap = lvl - 1;
      h.hp = heroDerived(h).maxHp;
    });
  });
  const setTowerLevels = () => mutate((s) => {
    const lvl = Math.max(1, Math.min(30, +tLvl || 1));
    s.towers.forEach((t) => { if (t) { t.level = lvl; t.xp = 150 * lvl * (lvl + 1) / 2; t.hp = towerDerived(t).maxHp; } });
  });
  const advanceTime = (mins) => mutate((s) => produce(s, mins * 60));
  const doFreeLife = () => mutate((s) => freeLife(s));
  const toggleScout = () => mutate((s) => { s.scoutKnowledge = s.scoutKnowledge > 0 ? 0 : 100; });
  const healCastle = () => mutate((s) => { s.castleHp = s.castleMaxHp; });
  const damageCastle = () => mutate((s) => { s.castleHp = Math.max(0, s.castleHp - s.castleMaxHp * 0.25); });

  return (
    <div className="fixed inset-y-0 right-0 z-[60] w-[320px] max-w-[92vw] glass p-4 overflow-y-auto thin-scroll animate-rise" data-testid="debug-panel">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display font-black text-green-400 text-glow-cyan uppercase tracking-wider">Dev Panel</h3>
        <button onClick={onClose} data-testid="debug-close"><X className="text-slate-400 hover:text-white" size={18} /></button>
      </div>
      <p className="font-mono-g text-[10px] text-slate-500 mb-3">CP {castlePower(state)} · Wave {state.wave}</p>

      <Group title="Resources / Morale">
        <div className="grid grid-cols-2 gap-1.5">
          <Field ph="Gold" v={gold} set={setGold} tid="debug-gold" />
          <Field ph="Food" v={food} set={setFood} tid="debug-food" />
          <Field ph="Stone" v={stone} set={setStone} tid="debug-stone" />
          <Field ph="Morale" v={morale} set={setMorale} tid="debug-morale" />
        </div>
        <NeonButton color="green" className="w-full mt-1.5" onClick={setRes} data-testid="debug-set-resources">Set</NeonButton>
      </Group>

      <Group title="Progression">
        <div className="flex gap-1.5"><Field ph="Wave" v={wave} set={setWave} tid="debug-wave" /><NeonButton color="cyan" onClick={setWaveFn}>Set</NeonButton></div>
        <div className="flex gap-1.5 mt-1.5"><Field ph="Hero Lvl" v={hLvl} set={setHLvl} tid="debug-hero-level" /><NeonButton color="cyan" onClick={setHeroLevels} data-testid="debug-hero-level-all">All</NeonButton></div>
        <div className="flex gap-1.5 mt-1.5"><Field ph="Tower Lvl" v={tLvl} set={setTLvl} tid="debug-tower-level" /><NeonButton color="cyan" onClick={setTowerLevels} data-testid="debug-tower-level-all">All</NeonButton></div>
      </Group>

      <Group title="Castle / Time">
        <div className="grid grid-cols-2 gap-1.5">
          <NeonButton color="green" onClick={healCastle} data-testid="debug-heal-castle">Heal Castle</NeonButton>
          <NeonButton color="red" onClick={damageCastle} data-testid="debug-damage-castle">-25% Castle</NeonButton>
          <NeonButton color="yellow" onClick={() => advanceTime(60)} data-testid="debug-advance-1h">+1h Prod</NeonButton>
          <NeonButton color="yellow" onClick={() => advanceTime(720)} data-testid="debug-advance-12h">+12h (cap)</NeonButton>
          <NeonButton color="magenta" onClick={doFreeLife} data-testid="debug-free-life">Free Life</NeonButton>
          <NeonButton color="cyan" onClick={toggleScout} data-testid="debug-scout">Scout {state.scoutKnowledge > 0 ? "OFF" : "ON"}</NeonButton>
        </div>
      </Group>

      {battleActions && (
        <Group title="Combat">
          <div className="grid grid-cols-2 gap-1.5">
            <NeonButton color="green" onClick={() => battleActions.spawn("ghost")} data-testid="debug-spawn-basic">Spawn Basic</NeonButton>
            <NeonButton color="orange" onClick={() => battleActions.spawn("orc")} data-testid="debug-spawn-spec">Spawn Spec</NeonButton>
            <NeonButton color="magenta" onClick={() => battleActions.spawn("lieutenant")} data-testid="debug-spawn-elite">Spawn Elite</NeonButton>
            <NeonButton color="red" onClick={battleActions.forceBoss} data-testid="debug-force-boss">Force Boss</NeonButton>
            <NeonButton color="red" onClick={battleActions.forceDefeat} data-testid="debug-force-defeat">Force Defeat</NeonButton>
            <NeonButton color="green" onClick={battleActions.forceWin} data-testid="debug-force-win">Force Win</NeonButton>
          </div>
        </Group>
      )}
    </div>
  );
}

function Group({ title, children }) {
  return (
    <div className="mb-3 glass-card rounded-lg p-2.5">
      <div className="font-mono-g text-[10px] uppercase tracking-widest text-cyan-400 mb-1.5">{title}</div>
      {children}
    </div>
  );
}
function Field({ ph, v, set, tid }) {
  return <Input data-testid={tid} value={v} onChange={(e) => set(e.target.value)} placeholder={ph} type="number"
    className="bg-black/40 border-white/10 text-slate-100 font-mono-g h-8 text-xs" />;
}

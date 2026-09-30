import { useState } from "react";
import { toast } from "sonner";
import { useGame } from "@/context/GameProvider";
import { NeonButton, TopResourceHUD, SectionTitle, StatBar } from "@/components/ui-kit";
import { HeroCard, TowerCard } from "@/components/cards";
import PrepField from "@/components/PrepField";
import DebugPanel from "@/components/DebugPanel";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Home as HomeIcon, Swords, Terminal, UserPlus, ArrowRightLeft } from "lucide-react";
import * as C from "@/game/config";
import {
  castlePower, slotCap, buildTower, dismantleTower, repairTower, applyTowerUpgrade,
  buyBarricade, repairBarricade, buyFarmer, buyWorker, allocateSp, buyPerk, repairCastle,
  recruitHero, swapHero, heroDerived, productionRates,
} from "@/game/logic";

export default function Preparation() {
  const { state, mutate, setScreen, saveNow } = useGame();
  const [openHero, setOpenHero] = useState(null);   // {list:'squad'|'bench', idx}
  const [openTower, setOpenTower] = useState(null);
  const [debug, setDebug] = useState(false);
  if (!state) return null;

  const cap = slotCap(state);
  const cp = castlePower(state);
  const rates = productionRates(state);
  const owned = state.heroes.length + (state.bench?.length || 0);

  const act = (fn, okMsg, failMsg) => mutate((s) => { if (!fn(s)) { toast.error(failMsg || "Cannot afford / invalid"); } else if (okMsg) toast.success(okMsg); });

  const handlers = {
    build: (slot, type) => act((s) => buildTower(s, type, slot), `${C.TOWERS[type].name} built`),
    dismantle: (slot) => act((s) => dismantleTower(s, slot), "Dismantled (30% refund)"),
    repairTower: (slot) => act((s) => repairTower(s, slot), "Repaired"),
    openCard: (slot) => setOpenTower(slot),
    buyBarricade: (pos, g) => act((s) => buyBarricade(s, pos, g), `+${g * C.BARRICADE.goldToHp} HP`),
    repairBarricade: (pos) => act((s) => repairBarricade(s, pos), "Repaired"),
  };

  const startWave = () => { saveNow(); setScreen("battle"); };
  const hero = openHero ? (openHero.list === "squad" ? state.heroes[openHero.idx] : state.bench[openHero.idx]) : null;

  return (
    <div className="h-full w-full flex flex-col">
      <header className="p-3 flex items-center gap-2 border-b border-white/10 flex-wrap">
        <NeonButton color="cyan" onClick={() => { saveNow(); setScreen("home"); }} data-testid="back-home"><HomeIcon size={14} /></NeonButton>
        <TopResourceHUD state={state} />
        <div className="ml-auto flex gap-2">
          <NeonButton color="green" onClick={() => setDebug(true)} data-testid="debug-toggle-panel"><Terminal size={14} /></NeonButton>
          <NeonButton color="magenta" className="!py-2.5 !px-5" onClick={startWave} data-testid="start-wave-button">
            <Swords size={14} className="inline mr-1.5" /> Start Wave {state.wave}
          </NeonButton>
        </div>
      </header>

      <div className="px-3 py-1.5 flex items-center gap-4 font-mono-g text-[11px] text-slate-400 border-b border-white/5">
        <span>CASTLE PWR <b className="text-yellow-300">{cp}</b></span>
        <span>SLOTS <b className="text-green-400">{cap}/5</b></span>
        <span>PROD ×<b className="text-cyan-300">{(rates.moraleMul * rates.castleEff).toFixed(2)}</b></span>
        {state.castleHp < state.castleMaxHp && (
          <NeonButton color="red" className="!py-1 !px-2 ml-auto" onClick={() => act(repairCastle, "Castle repaired")} data-testid="repair-castle">
            Repair Castle ({C.repairFoodCost(state.castleMaxHp - state.castleHp)}f)
          </NeonButton>
        )}
      </div>

      <div className="flex-1 overflow-y-auto thin-scroll p-3">
        <SectionTitle color="cyan">Battlefield · Place Defenses</SectionTitle>
        <p className="font-mono-g text-[10px] text-slate-500 mb-2">Tap strategic locations to build/upgrade towers and reinforce barricade lanes by hand.</p>
        <PrepField state={state} handlers={handlers} />

        <div className="mt-4">
          <Tabs defaultValue="heroes">
            <TabsList className="bg-black/40 border border-white/10 mb-3">
              <TabsTrigger value="heroes" data-testid="tab-heroes">Squad</TabsTrigger>
              <TabsTrigger value="workforce" data-testid="tab-workforce">Workforce</TabsTrigger>
            </TabsList>

            {/* SQUAD + RECRUIT */}
            <TabsContent value="heroes">
              <div className="grid gap-2.5" data-testid="hero-list">
                {state.heroes.map((h, i) => <HeroRow key={h.id} h={h} onClick={() => setOpenHero({ list: "squad", idx: i })} testid={`hero-slot-${i}`} />)}
              </div>

              <div className="glass-card rounded-xl p-3 mt-3" data-testid="recruit-panel">
                <SectionTitle color="magenta">Recruit Hero</SectionTitle>
                <p className="font-mono-g text-[10px] text-slate-400 mt-1 mb-2">Cost {C.recruitCost(owned)}g · fills an empty slot or goes to the bench.</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {C.HERO_ORDER.map((cls) => {
                    const c = C.HERO_CLASSES[cls];
                    return (
                      <button key={cls} data-testid={`recruit-${cls}`} onClick={() => act((s) => recruitHero(s, cls), `${c.name} recruited`)}
                        className="neon-btn flex items-center gap-2 p-2 rounded-lg border bg-black/40" style={{ borderColor: c.color + "55" }}>
                        <div className="w-6 h-7 rounded" style={{ background: c.color, boxShadow: `0 0 8px ${c.color}` }} />
                        <div className="text-left">
                          <div className="font-mono-g text-xs font-bold" style={{ color: c.color }}>{c.name}</div>
                          <div className="font-mono-g text-[9px] text-slate-400 flex items-center gap-1"><UserPlus size={9} />{C.recruitCost(owned)}g</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {state.bench && state.bench.length > 0 && (
                <div className="glass-card rounded-xl p-3 mt-3" data-testid="bench-panel">
                  <SectionTitle color="yellow">Bench · Swap into Squad</SectionTitle>
                  <div className="grid gap-2 mt-2">
                    {state.bench.map((h, bi) => {
                      const c = C.HERO_CLASSES[h.cls];
                      return (
                        <div key={h.id} className="flex items-center gap-2 p-2 rounded-lg bg-black/30" style={{ borderLeft: `3px solid ${c.color}` }} data-testid={`bench-hero-${bi}`}>
                          <button onClick={() => setOpenHero({ list: "bench", idx: bi })} className="w-7 h-8 rounded shrink-0" style={{ background: c.color, boxShadow: `0 0 8px ${c.color}` }} data-testid={`bench-card-${bi}`} />
                          <span className="font-mono-g text-xs flex-1" style={{ color: c.color }}>{c.name} <span className="text-slate-500">L{h.level}</span></span>
                          <span className="font-mono-g text-[9px] text-slate-500 flex items-center gap-0.5"><ArrowRightLeft size={9} /></span>
                          {[0, 1, 2, 3].map((si) => state.heroes[si] && (
                            <button key={si} onClick={() => act((s) => swapHero(s, bi, si), "Swapped")} data-testid={`bench-swap-${bi}-${si}`}
                              className="w-6 h-6 rounded bg-cyan-500/20 border border-cyan-400/50 text-cyan-300 font-mono-g text-[10px]">S{si + 1}</button>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </TabsContent>

            {/* WORKFORCE */}
            <TabsContent value="workforce">
              <div className="grid gap-3">
                <div className="glass-card rounded-xl p-3" data-testid="workforce-farmers">
                  <SectionTitle color="yellow">Farmers → Food</SectionTitle>
                  <div className="flex items-center justify-between mt-2">
                    <span className="font-mono-g text-sm text-slate-300">{state.farmers} farmers · +{rates.food.toFixed(1)} food/m</span>
                    <NeonButton color="yellow" onClick={() => act(buyFarmer, "Farmer hired")} data-testid="buy-farmer">Hire ({C.farmerCost(state.farmers)}g)</NeonButton>
                  </div>
                </div>
                <div className="glass-card rounded-xl p-3" data-testid="workforce-workers">
                  <SectionTitle color="cyan">Workers → Gold / Stone</SectionTitle>
                  <div className="font-mono-g text-xs text-slate-400 mt-2">{state.workers} workers · {state.workersGold} gold ({rates.gold.toFixed(1)}/m) · {state.workersStone} stone ({rates.stone.toFixed(1)}/m)</div>
                  <div className="flex gap-2 mt-2">
                    <NeonButton color="yellow" className="flex-1" onClick={() => act((s) => buyWorker(s, "gold"), "Gold worker hired")} data-testid="buy-worker-gold">Hire → Gold ({C.workerCost(state.workers)}g)</NeonButton>
                    <NeonButton color="cyan" className="flex-1" onClick={() => act((s) => buyWorker(s, "stone"), "Stone worker hired")} data-testid="buy-worker-stone">Hire → Stone ({C.workerCost(state.workers)}g)</NeonButton>
                  </div>
                  <div className="flex gap-2 mt-2">
                    <NeonButton color="cyan" className="flex-1 !text-[10px]" onClick={() => act((s) => { if (s.workersStone > 0) { s.workersStone--; s.workersGold++; return true; } return false; }, "Reallocated → Gold")} data-testid="realloc-gold">Move Stone→Gold</NeonButton>
                    <NeonButton color="cyan" className="flex-1 !text-[10px]" onClick={() => act((s) => { if (s.workersGold > 0) { s.workersGold--; s.workersStone++; return true; } return false; }, "Reallocated → Stone")} data-testid="realloc-stone">Move Gold→Stone</NeonButton>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {hero && (
        <HeroCard hero={hero} editable
          onAlloc={(st) => mutate((s) => allocateSp(openHero.list === "squad" ? s.heroes[openHero.idx] : s.bench[openHero.idx], st))}
          onPerk={(p) => mutate((s) => { if (!buyPerk(openHero.list === "squad" ? s.heroes[openHero.idx] : s.bench[openHero.idx], p)) toast.error("Not enough AP"); })}
          onConfig={(cfg) => mutate((s) => { const t = openHero.list === "squad" ? s.heroes[openHero.idx] : s.bench[openHero.idx]; t.attackConfig = cfg; })}
          onClose={() => setOpenHero(null)} />
      )}
      {openTower != null && state.towers[openTower] && (
        <TowerCard tower={state.towers[openTower]} editable
          onUpgrade={(ch) => mutate((s) => { if (!applyTowerUpgrade(s, openTower, ch)) toast.error("No pending upgrade"); else toast.success("Tower upgraded"); })}
          onClose={() => setOpenTower(null)} />
      )}
      {debug && <DebugPanel onClose={() => setDebug(false)} />}
    </div>
  );
}

function HeroRow({ h, onClick, testid }) {
  const d = heroDerived(h);
  const cls = C.HERO_CLASSES[h.cls];
  return (
    <button onClick={onClick} data-testid={testid}
      className="glass-card rounded-xl p-3 flex items-center gap-3 text-left w-full" style={{ borderLeft: `3px solid ${cls.color}` }}>
      <div className="w-9 h-11 rounded" style={{ background: cls.color, boxShadow: `0 0 12px ${cls.color}` }} />
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-display font-bold" style={{ color: cls.color }}>{cls.name}</span>
          <span className="font-mono-g text-[10px] text-slate-400">L{h.level}</span>
          {(h.sp > 0 || h.ap > 0) && <span className="font-mono-g text-[9px] text-fuchsia-400 animate-pulse-glow">SP{h.sp} AP{h.ap}</span>}
        </div>
        <div className="font-mono-g text-[10px] text-slate-500">{h.attackConfig} · {Math.round(h.hp)}/{d.maxHp} HP</div>
        <StatBar frac={h.hp / d.maxHp} color={cls.color} height={3} />
      </div>
    </button>
  );
}

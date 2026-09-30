import { useState } from "react";
import { toast } from "sonner";
import { useGame } from "@/context/GameProvider";
import { NeonButton, TopResourceHUD, SectionTitle, StatBar } from "@/components/ui-kit";
import { HeroCard, TowerCard } from "@/components/cards";
import DebugPanel from "@/components/DebugPanel";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Home as HomeIcon, Swords, Wrench, Terminal, Plus, Hammer, Trash2, ShieldPlus } from "lucide-react";
import * as C from "@/game/config";
import {
  castlePower, slotCap, buildTower, dismantleTower, repairTower, applyTowerUpgrade,
  buyBarricade, repairBarricade, buyFarmer, buyWorker, allocateSp, buyPerk, repairCastle,
  heroDerived, towerDerived, canAfford, productionRates,
} from "@/game/logic";

export default function Preparation() {
  const { state, mutate, setScreen, saveNow } = useGame();
  const [openHero, setOpenHero] = useState(null);
  const [openTower, setOpenTower] = useState(null);
  const [buildSlot, setBuildSlot] = useState(null);
  const [debug, setDebug] = useState(false);
  if (!state) return null;

  const cap = slotCap(state);
  const cp = castlePower(state);
  const rates = productionRates(state);

  const act = (fn, okMsg, failMsg) => mutate((s) => { if (!fn(s)) { toast.error(failMsg || "Cannot afford / invalid"); } else if (okMsg) toast.success(okMsg); });

  const startWave = () => { saveNow(); setScreen("battle"); };

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
        <Tabs defaultValue="towers">
          <TabsList className="bg-black/40 border border-white/10 mb-3">
            <TabsTrigger value="towers" data-testid="tab-towers">Towers</TabsTrigger>
            <TabsTrigger value="barricades" data-testid="tab-barricades">Barricades</TabsTrigger>
            <TabsTrigger value="heroes" data-testid="tab-heroes">Heroes</TabsTrigger>
            <TabsTrigger value="workforce" data-testid="tab-workforce">Workforce</TabsTrigger>
          </TabsList>

          {/* TOWERS */}
          <TabsContent value="towers">
            <div className="grid gap-2.5" data-testid="tower-slots">
              {state.towers.map((tw, slot) => {
                const unlocked = slot < cap;
                if (!unlocked) return (
                  <div key={slot} className="glass-card rounded-xl p-3 opacity-50 flex items-center gap-3" data-testid={`tower-slot-${slot}`}>
                    <div className="w-10 h-10 bracket rounded" />
                    <span className="font-mono-g text-xs text-slate-500">Slot {slot + 1} locked — needs {C.SLOT_THRESHOLDS[slot]} CP</span>
                  </div>
                );
                if (!tw) return (
                  <div key={slot} className="glass-card rounded-xl p-3" data-testid={`tower-slot-${slot}`}>
                    {buildSlot === slot ? (
                      <div>
                        <div className="font-mono-g text-[10px] text-slate-400 mb-1.5">Build in slot {slot + 1}:</div>
                        <div className="grid grid-cols-2 gap-1.5">
                          {C.TOWER_ORDER.map((tp) => {
                            const t = C.TOWERS[tp];
                            const ok = canAfford(state, t.construction);
                            return (
                              <button key={tp} disabled={!ok} onClick={() => { act((s) => buildTower(s, tp, slot), `${t.name} built`); setBuildSlot(null); }}
                                data-testid={`build-${tp}-${slot}`}
                                className="text-left p-2 rounded-lg border bg-black/40 disabled:opacity-30" style={{ borderColor: t.color + "66" }}>
                                <div className="font-mono-g text-xs font-bold" style={{ color: t.color }}>{t.name}</div>
                                <div className="font-mono-g text-[9px] text-slate-400">{t.construction.gold}g {t.construction.stone}s {t.construction.food}f</div>
                              </button>
                            );
                          })}
                        </div>
                        <button onClick={() => setBuildSlot(null)} className="font-mono-g text-[10px] text-slate-500 mt-1.5">cancel</button>
                      </div>
                    ) : (
                      <button onClick={() => setBuildSlot(slot)} data-testid={`build-open-${slot}`}
                        className="w-full flex items-center gap-3 text-cyan-300">
                        <div className="w-10 h-10 bracket rounded flex items-center justify-center"><Plus size={18} /></div>
                        <span className="font-mono-g text-xs">Empty slot {slot + 1} — build tower</span>
                      </button>
                    )}
                  </div>
                );
                const d = towerDerived(tw);
                const t = C.TOWERS[tw.type];
                return (
                  <div key={slot} className="glass-card rounded-xl p-3 flex items-center gap-3" data-testid={`tower-slot-${slot}`} style={{ borderLeft: `3px solid ${t.color}` }}>
                    <button onClick={() => setOpenTower(slot)} className="w-10 h-10 bracket rounded flex items-center justify-center shrink-0" data-testid={`open-tower-card-${slot}`}>
                      <div className="w-4 h-4 rounded" style={{ background: t.color, boxShadow: `0 0 10px ${t.color}` }} />
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono-g text-xs font-bold" style={{ color: t.color }}>{t.name}</span>
                        <span className="font-mono-g text-[10px] text-slate-400">L{tw.level}</span>
                        {tw.pending > 0 && <span className="font-mono-g text-[9px] text-yellow-300 animate-pulse-glow">⬆{tw.pending}</span>}
                        {tw.underfunded && <span className="font-mono-g text-[9px] text-rose-400">UNDERFUNDED</span>}
                      </div>
                      <StatBar frac={tw.hp / d.maxHp} color={t.color} height={4} />
                      <div className="font-mono-g text-[9px] text-slate-500 mt-0.5">{Math.round(tw.hp)}/{d.maxHp} HP · upkeep {t.upkeep.gold}g {t.upkeep.stone}s</div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <NeonButton color="green" className="!px-2 !py-1 !text-[9px]" onClick={() => act((s) => repairTower(s, slot), "Repaired")} data-testid={`repair-tower-${slot}`}><Wrench size={11} /></NeonButton>
                      <NeonButton color="red" className="!px-2 !py-1 !text-[9px]" onClick={() => act((s) => dismantleTower(s, slot), "Dismantled (30% refund)")} data-testid={`dismantle-tower-${slot}`}><Trash2 size={11} /></NeonButton>
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>

          {/* BARRICADES */}
          <TabsContent value="barricades">
            <div className="grid gap-2.5" data-testid="barricade-list">
              {state.barricades.map((b, pos) => (
                <div key={pos} className="glass-card rounded-xl p-3" data-testid={`barricade-${pos}`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-mono-g text-xs text-yellow-300">Position {pos + 1}</span>
                    <span className="font-mono-g text-[10px] text-slate-400">{Math.round(b.hp)}/{Math.round(b.maxHp)} HP</span>
                  </div>
                  <div className="h-3 rounded hazard mb-2" style={{ opacity: b.maxHp > 0 ? 0.4 + 0.6 * (b.hp / b.maxHp) : 0.15 }} />
                  <div className="flex gap-1.5 flex-wrap">
                    {[25, 50, 100].map((g) => (
                      <NeonButton key={g} color="yellow" className="!px-2 !py-1 !text-[10px]" onClick={() => act((s) => buyBarricade(s, pos, g), `+${g * C.BARRICADE.goldToHp} HP`)} data-testid={`barricade-buy-${pos}-${g}`}>+{g}g</NeonButton>
                    ))}
                    {b.hp < b.maxHp && <NeonButton color="green" className="!px-2 !py-1 !text-[10px]" onClick={() => act((s) => repairBarricade(s, pos), "Repaired")} data-testid={`barricade-repair-${pos}`}><Wrench size={11} /></NeonButton>}
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* HEROES */}
          <TabsContent value="heroes">
            <div className="grid gap-2.5" data-testid="hero-list">
              {state.heroes.map((h, i) => {
                const d = heroDerived(h);
                const cls = C.HERO_CLASSES[h.cls];
                return (
                  <button key={i} onClick={() => setOpenHero(i)} data-testid={`hero-slot-${i}`}
                    className="glass-card rounded-xl p-3 flex items-center gap-3 text-left" style={{ borderLeft: `3px solid ${cls.color}` }}>
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
              })}
            </div>
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

      {openHero != null && (
        <HeroCard hero={state.heroes[openHero]} editable
          onAlloc={(st) => mutate((s) => allocateSp(s.heroes[openHero], st))}
          onPerk={(p) => mutate((s) => { if (!buyPerk(s.heroes[openHero], p)) toast.error("Not enough AP"); })}
          onConfig={(cfg) => mutate((s) => { s.heroes[openHero].attackConfig = cfg; })}
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

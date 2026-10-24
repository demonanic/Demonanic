import { useState } from "react";
import { toast } from "sonner";
import { useGame } from "../context/GameProvider";
import { NeonButton, TopResourceHUD, SectionTitle, StatBar, HeroMiniSprite } from "../components/ui-kit";
import { HeroCard, TowerCard } from "../components/cards";
import PrepField from "../components/PrepField";
import CastleBuildings from "../components/CastleBuildings";
import ClasslessHeroAvatar from "../components/ClasslessHeroAvatar";
import DebugPanel from "../components/DebugPanel";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { Home as HomeIcon, Swords, Terminal, ArrowRightLeft, Heart, Skull, Backpack } from "lucide-react";
import * as C from "../game/config";
import { isRewardedAdConfirmed } from "../game/rewards";
import { gameApi } from "../api";
import {
  castlePower, slotCap, canAfford, buildTower, dismantleTower, repairTower, upgradeTower, chooseTowerSpecialization, resupplyTower, repositionTower,
  buyBarricade, repairBarricade, buyWorker, commitHeroProgressionDraft, repairCastle,
  swapHero, heroDerived, productionRates, healHero, reviveHero,
} from "../game/logic";

export default function Preparation() {
  const { state, mutate, setScreen, saveNow, offlineGains } = useGame();
  const [openHero, setOpenHero] = useState(null);   // {list:'squad'|'bench', idx}
  const [openTower, setOpenTower] = useState(null);
  const [debug, setDebug] = useState(false);
  if (!state) return null;

  const cap = slotCap(state);
  const cp = castlePower(state);
  const rates = productionRates(state);

  const act = (fn, okMsg, failMsg) => mutate((s) => { if (!fn(s)) { toast.error(failMsg || "Cannot afford / invalid"); } else if (okMsg) toast.success(okMsg); });

  const handlers = {
    build: (type, x, y, placementSlot) => {
      if (!C.TOWERS[type] || state.towers.length >= cap || !canAfford(state, C.TOWERS[type].construction)) {
        toast.error("Tower placement failed — check resources and available slots");
        return false;
      }
      return new Promise((resolve) => mutate((s) => {
        const built = buildTower(s, type, x, y, placementSlot);
        if (built) toast.success(`${C.TOWERS[type].name} placed`);
        else toast.error("Tower placement failed — check resources and available slots");
        resolve(built);
      }));
    },
    reposition: (index, x, y) => mutate((s) => repositionTower(s, index, x, y)),
    dismantle: (index) => act((s) => dismantleTower(s, index), "Dismantled (30% refund)"),
    repairTower: (index) => act((s) => repairTower(s, index), "Repaired"),
    upgradeTower: (index) => act((s) => upgradeTower(s, index), "Tower upgraded"),
    resupplyTower: (index) => act((s) => resupplyTower(s, index), "Tower fully resupplied"),
    openCard: (index) => setOpenTower(index),
    buyBarricade: (pos, g) => act((s) => buyBarricade(s, pos, g), `+${g * C.BARRICADE.goldToHp} HP`),
    repairBarricade: (pos) => act((s) => repairBarricade(s, pos), "Repaired"),
  };

  const startWave = () => {
    saveNow(); setScreen("battle");
  };

  const heal = (list, idx) => act(
    (s) => healHero(s, list === "squad" ? s.heroes[idx] : s.bench[idx]),
    "Hero fully healed",
    "Not enough Gold or hero is not wounded"
  );

  const revive = (list, idx) => act(
    (s) => reviveHero(s, list === "squad" ? s.heroes[idx] : s.bench[idx]),
    "Hero revived at 50% HP",
    "Not enough Gold or hero is not defeated"
  );

  const adRevive = async (list, idx) => {
    try {
      const { data } = await gameApi.reward("revive_hero", "mock_admob", { wave: state.wave, prep: true });
      if (!isRewardedAdConfirmed(data)) throw new Error("Rewarded ad completion was not verified");
      mutate((s) => {
        const h = list === "squad" ? s.heroes[idx] : s.bench[idx];
        const classless = !!h && !h.cls && !!h.combat;
        if (!h || (classless ? h.combat.hp : h.hp) > 0) {
          toast.error("Hero is no longer defeated");
          return;
        }
        const maxHp = heroDerived(h).maxHp;
        if (classless) h.combat.hp = Math.max(1, Math.round(maxHp * 0.75));
        else {
          h.hp = Math.max(1, Math.round(maxHp * 0.75));
          h.maxHp = maxHp;
        }
        toast.success("Reward granted — hero revived at 75% HP");
      });
    } catch {
      toast.error("Revival reward unavailable");
    }
  };
  const hero = openHero ? (openHero.list === "squad" ? state.heroes[openHero.idx] : state.bench[openHero.idx]) : null;

  return (
    <div className="h-full w-full flex flex-col">
      <header className="p-3 flex items-center gap-2 border-b border-white/10 flex-wrap">
        <NeonButton color="cyan" onClick={() => { saveNow(); setScreen("home"); }} data-testid="back-home"><HomeIcon size={14} /></NeonButton>
        <TopResourceHUD state={state} />
        <div className="ml-auto flex gap-2">
          <NeonButton color="green" onClick={() => setDebug(true)} data-testid="debug-toggle-panel"><Terminal size={14} /></NeonButton>
          <NeonButton color="yellow" className="!py-2.5 !px-3" onClick={() => { saveNow(); setScreen("armory"); }} data-testid="open-armory-button">
            <Backpack size={14} className="mr-1.5" /> ARMORY
          </NeonButton>
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
            Repair Castle ({C.repairStoneCost(state.castleMaxHp - state.castleHp)}s)
          </NeonButton>
        )}
      </div>

      <div className="flex-1 overflow-y-auto thin-scroll p-3">
        {offlineGains && (offlineGains.moraleRecovered > 0 || offlineGains.heroHpRecovered > 0) && (
          <div className="glass-card rounded-xl p-3 mb-3 border border-green-400/20" data-testid="offline-recovery-summary">
            <div className="font-display font-bold text-sm text-green-400">Castle recovered while you were away</div>
            <div className="font-mono-g text-[10px] text-slate-400 mt-1">
              {offlineGains.moraleRecovered > 0 && <>Morale +{offlineGains.moraleRecovered}</>}
              {offlineGains.moraleRecovered > 0 && offlineGains.heroHpRecovered > 0 && <span className="text-slate-600 mx-2">·</span>}
              {offlineGains.heroHpRecovered > 0 && <>Hero HP +{Math.round(offlineGains.heroHpRecovered)}</>}
              {offlineGains.minutes > 0 && <span className="text-slate-600 mx-2">·</span>}
              {Math.round(offlineGains.minutes)} min offline
            </div>
          </div>
        )}

        <SectionTitle color="cyan">Battlefield · Place Defenses</SectionTitle>
        <p className="font-mono-g text-[10px] text-slate-500 mb-2">Tap strategic locations to build or manage towers. Barricade orders are controlled by the Guild.</p>
        <div className="glass-card rounded-xl p-2.5 mb-3 border border-yellow-400/15 flex items-center gap-2">
          <Backpack size={15} className="text-yellow-300 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="font-display font-bold text-xs text-yellow-300">KINGDOM ARMORY</div>
            <div className="font-mono-g text-[9px] text-slate-500">Manage dropped gear, hero equipment, and the Shoppe.</div>
          </div>
          <NeonButton color="yellow" className="!py-1.5 !px-3 !text-[9px]" onClick={() => { saveNow(); setScreen("armory"); }} data-testid="open-armory-field-button">OPEN</NeonButton>
        </div>
        <PrepField state={state} handlers={handlers} />

        <div className="mt-4">
          <Tabs defaultValue="heroes">
            <TabsList className="bg-black/40 border border-white/10 mb-3">
              <TabsTrigger value="heroes" data-testid="tab-heroes">Squad</TabsTrigger>
              <TabsTrigger value="buildings" data-testid="tab-buildings">Buildings</TabsTrigger>
              <TabsTrigger value="workforce" data-testid="tab-workforce">Legacy Workforce</TabsTrigger>
            </TabsList>

            {/* SQUAD + RECRUIT */}
            <TabsContent value="heroes">
              <div className="glass-card rounded-xl p-3 mb-3" data-testid="recovery-panel">
                <div className="flex items-center justify-between">
                  <SectionTitle color="green">Castle Recovery</SectionTitle>
                  <span className="font-mono-g text-[10px] text-green-400">MORALE +{C.RECOVERY.moralePerHour}/h</span>
                </div>
                <p className="font-mono-g text-[10px] text-slate-500 mt-1">
                  Wounded heroes recover +{C.RECOVERY.heroHpPercentPerHour}% max HP/h while resting. Defeated heroes stay down until revived.
                </p>
                <div className="mt-2 font-mono-g text-[11px] text-slate-300">
                  Morale <b className="text-green-400">{Math.round(state.morale)}/100</b>
                  <span className="text-slate-600 mx-2">·</span>
                  Gold <b className="text-yellow-300">{Math.floor(state.gold)}</b>
                  <span className="text-slate-600 mx-2">·</span>
                  Resting recovery is active
                </div>
              </div>

              <div className="grid gap-2.5" data-testid="hero-list">
                {state.heroes.map((h, i) => (
                  <HeroRow
                    key={h.id || h.identity?.id || i}
                    h={h}
                    onClick={() => setOpenHero({ list: "squad", idx: i })}
                    onHeal={() => heal("squad", i)}
                    onRevive={() => revive("squad", i)}
                    onAdRevive={() => adRevive("squad", i)}
                    gold={state.gold}
                    testid={"hero-slot-" + i}
                  />
                ))}
              </div>
              {state.bench && state.bench.length > 0 && (
                <div className="glass-card rounded-xl p-3 mt-3" data-testid="bench-panel">
                  <SectionTitle color="yellow">Bench · Swap into Squad</SectionTitle>
                  <div className="grid gap-2 mt-2">
                    {state.bench.map((h, bi) => {
                      if (!h.cls && h.combat) return <div key={h.identity?.id || bi} className="flex items-center gap-2 p-2 rounded-lg bg-black/30 border-l-[3px] border-cyan-400/40" data-testid={`bench-hero-${bi}`}><ClasslessHeroAvatar identityColor={h.appearance?.identityColor} className="h-9 w-9 rounded border border-cyan-400/30 bg-black/30" label={`${h.identity?.name || "Hero"} classless sprite`} /><span className="font-mono-g text-xs flex-1 text-cyan-200">{h.identity?.name || "Hero"} · Classless · L{h.progression?.level || 1} · Appearance: {h.appearance?.id || "Unselected"}</span></div>;
                      const c = C.HERO_CLASSES[h.cls];
                      return (
                        <div key={h.id} className="flex items-center gap-2 p-2 rounded-lg bg-black/30" style={{ borderLeft: `3px solid ${c.color}` }} data-testid={`bench-hero-${bi}`}>
                          <button onClick={() => setOpenHero({ list: "bench", idx: bi })} className="w-9 h-9 rounded shrink-0 flex items-center justify-center" style={{ border: `1px solid ${c.color}55` }} data-testid={`bench-card-${bi}`}><HeroMiniSprite cls={h.cls} color={c.color} size="sm" dead={h.hp <= 0} /></button>
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

            <TabsContent value="buildings">
              <CastleBuildings state={state} mutate={mutate} />
            </TabsContent>

            {/* Worker assignments are managed from the Buildings tab. */}
            <TabsContent value="workforce">
              <div className="glass-card rounded-xl p-3" data-testid="legacy-workforce-notice">
                <SectionTitle color="yellow">Workforce Migration</SectionTitle>
                <p className="font-mono-g text-xs text-slate-400 mt-2">Worker hiring and building assignments are now managed from the Buildings tab. Assign Mine workers between Gold and Metal, and assign Quarry workers to Stone from the Buildings tab.</p>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {hero && (
        <HeroCard key={hero.id} hero={hero} editable draftProgression
          onCommitProgression={({ originalHero, draftHero }) => {
            const roster = openHero.list === "squad" ? state.heroes : state.bench;
            const current = roster.find((item) => item.id === originalHero.id);
            const preview = current && structuredClone(current);
            if (!preview || !commitHeroProgressionDraft(preview, originalHero, draftHero)) {
              toast.error("Allocations changed or are no longer valid");
              return false;
            }
            mutate((s) => {
              const currentRoster = openHero.list === "squad" ? s.heroes : s.bench;
              const target = currentRoster.find((item) => item.id === originalHero.id);
              if (!target || !commitHeroProgressionDraft(target, originalHero, draftHero)) {
                toast.error("Allocations changed or are no longer valid");
                return;
              }
              toast.success("Hero allocations confirmed");
            });
            return true;
          }}
          onConfig={(cfg) => mutate((s) => { const t = openHero.list === "squad" ? s.heroes[openHero.idx] : s.bench[openHero.idx]; t.attackConfig = cfg; })}
          onClose={() => setOpenHero(null)} />
      )}
      {openTower != null && state.towers[openTower] && (
        <TowerCard tower={state.towers[openTower]} editable
          onUpgrade={() => { if (!handlers.upgradeTower(openTower)) toast.error("Need the upgrade resources"); }}
          onChooseSpecialization={(milestone, id) => mutate((s) => {
            if (!chooseTowerSpecialization(s, openTower, milestone, id)) toast.error("That specialization is unavailable");
            else toast.success("Tower specialization unlocked");
          })}
          onClose={() => setOpenTower(null)} />
      )}
      {debug && <DebugPanel onClose={() => setDebug(false)} />}
    </div>
  );
}

function HeroRow({ h, onClick, onHeal, onRevive, onAdRevive, gold, testid }) {
  if (!h.cls && h.combat) return <div data-testid={testid} className="glass-card rounded-xl p-3 flex items-center gap-3 border-l-[3px] border-cyan-400/40">
    <ClasslessHeroAvatar identityColor={h.appearance?.identityColor} className="h-12 w-12 rounded border border-cyan-400/30 bg-black/30 shrink-0" label={`${h.identity?.name || "Hero"} classless sprite`} />
    <div className="min-w-0 flex-1"><div className="font-display font-bold text-cyan-200">{h.identity?.name || "Hero"} · Classless</div><div className="font-mono-g text-[10px] text-slate-400">L{h.progression?.level || 1} · {Math.round(h.combat.hp)}/{h.combat.maxHp} HP · Appearance: {h.appearance?.id || "Unselected"}</div><StatBar frac={h.combat.hp / h.combat.maxHp} color="#22D3EE" height={4} /></div>
  </div>;
  const d = heroDerived(h);
  const cls = C.HERO_CLASSES[h.cls];
  const wounded = h.hp > 0 && h.hp < d.maxHp;
  const defeated = h.hp <= 0;
  const healCost = Math.ceil(Math.max(0, d.maxHp - h.hp) / 10) * C.HERO_HEAL_GOLD_PER_10HP;

  return (
    <div data-testid={testid}
      className="glass-card rounded-xl p-3 flex items-center gap-3 text-left w-full"
      style={{ borderLeft: `3px solid ${cls.color}` }}>
      <button onClick={onClick} className="flex items-center gap-3 flex-1 min-w-0 text-left">
        <HeroMiniSprite cls={h.cls} color={cls.color} size="md" dead={defeated} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-display font-bold" style={{ color: cls.color }}>{cls.name}</span>
            <span className="font-mono-g text-[10px] text-slate-400">L{h.level}</span>
            {defeated && <span className="font-mono-g text-[9px] text-rose-400">DEFEATED</span>}
            {wounded && <span className="font-mono-g text-[9px] text-yellow-300">WOUNDED</span>}
            {(h.sp > 0 || h.ap > 0) && <span className="font-mono-g text-[9px] text-fuchsia-400 animate-pulse-glow">SP{h.sp} AP{h.ap}</span>}
          </div>
          <div className="font-mono-g text-[10px] text-slate-500">{h.attackConfig} · {Math.round(h.hp)}/{d.maxHp} HP</div>
          <StatBar frac={h.hp / d.maxHp} color={defeated ? "#FF0055" : cls.color} height={4} />
        </div>
      </button>

      <div className="flex flex-col gap-1 shrink-0">
        {wounded && (
          <NeonButton color="green" className="!px-2 !py-1 !text-[9px]" disabled={gold < healCost} onClick={onHeal} data-testid={testid + "-heal"}>
            <Heart size={10} className="mr-1" /> Heal {healCost}g
          </NeonButton>
        )}
        {defeated && (
          <>
            <NeonButton color="yellow" className="!px-2 !py-1 !text-[9px]" onClick={onRevive} data-testid={testid + "-revive"}>
              Revive {C.paidRevivalCost(h.level)}g
            </NeonButton>
            <NeonButton color="magenta" className="!px-2 !py-1 !text-[9px]" onClick={onAdRevive} data-testid={testid + "-ad-revive"}>
              <Skull size={10} className="mr-1" /> Ad Revive
            </NeonButton>
          </>
        )}
      </div>
    </div>
  );
}

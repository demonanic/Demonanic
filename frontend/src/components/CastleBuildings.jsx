import { useState } from "react";
import { toast } from "sonner";
import { Coins, Mountain, Users, Hammer, ShieldCheck, Wrench, ChevronDown, ChevronUp, Brain } from "lucide-react";
import { NeonButton, SectionTitle, StatBar } from "@/components/ui-kit";
import { productionRates, hostTavernFeast, recruitHero, enrollAcademyHero, recallAcademyHero, academyTrainingHours, academySeats, guildRepairDefenses, guildManufactureAmmo } from "@/game/logic";
import * as C from "@/game/config";
import { TAVERN_FEAST, workerCost } from "@/game/config";
import KingdomMap from "@/components/KingdomMap";

const BUILDINGS = [
  { id: "mine", name: "Mine", icon: Coins, color: "#FFE600", desc: "Produces Gold from assigned Workers.", workers: "gold" },
  { id: "quarry", name: "Quarry", icon: Mountain, color: "#00F3FF", desc: "Produces Stone from assigned Workers.", workers: "stone" },
  { id: "tavern", name: "Tavern", icon: Users, color: "#FF007F", desc: "Hero recruitment and Morale services.", workers: null },
  { id: "shoppe", name: "Shoppe", icon: Coins, color: "#A855F7", desc: "Equipment and item transactions.", workers: null },
  { id: "academy", name: "Academy", icon: ShieldCheck, color: "#39FF14", desc: "Train heroes in permanent stat improvements.", workers: null },
  { id: "guild", name: "Guild", icon: Hammer, color: "#FF6600", desc: "Repair damaged defenses and manufacture ammunition for physical towers.", workers: null },
  { id: "library", name: "Library", icon: ChevronUp, color: "#A855F7", desc: "Spell and perk research unlocks later.", workers: null, locked: true },
  { id: "vault", name: "Vault", icon: ShieldCheck, color: "#00F3FF", desc: "Protects deposited Gold when implemented.", workers: null, locked: true },
];

function initialBuilding(id) {
  return { level: 1, hp: 1000, maxHp: 1000, unlocked: !["academy", "guild", "library", "vault"].includes(id), activity: "Idle" };
}

function buildingState(state, id) {
  return state.buildings?.[id] || initialBuilding(id);
}

function condition(hp, maxHp) {
  const frac = maxHp > 0 ? hp / maxHp : 0;
  if (frac <= 0) return { label: "DISABLED", color: "#FF0055", efficiency: 0 };
  if (frac < 0.25) return { label: "CRITICAL", color: "#FF0055", efficiency: 0.25 };
  if (frac < 0.5) return { label: "DAMAGED", color: "#FF6600", efficiency: 0.5 };
  if (frac < 0.75) return { label: "DAMAGED", color: "#FFE600", efficiency: 0.75 };
  return { label: "HEALTHY", color: "#39FF14", efficiency: 1 };
}

export default function CastleBuildings({ state, mutate }) {
  const [selected, setSelected] = useState("mine");
  const [expanded, setExpanded] = useState(true);
  const rates = productionRates(state);
  const building = BUILDINGS.find((item) => item.id === selected) || BUILDINGS[0];
  const current = buildingState(state, building.id);
  const status = condition(current.hp, current.maxHp);
  const workersAssigned = building.workers === "gold" ? (state.workersGold || 0) : building.workers === "stone" ? (state.workersStone || 0) : 0;
  const availableWorkers = Math.max(0, (state.workers || 0) - (state.workersGold || 0) - (state.workersStone || 0));
  const baseRate = building.workers === "gold" ? rates.gold : building.workers === "stone" ? rates.stone : 0;
  const output = baseRate;
  const missingHp = Math.max(0, current.maxHp - current.hp);
  const repairGold = Math.ceil(missingHp * 0.2);
  const repairStone = Math.ceil(missingHp * 0.1);
  const turretMaxAmmo = 18 + (Math.max(1, Number(current.level) || 1) - 1) * 4;
  const turretAmmo = Math.max(0, Math.min(turretMaxAmmo, Number.isFinite(Number(current.turretAmmo)) ? Number(current.turretAmmo) : turretMaxAmmo));
  const missingTurretAmmo = Math.max(0, turretMaxAmmo - turretAmmo);
  const turretRefillCost = missingTurretAmmo;

  const updateBuilding = (fn) => mutate((s) => {
    s.buildings = s.buildings || {};
    s.buildings[building.id] = { ...initialBuilding(building.id), ...(s.buildings[building.id] || {}) };
    fn(s, s.buildings[building.id]);
  });

  const assign = (delta) => mutate((s) => {
    if (building.workers === "gold") {
      const next = Math.max(0, Math.min(s.workers || 0, (s.workersGold || 0) + delta));
      const actual = next - (s.workersGold || 0);
      if (actual > 0 && (s.workersStone || 0) + (s.workersGold || 0) + actual > s.workers) return;
      s.workersGold = next;
      s.workersStone = Math.max(0, (s.workersStone || 0) - Math.max(0, next - (s.workers || 0)));
    } else if (building.workers === "stone") {
      const next = Math.max(0, Math.min(s.workers || 0, (s.workersStone || 0) + delta));
      const actual = next - (s.workersStone || 0);
      if (actual > 0 && (s.workersStone || 0) + (s.workersGold || 0) + actual > s.workers) return;
      s.workersStone = next;
    }
  });

  const repair = () => {
    if (!missingHp || state.gold < repairGold || state.stone < repairStone) return;
    updateBuilding((s, b) => {
      if (s.gold < repairGold || s.stone < repairStone) return;
      s.gold -= repairGold;
      s.stone -= repairStone;
      b.hp = b.maxHp;
      b.activity = "Repaired";
    });
  };

  const upgrade = () => {
    const costGold = Math.ceil(100 * Math.pow(1.5, current.level - 1));
    const costStone = Math.ceil(40 * Math.pow(1.5, current.level - 1));
    updateBuilding((s, b) => {
      if (s.gold < costGold || s.stone < costStone) return;
      s.gold -= costGold;
      s.stone -= costStone;
      const oldLevel = Math.max(1, Number(b.level) || 1);
      const oldTurretMaxAmmo = 18 + (oldLevel - 1) * 4;
      const nextLevel = oldLevel + 1;
      const nextTurretMaxAmmo = 18 + (nextLevel - 1) * 4;
      b.level = nextLevel;
      b.turretMaxAmmo = nextTurretMaxAmmo;
      if (Number.isFinite(Number(b.turretAmmo))) {
        const currentTurretAmmo = Math.max(0, Math.min(oldTurretMaxAmmo, Number(b.turretAmmo)));
        b.turretAmmo = Math.min(nextTurretMaxAmmo, currentTurretAmmo + (nextTurretMaxAmmo - oldTurretMaxAmmo));
      } else {
        b.turretAmmo = nextTurretMaxAmmo;
      }
      b.maxHp = Math.round((b.maxHp || 1000) * 1.15);
      b.hp = Math.min(b.maxHp, b.hp + Math.round(b.maxHp * 0.15));
      b.activity = "Upgraded";
    });
  };

  const upgradeCostGold = Math.ceil(100 * Math.pow(1.5, current.level - 1));
  const upgradeCostStone = Math.ceil(40 * Math.pow(1.5, current.level - 1));

  return (
    <section className="glass-card rounded-xl p-3 mb-4" data-testid="castle-management">
      <div className="flex items-center justify-between gap-2">
        <div>
          <SectionTitle color="magenta">Castle Buildings</SectionTitle>
          <p className="font-mono-g text-[10px] text-slate-500 mt-1">Map overview · Select a building to manage it</p>
        </div>
        <NeonButton color="cyan" className="!px-2 !py-1.5" onClick={() => setExpanded((v) => !v)} aria-label={expanded ? "Collapse buildings" : "Expand buildings"}>
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </NeonButton>
      </div>

      {expanded && <>
        <div className="mt-3" data-testid="castle-building-map">
          <p className="font-mono-g text-[9px] text-cyan-200/70 mb-2">Tap a physical building on the kingdom map to inspect its condition and manage it.</p>
          <KingdomMap state={state} selected={selected} onSelect={setSelected} />
        </div>

        <div className="rounded-xl border bg-black/30 p-3 mt-3" style={{ borderColor: building.color + "66" }} data-testid="building-detail-panel">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="font-display font-black text-lg" style={{ color: building.color }}>{building.name.toUpperCase()} · L{current.level || 1}</div>
              <p className="font-mono-g text-[10px] text-slate-400 mt-1">{building.desc}</p>
            </div>
            <div className="text-right"><div className="font-mono-g text-[10px]" style={{ color: status.color }}>{status.label}</div><div className="font-mono-g text-[9px] text-slate-500">{Math.round(current.hp)} / {current.maxHp} HP</div></div>
          </div>
          <div className="mt-2"><StatBar frac={current.hp / Math.max(1, current.maxHp)} color={status.color} height={5} /></div>

          {building.id === "tavern" && <>
            <div className="mt-3 rounded-lg border border-pink-400/25 bg-pink-400/5 p-3" data-testid="tavern-morale-service">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="font-mono-g text-[10px] text-pink-200">CASTLE MORALE</div>
                  <div className="font-display font-bold text-2xl">{Math.round(state.morale || 0)} / 100</div>
                </div>
                <div className="text-right font-mono-g text-[9px] text-slate-400">FEAST BONUS<br />+{TAVERN_FEAST.morale} morale</div>
              </div>
              <StatBar frac={(state.morale || 0) / 100} color="#FF007F" height={6} />
              <p className="font-mono-g text-[9px] text-slate-400 mt-2">Host a feast to lift morale. Higher morale improves the castle's resource production.</p>
              <NeonButton color="magenta" className="w-full mt-2" disabled={current.hp <= 0 || current.unlocked === false || (state.morale || 0) >= 100 || state.gold < TAVERN_FEAST.gold || state.food < TAVERN_FEAST.food} onClick={() => mutate((s) => { hostTavernFeast(s); })}>
                Host Feast ({TAVERN_FEAST.gold}g / {TAVERN_FEAST.food} food)
              </NeonButton>
            </div>
            <div className="mt-3 pt-3 border-t border-pink-400/20" data-testid="tavern-hero-recruitment">
              <div className="font-display font-bold text-lg text-pink-200">RECRUIT HERO</div>
              <p className="font-mono-g text-[10px] text-slate-400 mt-1 mb-2">Cost {C.recruitCost((state.heroes?.length || 0) + (state.bench?.length || 0))}g · fills an empty squad slot or goes to the bench.</p>
              <div className="grid grid-cols-2 gap-2">
                {C.HERO_ORDER.map((cls) => {
                  const heroClass = C.HERO_CLASSES[cls];
                  const cost = C.recruitCost((state.heroes?.length || 0) + (state.bench?.length || 0));
                  return (
                    <button key={cls} type="button" data-testid={`tavern-recruit-${cls}`}
                      disabled={current.hp <= 0 || current.unlocked === false || state.gold < cost}
                      onClick={() => mutate((s) => {
                        if (s.buildings?.tavern?.hp <= 0 || s.buildings?.tavern?.unlocked === false) return;
                        if (!recruitHero(s, cls)) return;
                        s.buildings.tavern.activity = `Recruited ${heroClass.name}`;
                        toast.success(`${heroClass.name} recruited`);
                      })}
                      className="neon-btn flex items-center gap-2 p-2 rounded-lg border bg-black/40 disabled:opacity-40"
                      style={{ borderColor: heroClass.color + "55" }}>
                      <div className="w-6 h-7 rounded" style={{ background: heroClass.color, boxShadow: `0 0 8px ${heroClass.color}` }} />
                      <div className="text-left">
                        <div className="font-mono-g text-xs font-bold" style={{ color: heroClass.color }}>{heroClass.name}</div>
                        <div className="font-mono-g text-[9px] text-slate-400">{cost}g</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </>}

          {building.id === "academy" && <>
            <div className="mt-3 rounded-lg border border-green-400/25 bg-green-400/5 p-3" data-testid="academy-enrollment">
              <div className="font-display font-bold text-lg text-green-200">ENROLL RESERVE HERO</div>
              <p className="font-mono-g text-[10px] text-slate-400 mt-1">Only benched heroes can enroll. They move into the Academy while training and return to the bench when their course is complete. Intelligence alone improves learning speed.</p>
              <div className="font-mono-g text-[10px] text-green-200 mt-2">SEATS {(state.academyTraining || []).filter((t) => !t.paused).length} / {academySeats(state)}</div>
              {(state.academyHeroes || []).map((h) => {
                const training = (state.academyTraining || []).find((t) => t.heroId === h.id);
                return <div key={h.id} className="rounded-lg bg-black/35 p-2 mt-2" data-testid={`academy-training-${h.id}`}>
                  <div className="font-mono-g text-xs text-green-200">{h.name} · INT {h.stats.intelligence}</div>
                  <p className="font-mono-g text-[10px] text-cyan-200 mt-1">{training?.paused ? "PAUSED" : "Training"} {training?.stat || "—"} · {training ? Math.max(0, Math.ceil(((training.durationMs || 0) - (training.elapsedMs || 0)) / 60000)) : 0} min remaining</p>
                  <div className="flex gap-2 mt-2">
                    <button type="button" disabled={!training?.paused || (state.academyTraining || []).filter((t) => !t.paused).length >= academySeats(state)} onClick={() => mutate((s) => { if (!enrollAcademyHero(s, h.id, training?.stat)) toast.error("No Academy seat available"); else toast.success("Training resumed"); })} className="flex-1 rounded border border-cyan-400/30 px-2 py-1 font-mono-g text-[10px] disabled:opacity-30">RESUME</button>
                    <button type="button" onClick={() => mutate((s) => { if (!recallAcademyHero(s, h.id)) toast.error("Unable to recall hero"); else toast.success(`${h.name} returned to the bench`); })} className="flex-1 rounded border border-pink-400/30 px-2 py-1 font-mono-g text-[10px]">RECALL TO BENCH</button>
                  </div>
                </div>;
              })}
              {(state.bench || []).length === 0 ? <p className="font-mono-g text-[10px] text-slate-500 mt-3">No reserve heroes available. Recruit a hero at the Tavern or move a hero to the bench first.</p> : <div className="space-y-2 mt-2">
                {(state.bench || []).map((h) => {
                  const pausedCourse = (state.academyTraining || []).find((t) => t.heroId === h.id && t.paused);
                  return <div key={h.id} className="rounded-lg bg-black/35 p-2" data-testid={`academy-eligible-${h.id}`}>
                    <div className="font-mono-g text-xs text-green-200">{h.name} · L{h.level} · INT {h.stats.intelligence}</div>
                    {pausedCourse ? <div className="mt-2">
                      <p className="font-mono-g text-[10px] text-amber-200">Paused {pausedCourse.stat} · {Math.max(0, Math.ceil(((pausedCourse.durationMs || 0) - (pausedCourse.elapsedMs || 0)) / 60000))} min remaining</p>
                      <button type="button" disabled={current.hp <= 0 || current.unlocked === false || (state.academyTraining || []).filter((t) => !t.paused).length >= academySeats(state)} onClick={() => mutate((s) => { if (!enrollAcademyHero(s, h.id, pausedCourse.stat)) toast.error("Unable to resume training"); else toast.success("Training resumed"); })} className="mt-2 w-full rounded border border-cyan-400/30 px-2 py-1 font-mono-g text-[10px] disabled:opacity-40">RESUME {pausedCourse.stat.toUpperCase()}</button>
                    </div> : <div className="grid grid-cols-2 gap-1 mt-2">
                      {["attack", "defense", "agility", "intelligence"].map((stat) => <button key={stat} type="button" disabled={current.hp <= 0 || current.unlocked === false || (state.academyTraining || []).filter((t) => !t.paused).length >= academySeats(state)} onClick={() => mutate((s) => {
                        if (!enrollAcademyHero(s, h.id, stat)) toast.error("Unable to enroll this reserve hero");
                        else toast.success(`${h.name} enrolled for ${stat}`);
                      })} className="neon-btn rounded border border-green-400/30 px-2 py-1 font-mono-g text-[10px] disabled:opacity-40"><Brain size={11} className="inline mr-1" />{stat} · {academyTrainingHours(state, h, stat).toFixed(1)}h</button>)}
                    </div>}
                  </div>;
                })}
              </div>}
            </div>
          </>}

          {building.id === "guild" && <>
            <div className="mt-3 rounded-lg border border-orange-400/25 bg-orange-400/5 p-3" data-testid="guild-defense-service">
              <div className="font-display font-bold text-lg text-orange-200">DEFENSE WORKSHOP</div>
              <p className="font-mono-g text-[10px] text-slate-400 mt-1">Guild smiths repair damaged towers and barricades using Food. Higher Guild levels manufacture larger ammunition batches.</p>
              {(() => {
                const damagedTowers = (state.towers || []).filter((t) => t && t.hp < C.TOWERS[t.type]?.baseHp * Math.pow(1 + C.TOWER_UPGRADE.hpMult, Math.max(0, (t.level || 1) - 1)));
                const damagedBarricades = (state.barricades || []).filter((b) => b && b.maxHp > 0 && b.hp < b.maxHp);
                const towerFood = (state.towers || []).reduce((sum, t) => {
                  if (!t || !C.TOWERS[t.type]) return sum;
                  const maxHp = C.TOWERS[t.type].baseHp * Math.pow(1 + C.TOWER_UPGRADE.hpMult, Math.max(0, (t.level || 1) - 1));
                  return sum + C.repairFoodCost(Math.max(0, maxHp - (Number(t.hp) || 0)));
                }, 0);
                const barricadeFood = damagedBarricades.reduce((sum, b) => sum + Math.ceil((b.maxHp - b.hp) / 10 * C.BARRICADE.repairFoodPer10Hp), 0);
                const totalFood = towerFood + barricadeFood;
                return <>
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    <div className="rounded-lg bg-black/30 p-2"><div className="font-mono-g text-[9px] text-slate-400">DAMAGED TOWERS</div><div className="font-display font-bold text-xl">{damagedTowers.length}</div></div>
                    <div className="rounded-lg bg-black/30 p-2"><div className="font-mono-g text-[9px] text-slate-400">DAMAGED BARRICADES</div><div className="font-display font-bold text-xl">{damagedBarricades.length}</div></div>
                  </div>
                  <NeonButton color="orange" className="w-full mt-2" disabled={current.hp <= 0 || current.unlocked === false || (!damagedTowers.length && !damagedBarricades.length) || state.food < totalFood} onClick={() => mutate((s) => {
                    const result = guildRepairDefenses(s);
                    if (!result) toast.error("Not enough Food or no damaged defenses");
                    else toast.success(`Repaired ${result.towers} towers and ${result.barricades} barricades · ${result.foodCost} Food`);
                  })}>Repair All Defenses ({totalFood} Food)</NeonButton>
                </>;
              })()}
            </div>
            <div className="mt-3 rounded-lg border border-orange-400/25 bg-black/20 p-3" data-testid="guild-ammunition-workshop">
              <div className="font-display font-bold text-lg text-orange-200">AMMUNITION MANUFACTURING</div>
              <p className="font-mono-g text-[10px] text-slate-400 mt-1">Manufacture ammunition in batches for Archer, Catapult, and Ballista towers. Wizard Towers use Mana and cannot use this workshop.</p>
              {(state.towers || []).map((tower, index) => {
                if (!tower || !C.TOWER_RESOURCE[tower.type] || C.TOWER_RESOURCE[tower.type].kind !== "ammo") return null;
                const resource = C.TOWER_RESOURCE[tower.type];
                const level = Math.max(1, Number(tower.level) || 1);
                const maxAmmo = Math.round(resource.max * Math.pow(1 + C.TOWER_UPGRADE.resourceMult, level - 1) * (1 + (tower.specializations?.[5] === "deep_quiver" ? 0.25 : 0)));
                const ammo = Math.max(0, Number(tower.ammo) || 0);
                const missing = Math.max(0, maxAmmo - ammo);
                const batch = Math.min(missing, Math.max(1, Math.ceil(maxAmmo * (0.25 + Math.min(0.25, (Math.max(1, current.level || 1) - 1) * 0.05))));
                const goldCost = Math.ceil(batch * resource.resupplyGold);
                const stoneCost = Math.ceil(batch * resource.resupplyStone);
                return <div key={tower.id || index} className="rounded-lg bg-black/30 p-2 mt-2" data-testid={`guild-ammo-${tower.id || index}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div><div className="font-mono-g text-xs text-orange-100">{C.TOWERS[tower.type]?.name || tower.type}</div><div className="font-mono-g text-[10px] text-slate-400">{resource.label} {ammo} / {maxAmmo}</div></div>
                    <button type="button" disabled={current.hp <= 0 || current.unlocked === false || missing <= 0 || state.gold < goldCost || state.stone < stoneCost} onClick={() => mutate((s) => {
                      const result = guildManufactureAmmo(s, index);
                      if (!result) toast.error("Unable to manufacture ammunition");
                      else toast.success(`Made ${result.amount} ammunition · ${result.goldCost}g / ${result.stoneCost}s`);
                    })} className="neon-btn rounded border border-orange-400/40 px-2 py-2 font-mono-g text-[10px] disabled:opacity-35">MAKE {Math.min(batch, missing)} ({goldCost}g{stoneCost ? ` / ${stoneCost}s` : ""})</button>
                  </div>
                </div>;
              })}
              {!(state.towers || []).some((t) => t && C.TOWER_RESOURCE[t.type]?.kind === "ammo") && <p className="font-mono-g text-[10px] text-slate-500 mt-2">Build an Archer, Catapult, or Ballista tower to manufacture ammunition here.</p>}
            </div>
          </>}
          {building.workers && <>
            <div className="flex items-center justify-between gap-2 mt-3 rounded-lg bg-white/5 p-2">
              <div><div className="font-mono-g text-[9px] text-slate-500">UNASSIGNED WORKERS</div><div className="font-display font-bold text-lg">{availableWorkers}</div></div>
              <NeonButton color="yellow" className="!text-[10px]" disabled={state.gold < workerCost(state.workers || 0)} onClick={() => mutate((s) => {
                const cost = workerCost(s.workers || 0);
                if (s.gold < cost) return;
                s.gold -= cost;
                s.workers = (s.workers || 0) + 1;
              })}>Hire Worker ({workerCost(state.workers || 0)}g)</NeonButton>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-3">
              <div className="rounded-lg bg-white/5 p-2"><div className="font-mono-g text-[9px] text-slate-500">ASSIGNED WORKERS</div><div className="font-display font-bold text-xl">{workersAssigned}</div></div>
              <div className="rounded-lg bg-white/5 p-2"><div className="font-mono-g text-[9px] text-slate-500">CURRENT OUTPUT</div><div className="font-display font-bold text-xl" style={{ color: building.color }}>{output.toFixed(1)} / min</div></div>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <NeonButton color="cyan" className="flex-1" disabled={workersAssigned <= 0} onClick={() => assign(-1)}>- Worker</NeonButton>
              <NeonButton color="green" className="flex-1" disabled={availableWorkers <= 0} onClick={() => assign(1)}>+ Worker</NeonButton>
            </div>
            <p className="font-mono-g text-[9px] text-slate-500 mt-1">Available workforce: {availableWorkers}. Damage-adjusted production is based on building condition.</p>
          </>}

          <div className="mt-3 rounded-lg border border-cyan-400/20 bg-cyan-400/5 p-2" data-testid="building-turret-ammo">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="font-mono-g text-[9px] text-cyan-200">PERSONAL TURRET · SHORT RANGE</div>
                <div className="font-mono-g text-[10px] text-slate-300">AMMO {turretAmmo} / {turretMaxAmmo} · Level-scaled</div>
              </div>
              <NeonButton color="cyan" className="!text-[10px]" disabled={current.hp <= 0 || missingTurretAmmo <= 0 || state.gold < turretRefillCost} onClick={() => updateBuilding((s, b) => {
                const level = Math.max(1, Number(b.level) || 1);
                const maxAmmo = 18 + (level - 1) * 4;
                const currentAmmo = Math.max(0, Math.min(maxAmmo, Number(b.turretAmmo) || 0));
                const missing = maxAmmo - currentAmmo;
                if (missing <= 0 || s.gold < missing || b.hp <= 0) return;
                s.gold -= missing;
                b.turretMaxAmmo = maxAmmo;
                b.turretAmmo = maxAmmo;
              })}>Refill ({turretRefillCost}g)</NeonButton>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-3">
            <NeonButton color="red" className="!text-[10px]" disabled={missingHp <= 0 || state.gold < repairGold || state.stone < repairStone} onClick={repair}>
              <Wrench size={12} className="mr-1" /> Repair ({repairGold}g / {repairStone}s)
            </NeonButton>
            <NeonButton color="yellow" className="!text-[10px]" disabled={state.gold < upgradeCostGold || state.stone < upgradeCostStone || !!(itemLocked(building.id, current))} onClick={upgrade}>
              Upgrade ({upgradeCostGold}g / {upgradeCostStone}s)
            </NeonButton>
          </div>
        </div>
      </>}
    </section>
  );
}

function itemLocked(id, current) {
  return ["academy", "guild", "library", "vault"].includes(id) && !current.unlocked;
}

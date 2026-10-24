import { useRef, useState } from "react";
import { X, Plus, Zap, Shield, Swords, Wind, Brain, Heart } from "lucide-react";
import { StatBar, NeonButton, HeroMiniSprite } from "./ui-kit";
import * as C from "../game/config";
import { allocateSp, buyPerk, heroDerived, towerDerived, undoPendingPerk, undoPendingSp } from "../game/logic";
import PerkTree from "./PerkTree";
import ClasslessHeroAvatar from "./ClasslessHeroAvatar";

export function Modal({ children, onClose, testid, slowed }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" data-testid={testid}>
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      {slowed && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 font-mono-g text-xs tracking-[0.3em] text-cyan-400 animate-pulse-glow z-10">
          ⧗ BATTLE CLOCK — TACTICAL SLOWDOWN
        </div>
      )}
      <div className="relative glass rounded-2xl w-full max-w-md max-h-[86vh] overflow-y-auto thin-scroll animate-rise">
        <button onClick={onClose} className="absolute top-3 right-3 text-slate-400 hover:text-white z-10" data-testid="card-close"><X size={20} /></button>
        {children}
      </div>
    </div>
  );
}

const STAT_ICONS = { attack: <Swords size={13} />, defense: <Shield size={13} />, agility: <Wind size={13} />, intelligence: <Brain size={13} /> };

function cloneHeroData(hero) {
  return typeof structuredClone === "function" ? structuredClone(hero) : JSON.parse(JSON.stringify(hero));
}

export function HeroCard({ hero: sourceHero, editable, onAlloc, onPerk, onClose, onCommitProgression, draftProgression = false, onConfig, slowed, combatMode, onCombatMode, onRetreat, onRally }) {
  const [perkTreeOpen, setPerkTreeOpen] = useState(false);
  const displayHero = sourceHero?.classless ? sourceHero.model : sourceHero;
  const originalProgression = useRef(cloneHeroData(displayHero));
  const [progressionDraft, setProgressionDraft] = useState(() => cloneHeroData(displayHero));
  const committingDraft = useRef(false);
  const hero = draftProgression ? progressionDraft : displayHero;
  const originalPerks = originalProgression.current.perks || [];
  const removablePerks = draftProgression
    ? (hero.perks || []).filter((perkId) => !originalPerks.includes(perkId))
    : [];
  const hasProgressionChanges = draftProgression && (
    hero.sp !== originalProgression.current.sp ||
    hero.ap !== originalProgression.current.ap ||
    JSON.stringify(hero.stats) !== JSON.stringify(originalProgression.current.stats) ||
    JSON.stringify(hero.perks) !== JSON.stringify(originalPerks)
  );
  const updateProgressionDraft = (update) => {
    setProgressionDraft((current) => {
      const next = cloneHeroData(current);
      return update(next) ? next : current;
    });
  };
  const allocateStat = (stat) => {
    if (draftProgression) updateProgressionDraft((next) => allocateSp(next, stat));
    else onAlloc?.(stat);
  };
  const unlockPerk = (perkId) => {
    if (draftProgression) updateProgressionDraft((next) => buyPerk(next, perkId));
    else onPerk?.(perkId);
  };
  const undoPerk = (perkId) => updateProgressionDraft((next) =>
    undoPendingPerk(next, perkId, originalPerks));
  const undoStat = (stat) => updateProgressionDraft((next) =>
    undoPendingSp(next, stat, originalProgression.current.stats));
  const confirmProgression = () => {
    if (!hasProgressionChanges || committingDraft.current) return;
    committingDraft.current = true;
    const committed = onCommitProgression?.({
      originalHero: originalProgression.current,
      draftHero: progressionDraft,
    });
    if (committed === false) {
      committingDraft.current = false;
      return;
    }
    onClose?.();
  };
  const cls = C.HERO_CLASSES[hero.cls];
  const d = heroDerived(hero);
  if (!hero.cls && hero.combat) {
    const color = hero.appearance?.identityColor || "#22D3EE";
    const stats = hero.combat.stats || {};
    const hp = sourceHero?.classless ? sourceHero.ref.hp : hero.combat.hp;
    const maxHp = sourceHero?.classless ? sourceHero.d.maxHp : d.maxHp;
    return <Modal onClose={onClose} testid="hero-card-classless" slowed={slowed}>
      <div className="p-5" style={{ borderTop: `3px solid ${color}` }}>
        <div className="flex items-center gap-3 mb-3">
          <ClasslessHeroAvatar identityColor={color} className="h-16 w-16 rounded border border-cyan-400/30 bg-black/30" label={`${hero.identity?.name || "Hero"} classless sprite`} />
          <div><div className="font-display font-black text-2xl" style={{ color }}>{hero.identity?.name || "Hero"}</div><div className="font-mono-g text-[11px] text-slate-400">CLASSLESS · LVL {hero.progression?.level || 1}</div></div>
          <div className="ml-auto text-right"><div className="font-mono-g text-[10px] text-slate-400">HP</div><div className="font-mono-g font-bold text-sm" style={{ color }}>{Math.round(hp)}/{Math.round(maxHp)}</div></div>
        </div>
        <div className="grid grid-cols-2 gap-2 mb-4">
          {Object.entries({ attack: stats.attack, defense: stats.defense, agility: stats.agility, intelligence: stats.intelligence }).map(([key, value]) => <div key={key} className="flex justify-between rounded bg-black/30 px-2 py-1 font-mono-g text-xs"><span>{STAT_ICONS[key]} {key.toUpperCase()}</span><b style={{ color }}>{value}</b></div>)}
          <div className="rounded bg-black/30 px-2 py-1 font-mono-g text-xs">BASIC ATTACK · {hero.combat.basicAttack?.damage || 0} DMG</div>
          <div className="rounded bg-black/30 px-2 py-1 font-mono-g text-xs">RANGE · {hero.combat.basicAttack?.range || 0}</div>
        </div>
        {combatMode && <div className="flex gap-2 mb-3">
          <NeonButton color="red" onClick={onRetreat} disabled={hp <= 0 || !onRetreat}>RETREAT</NeonButton>
          <NeonButton color="green" onClick={onRally} disabled={hp <= 0 || !onRally}>RALLY</NeonButton>
          {onCombatMode && <NeonButton color="cyan" onClick={() => onCombatMode(combatMode === "manual" ? "auto" : "manual")}>{combatMode === "manual" ? "MANUAL" : "AUTO"}</NeonButton>}
        </div>}
        <div className="font-mono-g text-[10px] text-slate-400">AP {hero.progression?.ap || 0} · SP {hero.progression?.sp || 0} · OWNED NODES {(hero.progression?.ownedNodeIds || []).length}</div>
      </div>
    </Modal>;
  }
  const curXp = C.HERO_XP[hero.level - 1] || 0;
  const nextXp = C.HERO_XP[hero.level] || curXp;
  const xpFrac = nextXp > curXp ? (hero.xp - curXp) / (nextXp - curXp) : 1;

  return (
    <Modal onClose={onClose} testid={`hero-card-${hero.cls}`} slowed={slowed}>
      <div className="p-5" style={{ borderTop: `3px solid ${cls.color}` }}>
        <div className="flex items-center gap-3 mb-3">
          <HeroMiniSprite cls={hero.cls} color={cls.color} size="lg" dead={hero.hp <= 0} />
          <div>
            <div className="font-display font-black text-2xl" style={{ color: cls.color }}>{cls.name}</div>
            <div className="font-mono-g text-[11px] text-slate-400">{cls.role} · LVL {hero.level}</div>
          </div>
          <div className="ml-auto text-right">
            <div className="font-mono-g text-[10px] text-slate-400">HP</div>
            <div className="font-mono-g font-bold text-sm" style={{ color: cls.color }}>{Math.round(hero.hp)}/{d.maxHp}</div>
          </div>
        </div>

        <div className="mb-3">
          <div className="font-mono-g text-[10px] text-slate-400 mb-1">XP {Math.round(hero.xp)} / {nextXp}</div>
          <StatBar frac={xpFrac} color={cls.color} height={6} />
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <div className="font-mono-g text-[10px] text-slate-400 uppercase tracking-widest mb-1">Equipment</div>
            <div className="space-y-1">
              {C.EQUIP_SLOTS.map((s) => {
                const item = hero.equipment?.[s];
                return (
                  <div key={s} className="bracket flex items-center justify-between gap-2 px-2 py-1 rounded bg-black/30 text-[11px] font-mono-g">
                    <span className="text-slate-400">{s}</span>
                    <span className={item ? "text-cyan-300 truncate" : "text-slate-600"}>
                      {item ? item.name : "— empty —"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
          <div>
            <div className="font-mono-g text-[10px] text-slate-400 uppercase tracking-widest mb-1 flex justify-between">
              <span>Core Stats</span>
              {editable && <span className="text-cyan-400">{draftProgression ? "SP LEFT:" : "SP:"}
                <span data-testid="hero-sp-remaining">{hero.sp}</span>
              </span>}
            </div>
            {["attack", "defense", "agility", "intelligence"].map((st) => (
              <div key={st} className="flex items-center justify-between px-2 py-1 rounded bg-black/30 mb-1">
                <span className="flex items-center gap-1 text-[11px] font-mono-g text-slate-300">{STAT_ICONS[st]}{st.slice(0, 3).toUpperCase()}</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono-g font-bold text-sm" style={{ color: cls.color }} data-testid={`hero-stat-${st}`}>{hero.stats[st] + (d.gear?.[st] || 0)}</span>
                  {editable && (
                    <div className="flex items-center gap-1">
                      {draftProgression && (
                        <button disabled={hero.stats[st] <= originalProgression.current.stats[st]} onClick={() => undoStat(st)} data-testid={`hero-undo-${st}`}
                          aria-label={`Undo pending ${st} point`}
                          className="w-7 h-7 rounded bg-rose-500/15 border border-rose-400/40 text-rose-300 disabled:opacity-30 flex items-center justify-center">−</button>
                      )}
                      <button disabled={hero.sp <= 0} onClick={() => allocateStat(st)} data-testid={`hero-alloc-${st}`}
                        className="w-7 h-7 rounded bg-cyan-500/20 border border-cyan-400/50 text-cyan-300 disabled:opacity-30 flex items-center justify-center"><Plus size={12} /></button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <div className="flex items-center justify-between mb-1">
            <div className="font-mono-g text-[10px] text-slate-400 uppercase tracking-widest">
              Attack Config {editable ? "" : "(edit switches to MANUAL)"}
            </div>
            {combatMode && onCombatMode && (
              <button
                type="button"
                onClick={() => onCombatMode(combatMode === "manual" ? "auto" : "manual")}
                className={`font-mono-g text-[9px] px-2 py-1 rounded border uppercase tracking-wider ${
                  combatMode === "manual"
                    ? "bg-fuchsia-500/20 border-fuchsia-400 text-fuchsia-300"
                    : "bg-cyan-500/20 border-cyan-400 text-cyan-300"
                }`}
                data-testid="hero-combat-mode"
              >
                {combatMode === "manual" ? "MANUAL" : "AUTO"}
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {combatMode && (
              <>
                <NeonButton
                  color="red"
                  className="!px-2 !py-1 !text-[9px]"
                  onClick={onRetreat}
                  disabled={!hero.hp || !onRetreat}
                  data-testid="hero-retreat"
                >
                  RETREAT
                </NeonButton>
                <NeonButton
                  color="green"
                  className="!px-2 !py-1 !text-[9px]"
                  onClick={onRally}
                  disabled={!hero.hp || !onRally}
                  data-testid="hero-rally"
                >
                  RALLY
                </NeonButton>
              </>
            )}
            {C.ATTACK_CONFIGS[hero.cls].map((cfg) => (
              <button key={cfg} onClick={() => onConfig(cfg)} data-testid={`hero-config-${cfg.replace(/\s+/g, "-").toLowerCase()}`}
                className={`text-[10px] font-mono-g px-2 py-1 rounded border ${hero.attackConfig === cfg ? "bg-fuchsia-500 text-black border-fuchsia-400" : "border-white/15 text-slate-300"}`}>{cfg}</button>
            ))}
          </div>
        </div>

        <div>
          <div className="font-mono-g text-[10px] text-slate-400 uppercase tracking-widest mb-1 flex justify-between">
            <span className="flex items-center gap-1"><Zap size={12} /> PRK / ABILITIES</span>
            <span className="text-fuchsia-400">{draftProgression ? "AP LEFT:" : "AP:"}
              <span data-testid="hero-ap-remaining">{hero.ap || 0}</span>
            </span>
          </div>
          <button
            type="button"
            onClick={() => setPerkTreeOpen(true)}
            className="w-full rounded-lg border border-fuchsia-400/40 bg-fuchsia-500/10 px-3 py-2 text-left hover:bg-fuchsia-500/15"
            data-testid="open-perk-tree"
          >
            <div className="flex items-center justify-between">
              <span className="font-mono-g text-[10px] font-bold text-fuchsia-300">OPEN PRK TREE</span>
              <span className="font-mono-g text-[8px] text-slate-500">{hero.perks?.length || 0} selected</span>
            </div>
            <div className="font-mono-g text-[8px] text-slate-500 mt-1">Build branches, unlock intersections, and materialize combat abilities in Tactical.</div>
          </button>
          <div className="mt-2 text-[9px] font-mono-g text-slate-500">
            {hero.perks?.length ? "ACTIVE PRKs: " + hero.perks.length : "No PRKs selected yet."}
          </div>
        </div>
        {draftProgression && (
          <div className="mt-4 border-t border-white/10 pt-3" data-testid="progression-draft-actions">
          <div className="mb-2 font-mono-g text-[8px] text-slate-400">
            Pending allocations · {originalProgression.current.sp - hero.sp} SP · {originalProgression.current.ap - hero.ap} AP
          </div>
          <div className="grid grid-cols-2 gap-2">
            <NeonButton color="red" className="!min-h-11" onClick={onClose} data-testid="cancel-progression">
              CANCEL
            </NeonButton>
            <NeonButton color="green" className="!min-h-11" onClick={confirmProgression} disabled={!hasProgressionChanges} data-testid="confirm-progress" >
              CONFIRM ALLOCATIONS
            </NeonButton>
          </div>
          </div>
        )}
      </div>
      {perkTreeOpen && <PerkTree hero={hero} editable={editable} onPerk={unlockPerk}
        removablePerks={removablePerks} onUndoPerk={undoPerk} onClose={() => setPerkTreeOpen(false)} />}
    </Modal>
  );
}

export function TowerCard({ tower, editable, onUpgrade, onChooseSpecialization, onClose, slowed }) {
  const t = C.TOWERS[tower.type];
  const d = towerDerived(tower);
  const curXp = 150 * (tower.level - 1) * tower.level / 2;
  const nextXp = 150 * tower.level * (tower.level + 1) / 2;
  const xpFrac = nextXp > curXp ? (tower.xp - curXp) / (nextXp - curXp) : 0;
  return (
    <Modal onClose={onClose} testid={`tower-card-${tower.type}`} slowed={slowed}>
      <div className="p-5" style={{ borderTop: `3px solid ${t.color}` }}>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-lg bracket flex items-center justify-center" style={{ boxShadow: `0 0 16px ${t.color}` }}>
            <div className="w-7 h-7 rounded-full border-2 relative" style={{ borderColor: t.color }}>
              <div className="absolute left-1/2 top-0.5 w-1 h-5 -translate-x-1/2 rounded-full" style={{ background: t.color, boxShadow: `0 0 7px ${t.color}` }} />
            </div>
          </div>
          <div>
            <div className="font-display font-black text-xl" style={{ color: t.color }}>{t.name}</div>
            <div className="font-mono-g text-[11px] text-slate-400">LVL {tower.level} {tower.underfunded && <span className="text-rose-400">· UNDERFUNDED</span>}</div>
          </div>
        </div>
        <div className="mb-3">
          <div className="font-mono-g text-[10px] text-slate-400 mb-1">XP {Math.round(tower.xp)} / {Math.round(nextXp)}</div>
          <StatBar frac={xpFrac} color={t.color} height={6} />
        </div>
        <div className="grid grid-cols-2 gap-2 font-mono-g text-xs mb-4">
          <Info label="HP" value={`${Math.round(tower.hp)}/${d.maxHp}`} color={t.color} />
          <Info label="DAMAGE" value={Math.round(d.damage)} color={t.color} />
          <Info label={d.resourceLabel} value={d.resourceKind === "ammo" ? `${Math.round(tower.ammo || 0)}/${d.maxAmmo}` : `${Math.round(tower.mana || 0)}/${d.maxMana}`} color="#FFE600" />
          <Info label="RANGE" value={d.range} color={t.color} />
          <Info label="FIRE RATE" value={`${d.fireRate.toFixed(1)}/s`} color={t.color} />
          <Info label="UPKEEP / WAVE" value={`${Math.ceil(t.upkeep.gold * (1 + Math.max(0, tower.level - 1) * 0.15))}g ${Math.ceil(t.upkeep.stone * (1 + Math.max(0, tower.level - 1) * 0.15))}s`} color="#FFE600" />
          <Info label="SPY" value={`${Math.round((C.SCOUT.towerSpyBase + t.spyBonus / 100) * 100)}%`} color="#00F3FF" />
        </div>
        {editable && tower.pending > 0 ? (
          <div>
            <div className="font-mono-g text-[10px] text-yellow-300 uppercase tracking-widest mb-2 animate-pulse-glow">⬆ {tower.pending} Tower Upgrade{tower.pending > 1 ? "s" : ""} Available</div>
            {(() => {
              const cost = C.towerUpgradeCost(tower);
              return (
                <button onClick={onUpgrade} data-testid="tower-upgrade"
                  className="w-full p-2 rounded-lg border border-cyan-400/40 bg-black/40 hover:bg-cyan-500/20 text-left">
                  <div className="font-mono-g text-xs font-bold text-cyan-300">UPGRADE TO LVL {tower.level + 1}</div>
                  <div className="font-mono-g text-[10px] text-slate-400">+10% max HP · +10% damage · +12% ammo/mana capacity</div>
                  <div className="font-mono-g text-[10px] text-yellow-300 mt-1">Cost {cost.gold}g · {cost.stone}s</div>
                </button>
              );
            })()}
          </div>
        ) : (
          <div className="font-mono-g text-[10px] text-slate-500">Tower XP unlocks paid upgrades. Each upgrade increases HP, damage, and ammo/mana capacity.</div>
        )}
        {editable && [3, 5].map((milestone) => {
          if ((tower.level || 1) < milestone) return null;
          const owned = tower.specializations?.[milestone];
          const options = (C.TOWER_SPECIALIZATIONS[tower.type] || []).filter((spec) => spec.milestone === milestone);
          const chosen = options.find((spec) => spec.id === owned);
          return (
            <div key={milestone} className="mt-3 rounded-lg border border-fuchsia-400/25 bg-fuchsia-500/5 p-2" data-testid={`tower-specialization-${milestone}`}>
              <div className="font-mono-g text-[10px] font-bold text-fuchsia-300 mb-1">LEVEL {milestone} SPECIALIZATION</div>
              {chosen ? (
                <div className="font-mono-g text-[10px] text-green-300">{chosen.name} — {chosen.desc}</div>
              ) : (
                <div className="grid gap-1.5">
                  {options.map((spec) => (
                    <button key={spec.id} type="button" onClick={() => onChooseSpecialization?.(milestone, spec.id)} data-testid={`tower-specialize-${spec.id}`}
                      className="rounded border border-white/15 bg-black/30 p-2 text-left hover:border-fuchsia-400/60">
                      <div className="font-mono-g text-[10px] font-bold text-slate-200">{spec.name}</div>
                      <div className="font-mono-g text-[9px] text-slate-400">{spec.desc}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {(tower.choices || []).length > 0 && (
          <div className="mt-3 font-mono-g text-[10px] text-slate-400">Upgrades: {tower.choices.join(", ")}</div>
        )}
      </div>
    </Modal>
  );
}

function Info({ label, value, color }) {
  return (
    <div className="flex items-center justify-between px-2 py-1.5 rounded bg-black/30">
      <span className="text-slate-400 text-[10px]">{label}</span>
      <span className="font-bold" style={{ color }}>{value}</span>
    </div>
  );
}

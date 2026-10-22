import * as C from "./config";
import { addHeroXp, addTowerXp, completeWave } from "./logic";
import { mergeClasslessBattleResults } from "./classlessBattleResults";

const heroId = (hero) => hero?.cls ? hero.id : hero?.identity?.id;

// Prepare the exact profile update used by Battle.onEnd. The result staging
// happens before mutate receives its disposable draft, so malformed classless
// HP/XP cannot partially modify provider state.
export function stageBattleCompletion({ state, sim, result, heroIds, waveNumber }) {
  if (!state || !sim || !result || !Array.isArray(heroIds) || !Number.isInteger(waveNumber)) {
    throw new TypeError("Invalid battle completion");
  }
  const gainsHeroes = { ...(result.xpGains?.heroes || {}) };
  const gainsTowers = { ...(result.xpGains?.towers || {}) };

  const anyHeroAlive = (sim.heroes || []).some((hero) =>
    (hero?.cls ? hero.hp : hero?.combat?.hp) > 0);
  const castleEscapeLimit = Math.floor((result.total || 0) / 2) + 1;
  const breach = Number(result.castleEscaped || 0) >= castleEscapeLimit;
  let victory = !!result.victory;
  let reason = result.reason || (victory ? "cleared" : "castle");
  if (!anyHeroAlive) {
    victory = false;
    reason = "heroes";
  } else if (sim.castleHp <= 0) {
    victory = false;
    reason = "castle";
  } else if (breach) {
    victory = false;
    reason = "breach";
  }

  const hasClasslessRoster = [...(state.heroes || []), ...(state.bench || [])]
    .some((hero) => !hero.cls && hero.combat);
  const stagedClassless = hasClasslessRoster ? mergeClasslessBattleResults(state, {
    heroIds,
    runtimeHeroes: sim.heroes || [],
    xpGains: gainsHeroes,
  }) : null;
  const stagedClasslessById = new Map([...(stagedClassless?.heroes || []), ...(stagedClassless?.bench || [])]
    .filter((hero) => !hero.cls && hero.combat && typeof hero.identity?.id === "string")
    .map((hero) => [hero.identity.id, hero]));
  const totalXp = Object.values(gainsHeroes).reduce((sum, value) => sum + value, 0) +
    Object.values(gainsTowers).reduce((sum, value) => sum + value, 0);

  const applyToDraft = (draft) => {
    if (!draft || typeof draft !== "object") throw new TypeError("Invalid battle completion draft");
    draft.gold = sim.gold;
    draft.metal = sim.metal;
    draft.stone = sim.stone;
    draft.morale = sim.morale;
    draft.castleHp = sim.castleHp;
    draft.kills = sim.kills;
    draft.vault = sim.vault || draft.vault || [];
    draft.buildings = structuredClone(sim.buildings || draft.buildings || {});
    draft.barricades = structuredClone(sim.barricades || draft.barricades || []);
    draft.shoppe = sim.shoppe || draft.shoppe;
    draft.guildBlockadeLevel = sim.guildBlockadeLevel || 0;
    draft.guildBlockadeActiveUntil = sim.guildBlockadeActiveUntil || 0;
    draft.guildBlockadeCooldownUntil = sim.guildBlockadeCooldownUntil || 0;

    const simHeroesById = new Map((sim.heroes || []).map((hero) => [heroId(hero), hero]));
    for (const hero of [...(draft.heroes || []), ...(draft.bench || [])]) {
      const id = heroId(hero);
      const runtime = simHeroesById.get(id);
      if (!runtime) continue;
      if (hero.cls) {
        hero.hp = runtime.hp;
        hero.manual = !!runtime.manual;
        hero.attackConfig = runtime.attackConfig;
      } else {
        const completed = stagedClasslessById.get(id);
        if (completed) {
          hero.combat = structuredClone(completed.combat);
          hero.progression = structuredClone(completed.progression);
        }
      }
    }

    (draft.towers || []).forEach((tower, index) => {
      if (!tower || !sim.towers?.[index]) return;
      tower.hp = sim.towers[index].hp;
      tower.ammo = sim.towers[index].ammo;
      tower.mana = sim.towers[index].mana;
      tower.maxAmmo = sim.towers[index].maxAmmo;
      tower.maxMana = sim.towers[index].maxMana;
    });
    for (const index in gainsHeroes) {
      const id = heroIds[Number(index)];
      const hero = [...(draft.heroes || []), ...(draft.bench || [])].find((entry) => heroId(entry) === id);
      if (hero?.cls) addHeroXp(hero, gainsHeroes[index]);
    }
    for (const slot in gainsTowers) if (draft.towers?.[slot]) addTowerXp(draft.towers[slot], gainsTowers[slot]);
    draft.towers = (draft.towers || []).filter((tower) => tower.hp > 0);
    draft.bests.totalKills = Math.max(draft.bests.totalKills || 0, draft.kills.total);
    if (victory) completeWave(draft, waveNumber);
  };

  return {
    victory,
    reason,
    applyToDraft,
    lastResult: {
      victory,
      reason,
      wave: waveNumber,
      killed: result.killed,
      totalXp: Math.round(totalXp),
      goldAfter: Math.round(sim.gold),
      metalAfter: Math.round(sim.metal || 0),
      stoneAfter: Math.round(sim.stone),
      morale: Math.round(sim.morale),
      castleHp: Math.round(sim.castleHp),
      gearDrops: Math.max(0, (sim.vault || []).length - (state.vault || []).length),
      leveledUp: heroIds.filter((id, index) => {
        const hero = [...(state.heroes || []), ...(state.bench || [])].find((entry) => heroId(entry) === id);
        if (!hero) return false;
        if (hero.cls) return C.heroLevelForXp((hero.xp || 0) + (gainsHeroes[index] || 0)) > hero.level;
        return (stagedClasslessById.get(id)?.progression?.level || hero.progression?.level || 1) > (hero.progression?.level || 1);
      }).length,
    },
  };
}

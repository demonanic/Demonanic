import { serializeGameState } from "./heroModel";

const classlessId = (hero) => !hero?.cls && hero?.combat && typeof hero.identity?.id === "string"
  ? hero.identity.id
  : null;

// Stage classless combat results on a disposable JSON snapshot. Legacy XP and
// level-up rules remain the responsibility of the legacy battle path.
export function mergeClasslessBattleResults(state, { heroIds, runtimeHeroes, xpGains }) {
  if (!state || !Array.isArray(heroIds) || !Array.isArray(runtimeHeroes) ||
      !xpGains || typeof xpGains !== "object") throw new TypeError("Invalid battle result");

  const staged = serializeGameState(state);
  const roster = [...(staged.heroes || []), ...(staged.bench || [])];
  for (let index = 0; index < heroIds.length; index += 1) {
    const id = heroIds[index];
    const hero = roster.find((entry) => classlessId(entry) === id);
    if (!hero) continue;
    const runtime = runtimeHeroes[index];
    if (!runtime || !runtime.combat || !Number.isFinite(runtime.combat.hp) ||
        !Number.isFinite(hero.combat.maxHp) || hero.combat.maxHp <= 0 ||
        runtime.combat.hp < 0 || runtime.combat.hp > hero.combat.maxHp ||
        !hero.progression || !Number.isFinite(hero.progression.xp) || hero.progression.xp < 0) {
      throw new TypeError("Invalid classless runtime HP");
    }
    const xp = Number(xpGains[index] || 0);
    if (!Number.isFinite(xp) || xp < 0) throw new TypeError("Invalid classless XP award");
    hero.combat.hp = runtime.combat.hp;
    hero.progression.xp += xp;
    const rosterIndex = roster.indexOf(hero);
    roster[rosterIndex] = hero;
  }
  const activeCount = (staged.heroes || []).length;
  staged.heroes = roster.slice(0, activeCount);
  staged.bench = roster.slice(activeCount);
  return staged;
}

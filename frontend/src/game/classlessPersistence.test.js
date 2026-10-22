import { createHeroModel, normalizeClasslessHero, serializeGameState } from "./heroModel";
import { normalizeState } from "../context/GameProvider";
import { createNewState } from "./logic";

describe("classless profile persistence adapter", () => {
  test("round trips identity, appearance, combat and progression", () => {
    const hero = createHeroModel({ id: "stable-id", name: "Aster", appearanceId: "look-7" });
    hero.combat.hp = 217;
    hero.progression = { level: 3, xp: 42, ap: 2, sp: 1, ownedNodeIds: ["node-a"] };
    const state = normalizeState({ ...createNewState(), heroes: [hero] });
    const saved = serializeGameState(state);
    const loaded = normalizeState(JSON.parse(JSON.stringify(saved))).heroes[0];
    expect(loaded.identity).toEqual(hero.identity);
    expect(loaded.appearance).toEqual(hero.appearance);
    expect(loaded.combat).toEqual(hero.combat);
    expect(loaded.progression).toEqual(hero.progression);
    expect(loaded.cls).toBeUndefined();
  });

  test("keeps existing class profile normalization", () => {
    const legacy = createNewState(["knight"]);
    const before = JSON.parse(JSON.stringify(legacy.heroes[0]));
    const result = normalizeState(legacy);
    expect(result.heroes[0].cls).toBe("knight");
    expect(result.heroes[0].stats).toEqual(before.stats);
    expect(legacy.heroes[0]).toEqual(before);
  });

  test("repairs malformed optional classless values and tolerates unknown fields", () => {
    const result = normalizeClasslessHero({ identity: { id: "x" }, combat: { hp: "bad", stats: { attack: null } }, progression: { ownedNodeIds: "bad" }, custom: { flag: true } });
    expect(result.identity.name).toBe("Hero");
    expect(result.combat.hp).toBe(300);
    expect(result.combat.stats.attack).toBe(10);
    expect(result.progression.ownedNodeIds).toEqual([]);
    expect(result.custom).toEqual({ flag: true });
    expect(result.cls).toBeUndefined();
  });

  test("normalization and serialization failures leave source objects untouched", () => {
    const state = { wave: 1, heroes: [{ identity: { name: "kept" }, combat: { hp: 12 }, marker: "unchanged" }] };
    const snapshot = JSON.parse(JSON.stringify(state));
    expect(() => normalizeState(state)).not.toThrow();
    expect(state).toEqual(snapshot);
    const malformed = { wave: 1, heroes: [] };
    malformed.unserializable = malformed;
    expect(() => normalizeState(malformed)).toThrow();
    expect(malformed.heroes).toEqual([]);
    expect(malformed.unserializable).toBe(malformed);
    const cyclic = { wave: 1 };
    cyclic.self = cyclic;
    expect(() => serializeGameState(cyclic)).toThrow();
    expect(cyclic.self).toBe(cyclic);
  });

  test("retains disposable new-game economy, castle and profile structure", () => {
    const fresh = createNewState();
    fresh.heroes.push(createHeroModel({ id: "disposable", name: "No Class" }));
    const normalized = normalizeState(fresh);
    expect(normalized.gold).toBe(fresh.gold);
    expect(normalized.castleHp).toBe(fresh.castleHp);
    expect(normalized.castleMaxHp).toBe(fresh.castleMaxHp);
    expect(normalized.wave).toBe(1);
    expect(normalized.heroes[0].identity.id).toBe("disposable");
    expect(normalized.needsSquad).toBe(true);
    expect(fresh.heroes[0].cls).toBeUndefined();
  });
});

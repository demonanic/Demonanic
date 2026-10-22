import { createHeroModel } from "./heroModel";
import {
  getClasslessAbilityDefinition,
  getUnlockedClasslessAbilities,
  IMPLEMENTED_CLASSLESS_ABILITY_NODE_IDS,
  validateClasslessAbilityUse,
} from "./classlessAbilities";

describe("canonical classless Precision ability definitions", () => {
  test("exposes only the two implemented Phase 1 Precision node abilities", () => {
    expect(IMPLEMENTED_CLASSLESS_ABILITY_NODE_IDS).toEqual(["P3", "P3a"]);
    expect(getClasslessAbilityDefinition("P3")).toMatchObject({
      unlockNodeId: "P3", name: "Execution", cooldownSeconds: 22, resourceCost: 0,
      targetMode: "enemy", damageMultiplier: 1.8, conditionalTargetHpBelow: 0.35, conditionalDamageBonus: 0.25,
    });
    expect(getClasslessAbilityDefinition("P3a")).toMatchObject({
      unlockNodeId: "P3a", name: "Killshot", cooldownSeconds: 18, resourceCost: 0,
      damageMultiplier: 2, conditionalTargetHpBelow: 0.4, refundCooldownOnKill: true,
    });
    expect(getClasslessAbilityDefinition("V3")).toBeNull();
  });

  test("derives unlocks solely from canonical node ownership", () => {
    const hero = createHeroModel({ id: "precision-hero" });
    expect(getUnlockedClasslessAbilities(hero)).toEqual([]);
    hero.progression.ownedNodeIds = ["P3"];
    expect(getUnlockedClasslessAbilities(hero).map((ability) => ability.id)).toEqual(["P3"]);
    hero.cls = "mage";
    expect(getUnlockedClasslessAbilities(hero).map((ability) => ability.id)).toEqual(["P3"]);
  });

  test.each([
    [{ alive: false }, "unavailable"],
    [{ alive: true, cooldown: 2 }, "cooldown"],
    [{ alive: true, target: null }, "no_target"],
    [{ alive: true, target: { hp: 200, maxHp: 500 } }, "target_health"],
  ])("rejects invalid activation without a successful validation result: %s", (scenario, reason) => {
    const hero = createHeroModel({ id: "precision-hero" });
    hero.progression.ownedNodeIds = ["P3"];
    const target = scenario.target;
    const result = validateClasslessAbilityUse({ hero: { ...hero, alive: scenario.alive }, abilityId: "P3",
      cooldown: scenario.cooldown || 0, target, targetValid: !!target, battleActive: true });
    expect(result).toMatchObject({ ok: false, reason });
  });

  test("does not unlock unknown or unowned abilities", () => {
    const hero = createHeroModel({ id: "precision-hero" });
    const validTarget = { hp: 100, maxHp: 500 };
    expect(validateClasslessAbilityUse({ hero, abilityId: "P3", target: validTarget, targetValid: true })).toMatchObject({ ok: false, reason: "locked" });
    hero.progression.ownedNodeIds = ["P3"];
    expect(validateClasslessAbilityUse({ hero, abilityId: "P3a", target: validTarget, targetValid: true })).toMatchObject({ ok: false, reason: "locked" });
  });
});

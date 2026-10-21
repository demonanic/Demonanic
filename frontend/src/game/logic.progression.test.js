import {
  allocateSp, buyPerk, commitHeroProgressionDraft, createHero, undoPendingPerk, undoPendingSp,
} from "./logic";

const clone = (value) => JSON.parse(JSON.stringify(value));

describe("reversible Preparation hero progression", () => {
  function makeDraft() {
    const hero = createHero("knight");
    hero.sp = 2;
    hero.ap = 3;
    return { hero, original: clone(hero), draft: clone(hero) };
  }

  test("SP allocations can be undone only up to the original stat and available points", () => {
    const { original, draft } = makeDraft();
    expect(allocateSp(draft, "attack")).toBe(true);
    expect(allocateSp(draft, "attack")).toBe(true);
    expect(draft.sp).toBe(0);
    expect(draft.stats.attack).toBe(original.stats.attack + 2);

    expect(undoPendingSp(draft, "attack", original.stats)).toBe(true);
    expect(undoPendingSp(draft, "attack", original.stats)).toBe(true);
    expect(undoPendingSp(draft, "attack", original.stats)).toBe(false);
    expect(allocateSp(draft, "invalid")).toBe(false);
    expect(draft.stats.attack).toBe(original.stats.attack);
    expect(draft.sp).toBe(2);
  });

  test("pending perks refund once and cannot remove a parent before its pending child", () => {
    const { original, draft } = makeDraft();
    expect(buyPerk(draft, "knight_bulwark")).toBe(true);
    expect(buyPerk(draft, "knight_guardian")).toBe(true);
    expect(draft.ap).toBe(1);

    expect(undoPendingPerk(draft, "knight_bulwark", original.perks)).toBe(false);
    expect(undoPendingPerk(draft, "knight_guardian", original.perks)).toBe(true);
    expect(undoPendingPerk(draft, "knight_guardian", original.perks)).toBe(false);
    expect(undoPendingPerk(draft, "knight_bulwark", original.perks)).toBe(true);
    expect(draft.ap).toBe(3);
    expect(draft.perks).toEqual([]);

    const committed = createHero("knight");
    committed.perks = ["knight_bulwark"];
    expect(undoPendingPerk(committed, "knight_bulwark", committed.perks)).toBe(false);
  });

  test("confirm commits staged AP/SP once, with unchanged point balances matching the draft", () => {
    const { hero, original, draft } = makeDraft();
    expect(allocateSp(draft, "defense")).toBe(true);
    expect(buyPerk(draft, "knight_bulwark")).toBe(true);

    expect(commitHeroProgressionDraft(hero, original, draft)).toBe(true);
    expect(hero.stats.defense).toBe(original.stats.defense + 1);
    expect(hero.sp).toBe(1);
    expect(hero.ap).toBe(2);
    expect(hero.perks).toEqual(["knight_bulwark"]);
    expect(commitHeroProgressionDraft(hero, original, draft)).toBe(false);
  });

  test("rejects invalid or stale drafts without changing committed progression", () => {
    const { hero, original, draft } = makeDraft();
    expect(allocateSp(draft, "agility")).toBe(true);
    draft.sp = -1;
    expect(commitHeroProgressionDraft(hero, original, draft)).toBe(false);
    expect(hero.sp).toBe(original.sp);
    expect(hero.stats.agility).toBe(original.stats.agility);

    const stale = clone(original);
    stale.ap -= 1;
    expect(commitHeroProgressionDraft(hero, original, stale)).toBe(false);

    const overspent = clone(original);
    overspent.ap = 0;
    overspent.perks = ["knight_bulwark", "knight_iron_wall"];
    expect(commitHeroProgressionDraft(hero, original, overspent)).toBe(false);
  });
});

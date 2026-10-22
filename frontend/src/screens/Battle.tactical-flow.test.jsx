import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { createNewState } from "../game/logic";
import { createHeroModel } from "../game/heroModel";
import Battle from "./Battle";

let mockGameContext;
let mockEngineInstance;

jest.mock("../context/GameProvider", () => ({ useGame: () => mockGameContext }));
jest.mock("../game/engine", () => {
  class MockEngine {
    constructor(_canvas, sim, _wave, callbacks) {
      this.callbacks = callbacks;
      this.sim = sim;
      this.heroes = sim.heroes.map((hero, i) => ({ i, alive: hero.hp > 0 }));
      this.ended = false;
      mockEngineInstance = this;
    }
    start() {}
    stop() {}
    setSpeed() {}
    setSelectedHero() {}
    setTargetSelection = jest.fn()
    setHeroManual() { return true; }
    getHeroAbilityStatus = jest.fn(() => this.abilityStatus || []);
    getHeroSpellStatus = jest.fn(() => this.spellStatus || []);
    getHeroAbilityTargets = jest.fn(() => this.actionTargets || []);
    getMageSpellTargets = jest.fn(() => this.actionTargets || []);
    getHeroAbilityTargetAt = jest.fn(() => (this.actionTargets || [])[0] || null);
    getMageSpellTargetAt = jest.fn(() => (this.actionTargets || [])[0] || null);
    getHeroAbilityAreaPreview = jest.fn((_index, _id, x, y) => ({ valid: true, targets: [{ x, y }] }));
    getMageSpellAreaPreview = jest.fn((_index, _id, x, y) => ({ valid: true, targets: [{ x, y }], radius: 95 }));
    useHeroAbility = jest.fn(() => true);
    castMageSpell = jest.fn(() => true);
    commandHeroAttack = jest.fn(() => true);
    commandHeroAttackAt = jest.fn(() => true);
    commandHeroMoveTo = jest.fn(() => true);
    cancelTacticalAction = jest.fn(() => true);
    getRangedTargetStatus() {
      return { heroName: "Archer", range: 340, targets: [{ type: "orc", name: "Orc", hp: 30, maxHp: 40, distance: 90, enemy: {} }] };
    }
    getRangedTargetAt() { return null; }
    getBuildingAt = jest.fn(() => null);
    getFallenHeroRevivalOffer() {
      if (this.ended || this.heroes.filter((hero) => hero.alive).length !== 1) return null;
      const fallen = this.heroes.filter((hero, index) => !hero.alive && this.sim.heroes[index].hp <= 0);
      if (!fallen.length) return null;
      return { cost: fallen.length * 300, heroIds: fallen.map((hero) => this.sim.heroes[hero.i].id) };
    }
    reviveFallenHeroes() {
      const offer = this.getFallenHeroRevivalOffer();
      if (!offer || this.sim.gold < offer.cost) return false;
      this.sim.gold -= offer.cost;
      for (const hero of this.heroes) {
        if (!offer.heroIds.includes(this.sim.heroes[hero.i].id)) continue;
        this.sim.heroes[hero.i].hp = Math.round(this.sim.heroes[hero.i].maxHp * 0.5);
        hero.alive = true;
      }
      return offer;
    }
  }
  return { Engine: MockEngine, LAYOUT: { W: 420, H: 760 } };
});
jest.mock("../components/cards", () => ({ HeroCard: () => null, TowerCard: () => null }));
jest.mock("../components/DebugPanel", () => () => null);
jest.mock("../components/ui-kit", () => ({
  NeonButton: ({ children, active, ...props }) => <button aria-pressed={active} {...props}>{children}</button>,
  StatBar: () => null,
  HeroMiniSprite: () => <span />,
  TowerIcon: () => <span />,
  getTacticalHudOpaque: () => false,
  setTacticalHudOpaque: () => {},
}));

describe("Battle tactical menu lifecycle", () => {
  let container;
  let root;

  const startBattle = (heroClass = "archer", beginCombat = true, fallenIndexes = [], startingGold = null) => {
    jest.useFakeTimers();
    const state = createNewState(Array.isArray(heroClass) ? heroClass : [heroClass]);
    if (startingGold !== null) state.gold = startingGold;
    state.heroes.forEach((hero, index) => {
      hero.manual = true;
      if (fallenIndexes.includes(index)) hero.hp = 0;
    });
    mockGameContext = {
      state,
      mutate: (update) => update(state),
      setScreen: jest.fn(),
      setLastResult: jest.fn(),
    };
    act(() => root.render(<Battle />));
    if (beginCombat) act(() => jest.advanceTimersByTime(5000));
    act(() => jest.advanceTimersByTime(100));
    act(() => mockEngineInstance.callbacks.onHud({
      heroAbilities: [[{ id: "archer_focus_volley", name: "Focus Volley", desc: "Three shots.", cooldown: 0, available: true }]],
      heroSpells: [[{ id: "fireball", name: "Fireball", color: "#FF6600", cost: 12, cooldown: 0, available: true }]],
      heroes: state.heroes.map((hero, index) => ({ name: hero.name, hp: hero.hp || 100, maxHp: hero.maxHp, alive: !fallenIndexes.includes(index) })),
      remaining: 1,
      total: 1,
      castleHp: 100,
      castleMaxHp: 100,
      morale: 100,
      gold: 0,
    }));
    return mockEngineInstance;
  };

  const openCategory = (category) => {
    act(() => container.querySelector(`[data-testid="tactical-category-${category}"]`).click());
  };
  const openCommands = () => openCategory("abilities");

  beforeEach(() => {
    global.IS_REACT_ACT_ENVIRONMENT = true;
    global.structuredClone ||= (value) => JSON.parse(JSON.stringify(value));
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    mockEngineInstance = null;
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    jest.useRealTimers();
  });

  test("keeps the battlefield clear through an ability and returns to the dock after resolution", () => {
    const engine = startBattle();
    openCommands();

    act(() => container.querySelector('[data-testid="tactical-ability-archer_focus_volley"]').click());
    expect(container.querySelector('[data-testid="tactical-menu"]')).toBeNull();
    expect(container.querySelector('[data-testid="tactical-action-overlay"]').textContent).toContain("ABILITY RESOLVING");

    act(() => engine.callbacks.onActionResolved({ index: 0, result: "completed" }));
    expect(container.querySelector('[data-testid="tactical-menu"]')).toBeNull();
    expect(container.querySelector('[data-testid="tactical-category-dock"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="combat-action-notice"]').textContent).toContain("ABILITY COMPLETE");
    act(() => jest.advanceTimersByTime(1500));
    expect(container.querySelector('[data-testid="combat-action-notice"]')).toBeNull();
  });

  test("keeps classless heroes out of the live battle engine", () => {
    jest.useFakeTimers();
    const state = createNewState();
    state.heroes = [createHeroModel({ id: "classless-live-gate", name: "Aster" })];
    mockGameContext = { state, mutate: jest.fn(), setScreen: jest.fn(), setLastResult: jest.fn() };

    act(() => root.render(<Battle />));

    expect(container.textContent).toContain("Classless heroes are not enabled in live battle yet.");
    expect(mockEngineInstance).toBeNull();
    expect(mockGameContext.setScreen).toHaveBeenCalledWith("prep");
  });

  test("keeps the five-category dock available over a visible battlefield without triggering actions", () => {
    const engine = startBattle();
    const categories = ["tactics", "combat", "abilities", "spells", "squad"];
    expect(container.querySelector('[data-testid="battlefield-canvas"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="tactical-category-dock"]').querySelectorAll("button")).toHaveLength(5);

    for (const category of categories) {
      openCategory(category);
      expect(container.querySelector('[data-testid="tactical-menu"]').getAttribute("aria-label")).toBe(`${category[0].toUpperCase()}${category.slice(1)} actions`);
      expect(container.querySelector('[data-testid="battlefield-canvas"]')).not.toBeNull();
    }
    expect(engine.useHeroAbility).not.toHaveBeenCalled();
    expect(engine.castMageSpell).not.toHaveBeenCalled();
    expect(engine.commandHeroAttack).not.toHaveBeenCalled();
  });

  test("a menu action dismisses an obstructive battlefield panel before resolving", () => {
    const engine = startBattle();
    engine.getBuildingAt.mockReturnValue("mine");
    engine.sim.buildings = { mine: { level: 1, hp: 1000, maxHp: 1000, activity: "Idle" } };
    mockGameContext.state.buildings = engine.sim.buildings;
    const canvas = container.querySelector('[data-testid="battlefield-canvas"]');
    canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 420, height: 760 });
    act(() => canvas.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, clientX: 20, clientY: 20 })));
    expect(engine.getBuildingAt).toHaveBeenCalled();
    expect(container.querySelector('[data-testid="battlefield-building-panel"]')).not.toBeNull();

    openCommands();
    act(() => container.querySelector('[data-testid="tactical-ability-archer_focus_volley"]').click());
    expect(engine.useHeroAbility).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[data-testid="battlefield-building-panel"]')).toBeNull();
    expect(container.querySelector('[data-testid="tactical-menu"]')).toBeNull();
    expect(container.querySelector('[data-testid="tactical-hero-selector"]')).not.toBeNull();
  });

  test("minimizes for a spell and leaves panels closed after its visual resolution", () => {
    const engine = startBattle("mage");
    openCategory("spells");
    act(() => container.querySelector('[data-testid="tactical-spell-fireball"]').click());
    expect(engine.castMageSpell).toHaveBeenCalledWith(0, "fireball", null);
    expect(engine.castMageSpell).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[data-testid="tactical-menu"]')).toBeNull();
    expect(container.querySelector('[data-testid="tactical-action-cancel"]')).toBeNull();
    expect(container.querySelector('[data-testid="battle-active-hero-0"]').disabled).toBe(true);

    act(() => engine.callbacks.onHud({ heroes: [{ name: "Hero", hp: 100, maxHp: 100, alive: true }] }));
    expect(container.querySelector('[data-testid="tactical-menu"]')).toBeNull();
    expect(container.querySelector('[data-testid="tactical-action-overlay"]')).not.toBeNull();

    act(() => engine.callbacks.onActionResolved({ index: 0, result: "completed" }));
    expect(container.querySelector('[data-testid="tactical-menu"]')).toBeNull();
    expect(container.querySelector('[data-testid="tactical-category-dock"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="combat-action-notice"]').textContent).toContain("SPELL COMPLETE");
  });

  test("failed spell casts leave the battlefield clear and report the failure", () => {
    const engine = startBattle("mage");
    engine.castMageSpell.mockReturnValue(false);
    openCategory("spells");
    act(() => container.querySelector('[data-testid="tactical-spell-fireball"]').click());

    expect(container.querySelector('[data-testid="tactical-menu"]')).toBeNull();
    expect(container.querySelector('[data-testid="tactical-action-overlay"]')).toBeNull();
    expect(container.querySelector('[data-testid="combat-action-notice"]').textContent).toContain("SPELL NOT AVAILABLE");
  });

  test("executes a selected enemy-targeted ability once on a valid target tap", () => {
    const engine = startBattle("knight");
    const target = { type: "orc", name: "Orc", hp: 30, maxHp: 40, distance: 90, enemy: { id: "orc-1" } };
    engine.abilityStatus = [{ id: "knight_shield_bash", name: "Shield Bash", cooldown: 0, available: true, targetMode: "enemy", range: 190 }];
    engine.actionTargets = [target];
    act(() => jest.advanceTimersByTime(100));
    act(() => engine.callbacks.onHud({
      heroAbilities: [engine.abilityStatus], heroes: [{ name: "Knight", hp: 100, maxHp: 100, alive: true }],
      castleHp: 100, castleMaxHp: 100, morale: 100, gold: 0, remaining: 1, total: 1,
    }));
    openCategory("abilities");
    act(() => container.querySelector('[data-testid="tactical-ability-knight_shield_bash"]').click());
    expect(container.querySelector('[data-testid="ability-target-orc"]')).not.toBeNull();
    act(() => container.querySelector('[data-testid="ability-target-orc"]').click());
    expect(engine.useHeroAbility).toHaveBeenCalledTimes(1);
    expect(engine.useHeroAbility).toHaveBeenCalledWith(0, "knight_shield_bash", target);
    expect(container.querySelector('[data-testid="tactical-action-overlay"]').textContent).toContain("ABILITY RESOLVING");
    expect(container.querySelector('[data-testid="tactical-menu"]')).toBeNull();
  });

  test("executes an area spell on the chosen location once after showing its targeting preview", () => {
    const engine = startBattle("mage");
    engine.spellStatus = [{ id: "cinder_field", name: "Cinder Field", cost: 20, cooldown: 0, available: true, targetMode: "area", range: 340, radius: 95 }];
    act(() => jest.advanceTimersByTime(100));
    act(() => engine.callbacks.onHud({
      heroSpells: [engine.spellStatus], heroes: [{ name: "Mage", hp: 100, maxHp: 100, alive: true }],
      castleHp: 100, castleMaxHp: 100, morale: 100, gold: 0, remaining: 1, total: 1,
    }));
    openCategory("spells");
    act(() => container.querySelector('[data-testid="tactical-spell-cinder_field"]').click());
    expect(engine.castMageSpell).not.toHaveBeenCalled();

    const canvas = container.querySelector('[data-testid="battlefield-canvas"]');
    canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 420, height: 760 });
    act(() => canvas.dispatchEvent(new MouseEvent("pointermove", { bubbles: true, clientX: 120, clientY: 200 })));
    expect(container.querySelector('[data-testid="combat-area-preview"]')).not.toBeNull();
    act(() => canvas.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, clientX: 120, clientY: 200 })));
    expect(engine.getMageSpellAreaPreview).toHaveBeenCalledWith(0, "cinder_field", 120, 200);
    expect(engine.castMageSpell).toHaveBeenCalledTimes(1);
    expect(engine.castMageSpell).toHaveBeenCalledWith(0, "cinder_field", { x: 120, y: 200 });
    expect(container.querySelector('[data-testid="combat-area-preview"]')).toBeNull();
    expect(container.querySelector('[data-testid="tactical-menu"]')).toBeNull();
  });

  test("switching heroes cancels unexecuted targeting without dispatching the old action", () => {
    const engine = startBattle(["knight", "mage"]);
    engine.abilityStatus = [{ id: "knight_shield_bash", name: "Shield Bash", cooldown: 0, available: true, targetMode: "enemy", range: 190 }];
    act(() => jest.advanceTimersByTime(100));
    act(() => engine.callbacks.onHud({
      heroAbilities: [engine.abilityStatus, []],
      heroSpells: [[], [{ id: "fireball", name: "Fireball", cost: 12, mana: 35, maxMana: 50, cooldown: 0, available: true }]],
      heroes: engine.sim.heroes.map((hero) => ({ name: hero.name, hp: hero.hp, maxHp: hero.maxHp, alive: true })),
      castleHp: 100, castleMaxHp: 100, morale: 100, gold: 0, remaining: 1, total: 1,
    }));
    openCategory("abilities");
    act(() => container.querySelector('[data-testid="tactical-ability-knight_shield_bash"]').click());
    expect(container.querySelector('[data-testid="tactical-action-overlay"]')).not.toBeNull();
    act(() => container.querySelector('[data-testid="battle-active-hero-1"]').click());
    expect(engine.useHeroAbility).not.toHaveBeenCalled();
    expect(container.querySelector('[data-testid="tactical-action-overlay"]')).toBeNull();
    expect(container.querySelector('[data-testid="battle-active-hero-1"]').getAttribute("aria-pressed")).toBe("true");
    expect(container.querySelector('[data-testid="combat-action-notice"]').textContent).toContain("TARGETING CANCELED");
    expect(container.querySelector('[data-testid="tactical-menu"]')).toBeNull();
    openCategory("spells");
    expect(container.querySelector('[data-testid="tactical-menu"]').textContent).toContain("MAGE SPELLS");
    expect(container.querySelector('[data-testid="tactical-menu"]').textContent).toContain("35/50 MP");
    expect(engine.castMageSpell).not.toHaveBeenCalled();
  });

  test("keeps the menu minimized during basic attack targeting and impact", () => {
    const engine = startBattle();
    openCategory("combat");
    act(() => container.querySelector('[data-testid="tactical-target"]').click());

    expect(container.querySelector('[data-testid="tactical-menu"]')).toBeNull();
    expect(container.querySelector('[data-testid="battle-target-orc"]')).not.toBeNull();
    act(() => container.querySelector('[data-testid="battle-target-orc"]').click());
    expect(engine.commandHeroAttack).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[data-testid="tactical-menu"]')).toBeNull();
    expect(container.querySelector('[data-testid="tactical-action-overlay"]').textContent).toContain("ATTACK RESOLVING");

    act(() => engine.callbacks.onActionResolved({ index: 0, result: "completed" }));
    expect(container.querySelector('[data-testid="tactical-menu"]')).toBeNull();
  });

  test("cancels target selection without issuing an attack or reopening a panel", () => {
    const engine = startBattle();
    openCategory("combat");
    act(() => container.querySelector('[data-testid="tactical-target"]').click());
    act(() => container.querySelector('[data-testid="tactical-action-cancel"]').click());

    expect(engine.commandHeroAttack).not.toHaveBeenCalled();
    expect(container.querySelector('[data-testid="tactical-menu"]')).toBeNull();
    expect(container.querySelector('[data-testid="tactical-category-dock"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="combat-action-notice"]').textContent).toContain("TARGETING CANCELED");
  });

  test("invalid target selection keeps target mode active and provides visible retry feedback", () => {
    const engine = startBattle();
    engine.commandHeroAttackAt.mockReturnValue(false);
    openCategory("combat");
    act(() => container.querySelector('[data-testid="tactical-target"]').click());

    const canvas = container.querySelector('[data-testid="battlefield-canvas"]');
    canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 420, height: 760 });
    act(() => canvas.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, clientX: 20, clientY: 20 })));

    expect(container.querySelector('[data-testid="tactical-menu"]')).toBeNull();
    expect(container.querySelector('[data-testid="tactical-action-overlay"]').textContent).toContain("INVALID TARGET");
    expect(engine.setTargetSelection).toHaveBeenLastCalledWith(0);
  });

  test("movement minimizes until arrival without exposing cancel while resolving", () => {
    const engine = startBattle();
    openCategory("tactics");

    act(() => container.querySelector('[data-testid="tactical-move"]').click());

    expect(container.querySelector('[data-testid="tactical-action-overlay"]').textContent)
      .toContain("MOVE MODE");

    const canvas = container.querySelector('[data-testid="battlefield-canvas"]');
    canvas.getBoundingClientRect = () => ({
      left: 0, top: 0, width: 420, height: 760
    });

    act(() => canvas.dispatchEvent(new MouseEvent("pointerdown", {
      bubbles: true, clientX: 20, clientY: 20
    })));

    expect(engine.commandHeroMoveTo).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[data-testid="tactical-action-overlay"]').textContent)
      .toContain("MOVE RESOLVING");
    expect(container.querySelector('[data-testid="tactical-action-cancel"]')).toBeNull();
    expect(container.querySelector('[data-testid="tactical-menu"]')).toBeNull();

    act(() => engine.callbacks.onActionResolved({
      index: 0, result: "arrived"
    }));

    expect(container.querySelector('[data-testid="tactical-menu"]')).toBeNull();
    expect(container.querySelector('[data-testid="tactical-category-dock"]')).not.toBeNull();
});

test("does not reopen after the hero dies", () => {
    const engine = startBattle();
    openCommands();
    act(() => container.querySelector('[data-testid="tactical-ability-archer_focus_volley"]').click());
    engine.heroes[0].alive = false;
    act(() => engine.callbacks.onActionResolved({ index: 0, result: "cancelled" }));
    expect(container.querySelector('[data-testid="tactical-menu"]')).toBeNull();
  });

  test("does not reopen after battle completion", () => {
    const engine = startBattle();
    openCommands();
    act(() => container.querySelector('[data-testid="tactical-ability-archer_focus_volley"]').click());
    const result = { victory: true, reason: "cleared", xpGains: { heroes: {}, towers: {} }, killed: 0, total: 0 };
    act(() => engine.callbacks.onEnd(result));
    act(() => engine.callbacks.onActionResolved({ index: 0, result: "completed" }));
    expect(container.querySelector('[data-testid="tactical-menu"]')).toBeNull();
    expect(container.querySelector('[data-testid="tactical-category-dock"]')).toBeNull();
  });

  test("does not issue a combat action before the battle starts", () => {
    const engine = startBattle("archer", false);
    act(() => mockEngineInstance.callbacks.onHud({
      heroAbilities: [[{ id: "archer_focus_volley", name: "Focus Volley", desc: "Three shots.", cooldown: 0, available: true }]],
      heroSpells: [[{ id: "fireball", name: "Fireball", color: "#FF6600", cost: 12, cooldown: 0, available: true }]],
      heroes: [{ name: "Hero", hp: 100, maxHp: 100, alive: true }],
      remaining: 1,
      total: 1,
      castleHp: 100,
      castleMaxHp: 100,
      morale: 100,
      gold: 0,
    }));
    expect(container.querySelector('[data-testid="tactical-category-dock"]')).toBeNull();
    expect(engine.useHeroAbility).not.toHaveBeenCalled();
    expect(container.querySelector('[data-testid="tactical-menu"]')).toBeNull();
  });

  test("one survivor receives a dismissible paid-revival offer and only fallen heroes are restored", () => {
    const engine = startBattle(["knight", "mage", "archer"], true, [1, 2], 5000);
    const initialGold = engine.sim.gold;
    engine.sim.towers = [{ hp: 123, maxHp: 456 }];
    engine.sim.castleHp = 321;
    act(() => engine.callbacks.onHud({
      heroes: engine.sim.heroes.map((hero, index) => ({ name: hero.name, hp: hero.hp, maxHp: hero.maxHp, alive: index === 0 })),
    }));

    const offer = container.querySelector('[data-testid="battle-revival-offer"]');
    expect(offer.textContent).toContain("One hero remains");
    expect(offer.textContent).toContain("600G");
    expect(offer.textContent).toContain(`TREASURY ${Math.floor(initialGold)}G`);
    expect(container.querySelector('[data-testid="ad-revive-unavailable"]').disabled).toBe(true);
    const reviveButton = container.querySelector('[data-testid="pay-revive-fallen"]');
    expect(reviveButton.disabled).toBe(false);
    const reviveSpy = jest.spyOn(engine, "reviveFallenHeroes");
    act(() => reviveButton.click());

    expect(reviveSpy).toHaveBeenCalledTimes(1);
    expect(engine.sim.gold).toBe(initialGold - 600);
    expect(mockGameContext.state.gold).toBe(initialGold - 600);
    expect(mockGameContext.state.heroes[0].hp).toBeGreaterThan(0);
    expect(mockGameContext.state.heroes[1].hp).toBe(Math.round(mockGameContext.state.heroes[1].maxHp * 0.5));
    expect(mockGameContext.state.heroes[2].hp).toBe(Math.round(mockGameContext.state.heroes[2].maxHp * 0.5));
    expect(engine.sim.towers[0].hp).toBe(123);
    expect(engine.sim.castleHp).toBe(321);
    expect(container.querySelector('[data-testid="battle-revival-offer"]')).toBeNull();
  });

  test("completely defeated squads receive no mid-battle revival offer", () => {
    const engine = startBattle(["knight", "mage"], true, [0, 1]);
    act(() => engine.callbacks.onHud({
      heroes: engine.sim.heroes.map((hero) => ({ name: hero.name, hp: 0, maxHp: hero.maxHp, alive: false })),
    }));
    expect(container.querySelector('[data-testid="battle-revival-offer"]')).toBeNull();
  });

  test("defeat state, barricade damage, kill rewards, and XP persist once; retry does not advance the wave", () => {
    const engine = startBattle();
    engine.sim.gold = 412;
    engine.sim.vault.push({ id: "drop-1", type: "weapon" });
    engine.sim.barricades[0] = { hp: 0, maxHp: 1000 };
    const defeat = { victory: false, reason: "castle", xpGains: { heroes: { 0: 25 }, towers: {} }, killed: 1, total: 2 };
    act(() => engine.callbacks.onEnd(defeat));

    expect(mockGameContext.state.gold).toBe(412);
    expect(mockGameContext.state.vault).toEqual([{ id: "drop-1", type: "weapon" }]);
    expect(mockGameContext.state.barricades[0]).toEqual({ hp: 0, maxHp: 1000 });
    expect(mockGameContext.state.heroes[0].xp).toBe(25);
    expect(mockGameContext.state.wave).toBe(1);

    engine.sim.gold = 5;
    act(() => engine.callbacks.onEnd(defeat));
    expect(mockGameContext.state.gold).toBe(412);
    expect(mockGameContext.state.heroes[0].xp).toBe(25);
    expect(mockGameContext.state.wave).toBe(1);
  });

  test("duplicate victory callback grants wave progression once", () => {
    const engine = startBattle();
    const victory = { victory: true, reason: "cleared", xpGains: { heroes: {}, towers: {} }, killed: 1, total: 1 };
    act(() => engine.callbacks.onEnd(victory));
    act(() => engine.callbacks.onEnd(victory));
    expect(mockGameContext.state.wave).toBe(2);
    expect(mockGameContext.state.highestWaveCleared).toBe(1);
  });
});

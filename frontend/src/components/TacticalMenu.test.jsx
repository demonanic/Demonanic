import React, { act, useState } from "react";
import { createRoot } from "react-dom/client";
import TacticalMenu from "./TacticalMenu";

jest.mock("./ui-kit", () => ({
  NeonButton: ({ children, active, ...props }) => <button aria-pressed={active} {...props}>{children}</button>,
  HeroMiniSprite: () => <span aria-hidden="true" />,
}));

const heroes = [
  { id: "knight-1", cls: "knight", hp: 100, maxHp: 100, level: 1, manual: false },
  { id: "mage-1", cls: "mage", hp: 80, maxHp: 80, level: 2, manual: false },
];
const spells = [{ id: "fireball", name: "Fireball", color: "#FF6600", cost: 12, cooldown: 0, available: true, mana: 40, maxMana: 50 }];

function Harness({
  onCastSpell, onManual, onAbility = () => {}, onClose = () => {},
  onToggleOpaque = () => {}, onBeginAbilityTarget = () => {}, onBeginSpellTarget = () => {},
  abilityStatus = [], targetSelection = null, initialCommandMode = "move", menuHeroes = heroes, heroStatuses = [],
}) {
  const [selectedHero, setSelectedHero] = useState(0);
  const [commandMode, setCommandMode] = useState(initialCommandMode);
  const displayedHeroes = initialCommandMode === "target" ? menuHeroes.map((hero) => ({ ...hero, manual: true })) : menuHeroes;
  return <TacticalMenu open heroes={displayedHeroes} selectedHero={selectedHero} onSelectHero={setSelectedHero}
    onClose={onClose} commandMode={commandMode} onManual={onManual} onAuto={() => {}} onCommandMode={setCommandMode}
    gold={100} onRetreat={() => {}} onRally={() => {}} onRevive={() => {}} onDetails={() => {}}
    onAbility={onAbility} abilityStatus={abilityStatus} onCastSpell={onCastSpell} spellStatus={spells}
    onBeginAbilityTarget={onBeginAbilityTarget} onBeginSpellTarget={onBeginSpellTarget}
    targetSelection={targetSelection} heroStatuses={heroStatuses} onCancelTarget={() => setCommandMode("move")}
    opaque={false} onToggleOpaque={onToggleOpaque} />;
}

describe("TacticalMenu mobile controls", () => {
  let container;
  let root;

  beforeEach(() => {
    global.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  test("selects a mage from the compact roster and casts its visible spell", () => {
    const onCastSpell = jest.fn();
    const onClose = jest.fn();
    act(() => root.render(<Harness onCastSpell={onCastSpell} onClose={onClose} onManual={() => {}} />));

    const mage = container.querySelector('[data-testid="tactical-hero-1"]');
    expect(mage.className).toContain("min-h-14");
    act(() => mage.click());
    expect(mage.getAttribute("aria-pressed")).toBe("true");
    act(() => container.querySelector('[data-testid="tactical-category-spells"]').click());
    expect(container.querySelector('[data-testid="tactical-menu"]').textContent).toContain("MAGE SPELLS");

    act(() => container.querySelector('[data-testid="tactical-spell-fireball"]').click());
    expect(onCastSpell).toHaveBeenCalledWith(1, "fireball");
    expect(onCastSpell).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
    expect(container.querySelector('[data-testid="tactical-menu"]')).not.toBeNull();
  });

  test("keeps commands collapsed until requested and exposes manual controls", () => {
    const onManual = jest.fn();
    act(() => root.render(<Harness onCastSpell={() => {}} onManual={onManual} />));
    act(() => container.querySelector('[data-testid="tactical-category-tactics"]').click());
    act(() => container.querySelector('[data-testid="tactical-manual"]').click());
    expect(onManual).toHaveBeenCalledWith(0);
  });

  test("shows why a starter ability cannot be used on mobile", () => {
    act(() => root.render(<Harness onCastSpell={() => {}} onManual={() => {}}
      abilityStatus={[{ id: "knight_shield_bash", name: "Shield Bash", desc: "Stuns the nearest enemy.", cooldown: 0, available: false, reason: "no_target" }]} />));

    act(() => container.querySelector('[data-testid="tactical-category-abilities"]').click());
    const button = container.querySelector('[data-testid="tactical-ability-knight_shield_bash"]');
    expect(button.disabled).toBe(true);
    expect(button.textContent).toContain("NO TARGET");
    expect(button.getAttribute("aria-label")).toContain("no valid target");
  });

  test("keeps the tactical menu open after an ability action", () => {
    const onAbility = jest.fn();
    const onClose = jest.fn();
    act(() => root.render(<Harness onCastSpell={() => {}} onManual={() => {}} onAbility={onAbility} onClose={onClose}
      abilityStatus={[{ id: "knight_shield_bash", name: "Shield Bash", desc: "Stuns an enemy.", cooldown: 0, available: true }]} />));
    act(() => container.querySelector('[data-testid="tactical-category-abilities"]').click());
    act(() => container.querySelector('[data-testid="tactical-ability-knight_shield_bash"]').click());
    expect(onAbility).toHaveBeenCalledWith(0, "knight_shield_bash");
    expect(onClose).not.toHaveBeenCalled();
    expect(container.querySelector('[data-testid="tactical-menu"]')).not.toBeNull();
  });

  test("shows Shared Strike for a classless hero and routes it through the existing ability action", () => {
    const onAbility = jest.fn();
    const onBeginAbilityTarget = jest.fn();
    const classless = { identity: { id: "shared-ui", name: "Aster" }, appearance: { id: null },
      combat: { hp: 240, maxHp: 300 }, progression: { level: 1, xp: 0, ap: 0, sp: 0 } };
    act(() => root.render(<Harness onCastSpell={() => {}} onManual={() => {}} onAbility={onAbility} onBeginAbilityTarget={onBeginAbilityTarget}
      menuHeroes={[classless]} heroStatuses={[{ hp: 240, maxHp: 300, alive: true }]}
      abilityStatus={[{ id: "shared_strike", name: "Shared Strike", desc: "24 raw direct-hit weapon damage at baseline (150%); 12s cooldown; no resource cost.", damage: 24, cooldownSeconds: 12, resourceCost: 0, cooldown: 0, available: true, targetMode: "enemy", range: 220 }]} />));
    act(() => container.querySelector('[data-testid="tactical-category-abilities"]').click());
    const action = container.querySelector('[data-testid="tactical-ability-shared_strike"]');
    expect(action.disabled).toBe(false);
    expect(action.textContent).toContain("Shared Strike");
    expect(action.textContent).toContain("24 RAW");
    expect(action.textContent).toContain("12s CD");
    expect(action.textContent).toContain("0 COST");
    expect(action.getAttribute("aria-label")).toContain("ready");
    act(() => action.click());
    expect(onBeginAbilityTarget).toHaveBeenCalledWith(0, "shared_strike");
    expect(onAbility).not.toHaveBeenCalled();
  });

  test("shows ranged target details and returns to move mode when targeting is canceled", () => {
    act(() => root.render(<Harness onCastSpell={() => {}} onManual={() => {}}
      initialCommandMode="target"
      targetSelection={{ heroName: "Archer", range: 340, targets: [{ type: "orc", name: "Orc", hp: 72, maxHp: 120, distance: 145 }] }} />));
    act(() => container.querySelector('[data-testid="tactical-category-combat"]').click());
    expect(container.querySelector('[data-testid="ranged-target-status"]').textContent).toContain("Orc");
    expect(container.querySelector('[data-testid="ranged-target-status"]').textContent).toContain("72/120 HP");

    act(() => container.querySelector('[data-testid="tactical-cancel-target"]').click());
    expect(container.querySelector('[data-testid="ranged-target-status"]')).toBeNull();
    expect(container.querySelector('[data-testid="tactical-menu"]')).not.toBeNull();
  });

  test("allows tapping a highlighted target from the range and health list", () => {
    const onSelectRangedTarget = jest.fn();
    const target = { type: "orc", name: "Orc", hp: 72, maxHp: 120, distance: 145, enemy: { id: "orc-1" } };
    act(() => root.render(<TacticalMenu
      open heroes={heroes.map((hero) => ({ ...hero, manual: true }))} selectedHero={0}
      commandMode="target" onSelectHero={() => {}} onClose={() => {}}
      onManual={() => {}} onAuto={() => {}} onCommandMode={() => {}} gold={0}
      onRetreat={() => {}} onRally={() => {}} onRevive={() => {}} onDetails={() => {}}
      onAbility={() => {}} abilityStatus={[]} onCastSpell={() => {}} spellStatus={[]}
      targetSelection={{ heroName: "Archer", range: 340, targets: [target] }}
      onSelectRangedTarget={onSelectRangedTarget} onCancelTarget={() => {}}
      opaque={false} onToggleOpaque={() => {}}
    />));
    act(() => container.querySelector('[data-testid="tactical-category-combat"]').click());
    act(() => container.querySelector('[data-testid="ranged-target-orc"]').click());
    expect(onSelectRangedTarget).toHaveBeenCalledWith(target);
  });

  test("keeps an explicit close action available", () => {
    const onClose = jest.fn();
    act(() => root.render(<Harness onCastSpell={() => {}} onManual={() => {}} onClose={onClose} />));
    act(() => container.querySelector('[data-testid="tactical-close"]').click());
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("keeps all five categories in a compact dock and opens and closes their panels", () => {
    act(() => root.render(<Harness onCastSpell={() => {}} onManual={() => {}} />));
    const dock = container.querySelector('[data-testid="tactical-category-dock"]');
    expect(dock.querySelectorAll("button")).toHaveLength(5);
    expect(Array.from(dock.querySelectorAll("button")).every((button) => button.className.includes("min-h-14"))).toBe(true);
    expect(container.querySelector('[data-testid="tactical-menu"]')).not.toBeNull();

    act(() => container.querySelector('[data-testid="tactical-category-combat"]').click());
    expect(container.querySelector('[data-testid="tactical-menu"]').getAttribute("aria-label")).toBe("Combat actions");
    expect(container.querySelector('[data-testid="tactical-menu"] .overflow-y-auto').style.maxHeight).toBe("min(42vh, 340px)");
    act(() => container.querySelector('[data-testid="tactical-category-combat"]').click());
    expect(container.querySelector('[data-testid="tactical-menu"]')).toBeNull();
    expect(container.querySelector('[data-testid="tactical-category-dock"]')).not.toBeNull();
  });

  test("shows spell costs and supported range and area details through information controls", () => {
    const areaSpell = { ...spells[0], desc: "Hits nearby enemies.", range: 155, radius: 105, effect: "area" };
    act(() => root.render(<TacticalMenu
      open heroes={heroes} selectedHero={1} onSelectHero={() => {}} onClose={() => {}}
      onManual={() => {}} onAuto={() => {}} onCommandMode={() => {}} onRetreat={() => {}}
      onRally={() => {}} onRevive={() => {}} onDetails={() => {}} onAbility={() => {}}
      abilityStatus={[]} onCastSpell={() => {}} spellStatus={[areaSpell]}
    />));
    act(() => container.querySelector('[data-testid="tactical-category-spells"]').click());
    expect(container.querySelector('[data-testid="tactical-spell-fireball"]').textContent).toContain("12 MP");
    act(() => container.querySelector('[data-testid="tactical-spell-fireball"]').click());
    expect(container.querySelector('[data-testid="tactical-spell-preview-fireball"]')).toBeNull();
    act(() => container.querySelector('[data-testid="tactical-info-fireball"]').click());
    expect(container.querySelector('[data-testid="tactical-menu"]').textContent).toContain("Range: 155");
    expect(container.querySelector('[data-testid="tactical-menu"]').textContent).toContain("Area radius: 105");
  });

  test("starts area ability targeting without an extra confirmation step", () => {
    const onBeginAbilityTarget = jest.fn();
    act(() => root.render(<Harness
      onCastSpell={() => {}}
      onManual={() => {}}
      onBeginAbilityTarget={onBeginAbilityTarget}
      abilityStatus={[{ id: "mage_firestorm_ability", name: "Firestorm", desc: "Blast a target area.", cooldown: 0, available: true, targetMode: "area", range: 200, radius: 70 }]}
    />));
    act(() => container.querySelector('[data-testid="tactical-category-abilities"]').click());
    act(() => container.querySelector('[data-testid="tactical-ability-mage_firestorm_ability"]').click());
    expect(onBeginAbilityTarget).toHaveBeenCalledTimes(1);
    expect(onBeginAbilityTarget).toHaveBeenCalledWith(0, "mage_firestorm_ability");
  });

  test("keeps the hero selector persistent, live, and locked only while resolving", () => {
    act(() => root.render(<TacticalMenu
      visible open={false} heroes={heroes} selectedHero={0} onSelectHero={() => {}}
      heroStatuses={[{ hp: 44, maxHp: 100, alive: true }, { hp: 80, maxHp: 80, alive: true }]}
      switchDisabled onClose={() => {}}
    />));
    const selector = container.querySelector('[data-testid="tactical-hero-selector"]');
    expect(selector.textContent).toContain("44/100 HP");
    expect(container.querySelector('[data-testid="battle-active-hero-0"]').disabled).toBe(true);
    expect(container.querySelector('[data-testid="tactical-category-dock"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="tactical-menu"]')).toBeNull();
  });

  test("shows learned passives, AP, shield status, hero details, and the HUD display control", () => {
    const onDetails = jest.fn();
    const onToggleOpaque = jest.fn();
    const knight = { ...heroes[0], perks: ["knight_cleave"], ap: 2, sp: 1, shield: 20 };
    act(() => root.render(<TacticalMenu
      open heroes={[knight, heroes[1]]} selectedHero={0} onSelectHero={() => {}} onClose={() => {}}
      onManual={() => {}} onAuto={() => {}} onCommandMode={() => {}} onRetreat={() => {}}
      onRally={() => {}} onRevive={() => {}} onDetails={onDetails} onAbility={() => {}}
      abilityStatus={[]} onCastSpell={() => {}} spellStatus={[]} heroStatuses={[{ shield: 35 }]}
      onToggleOpaque={onToggleOpaque}
    />));
    act(() => container.querySelector('[data-testid="tactical-category-abilities"]').click());
    expect(container.querySelector('[data-testid="tactical-passive-effects"]').textContent).toContain("Cleave");
    act(() => container.querySelector('[data-testid="tactical-category-squad"]').click());
    expect(container.querySelector('[data-testid="tactical-squad-status"]').textContent).toContain("2 AP");
    expect(container.querySelector('[data-testid="tactical-squad-status"]').textContent).toContain("SHIELD · 35");
    act(() => container.querySelector('[data-testid="tactical-details"]').click());
    expect(onDetails).toHaveBeenCalledWith(0);
    act(() => container.querySelector('[data-testid="tactical-opacity-toggle"]').click());
    expect(onToggleOpaque).toHaveBeenCalledTimes(1);
  });

  test("keeps the existing Guild blockade action available without a selected hero", () => {
    const onActivateBlockade = jest.fn();
    act(() => root.render(<TacticalMenu
      open heroes={heroes} selectedHero={null} onSelectHero={() => {}} onClose={() => {}}
      onManual={() => {}} onAuto={() => {}} onCommandMode={() => {}} onRetreat={() => {}}
      onRally={() => {}} onRevive={() => {}} onDetails={() => {}} onAbility={() => {}}
      abilityStatus={[]} onCastSpell={() => {}} spellStatus={[]}
      blockadeStatus={{ active: false, cooldownMs: 0, remainingMs: 0 }}
      blockadeCanActivate onActivateBlockade={onActivateBlockade}
    />));
    act(() => container.querySelector('[data-testid="tactical-category-combat"]').click());
    const action = container.querySelector('[data-testid="activate-guild-blockade"]');
    expect(action.disabled).toBe(false);
    act(() => action.click());
    expect(onActivateBlockade).toHaveBeenCalledTimes(1);
  });
});

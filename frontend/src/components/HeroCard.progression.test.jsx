import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { commitHeroProgressionDraft, createHero } from "../game/logic";
import { HeroCard } from "./cards";

jest.mock("./ui-kit", () => ({
  StatBar: () => <div />,
  NeonButton: ({ children, ...props }) => <button {...props}>{children}</button>,
  HeroMiniSprite: () => <span aria-hidden="true" />,
}));

if (!global.structuredClone) {
  global.structuredClone = (value) => JSON.parse(JSON.stringify(value));
}

describe("Preparation HeroCard progression draft", () => {
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

  function renderCard(hero, onCommitProgression = jest.fn(), onClose = jest.fn()) {
    act(() => root.render(<HeroCard key={hero.id} hero={hero} editable draftProgression
      onCommitProgression={onCommitProgression} onClose={onClose} />));
    return { onCommitProgression, onClose };
  }

  test("updates derived stats and remaining SP immediately, then commits only on confirmation", () => {
    const hero = createHero("knight");
    hero.sp = 1;
    hero.ap = 1;
    const onCommitProgression = jest.fn(({ originalHero, draftHero }) =>
      commitHeroProgressionDraft(hero, originalHero, draftHero));
    const { onClose } = renderCard(hero, onCommitProgression);
    const originalAttack = hero.stats.attack;

    act(() => container.querySelector('[data-testid="hero-alloc-attack"]').click());
    expect(container.querySelector('[data-testid="hero-stat-attack"]').textContent).toBe(String(originalAttack + 1));
    expect(container.querySelector('[data-testid="hero-sp-remaining"]').textContent).toBe("0");
    expect(container.textContent).toContain("Pending allocations · 1 SP · 0 AP");
    expect(hero.stats.attack).toBe(originalAttack);
    expect(onCommitProgression).not.toHaveBeenCalled();

    act(() => container.querySelector('[data-testid="confirm-progress"]').click());
    expect(onCommitProgression).toHaveBeenCalledTimes(1);
    expect(hero.stats.attack).toBe(originalAttack + 1);
    expect(hero.sp).toBe(0);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("pending AP perks can be undone and refunded before a single confirmation", () => {
    const hero = createHero("knight");
    hero.ap = 2;
    const onCommitProgression = jest.fn(({ originalHero, draftHero }) =>
      commitHeroProgressionDraft(hero, originalHero, draftHero));
    renderCard(hero, onCommitProgression);

    act(() => container.querySelector('[data-testid="open-perk-tree"]').click());
    act(() => container.querySelector('[data-testid="perk-node-knight_bulwark"]').click());
    expect(container.querySelector('[data-testid="hero-ap-remaining"]').textContent).toBe("1");
    expect(hero.ap).toBe(2);
    act(() => container.querySelector('[aria-label="Undo pending Bulwark"]').click());
    expect(container.querySelector('[data-testid="hero-ap-remaining"]').textContent).toBe("2");
    expect(onCommitProgression).not.toHaveBeenCalled();

    act(() => container.querySelector('[data-testid="perk-node-knight_bulwark"]').click());
    act(() => container.querySelector('[data-testid="perk-tree-close"]').click());
    act(() => container.querySelector('[data-testid="confirm-progress"]').click());
    expect(onCommitProgression).toHaveBeenCalledTimes(1);
    expect(hero.ap).toBe(1);
    expect(hero.perks).toEqual(["knight_bulwark"]);
  });

  test("cancel discards pending SP without committing or refunding persistent points", () => {
    const hero = createHero("knight");
    hero.sp = 1;
    const onCommitProgression = jest.fn();
    const { onClose } = renderCard(hero, onCommitProgression);
    const originalDefense = hero.stats.defense;

    act(() => container.querySelector('[data-testid="hero-alloc-defense"]').click());
    act(() => container.querySelector('[data-testid="cancel-progression"]').click());
    expect(onCommitProgression).not.toHaveBeenCalled();
    expect(hero.stats.defense).toBe(originalDefense);
    expect(hero.sp).toBe(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

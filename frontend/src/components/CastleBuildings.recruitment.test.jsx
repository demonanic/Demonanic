import React, { act, useState } from "react";
import { createRoot } from "react-dom/client";
import CastleBuildings from "./CastleBuildings";
import { createNewState, setClasslessSquad } from "../game/logic";
import { createHeroModel } from "../game/heroModel";

let mockState;
let mockMutate;
jest.mock("@/components/ui-kit", () => ({
  NeonButton: ({ children, ...props }) => <button {...props}>{children}</button>,
  SectionTitle: ({ children }) => <h2>{children}</h2>,
  StatBar: () => <div />,
}), { virtual: true });
jest.mock("@/components/KingdomMap", () => ({ __esModule: true, default: ({ onSelect }) => <><button onClick={() => onSelect("tavern")}>Open Tavern</button><button onClick={() => onSelect("academy")}>Open Academy</button></> }), { virtual: true });
jest.mock("@/components/LibraryResearch", () => ({ __esModule: true, default: () => null }), { virtual: true });
jest.mock("@/game/logic", () => jest.requireActual("../game/logic"), { virtual: true });
jest.mock("@/game/config", () => jest.requireActual("../game/config"), { virtual: true });
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

function TestHarness() {
  const [, setRevision] = useState(0);
  mockMutate = (update) => {
    update(mockState);
    setRevision((revision) => revision + 1);
  };
  return <CastleBuildings state={mockState} mutate={(update) => mockMutate(update)} />;
}

describe("classless tavern recruitment", () => {
  let container;
  let root;

  beforeEach(() => {
    global.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    mockState = createNewState();
    setClasslessSquad(mockState);
    mockState.gold = 50000;
    mockState.buildings = { tavern: { level: 1, hp: 1000, maxHp: 1000, unlocked: true } };
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  test("recruits classless heroes and disables recruitment at six total", () => {
    act(() => root.render(<TestHarness />));
    act(() => [...container.querySelectorAll("button")].find((button) => button.textContent === "Open Tavern").click());
    for (let i = 0; i < 5; i += 1) {
      const recruit = container.querySelector('[data-testid="tavern-recruit-classless"]');
      expect(recruit.disabled).toBe(false);
      act(() => recruit.click());
    }
    expect(mockState.heroes).toHaveLength(6);
    expect([...mockState.heroes, ...mockState.bench].every((hero) => !hero.cls && hero.combat)).toBe(true);
    expect(container.querySelector('[data-testid="tavern-recruit-classless"]').disabled).toBe(true);
    expect(container.textContent).toContain("Roster 6/6 · Roster full");
  });

  test("reports the newly recruited hero when an older reserve is already benched", () => {
    mockState.bench.push(createHeroModel({ id: "reserve-id", name: "Reserve" }));
    act(() => root.render(<TestHarness />));
    act(() => [...container.querySelectorAll("button")].find((button) => button.textContent === "Open Tavern").click());
    act(() => container.querySelector('[data-testid="tavern-recruit-classless"]').click());
    expect(mockState.buildings.tavern.activity).toBe(`Recruited ${mockState.heroes[mockState.heroes.length - 1].identity.name}`);
    expect(mockState.buildings.tavern.activity).not.toBe("Recruited Reserve");
  });

  test("Academy displays and trains a classless reserve by identity ID", () => {
    mockState = createNewState();
    mockState.bench = [createHeroModel({ id: "academy-screen-hero", name: "Reserve Neon" })];
    mockState.buildings = { academy: { level: 1, hp: 1000, maxHp: 1000, unlocked: true } };
    act(() => root.render(<TestHarness />));
    act(() => [...container.querySelectorAll("button")].find((button) => button.textContent === "Open Academy").click());
    expect(container.querySelector('[data-testid="academy-eligible-academy-screen-hero"]')?.textContent).toContain("Reserve Neon");
    act(() => container.querySelector('[data-testid="academy-eligible-academy-screen-hero"] button').click());
    expect(mockState.academyTraining[0].heroId).toBe("academy-screen-hero");
    expect(mockState.academyHeroes[0].identity.id).toBe("academy-screen-hero");
  });
});

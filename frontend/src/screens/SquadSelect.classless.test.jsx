import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { createNewState } from "../game/logic";
import { serializeGameState } from "../game/heroModel";
import SquadSelect from "./SquadSelect";

let mockContext;
jest.mock("../context/GameProvider", () => ({ useGame: () => mockContext }));
jest.mock("../components/ui-kit", () => ({
  NeonButton: ({ children, ...props }) => <button {...props}>{children}</button>,
}));

describe("classless new squad selection", () => {
  let container;
  let root;
  let state;

  beforeEach(() => {
    global.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    state = createNewState();
    mockContext = {
      mutate: (fn) => fn(state),
      saveNow: jest.fn(),
      setScreen: jest.fn(),
    };
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  test("creates and saves one unclassified starter without selecting an appearance or entering battle", () => {
    act(() => root.render(<SquadSelect />));
    act(() => container.querySelector('[data-testid="squad-classless-confirm"]').click());
    expect(state.heroes).toHaveLength(1);
    expect(state.heroes.every((hero) => !hero.cls && hero.appearance.id === null)).toBe(true);
    expect(mockContext.saveNow).toHaveBeenCalledTimes(1);
    expect(mockContext.setScreen).toHaveBeenCalledWith("home");
    expect(container.textContent).toContain("Recruit up to 6 heroes total");
    const reloaded = JSON.parse(JSON.stringify(serializeGameState(state)));
    expect(reloaded.heroes).toHaveLength(1);
    expect(reloaded.heroes.every((hero) => !hero.cls && hero.combat.hp === 300)).toBe(true);
  });
});

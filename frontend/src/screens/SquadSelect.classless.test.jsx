import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { createNewState, setClasslessSquad } from "../game/logic";
import { serializeGameState } from "../game/heroModel";
import SquadSelect from "./SquadSelect";

let mockContext;
let mockLogout;
jest.mock("../context/GameProvider", () => ({ useGame: () => mockContext }));
jest.mock("../context/AuthContext", () => ({ useAuth: () => ({ logout: mockLogout }) }));
jest.mock("../components/ui-kit", () => ({
  NeonButton: ({ children, ...props }) => <button {...props}>{children}</button>,
}));

describe("classless new squad selection", () => {
  let container;
  let root;
  let state;

  beforeEach(() => {
    global.IS_REACT_ACT_ENVIRONMENT = true;
    mockLogout = jest.fn();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    state = createNewState();
    mockContext = {
      beginClasslessJourney: jest.fn(() => {
        const created = setClasslessSquad(state);
        return { ok: created, created };
      }),
      setScreen: jest.fn(),
      retryLoad: jest.fn(),
    };
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  test("creates and saves one unclassified starter without selecting an appearance or entering battle", async () => {
    act(() => root.render(<SquadSelect />));
    await act(async () => {
      container.querySelector('[data-testid="squad-classless-confirm"]').click();
      await Promise.resolve();
    });
    expect(state.heroes).toHaveLength(1);
    expect(state.heroes.every((hero) => !hero.cls && hero.appearance.id === null)).toBe(true);
    expect(mockContext.beginClasslessJourney).toHaveBeenCalledTimes(1);
    expect(mockContext.setScreen).toHaveBeenCalledWith("home");
    expect(container.textContent).toContain("Recruit up to 6 heroes total");
    const reloaded = JSON.parse(JSON.stringify(serializeGameState(state)));
    expect(reloaded.heroes).toHaveLength(1);
    expect(reloaded.heroes.every((hero) => !hero.cls && hero.combat.hp === 300)).toBe(true);
  });

  test("shows an actionable message when starter initialization is rejected", async () => {
    mockContext.beginClasslessJourney.mockReturnValue({ ok: false, reason: "starter-unavailable" });
    act(() => root.render(<SquadSelect />));
    await act(async () => {
      container.querySelector('[data-testid="squad-classless-confirm"]').click();
      await Promise.resolve();
    });
    expect(container.querySelector('[role="alert"]')?.textContent).toMatch(/could not be saved.*retry/i);
    expect(mockContext.setScreen).not.toHaveBeenCalled();
  });
});

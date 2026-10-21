import React, { act } from "react";
import { createRoot } from "react-dom/client";
import Home from "./Home";

const mockSetScreen = jest.fn();
const mockLogout = jest.fn();
const mockSetOfflineGains = jest.fn();
const mockState = {
  gold: 1250,
  stone: 460,
  metal: 80,
  morale: 72,
  castleHp: 850,
  castleMaxHp: 1000,
  wave: 9,
  heroes: [{ level: 3 }, { level: 2 }],
  towers: [{ level: 2 }],
  bests: { highestWave: 12 },
  vault: [{ id: "vault-1" }],
  shoppe: { inventory: [{ id: "item-1" }, { id: "item-2" }] },
};

jest.mock("../context/AuthContext", () => ({ useAuth: () => ({ logout: mockLogout }) }));
jest.mock("../context/GameProvider", () => ({
  useGame: () => ({ state: mockState, setScreen: mockSetScreen, offlineGains: null, setOfflineGains: mockSetOfflineGains }),
}));
jest.mock("../components/ui-kit", () => ({ getTacticalHudOpaque: () => false, setTacticalHudOpaque: jest.fn() }));
jest.mock("sonner", () => ({ toast: { success: jest.fn() } }));

describe("Home menu", () => {
  let container;
  let root;

  beforeEach(() => {
    global.IS_REACT_ACT_ENVIRONMENT = true;
    mockSetScreen.mockClear();
    mockLogout.mockClear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root.render(<Home />));
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  test("shows current resources and status without inventing a food balance", () => {
    expect(container.querySelector('[data-testid="home-resource-gold"]')?.textContent).toContain("1,250");
    expect(container.querySelector('[data-testid="home-resource-stone"]')?.textContent).toContain("460");
    expect(container.querySelector('[data-testid="home-food"]')?.textContent).toContain("N/A");
    expect(container.querySelector('[data-testid="home-morale"]')?.textContent).toContain("72%");
    expect(container.querySelector('[data-testid="home-castle-hp"]')?.textContent).toContain("850/1000");
    expect(container.querySelector('[data-testid="home-stats"]')?.textContent).toContain("9");
    expect(container.querySelector('[data-testid="home-stats"]')?.textContent).toContain("12");
    expect(container.querySelector('[data-testid="demonanic-skull-crest"]')).not.toBeNull();
  });

  test("keeps all main menu destinations and logout wired", () => {
    [
      ["enter-preparation-button", "prep"],
      ["home-armory-button", "armory"],
      ["open-profile-button", "profile"],
      ["open-roster-button", "roster"],
    ].forEach(([testId, screen]) => {
      act(() => container.querySelector(`[data-testid="${testId}"]`).click());
      expect(mockSetScreen).toHaveBeenLastCalledWith(screen);
    });
    act(() => container.querySelector('[data-testid="logout-button"]').click());
    expect(mockLogout).toHaveBeenCalledTimes(1);
  });
});

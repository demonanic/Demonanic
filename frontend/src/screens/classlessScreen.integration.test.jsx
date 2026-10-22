import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { GameProvider, useGame } from "../context/GameProvider";
import { createHeroModel } from "../game/heroModel";
import { createNewState } from "../game/logic";
import Preparation from "./Preparation";
import Battle from "./Battle";

jest.mock("../api", () => ({
  gameApi: { getState: jest.fn(), createState: jest.fn(), saveState: jest.fn() },
}));
jest.mock("../game/engine", () => ({
  Engine: jest.fn(),
  LAYOUT: { W: 420, H: 760 },
}));
jest.mock("sonner", () => ({ toast: { error: jest.fn(), success: jest.fn() } }));
jest.mock("../components/ui-kit", () => ({
  NeonButton: ({ children, ...props }) => <button {...props}>{children}</button>,
  TopResourceHUD: () => null,
  SectionTitle: ({ children }) => <div>{children}</div>,
  StatBar: () => null,
  HeroMiniSprite: () => null,
  TowerIcon: () => null,
  getTacticalHudOpaque: () => false,
  setTacticalHudOpaque: () => {},
}));
jest.mock("../components/cards", () => ({ HeroCard: () => null, TowerCard: () => null }));
jest.mock("../components/PrepField", () => () => null);
jest.mock("../components/CastleBuildings", () => () => null);
jest.mock("../components/DebugPanel", () => () => null);
jest.mock("../components/ui/tabs", () => ({
  Tabs: ({ children }) => <div>{children}</div>,
  TabsList: ({ children }) => <div>{children}</div>,
  TabsTrigger: ({ children }) => <button>{children}</button>,
  TabsContent: ({ children }) => <div>{children}</div>,
}));

import { gameApi } from "../api";
import { Engine } from "../game/engine";

function ScreenHarness() {
  const game = useGame();
  return (
    <>
      <div data-testid="active-screen">{game.screen}</div>
      {game.screen === "prep" && <Preparation />}
      {game.screen === "battle" && <Battle />}
      <button data-testid="open-preparation" onClick={() => game.setScreen("prep")}>open preparation</button>
      <button data-testid="attempt-battle-route" onClick={() => game.setScreen("battle")}>attempt battle route</button>
    </>
  );
}

describe("classless screen integration safety boundary", () => {
  let container;
  let root;
  const disposableUser = { id: "screen-integration-test", username: "Local Test" };

  beforeEach(() => {
    global.IS_REACT_ACT_ENVIRONMENT = true;
    global.structuredClone ||= (value) => JSON.parse(JSON.stringify(value));
    localStorage.clear();
    localStorage.setItem("dm_token", "disposable-screen-test-token");
    const profile = createNewState();
    profile.heroes = [createHeroModel({ id: "screen-stable-hero", name: "Aster" })];
    profile.needsSquad = false;
    jest.clearAllMocks();
    gameApi.getState.mockResolvedValue({ data: { state: JSON.parse(JSON.stringify(profile)) } });
    gameApi.createState.mockResolvedValue({ data: { ok: true } });
    gameApi.saveState.mockResolvedValue({ data: { ok: true } });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    if (root) await act(async () => root.unmount());
    container?.remove();
    root = null;
    container = null;
  });

  test("preparation blocks battle and direct Battle entry returns to preparation before engine creation", async () => {
    await act(async () => {
      root.render(<GameProvider user={disposableUser}><ScreenHarness /></GameProvider>);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(gameApi.getState).toHaveBeenCalledTimes(1);

    await act(async () => container.querySelector('[data-testid="open-preparation"]').click());
    expect(container.querySelector('[data-testid="active-screen"]').textContent).toBe("prep");
    expect(container.querySelector('[data-testid="classless-combat-notice"]')).not.toBeNull();

    await act(async () => container.querySelector('[data-testid="start-wave-button"]').click());
    expect(container.querySelector('[data-testid="active-screen"]').textContent).toBe("prep");
    expect(gameApi.saveState).not.toHaveBeenCalled();
    expect(gameApi.createState).not.toHaveBeenCalled();

    await act(async () => container.querySelector('[data-testid="attempt-battle-route"]').click());
    expect(container.querySelector('[data-testid="active-screen"]').textContent).toBe("prep");
    expect(container.textContent).not.toContain("Classless heroes are not enabled in live battle yet.");
    expect(Engine).not.toHaveBeenCalled();
    expect(gameApi.saveState).not.toHaveBeenCalled();
  });
});

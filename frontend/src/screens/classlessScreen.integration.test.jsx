import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { GameProvider, useGame } from "../context/GameProvider";
import { createHeroModel, serializeGameState } from "../game/heroModel";
import { createNewState } from "../game/logic";
import Preparation from "./Preparation";
import Battle from "./Battle";
import Results from "./Results";

jest.mock("../api", () => ({
  gameApi: { getState: jest.fn(), createState: jest.fn(), saveState: jest.fn() },
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

jest.setTimeout(30000);

let activeEngine;
function ScreenHarness() {
  const game = useGame();
  return <>
    <div data-testid="active-screen">{game.screen}</div>
    <div data-testid="hero-json">{JSON.stringify(game.state?.heroes?.[0] || null)}</div>
    <div data-testid="castle-json">{JSON.stringify({ gold: game.state?.gold, castleHp: game.state?.castleHp, wave: game.state?.wave, marker: game.state?.testProfileMarker })}</div>
    <div data-testid="result-json">{JSON.stringify(game.lastResult)}</div>
    {game.screen === "prep" && <Preparation />}
    {game.screen === "battle" && <Battle />}
    {game.screen === "results" && <Results />}
    <button data-testid="open-preparation" onClick={() => game.setScreen("prep")}>Preparation</button>
  </>;
}

describe("classless preparation, Battle, completion, and provider persistence", () => {
  let container;
  let root;
  let persisted;
  const disposableUser = { id: "classless-screen-test", username: "Local Test" };

  const mountProvider = async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root.render(<GameProvider user={disposableUser}><ScreenHarness /></GameProvider>);
      await Promise.resolve();
    });
  };

  const unmountProvider = async () => {
    if (root) await act(async () => root.unmount());
    container?.remove();
    root = null;
    container = null;
  };

  const click = async (testId) => act(async () => {
    const element = container.querySelector(`[data-testid="${testId}"]`);
    if (!element) throw new Error(`Missing ${testId}`);
    element.click();
    await Promise.resolve();
  });

  const enterCombat = async (hp = 300) => {
    const hero = createHeroModel({ id: "screen-stable-hero", name: "Aster", appearanceId: "approved-test-look" });
    hero.combat.hp = hp;
    hero.progression.xp = 17;
    hero.progression.ap = 4;
    hero.progression.sp = 2;
    hero.progression.ownedNodeIds = ["V1"];
    const profile = createNewState();
    profile.heroes = [hero];
    profile.needsSquad = false;
    profile.gold = 222;
    profile.castleHp = 731;
    profile.testProfileMarker = "disposable-classless-fixture";
    persisted = serializeGameState(profile);
    gameApi.getState.mockImplementation(async () => ({ data: { state: serializeGameState(persisted) } }));
    gameApi.saveState.mockImplementation(async (state) => {
      persisted = serializeGameState(state);
      return { data: { ok: true } };
    });
    gameApi.createState.mockResolvedValue({ data: { ok: true } });
    await mountProvider();
    await click("open-preparation");
    expect(container.querySelector('[data-testid="classless-combat-notice"]')).toBeNull();
    await click("start-wave-button");
    expect(container.querySelector('[data-testid="active-screen"]').textContent).toBe("battle");
    expect(gameApi.saveState).toHaveBeenCalledTimes(1); // Preparation.saveNow before entering Battle.
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 5200)); });
    expect(activeEngine).toBeTruthy();
  };

  beforeEach(() => {
    global.IS_REACT_ACT_ENVIRONMENT = true;
    global.structuredClone ||= (value) => JSON.parse(JSON.stringify(value));
    localStorage.clear();
    localStorage.setItem("dm_token", "disposable-screen-test-token");
    activeEngine = null;
    jest.clearAllMocks();
    jest.spyOn(Engine.prototype, "start").mockImplementation(function startWithoutAnimationLoop() {
      activeEngine = this;
      this.running = true;
    });
    jest.spyOn(Engine.prototype, "stop").mockImplementation(function stopWithoutAnimationLoop() {
      this.running = false;
    });
    jest.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  });

  afterEach(async () => {
    await unmountProvider();
    jest.restoreAllMocks();
  });

  test.each([
    ["victory", 300],
    ["defeat", 1],
  ])("real preparation-to-Battle path persists %s by stable classless identity", async (outcome, startingHp) => {
    await enterCombat(startingHp);
    expect(activeEngine.heroes[0].classless).toBe(true);
    expect(activeEngine.heroes[0].ref.id).toBe("screen-stable-hero");

    const hero = activeEngine.heroes[0];
    const target = {
      type: "goblin", name: "Test Goblin", x: hero.x + 12, y: hero.y,
      hp: 20, maxHp: 20, tier: "basic", dmgBy: {}, boss: false,
    };
    activeEngine.active.push(target);
    await act(async () => activeEngine._hud());
    await click("tactical-category-abilities");
    expect(container.querySelector('[data-testid="tactical-ability-shared_strike"]')).not.toBeNull();
    await click("tactical-ability-shared_strike");
    expect(container.querySelector('[data-testid="ability-target-goblin"]')).not.toBeNull();
    await click("ability-target-goblin");
    expect(target.hp).toBe(0);
    expect(activeEngine.xpGains.heroes[0]).toBeGreaterThan(0);
    expect(activeEngine.heroes[0].abilityCooldowns.shared_strike).toBe(12);

    await act(async () => {
      if (outcome === "victory") {
        activeEngine.forceWin();
      } else {
        jest.spyOn(Math, "random").mockReturnValue(0.99);
        activeEngine._enemyAttack({ type: "goblin", damage: 10000 }, { kind: "hero", obj: hero });
      }
      activeEngine._checkEnd();
    });
    expect(container.querySelector('[data-testid="active-screen"]').textContent).toBe("results");
    expect(JSON.parse(container.querySelector('[data-testid="result-json"]').textContent).victory).toBe(outcome === "victory");
    expect(container.querySelector(outcome === "victory" ? '[data-testid="results-continue"]' : '[data-testid="results-surrender"]')).not.toBeNull();
    expect(activeEngine.ended).toBe(true);

    await act(async () => activeEngine.cb.onEnd({
      victory: outcome === "victory", reason: outcome === "victory" ? "cleared" : "heroes",
      xpGains: activeEngine.xpGains, killed: activeEngine.killed,
    }));
    expect(container.querySelector('[data-testid="result-json"]').textContent).not.toBe("null");
    expect(JSON.parse(container.querySelector('[data-testid="castle-json"]').textContent).wave).toBe(outcome === "victory" ? 2 : 1);

    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 750)); });
    expect(gameApi.saveState).toHaveBeenCalledTimes(2); // Prep save plus completion autosave.
    expect(persisted.heroes[0].identity.id).toBe("screen-stable-hero");
    expect(persisted.heroes[0].cls).toBeUndefined();
    expect(persisted.heroes[0].combat.hp).toBe(outcome === "victory" ? 300 : 0);
    expect(persisted.heroes[0].progression.xp).toBe(17 + activeEngine.xpGains.heroes[0]);
    expect(persisted.heroes[0].progression.ap).toBe(4);
    expect(persisted.heroes[0].progression.sp).toBe(2);
    expect(persisted.heroes[0].progression.ownedNodeIds).toEqual(["V1"]);
    expect(persisted.heroes[0].appearance.id).toBe("approved-test-look");
    expect(persisted.testProfileMarker).toBe("disposable-classless-fixture");
    expect(persisted.gold).toBe(activeEngine.sim.gold);

    await unmountProvider();
    await mountProvider();
    const reloaded = JSON.parse(container.querySelector('[data-testid="hero-json"]').textContent);
    const persistedProfile = JSON.parse(container.querySelector('[data-testid="castle-json"]').textContent);
    expect(reloaded.identity.id).toBe("screen-stable-hero");
    expect(reloaded.cls).toBeUndefined();
    expect(reloaded.combat.hp).toBe(outcome === "victory" ? 300 : 0);
    expect(reloaded.progression.xp).toBe(persisted.heroes[0].progression.xp);
    expect(reloaded.appearance.id).toBe("approved-test-look");
    expect(reloaded.progression.ownedNodeIds).toEqual(["V1"]);
    expect(persistedProfile.gold).toBeGreaterThanOrEqual(222);
    expect(persistedProfile.castleHp).toBe(731);
    expect(persistedProfile.marker).toBe("disposable-classless-fixture");
    expect(gameApi.getState).toHaveBeenCalledTimes(2);
  });
});

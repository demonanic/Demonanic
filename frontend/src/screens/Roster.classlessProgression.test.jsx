import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { GameProvider, useGame } from "../context/GameProvider";
import { createHeroModel, serializeGameState } from "../game/heroModel";
import { createNewState } from "../game/logic";
import Roster from "./Roster";

jest.mock("../api", () => ({ gameApi: { getState: jest.fn(), createState: jest.fn(), saveState: jest.fn() } }));
jest.mock("sonner", () => ({ toast: { error: jest.fn(), success: jest.fn() } }));
jest.mock("../components/ui-kit", () => ({
  NeonButton: ({ children, ...props }) => <button {...props}>{children}</button>,
  SectionTitle: ({ children }) => <div>{children}</div>,
  TopResourceHUD: () => null,
  StatBar: () => null,
}));
jest.mock("../components/cards", () => ({ HeroCard: () => null }));
jest.mock("../components/ui/input", () => ({ Input: (props) => <input {...props} /> }));

import { gameApi } from "../api";

function RosterHarness() {
  const { state } = useGame();
  return <>
    <div data-testid="hero-state">{JSON.stringify(state?.heroes?.[0] || null)}</div>
    <div data-testid="profile-state">{JSON.stringify({ gold: state?.gold, castleHp: state?.castleHp, accountMarker: state?.accountMarker })}</div>
    <Roster />
  </>;
}

describe("classless perk purchase through roster and profile persistence", () => {
  let root;
  let container;
  let remoteState;
  const user = { id: "disposable-perk-profile", username: "Local Test" };

  async function mount() {
    root = createRoot(container);
    await act(async () => {
      root.render(<GameProvider user={user}><RosterHarness /></GameProvider>);
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  async function click(testId) {
    await act(async () => {
      const button = container.querySelector(`[data-testid="${testId}"]`);
      if (!button) throw new Error(`Missing ${testId}`);
      button.click();
      await Promise.resolve();
    });
  }

  beforeEach(() => {
    global.IS_REACT_ACT_ENVIRONMENT = true;
    global.structuredClone ||= (value) => JSON.parse(JSON.stringify(value));
    localStorage.clear();
    localStorage.setItem("dm_token", "disposable-perk-test-token");
    const hero = createHeroModel({ id: "perk-stable-id", name: "Aster", appearanceId: "look-cyan" });
    hero.progression.ap = 1;
    hero.progression.sp = 1;
    const profile = createNewState();
    profile.heroes = [hero];
    profile.needsSquad = false;
    profile.gold = 456;
    profile.castleHp = 789;
    profile.accountMarker = { disposable: true };
    remoteState = serializeGameState(profile);
    jest.clearAllMocks();
    gameApi.getState.mockImplementation(async () => ({ data: { state: serializeGameState(remoteState) } }));
    gameApi.saveState.mockImplementation(async (state) => {
      remoteState = serializeGameState(state);
      return { data: { ok: true } };
    });
    gameApi.createState.mockResolvedValue({ data: { ok: true } });
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(async () => {
    if (root) await act(async () => root.unmount());
    container?.remove();
    root = null;
    container = null;
  });

  test("purchases a valid universal node and reloads the saved classless progression", async () => {
    await mount();
    await click("roster-classless-progression-perk-stable-id");
    expect(container.querySelector('[data-testid="classless-perk-tree"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="classless-perk-effects-notice"]').textContent).toContain("Only effects marked active");
    expect(container.querySelector('[data-testid="classless-node-purchase-V1"]').disabled).toBe(false);
    expect(container.querySelector('[data-testid="classless-node-purchase-V2"]').disabled).toBe(true);
    expect(container.querySelector('[data-testid="classless-node-purchase-C3"]').disabled).toBe(true);
    expect(container.querySelector('[data-testid="classless-node-purchase-H1"]').disabled).toBe(true);
    expect(container.querySelector('[data-testid="classless-node-purchase-H1"]').textContent).toContain("effect pending");

    await click("classless-node-purchase-V1");
    expect(container.querySelector('[data-testid="classless-node-purchase-V1"]').textContent).toBe("OWNED");
    await click("classless-allocate-attack");
    expect(JSON.parse(container.querySelector('[data-testid="hero-state"]').textContent).combat.stats.attack).toBe(11);
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 750)); });
    expect(gameApi.saveState).toHaveBeenCalledTimes(1);
    expect(remoteState.heroes[0].identity.id).toBe("perk-stable-id");
    expect(remoteState.heroes[0].cls).toBeUndefined();
    expect(remoteState.heroes[0].progression).toMatchObject({ ap: 0, ownedNodeIds: ["V1"] });
    expect(remoteState.heroes[0].progression.sp).toBe(0);
    expect(remoteState.heroes[0].combat.stats.attack).toBe(11);
    expect(remoteState.heroes[0].appearance.id).toBe("look-cyan");
    expect(remoteState.heroes[0].combat).toEqual(JSON.parse(container.querySelector('[data-testid="hero-state"]').textContent).combat);
    expect(remoteState.gold).toBe(456);
    expect(remoteState.castleHp).toBe(789);
    expect(remoteState.accountMarker).toEqual({ disposable: true });

    await act(async () => root.unmount());
    root = null;
    await mount();
    const loaded = JSON.parse(container.querySelector('[data-testid="hero-state"]').textContent);
    expect(loaded.identity.id).toBe("perk-stable-id");
    expect(loaded.cls).toBeUndefined();
    expect(loaded.progression).toMatchObject({ ap: 0, ownedNodeIds: ["V1"] });
    expect(loaded.progression.sp).toBe(0);
    expect(loaded.combat.stats.attack).toBe(11);
    expect(loaded.appearance.id).toBe("look-cyan");
    expect(JSON.parse(container.querySelector('[data-testid="profile-state"]').textContent)).toEqual({
      gold: 456, castleHp: 789, accountMarker: { disposable: true },
    });
    expect(gameApi.createState).not.toHaveBeenCalled();
    expect(gameApi.getState).toHaveBeenCalledTimes(2);
  });
});

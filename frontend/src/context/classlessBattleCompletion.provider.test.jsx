import React, { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { GameProvider, normalizeState, useGame } from "./GameProvider";
import { stageBattleCompletion } from "../game/battleCompletion";
import { createNewState } from "../game/logic";
import { createHeroModel, serializeGameState } from "../game/heroModel";

let mockRemoteState;
let mockSerialize;

jest.mock("../api", () => ({ gameApi: { getState: jest.fn(), createState: jest.fn(), saveState: jest.fn() } }));

import { gameApi } from "../api";

function CompletionProbe({ sim, result, heroId }) {
  const game = useGame();
  const [completion, setCompletion] = useState(null);
  return (
    <div data-testid="completion-profile" data-hp={game.state?.heroes?.[0]?.combat?.hp ?? ""}
      data-xp={game.state?.heroes?.[0]?.progression?.xp ?? ""} data-wave={game.state?.wave ?? ""}
      data-gold={game.state?.gold ?? ""} data-result={completion?.victory == null ? "pending" : String(completion.victory)}>
      <button onClick={() => {
        const staged = stageBattleCompletion({ state: game.state, sim, result, heroIds: [heroId], waveNumber: 1 });
        game.mutate((draft) => {
          // Repeat application verifies classless awards/wave completion are
          // assigned once at this production state boundary.
          staged.applyToDraft(draft);
          staged.applyToDraft(draft);
        });
        setCompletion(staged.lastResult);
      }}>complete</button>
    </div>
  );
}

describe("classless battle completion through GameProvider persistence", () => {
  let root;
  let container;
  const user = { id: "disposable-user", username: "Local Test" };

  function fixture({ victory, hp, xp, gold }) {
    const state = createNewState();
    state.heroes = [createHeroModel({ id: "completion-stable-id", name: "Aster", appearanceId: "look-3" })];
    state.heroes[0].progression = { level: 2, xp: 7, ap: 2, sp: 3, ownedNodeIds: ["owned-node"] };
    state.needsSquad = false;
    state.gold = 100;
    state.castleHp = 900;
    state.accountMarker = { disposable: true };
    const sim = JSON.parse(JSON.stringify(state));
    sim.heroes[0].combat.hp = hp;
    sim.gold = gold;
    sim.castleHp = 820;
    sim.kills.total = 4;
    const result = {
      victory,
      reason: victory ? "cleared" : "heroes",
      killed: 2,
      total: 4,
      xpGains: { heroes: { 0: xp }, towers: {} },
    };
    return { state, sim, result, heroId: state.heroes[0].identity.id };
  }

  async function mount(input) {
    root = createRoot(container);
    await act(async () => {
      root.render(<GameProvider user={user}><CompletionProbe {...input} /></GameProvider>);
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  beforeEach(() => {
    global.IS_REACT_ACT_ENVIRONMENT = true;
    global.structuredClone ||= (value) => JSON.parse(JSON.stringify(value));
    localStorage.clear();
    localStorage.setItem("dm_token", "disposable-test-token");
    container = document.createElement("div");
    document.body.appendChild(container);
    mockRemoteState = null;
    mockSerialize = serializeGameState;
    jest.clearAllMocks();
    gameApi.getState.mockImplementation(async () => ({ data: { state: mockRemoteState ? JSON.parse(JSON.stringify(mockRemoteState)) : null } }));
    gameApi.createState.mockResolvedValue({ data: { ok: true } });
    gameApi.saveState.mockImplementation(async (state) => {
      mockRemoteState = mockSerialize(state);
      return { data: { ok: true } };
    });
  });

  afterEach(async () => {
    if (root) await act(async () => root.unmount());
    container?.remove();
    root = null;
    container = null;
  });

  test.each([
    ["victory", true, 214, 29, 165, 2, 36],
    ["defeat", false, 0, 12, 125, 1, 19],
  ])("applies %s through the production completion boundary and reloads the saved profile", async (_label, victory, hp, xp, gold, expectedWave, expectedXp) => {
    const input = fixture({ victory, hp, xp, gold });
    expect(normalizeState(input.state).heroes[0].combat.hp).toBe(300);
    mockRemoteState = input.state;
    await mount(input);

    await act(async () => {
      container.querySelector("button").click();
      await new Promise((resolve) => setTimeout(resolve, 750));
    });
    expect(container.querySelector('[data-testid="completion-profile"]').dataset.result).toBe(String(victory));
    expect(gameApi.saveState).toHaveBeenCalledTimes(1);
    expect(gameApi.createState).not.toHaveBeenCalled();
    expect(mockRemoteState.gold).toBe(gold);
    expect(mockRemoteState.wave).toBe(expectedWave);

    await act(async () => root.unmount());
    root = null;
    await mount(input);

    const loaded = container.querySelector('[data-testid="completion-profile"]');
    const hero = mockRemoteState.heroes[0];
    expect(loaded.dataset.hp).toBe(String(hp));
    expect(loaded.dataset.xp).toBe(String(expectedXp));
    expect(loaded.dataset.wave).toBe(String(expectedWave));
    expect(loaded.dataset.gold).toBe(String(gold));
    expect(hero.identity).toEqual(input.state.heroes[0].identity);
    expect(hero.appearance).toEqual(input.state.heroes[0].appearance);
    expect(hero.combat).toMatchObject({
      hp,
      maxHp: 300,
      stats: { attack: 10, defense: 10, agility: 10, intelligence: 10 },
      basicAttack: input.state.heroes[0].combat.basicAttack,
      capabilities: input.state.heroes[0].combat.capabilities,
    });
    expect(hero.progression).toMatchObject({ ap: 2, sp: 3, ownedNodeIds: ["owned-node"] });
    expect(hero.cls).toBeUndefined();
    expect(mockRemoteState.castleHp).toBe(820);
    expect(mockRemoteState.accountMarker).toEqual({ disposable: true });
    expect(gameApi.getState).toHaveBeenCalledTimes(2);
  });
});

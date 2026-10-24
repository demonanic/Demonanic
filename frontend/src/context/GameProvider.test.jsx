import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { GameProvider, normalizeState, useGame } from "./GameProvider";
import { gameApi } from "../api";
import { createHero } from "../game/logic";
import { NEON_IDENTITY_COLORS } from "../game/heroModel";

jest.mock("../api", () => ({
  gameApi: {
    getState: jest.fn(),
    createState: jest.fn(),
    saveState: jest.fn(),
  },
}));

global.IS_REACT_ACT_ENVIRONMENT = true;

function Probe() {
  const game = useGame();
  return (
    <div data-testid="game-probe" data-state={game.state ? "ready" : "empty"} data-screen={game.screen} data-prompt={game.profilePrompt?.kind || "none"}
      data-message={game.profilePrompt?.message || ""}
      data-blockade-active={game.state?.guildBlockadeActiveUntil || 0} data-blockade-cooldown={game.state?.guildBlockadeCooldownUntil || 0}>
      <button onClick={game.startNewGame}>new-game</button>
      <button onClick={game.continueWithLocalBackup}>continue-local</button>
      <button onClick={game.saveNow}>save</button>
      <button onClick={game.retryLoad}>retry-load</button>
    </div>
  );
}

describe("GameProvider saved profile startup", () => {
  let root;
  let container;

  const user = { id: "test-user", username: "Commander" };
  const savedState = { wave: 8, highestWaveCleared: 7, heroes: [], bench: [], towers: [] };

  async function mount(providerUser = user) {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root.render(<GameProvider user={providerUser}><Probe /></GameProvider>);
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    localStorage.setItem("dm_token", "test-token");
    gameApi.saveState.mockResolvedValue({ data: { ok: true } });
    gameApi.createState.mockResolvedValue({ data: { ok: true } });
  });

  afterEach(async () => {
    if (root) await act(async () => root.unmount());
    container?.remove();
    root = null;
    container = null;
  });

  test("loads an existing server profile without creating or replacing it", async () => {
    gameApi.getState.mockResolvedValue({ data: { state: savedState } });
    await mount();
    expect(container.querySelector("[data-testid='game-probe']").dataset.state).toBe("ready");
    expect(gameApi.createState).not.toHaveBeenCalled();
    expect(gameApi.saveState).not.toHaveBeenCalled();
  });

  test("clamps persisted blockade timers to their documented maximum durations", async () => {
    const now = Date.now();
    gameApi.getState.mockResolvedValue({ data: { state: {
      ...savedState,
      guildBlockadeActiveUntil: now + 24 * 60 * 60 * 1000,
      guildBlockadeCooldownUntil: now + 24 * 60 * 60 * 1000,
    } } });
    await mount();
    const probe = container.querySelector("[data-testid='game-probe']");
    expect(Number(probe.dataset.blockadeActive) - now).toBeLessThanOrEqual(10_000);
    expect(Number(probe.dataset.blockadeCooldown) - now).toBeLessThanOrEqual(62_000);
  });

  test("migrates legacy hero color once without changing class or equipment across reload", () => {
    const oldHero = createHero("mage");
    delete oldHero.appearance; // shape of a pre-color legacy save
    const oldEquipment = JSON.parse(JSON.stringify(oldHero.equipment));
    const migrated = normalizeState({ ...savedState, heroes: [oldHero], bench: [], academyHeroes: [] });
    const color = migrated.heroes[0].appearance.identityColor;

    expect(NEON_IDENTITY_COLORS).toContain(color);
    expect(migrated.heroes[0].cls).toBe("mage");
    expect(migrated.heroes[0].equipment).toEqual(oldEquipment);
    expect(oldHero).not.toHaveProperty("appearance");

    const reloaded = normalizeState(JSON.parse(JSON.stringify(migrated)));
    expect(reloaded.heroes[0].appearance.identityColor).toBe(color);
    expect(reloaded.heroes[0].cls).toBe("mage");
    expect(reloaded.heroes[0].equipment).toEqual(oldEquipment);
  });

  test("treats an explicit null as missing and waits for the player's choice", async () => {
    gameApi.getState.mockResolvedValue({ data: { state: null } });
    await mount();
    expect(container.querySelector("[data-testid='game-probe']").dataset.prompt).toBe("missing");
    expect(gameApi.createState).not.toHaveBeenCalled();
    expect(gameApi.saveState).not.toHaveBeenCalled();
  });

  test.each([
    ["network failure", { code: "ERR_NETWORK" }],
    ["server error", { response: { status: 503 } }],
    ["unexpected HTTP 404", { response: { status: 404 } }],
  ])("does not create a profile after a %s", async (_label, error) => {
    gameApi.getState.mockRejectedValue(error);
    await mount();
    expect(container.querySelector("[data-testid='game-probe']").dataset.prompt).toBe("error");
    expect(gameApi.createState).not.toHaveBeenCalled();
    expect(gameApi.saveState).not.toHaveBeenCalled();
  });

  test("does not interpret an ambiguous successful response as a missing profile", async () => {
    gameApi.getState.mockResolvedValue({ data: {} });
    await mount();
    expect(container.querySelector("[data-testid='game-probe']").dataset.prompt).toBe("error");
    expect(gameApi.createState).not.toHaveBeenCalled();
    expect(gameApi.saveState).not.toHaveBeenCalled();
  });

  test("does not accept an object without a valid save marker as a profile", async () => {
    gameApi.getState.mockResolvedValue({ data: { state: {} } });
    await mount();
    expect(container.querySelector("[data-testid='game-probe']").dataset.prompt).toBe("error");
    expect(gameApi.createState).not.toHaveBeenCalled();
    expect(gameApi.saveState).not.toHaveBeenCalled();
  });

  test("does not call the profile endpoint without an authenticated user", async () => {
    await mount(null);
    expect(container.querySelector("[data-testid='game-probe']").dataset.prompt).toBe("error");
    expect(gameApi.getState).not.toHaveBeenCalled();
    expect(gameApi.createState).not.toHaveBeenCalled();
  });

  test("a failed profile verification can be retried without exposing new-profile creation", async () => {
    gameApi.getState.mockResolvedValueOnce({ data: { state: {} } }).mockResolvedValueOnce({ data: { state: savedState } });
    await mount();

    let probe = container.querySelector("[data-testid='game-probe']");
    expect(probe.dataset.prompt).toBe("error");
    expect(gameApi.createState).not.toHaveBeenCalled();

    await act(async () => {
      container.querySelector("button:nth-of-type(4)").click();
      await Promise.resolve();
      await Promise.resolve();
    });
    probe = container.querySelector("[data-testid='game-probe']");
    expect(probe.dataset.state).toBe("ready");
    expect(probe.dataset.prompt).toBe("none");
    expect(gameApi.createState).not.toHaveBeenCalled();
  });

  test("treats an unauthorized profile request as an error, never as a new account", async () => {
    gameApi.getState.mockRejectedValue({ response: { status: 401 } });
    await mount();
    expect(container.querySelector("[data-testid='game-probe']").dataset.prompt).toBe("error");
    expect(gameApi.createState).not.toHaveBeenCalled();
    expect(gameApi.saveState).not.toHaveBeenCalled();
  });

  test("keeps an existing local backup device-only unless the player chooses it", async () => {
    localStorage.setItem("dm_state_backup_test-user", JSON.stringify(savedState));
    gameApi.getState.mockResolvedValue({ data: { state: null } });
    await mount();

    expect(gameApi.createState).not.toHaveBeenCalled();
    await act(async () => {
      container.querySelector("button:nth-of-type(2)").click();
      await Promise.resolve();
    });
    await act(async () => {
      container.querySelector("button:nth-of-type(3)").click();
      await Promise.resolve();
    });
    expect(container.querySelector("[data-testid='game-probe']").dataset.state).toBe("ready");
    expect(gameApi.saveState).not.toHaveBeenCalled();
  });

  test("creates a new profile only after explicit confirmation", async () => {
    gameApi.getState.mockResolvedValue({ data: { state: null } });
    await mount();
    await act(async () => {
      container.querySelector("button:nth-of-type(1)").click();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(gameApi.createState).toHaveBeenCalledTimes(1);
    expect(gameApi.saveState).not.toHaveBeenCalled();
    expect(container.querySelector("[data-testid='game-probe']").dataset.state).toBe("ready");

    await act(async () => {
      container.querySelector("button:nth-of-type(3)").click();
      await Promise.resolve();
    });
    expect(gameApi.saveState).toHaveBeenCalledTimes(1);
  });

  test("does not enter the game unless profile creation returns explicit success", async () => {
    gameApi.getState.mockResolvedValue({ data: { state: null } });
    gameApi.createState.mockResolvedValue({ data: { ok: false } });
    await mount();

    await act(async () => {
      container.querySelector("button:nth-of-type(1)").click();
      await Promise.resolve();
      await Promise.resolve();
    });

    const probe = container.querySelector("[data-testid='game-probe']");
    expect(probe.dataset.state).toBe("empty");
    expect(probe.dataset.prompt).toBe("error");
    expect(probe.dataset.message).toMatch(/server did not confirm/i);
    expect(gameApi.saveState).not.toHaveBeenCalled();
  });

  test("network failure during creation can be safely retried after an explicit missing lookup", async () => {
    gameApi.getState.mockResolvedValue({ data: { state: null } });
    gameApi.createState.mockRejectedValueOnce({ code: "ERR_NETWORK" }).mockResolvedValueOnce({ data: { ok: true } });
    await mount();

    await act(async () => {
      container.querySelector("button:nth-of-type(1)").click();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(container.querySelector("[data-testid='game-probe']").dataset.prompt).toBe("error");
    expect(container.querySelector("[data-testid='game-probe']").dataset.message).toMatch(/retry loading/i);

    await act(async () => {
      container.querySelector("button:nth-of-type(4)").click();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(container.querySelector("[data-testid='game-probe']").dataset.prompt).toBe("missing");

    await act(async () => {
      container.querySelector("button:nth-of-type(1)").click();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(gameApi.createState).toHaveBeenCalledTimes(2);
    expect(container.querySelector("[data-testid='game-probe']").dataset.state).toBe("ready");
  });

  test("a creation conflict preserves recovery through a subsequent profile lookup", async () => {
    gameApi.getState.mockResolvedValueOnce({ data: { state: null } }).mockResolvedValueOnce({ data: { state: savedState } });
    gameApi.createState.mockRejectedValue({ response: { status: 409 } });
    await mount();

    await act(async () => {
      container.querySelector("button:nth-of-type(1)").click();
      await Promise.resolve();
      await Promise.resolve();
    });
    const probe = container.querySelector("[data-testid='game-probe']");
    expect(probe.dataset.state).toBe("empty");
    expect(probe.dataset.message).toMatch(/already exists.*retry loading/i);
    expect(gameApi.saveState).not.toHaveBeenCalled();

    await act(async () => {
      container.querySelector("button:nth-of-type(4)").click();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(container.querySelector("[data-testid='game-probe']").dataset.state).toBe("ready");
    expect(gameApi.createState).toHaveBeenCalledTimes(1);
    expect(gameApi.saveState).not.toHaveBeenCalled();
  });

  test("coalesces rapid new-game confirmation clicks", async () => {
    let finishCreation;
    gameApi.getState.mockResolvedValue({ data: { state: null } });
    gameApi.createState.mockImplementation(() => new Promise((resolve) => { finishCreation = resolve; }));
    await mount();
    await act(async () => {
      container.querySelector("button:nth-of-type(1)").click();
      container.querySelector("button:nth-of-type(1)").click();
      await Promise.resolve();
    });
    expect(gameApi.createState).toHaveBeenCalledTimes(1);
    await act(async () => {
      finishCreation({ data: { ok: true } });
      await Promise.resolve();
    });
    expect(container.querySelector("[data-testid='game-probe']").dataset.state).toBe("ready");
  });
});

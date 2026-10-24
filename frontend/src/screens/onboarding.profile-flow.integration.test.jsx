import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { GameProvider, useGame } from "../context/GameProvider";
import SquadSelect from "./SquadSelect";
import Home from "./Home";
import { gameApi } from "../api";
import { createNewState, setClasslessSquad } from "../game/logic";
import { serializeGameState } from "../game/heroModel";

jest.mock("../api", () => ({
  gameApi: {
    getState: jest.fn(),
    createState: jest.fn(),
    saveState: jest.fn(),
  },
}));

jest.mock("../components/ui-kit", () => ({
  NeonButton: ({ children, ...props }) => <button {...props}>{children}</button>,
  getTacticalHudOpaque: () => false,
  setTacticalHudOpaque: jest.fn(),
}));

jest.mock("../context/AuthContext", () => ({ useAuth: () => ({ logout: jest.fn() }) }));

function OnboardingRouteProbe() {
  const game = useGame();
  if (game.loading) return <div data-testid="loading" />;
  if (game.profilePrompt) {
    return (
      <main>
        <h1>{game.profilePrompt.kind === "missing" ? "SAVED PROFILE NOT FOUND" : "SAVED PROFILE NOT VERIFIED"}</h1>
        <p>{game.profilePrompt.message || "No profile was returned. Starting a new game is an explicit choice."}</p>
        {game.profilePrompt.kind === "missing" && !game.profilePrompt.found && (
          <button onClick={game.startNewGame}>START NEW GAME</button>
        )}
        <button onClick={game.retryLoad}>RETRY LOAD</button>
      </main>
    );
  }
  if (game.screen === "squad") return <SquadSelect />;
  if (game.screen === "home") return <Home />;
  return null;
}

describe("classless first-profile onboarding journey", () => {
  let root;
  let container;
  let originalStructuredClone;

  beforeEach(() => {
    originalStructuredClone = global.structuredClone;
    global.structuredClone = undefined;
    localStorage.clear();
    localStorage.setItem("dm_token", "disposable-test-token");
    jest.clearAllMocks();
    gameApi.getState.mockResolvedValue({ data: { state: null } });
    gameApi.createState.mockResolvedValue({ status: 201, data: { ok: true } });
    gameApi.saveState.mockResolvedValue({ status: 200, data: { ok: true } });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    if (root) await act(async () => root.unmount());
    container?.remove();
    root = null;
    container = null;
    global.structuredClone = originalStructuredClone;
    jest.useRealTimers();
  });

  async function mountApp() {
    await act(async () => {
      root.render(<GameProvider user={{ id: "disposable-onboarding-user", username: "Tester" }}><OnboardingRouteProbe /></GameProvider>);
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  async function click(button) {
    await act(async () => {
      button.click();
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  test("waits for the authenticated profile save before rendering the real Home screen", async () => {
    await mountApp();
    expect(container.textContent).toContain("SAVED PROFILE NOT FOUND");
    await click([...container.querySelectorAll("button")].find((button) => button.textContent.includes("START NEW GAME")));

    expect(gameApi.createState).toHaveBeenCalledTimes(1);
    const initialProfile = gameApi.createState.mock.calls[0][0];
    expect(initialProfile).toEqual(expect.objectContaining({ needsSquad: true, heroes: [] }));
    expect(container.textContent).toContain("Begin Your Journey");

    let resolveSave;
    gameApi.saveState.mockReturnValueOnce(new Promise((resolve) => { resolveSave = resolve; }));
    const startButton = container.querySelector('[data-testid="squad-classless-confirm"]');
    await act(async () => {
      startButton.click();
      startButton.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(startButton.disabled).toBe(true);
    expect(startButton.textContent).toMatch(/saving hero/i);
    expect(container.querySelector('[data-testid="home-screen"]')).toBeNull();
    expect(gameApi.saveState).toHaveBeenCalledTimes(1);
    const pendingSave = gameApi.saveState.mock.calls[0][0];
    expect(pendingSave.needsSquad).toBe(false);
    expect(pendingSave.heroes).toHaveLength(1);
    expect(pendingSave.heroes[0]).not.toHaveProperty("cls");

    await act(async () => {
      resolveSave({ status: 200, data: { ok: true } });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.querySelector('[data-testid="home-screen"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="enter-preparation-button"]')).not.toBeNull();
    expect(gameApi.createState).toHaveBeenCalledTimes(1);
    const savedBackup = JSON.parse(localStorage.getItem("dm_state_backup_disposable-onboarding-user"));
    expect(savedBackup.heroes).toHaveLength(1);
    expect(savedBackup.heroes[0]).not.toHaveProperty("cls");
    expect(savedBackup.heroes[0].combat.hp).toBe(300);
  });

  test("a failed starter PUT stays on onboarding and retry saves the same single hero", async () => {
    await mountApp();
    await click([...container.querySelectorAll("button")].find((button) => button.textContent.includes("START NEW GAME")));
    gameApi.saveState.mockRejectedValueOnce({ code: "ERR_NETWORK" });

    await click(container.querySelector('[data-testid="squad-classless-confirm"]'));
    expect(container.querySelector("[role=alert]")?.textContent).toMatch(/server did not confirm.*retry/i);
    expect(container.querySelector('[data-testid="home-screen"]')).toBeNull();
    const firstAttempt = gameApi.saveState.mock.calls[0][0];
    expect(firstAttempt.heroes).toHaveLength(1);
    const heroId = firstAttempt.heroes[0].identity.id;

    gameApi.saveState.mockResolvedValueOnce({ status: 200, data: { ok: true } });
    await click(container.querySelector('[data-testid="squad-classless-confirm"]'));

    expect(container.querySelector('[data-testid="home-screen"]')).not.toBeNull();
    expect(gameApi.createState).toHaveBeenCalledTimes(1);
    expect(gameApi.saveState).toHaveBeenCalledTimes(2);
    expect(gameApi.saveState.mock.calls[1][0].heroes).toHaveLength(1);
    expect(gameApi.saveState.mock.calls[1][0].heroes[0].identity.id).toBe(heroId);
  });

  test("a saved new profile reloads into Home with the same starter identity", async () => {
    await mountApp();
    await click([...container.querySelectorAll("button")].find((button) => button.textContent.includes("START NEW GAME")));

    let savedProfile;
    gameApi.saveState.mockImplementationOnce(async (state) => {
      savedProfile = serializeGameState(state);
      return { status: 200, data: { ok: true } };
    });
    await click(container.querySelector('[data-testid="squad-classless-confirm"]'));
    const savedHeroId = savedProfile.heroes[0].identity.id;
    expect(container.querySelector('[data-testid="home-screen"]')).not.toBeNull();

    await act(async () => root.unmount());
    root = null;
    container.innerHTML = "";
    gameApi.getState.mockResolvedValueOnce({ data: { state: savedProfile } });
    root = createRoot(container);
    await mountApp();

    expect(container.querySelector('[data-testid="home-screen"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="squad-classless-confirm"]')).toBeNull();
    expect(gameApi.createState).toHaveBeenCalledTimes(1);
    expect(gameApi.saveState).toHaveBeenCalledTimes(1);
    const reloaded = JSON.parse(localStorage.getItem("dm_state_backup_disposable-onboarding-user"));
    expect(reloaded.heroes).toHaveLength(1);
    expect(reloaded.heroes[0].identity.id).toBe(savedHeroId);
  });

  test("an existing saved profile still loads into Home without creating another profile", async () => {
    const saved = createNewState();
    setClasslessSquad(saved);
    gameApi.getState.mockResolvedValueOnce({ data: { state: serializeGameState(saved) } });
    await mountApp();

    expect(container.querySelector('[data-testid="home-screen"]')).not.toBeNull();
    expect(gameApi.createState).not.toHaveBeenCalled();
    expect(gameApi.saveState).not.toHaveBeenCalled();
  });

  test.each([
    ["unauthorized session", { response: { status: 401 } }, /session could not be verified/i],
    ["duplicate profile", { response: { status: 409 } }, /saved profile already exists.*retry loading/i],
    ["network failure", { code: "ERR_NETWORK" }, /server did not confirm.*retry loading/i],
    ["unexpected acknowledgement", { resolved: { status: 201, data: { ok: false } } }, /server did not confirm.*retry loading/i],
  ])("shows actionable feedback for %s", async (_case, outcome, message) => {
    await mountApp();
    const startNewGame = [...container.querySelectorAll("button")].find((button) => button.textContent.includes("START NEW GAME"));
    if (outcome.resolved) gameApi.createState.mockResolvedValue(outcome.resolved);
    else gameApi.createState.mockRejectedValue(outcome);
    await click(startNewGame);

    expect(container.textContent).toContain("SAVED PROFILE NOT VERIFIED");
    expect(container.textContent).toMatch(message);
    expect(container.querySelector('[data-testid="home-screen"]')).toBeNull();
    expect(gameApi.saveState).not.toHaveBeenCalled();
  });
});

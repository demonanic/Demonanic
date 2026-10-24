import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { GameProvider, useGame } from "../context/GameProvider";
import SquadSelect from "./SquadSelect";
import { gameApi } from "../api";

jest.mock("../api", () => ({
  gameApi: {
    getState: jest.fn(),
    createState: jest.fn(),
    saveState: jest.fn(),
  },
}));

jest.mock("../components/ui-kit", () => ({
  NeonButton: ({ children, ...props }) => <button {...props}>{children}</button>,
}));

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
  if (game.screen === "home") {
    return <main data-testid="playable-home" data-hero-count={game.state?.heroes?.length || 0} />;
  }
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

  test("POST acknowledgement, starter click, and app routing reach playable mode once", async () => {
    await mountApp();
    expect(container.textContent).toContain("SAVED PROFILE NOT FOUND");
    await click([...container.querySelectorAll("button")].find((button) => button.textContent.includes("START NEW GAME")));

    expect(gameApi.createState).toHaveBeenCalledTimes(1);
    const initialProfile = gameApi.createState.mock.calls[0][0];
    expect(initialProfile).toEqual(expect.objectContaining({ needsSquad: true, heroes: [] }));
    expect(container.textContent).toContain("Begin Your Journey");

    const startButton = container.querySelector('[data-testid="squad-classless-confirm"]');
    await act(async () => {
      startButton.click();
      startButton.click();
      await Promise.resolve();
    });

    const home = container.querySelector('[data-testid="playable-home"]');
    expect(home).not.toBeNull();
    expect(home.dataset.heroCount).toBe("1");
    expect(gameApi.createState).toHaveBeenCalledTimes(1);
    const savedBackup = JSON.parse(localStorage.getItem("dm_state_backup_disposable-onboarding-user"));
    expect(savedBackup.heroes).toHaveLength(1);
    expect(savedBackup.heroes[0]).not.toHaveProperty("cls");
    expect(savedBackup.heroes[0].combat.hp).toBe(300);
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
    expect(container.querySelector('[data-testid="playable-home"]')).toBeNull();
    expect(gameApi.saveState).not.toHaveBeenCalled();
  });
});

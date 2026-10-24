import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { gameApi } from "../api";
import { createNewState, produce, advanceGuildManufacturing, setClasslessSquad } from "../game/logic";
import { advanceLibraryResearch, ensureMageSpellData, ensureResearchMageBenched } from "../game/libraryResearch";
import { emptyEquipmentState } from "../game/equipment";
import { normalizePerks } from "../game/perks";
import { heroDerived } from "../game/logic";
import * as C from "../game/config";
import { ensureHeroIdentityColor, normalizeClasslessHero } from "../game/heroModel";

const GameCtx = createContext(null);
export const useGame = () => useContext(GameCtx);

function safeErrorDetails(error) {
  return { status: error?.response?.status, code: error?.code };
}

function profileCreationErrorMessage(error) {
  const status = error?.response?.status;
  if (status === 409) {
    return "A saved profile already exists for this account. Retry loading it; no existing profile was replaced.";
  }
  if (status === 401 || status === 403) {
    return "Your session could not be verified. Return to login and sign in again; no profile was created.";
  }
  if (error?.code === "ERR_NETWORK" || error?.code === "ECONNABORTED") {
    return "The server did not confirm profile creation. Retry loading before trying again; an existing profile will not be replaced.";
  }
  return "The server did not confirm profile creation. Retry loading before trying again; an existing profile will not be replaced.";
}

function journeySaveErrorMessage(error) {
  const status = error?.response?.status;
  if (status === 401 || status === 403) {
    return "Your session expired before the starter hero was saved. Sign in again, then retry; no existing profile was replaced.";
  }
  if (status === 409) {
    return "The profile could not be updated because the server reported a conflict. Retry loading your profile before continuing.";
  }
  if (error?.code === "ERR_NETWORK" || error?.code === "ECONNABORTED") {
    return "The server did not confirm the starter hero save. Check your connection and tap Start with One Hero to retry.";
  }
  return "The server did not confirm the starter hero save. Retry the save before entering the game.";
}

// Game state is persisted as JSON. Keep provider mutations usable on older
// Android WebViews that do not implement structuredClone.
function cloneGameState(state) {
  return typeof structuredClone === "function"
    ? structuredClone(state)
    : JSON.parse(JSON.stringify(state));
}

// Backward-compat for older saves.
export function normalizeState(s) {
  if (!s || typeof s !== "object" || Array.isArray(s)) throw new TypeError("Invalid game state");
  // Normalize a disposable copy so malformed input can never be half-mutated.
  s = JSON.parse(JSON.stringify(s));
  if (!s.bench) s.bench = [];
  // One-time economy migration: convert legacy Food to Metal at 10:1, then remove Food.
  if (!Number.isFinite(Number(s.metal))) s.metal = Math.floor(Math.max(0, Number(s.food) || 0) / 10);
  delete s.food;
  delete s.farmers;
  s.mineGoldRatio = Math.max(0, Math.min(1, Number.isFinite(Number(s.mineGoldRatio)) ? Number(s.mineGoldRatio) : 0.5));
  s.goldVaultPercent = Math.max(0, Math.min(100, Number(s.goldVaultPercent) || 0));
  s.goldTreasuryPercent = 100 - s.goldVaultPercent;
  s.vaultGold = Math.max(0, Number(s.vaultGold) || 0);
  s.guildWorkers = Math.max(0, Math.floor(Number(s.guildWorkers) || 0));
  if (!s.guildAmmoCache || typeof s.guildAmmoCache !== "object") s.guildAmmoCache = {};
  if (!s.guildManufacturing || !(Number(s.guildManufacturing.remaining) > 0)) s.guildManufacturing = null;
  if (!Number.isFinite(Number(s.surrenderTaxAppliedWave))) {
    s.surrenderTaxAppliedWave = Math.max(0, Number(s.surrenderDebtWave) || 0);
  }
  s.lastCompletedWave = Math.max(0, Math.floor(Number(s.lastCompletedWave) || Number(s.highestWaveCleared) || 0));
  s.guildBlockadeLevel = Math.max(0, Math.min(1, Math.floor(Number(s.guildBlockadeLevel) || 0)));
  const blockadeNow = Date.now();
  const normalizeBlockadeDeadline = (value, maxDuration) => {
    const deadline = Number(value);
    return Number.isFinite(deadline) && deadline > blockadeNow
      ? Math.min(deadline, blockadeNow + maxDuration)
      : 0;
  };
  s.guildBlockadeActiveUntil = normalizeBlockadeDeadline(s.guildBlockadeActiveUntil, C.GUILD_BLOCKADE.durationMs);
  s.guildBlockadeCooldownUntil = normalizeBlockadeDeadline(s.guildBlockadeCooldownUntil, C.GUILD_BLOCKADE.cooldownMs);

  s.goldVaultPercent = Math.max(0, Math.min(100, Number(s.goldVaultPercent) || 0));
  s.goldTreasuryPercent = 100 - s.goldVaultPercent;
  s.vaultGold = Math.max(0, Number(s.vaultGold) || 0);
  s.guildWorkers = Math.max(0, Math.floor(Number(s.guildWorkers) || 0));
  if (!s.guildAmmoCache || typeof s.guildAmmoCache !== "object") s.guildAmmoCache = {};
  if (!s.guildManufacturing || !(Number(s.guildManufacturing.remaining) > 0)) s.guildManufacturing = null;

  if (!Array.isArray(s.libraryBlueprints)) s.libraryBlueprints = [];
  if (!Array.isArray(s.librarySpells)) s.librarySpells = [];
  if (!s.libraryResearch || !(Number(s.libraryResearch.remainingSeconds) > 0)) s.libraryResearch = null;
  if (!s.libraryCompletionNotice || typeof s.libraryCompletionNotice !== "object") s.libraryCompletionNotice = null;

  if (!Array.isArray(s.academyHeroes)) s.academyHeroes = [];
  if (!Array.isArray(s.academyTraining)) s.academyTraining = [];
  // Discard legacy enrollments that point at active/bench heroes. Only heroes
  // explicitly moved into academyHeroes may occupy a training seat.
  const academyIds = new Set(s.academyHeroes.map((h) => h?.id).filter(Boolean));
  s.academyTraining = s.academyTraining.filter((t) => t && (academyIds.has(t.heroId) || (t.paused && s.bench.some((h) => h?.id === t.heroId))));
  // First-pass persistent castle-building state. Defaults preserve old profiles.
  if (!s.buildings || typeof s.buildings !== "object") s.buildings = {};
  const buildingDefaults = {
    mine: { unlocked: true },
    quarry: { unlocked: true },
    tavern: { unlocked: true },
    shoppe: { unlocked: true },
    vault: { unlocked: true },
    academy: { unlocked: true },
    guild: { unlocked: true },
    library: { unlocked: true },
  };
  Object.entries(buildingDefaults).forEach(([id, defaults]) => {
    const prior = s.buildings[id] && typeof s.buildings[id] === "object" ? s.buildings[id] : {};
    const maxHp = Math.max(1, Number(prior.maxHp) || 1000);
    s.buildings[id] = {
      ...prior,
      level: Math.max(1, Number(prior.level) || 1),
      maxHp,
      hp: Math.max(0, Math.min(maxHp, Number.isFinite(Number(prior.hp)) ? Number(prior.hp) : maxHp)),
      unlocked: (id === "academy" || id === "guild" || id === "vault" || id === "library") ? true : (prior.unlocked === undefined ? defaults.unlocked : !!prior.unlocked),
      activity: prior.activity || "Idle",
      ...(Number.isFinite(Number(prior.turretAmmo)) ? { turretAmmo: Math.max(0, Number(prior.turretAmmo)) } : {}),
      ...(Number.isFinite(Number(prior.turretMaxAmmo)) ? { turretMaxAmmo: Math.max(0, Number(prior.turretMaxAmmo)) } : {}),
    };
  });
  const barricades = Array.isArray(s.barricades) ? s.barricades : [];
  s.barricades = Array.from({ length: C.BARRICADE.positions }, (_, index) => {
    const prior = barricades[index] && typeof barricades[index] === "object" ? barricades[index] : {};
    const maxHp = Math.max(0, Math.min(C.BARRICADE.maxHp, Number(prior.maxHp) || 0));
    return { ...prior, maxHp, hp: Math.max(0, Math.min(maxHp, Number(prior.hp) || 0)) };
  });
  for (const roster of [s.heroes, s.bench]) {
    if (!Array.isArray(roster)) continue;
    roster.forEach((h, index) => {
      if (h && !h.cls && (h.combat || h.identity)) roster[index] = normalizeClasslessHero(h);
    });
  }
  if (Array.isArray(s.heroes)) {
    s.heroes.forEach((h) => {
      if (h && !h.cls && (h.combat || h.identity)) return;
      if (h && !h.id) h.id = `${h.cls || h.key}-${Math.random().toString(36).slice(2)}`;
      if (h) {
        h.perks = normalizePerks(h.cls, h.perks);
        ensureMageSpellData(h);
        if (!h.abilityCooldowns || typeof h.abilityCooldowns !== "object") h.abilityCooldowns = {};
        h.maxHp = heroDerived(h).maxHp;
        h.maxMana = Math.max(1, Number(h.maxMana) || (100 + (Number(h.stats?.intelligence) || 10) * 5));
        h.mana = Math.max(0, Math.min(h.maxMana, Number.isFinite(Number(h.mana)) ? Number(h.mana) : h.maxMana));
        if (h.hp > 0) h.hp = Math.min(h.hp, h.maxHp);
      }
    });
  }
  // Add the visual-only identity color to old class and classless saves once.
  // Normalization already runs against a copy; the saved source is untouched.
  for (const roster of [s.heroes, s.bench, s.academyHeroes]) {
    if (!Array.isArray(roster)) continue;
    roster.forEach((hero, index) => {
      if (hero && typeof hero === "object") roster[index] = ensureHeroIdentityColor(hero);
    });
  }
  if (Array.isArray(s.bench)) s.bench.forEach((h) => { if (h?.cls) ensureMageSpellData(h); });
  const firstMage = [...(s.heroes || []), ...(s.bench || [])].find((h) => h?.cls === "mage");
  if (firstMage) (s.libraryBlueprints || []).forEach((blueprint) => { if (blueprint && !blueprint.mageId) { blueprint.mageId = firstMage.id; blueprint.mageName = firstMage.name; } });
  // Migrate older global Library orders to one stable mage without discarding progress.
  if (s.libraryResearch) {
    const blueprint = (s.libraryBlueprints || []).find((item) => item.id === s.libraryResearch.blueprintId);
    const mage = [...(s.heroes || []), ...(s.bench || [])].find((h) => h?.cls === "mage" && (h.id === s.libraryResearch.mageId || h.id === blueprint?.mageId)) ||
      [...(s.heroes || []), ...(s.bench || [])].find((h) => h?.cls === "mage");
    if (mage) {
      s.libraryResearch.mageId = mage.id;
      if (blueprint) { blueprint.mageId = mage.id; blueprint.mageName = mage.name; }
    } else {
      // Do not lose an old research order if no mage exists in the saved roster.
      s.libraryResearch.mageId = s.libraryResearch.mageId || null;
    }
    // Older saves may already have an active research order but still list its mage in the squad.
    ensureResearchMageBenched(s);
  }
  if (s.needsSquad === undefined) {
    s.needsSquad = !(Array.isArray(s.heroes) && s.heroes.length > 0);
  }
  emptyEquipmentState(s);

  if (Array.isArray(s.towers)) {
    const defaults = [[60, 180], [360, 180], [60, 300], [360, 300], [210, 205]];
    s.towers = s.towers.filter(Boolean);
    s.towers.forEach((t, i) => {
      if (!t.id) t.id = `tw-${Math.random().toString(36).slice(2)}`;
      if (t.x == null || t.y == null) {
        const d = defaults[i % 5];
        t.x = d[0];
        t.y = d[1];
      }
    });
  } else {
    s.towers = [];
  }
  return s;
}

export function GameProvider({ children, user }) {
  const [state, setState] = useState(null);
  const [screen, setScreen] = useState("home");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [profilePrompt, setProfilePrompt] = useState(null);
  const [offlineGains, setOfflineGains] = useState(null);
  const [lastResult, setLastResult] = useState(null);
  const stateRef = useRef(null);
  const saveTimer = useRef(null);
  const serverSaveEnabled = useRef(false);
  const newGamePending = useRef(false);
  const journeyPending = useRef(false);

  stateRef.current = state;
  const hasState = Boolean(state);

  const backupKey = user?.id ? `dm_state_backup_${user.id}` : null;

  const writeLocalBackup = useCallback((s) => {
    if (!backupKey || !s) return;
    try {
      localStorage.setItem(backupKey, JSON.stringify(s));
    } catch (e) {
      console.warn("[Demonanic Game] local backup failed:", e);
    }
  }, [backupKey]);

  const loadGame = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    setProfilePrompt(null);
    serverSaveEnabled.current = false;

    try {
      if (!user?.id || !localStorage.getItem("dm_token")) {
        setProfilePrompt({ kind: "error", message: "Sign in again to load your saved profile." });
        return;
      }

      console.log("[Demonanic Game] LOAD START");

      const { data } = await gameApi.getState();

      if (!data || typeof data !== "object" || !Object.prototype.hasOwnProperty.call(data, "state")) {
        throw new Error("The profile service returned an invalid response.");
      }

      if (data.state === null) {
        // Only the backend's explicit null result means no profile. Do not
        // create or sync anything until the player makes an explicit choice.
        let backup = { found: false, state: null, invalid: false };
        if (backupKey) {
          try {
            const raw = localStorage.getItem(backupKey);
            if (raw) {
              const parsed = JSON.parse(raw);
              if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) || !Number.isFinite(parsed.wave)) {
                backup = { found: true, state: null, invalid: true };
              } else {
                backup = { found: true, state: normalizeState(parsed), invalid: false };
              }
            }
          } catch (backupError) {
            backup = { found: true, state: null, invalid: true };
          }
        }
        setProfilePrompt({ kind: "missing", ...backup });
        return;
      }

      if (data.state && typeof data.state === "object" && !Array.isArray(data.state) && Number.isFinite(data.state.wave)) {
        serverSaveEnabled.current = true;
        const reportedOfflineMinutes = Math.max(0, Math.min(720, Number(data.state._offlineGains?.minutes) || 0));
        if (data.state._offlineGains && data.state._offlineGains.minutes > 1) {
          setOfflineGains(data.state._offlineGains);
        }
        delete data.state._offlineGains;

        const finalState = normalizeState(data.state);
        // Backend offline accrual already handles resources. Advance only the
        // saved Guild order here to avoid double-crediting resource production.
        if (reportedOfflineMinutes > 0) {
          advanceGuildManufacturing(finalState, reportedOfflineMinutes * 60);
          advanceLibraryResearch(finalState, reportedOfflineMinutes * 60);
        }
        writeLocalBackup(finalState);
        setState(finalState);
        setScreen(finalState.needsSquad ? "squad" : "home");

        console.log("[Demonanic Game] SAVED PROFILE LOADED:", {
          wave: finalState.wave,
          highestWaveCleared: finalState.highestWaveCleared,
          heroes: finalState.heroes?.length || 0,
          towers: finalState.towers?.length || 0,
        });
      } else {
        throw new Error("The profile service returned an invalid state.");
      }
    } catch (e) {
      console.error("[Demonanic Game] LOAD FAILED:", safeErrorDetails(e));

      // Offer any local copy as an offline option. It remains local until the
      // player chooses it, and server writes stay disabled in that mode.
      let backup = { found: false, state: null, invalid: false };
      if (backupKey) {
        try {
          const raw = localStorage.getItem(backupKey);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) || !Number.isFinite(parsed.wave)) {
              backup = { found: true, state: null, invalid: true };
            } else {
              backup = { found: true, state: normalizeState(parsed), invalid: false };
            }
          }
        } catch (backupError) {
          backup = { found: true, state: null, invalid: true };
        }
      }

      setState(null);
      setProfilePrompt({ kind: "error", message: "Unable to verify your saved profile. Your game was not replaced.", ...backup });
    } finally {
      setLoading(false);
    }
  }, [backupKey, user?.id, writeLocalBackup]);

  const continueWithLocalBackup = useCallback(() => {
    if (!profilePrompt?.found || profilePrompt.invalid || !profilePrompt.state) return false;
    serverSaveEnabled.current = false;
    const localState = profilePrompt.state;
    setProfilePrompt(null);
    setState(localState);
    setScreen(localState.needsSquad ? "squad" : "home");
    return true;
  }, [profilePrompt]);

  const startNewGame = useCallback(async () => {
    if (profilePrompt?.kind !== "missing" || profilePrompt.found || newGamePending.current) return false;
    if (!user?.id || !localStorage.getItem("dm_token")) {
      setProfilePrompt({ kind: "error", message: "Sign in again before creating a new profile." });
      return false;
    }
    newGamePending.current = true;
    setLoading(true);
    setProfilePrompt(null);
    try {
      const newState = normalizeState(createNewState());
      const { data } = await gameApi.createState(newState);
      if (!data || data.ok !== true) {
        const invalidResponse = new Error("Profile creation was not confirmed by the server.");
        invalidResponse.code = "INVALID_PROFILE_CREATE_RESPONSE";
        throw invalidResponse;
      }
      serverSaveEnabled.current = true;
      writeLocalBackup(newState);
      setState(newState);
      setScreen("squad");
      return true;
    } catch (e) {
      console.error("[Demonanic Game] NEW PROFILE CREATION FAILED:", safeErrorDetails(e));
      setState(null);
      setProfilePrompt({ kind: "error", message: profileCreationErrorMessage(e) });
      return false;
    } finally {
      newGamePending.current = false;
      setLoading(false);
    }
  }, [profilePrompt, user?.id, writeLocalBackup]);

  useEffect(() => {
    loadGame();
  }, [loadGame]);

  const scheduleSave = useCallback((s) => {
    writeLocalBackup(s);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      if (!serverSaveEnabled.current) return;
      gameApi.saveState(s).then(() => {
        console.log("[Demonanic Game] SAVE OK");
      }).catch((e) => {
        console.error("[Demonanic Game] SAVE FAILED:", safeErrorDetails(e));
      });
    }, 700);
  }, [writeLocalBackup]);

  const mutate = useCallback((fn) => {
    setState((prev) => {
      if (!prev) return prev;
      const clone = cloneGameState(prev);
      fn(clone);
      scheduleSave(clone);
      return clone;
    });
  }, [scheduleSave]);

  const saveNow = useCallback(async () => {
    if (!stateRef.current) return false;
    writeLocalBackup(stateRef.current);
    if (!serverSaveEnabled.current) return false;
    try {
      await gameApi.saveState(stateRef.current);
      console.log("[Demonanic Game] SAVE NOW OK");
      return true;
    } catch (e) {
      console.error("[Demonanic Game] SAVE NOW FAILED:", safeErrorDetails(e));
      return false;
    }
  }, [writeLocalBackup]);

  // Starter creation and its authenticated PUT form one onboarding action.
  // Do not leave the screen until the server acknowledges the hero state.
  // Keep the same candidate in state on failure so a retry persists that hero
  // instead of creating another one.
  const beginClasslessJourney = useCallback(async () => {
    if (journeyPending.current) return { ok: false, reason: "save-pending" };
    let next = stateRef.current;
    if (!next) return { ok: false, reason: "state-unavailable" };

    const alreadyHasHeroes = Array.isArray(next.heroes) && next.heroes.length > 0;
    let created = false;
    if (next.needsSquad || !alreadyHasHeroes) {
      next = cloneGameState(next);
      if (!setClasslessSquad(next)) return { ok: false, reason: "starter-unavailable" };
      created = true;
      // Update synchronously to make retries and rapid taps idempotent.
      stateRef.current = next;
      setState(next);
    }

    journeyPending.current = true;
    try {
      if (!serverSaveEnabled.current) {
        const unavailable = new Error("Server profile saving is not enabled.");
        unavailable.code = "PROFILE_SAVE_UNAVAILABLE";
        throw unavailable;
      }
      const { data } = await gameApi.saveState(next);
      if (!data || data.ok !== true) {
        const invalidResponse = new Error("Starter hero save was not confirmed by the server.");
        invalidResponse.code = "INVALID_PROFILE_SAVE_RESPONSE";
        throw invalidResponse;
      }
      writeLocalBackup(next);
      return { ok: true, created };
    } catch (error) {
      console.error("[Demonanic Game] STARTER HERO SAVE FAILED:", safeErrorDetails(error));
      return { ok: false, reason: "save-failed", message: journeySaveErrorMessage(error) };
    } finally {
      journeyPending.current = false;
    }
  }, [writeLocalBackup]);

  useEffect(() => {
    if (!hasState || (screen !== "prep" && screen !== "home")) return;

    const id = setInterval(() => {
      setState((prev) => {
        if (!prev) return prev;
        const clone = cloneGameState(prev);
        produce(clone, 1);
        writeLocalBackup(clone);
        return clone;
      });
    }, 1000);

    const save = setInterval(() => saveNow(), 8000);
    return () => {
      clearInterval(id);
      clearInterval(save);
    };
  }, [screen, hasState, saveNow, writeLocalBackup]);

  // Research continues while a wave is active. Persist locally each tick and
  // send the full state on the existing low-frequency save cadence.
  useEffect(() => {
    if (!hasState || screen !== "battle") return;
    const id = setInterval(() => {
      setState((prev) => {
        if (!prev?.libraryResearch) return prev;
        const clone = cloneGameState(prev);
        advanceLibraryResearch(clone, 1);
        writeLocalBackup(clone);
        return clone;
      });
    }, 1000);
    const save = setInterval(() => saveNow(), 8000);
    return () => { clearInterval(id); clearInterval(save); };
  }, [screen, hasState, saveNow, writeLocalBackup]);

  return (
    <GameCtx.Provider value={{
      state,
      setState,
      mutate,
      saveNow,
      beginClasslessJourney,
      loading,
      loadError,
      profilePrompt,
      continueWithLocalBackup,
      startNewGame,
      retryLoad: loadGame,
      screen,
      setScreen,
      offlineGains,
      setOfflineGains,
      lastResult,
      setLastResult,
    }}>
      {children}
    </GameCtx.Provider>
  );
}

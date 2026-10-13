import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { gameApi } from "@/api";
import { createNewState, produce, advanceGuildManufacturing } from "@/game/logic";
import { advanceLibraryResearch, ensureMageSpellData } from "@/game/libraryResearch";
import { emptyEquipmentState } from "@/game/equipment";
import { normalizePerks } from "@/game/perks";
import { heroDerived } from "@/game/logic";

const GameCtx = createContext(null);
export const useGame = () => useContext(GameCtx);

// Backward-compat for older saves.
function normalizeState(s) {
  if (!s || typeof s !== "object") return s;
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
  if (Array.isArray(s.heroes)) {
    s.heroes.forEach((h) => {
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
  if (Array.isArray(s.bench)) s.bench.forEach((h) => { if (h) ensureMageSpellData(h); });
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
  const [offlineGains, setOfflineGains] = useState(null);
  const [lastResult, setLastResult] = useState(null);
  const stateRef = useRef(null);
  const saveTimer = useRef(null);

  stateRef.current = state;

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

    try {
      console.log("[Demonanic Game] LOAD START:", user?.username || user?.id || "unknown");

      const { data } = await gameApi.getState();

      if (data?.state) {
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
        // The API says this account has no server state. Before creating or
        // saving a fresh profile, check whether this user has a local save.
        // Never overwrite a recoverable local profile with a blank new game.
        let localState = null;
        if (backupKey) {
          try {
            const raw = localStorage.getItem(backupKey);
            if (raw) localState = normalizeState(JSON.parse(raw));
          } catch (backupError) {
            console.error("[Demonanic Game] LOCAL BACKUP READ FAILED:", backupError);
          }
        }

        if (localState) {
          setState(localState);
          setScreen(localState.needsSquad ? "squad" : "home");
          console.warn("[Demonanic Game] SERVER PROFILE MISSING; RESTORED LOCAL SAVE WITHOUT OVERWRITING IT");
          // Do not immediately PUT this save: the missing server profile needs
          // investigation before a local copy is allowed to replace server data.
        } else {
          // No server profile and no per-user local backup: initialize a new account.
          const finalState = createNewState();
          normalizeState(finalState);
          writeLocalBackup(finalState);
          await gameApi.saveState(finalState);
          setState(finalState);
          setScreen("squad");
          console.log("[Demonanic Game] NEW PROFILE CREATED");
        }
      }
    } catch (e) {
      console.error("[Demonanic Game] LOAD FAILED:", e);

      // Never silently replace a saved profile with a fresh profile after a
      // network/server error. Use the per-user local backup if available.
      let restored = null;
      if (backupKey) {
        try {
          const raw = localStorage.getItem(backupKey);
          if (raw) restored = normalizeState(JSON.parse(raw));
        } catch (backupError) {
          console.error("[Demonanic Game] LOCAL BACKUP FAILED:", backupError);
        }
      }

      if (restored) {
        setState(restored);
        setScreen(restored.needsSquad ? "squad" : "home");
        // A local backup is still a valid playable profile. Do not block the
        // player on an API outage; the next successful save/load reconnects
        // the server copy.
        setLoadError("");
        console.warn("[Demonanic Game] RESTORED LOCAL BACKUP");
      } else {
        setState(null);
        setLoadError("Unable to load your saved profile. Your game was not replaced.");
      }
    } finally {
      setLoading(false);
    }
  }, [backupKey, user?.id, user?.username, writeLocalBackup]);

  useEffect(() => {
    loadGame();
  }, [loadGame]);

  const scheduleSave = useCallback((s) => {
    writeLocalBackup(s);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      gameApi.saveState(s).then(() => {
        console.log("[Demonanic Game] SAVE OK");
      }).catch((e) => {
        console.error("[Demonanic Game] SAVE FAILED:", e);
      });
    }, 700);
  }, [writeLocalBackup]);

  const mutate = useCallback((fn) => {
    setState((prev) => {
      if (!prev) return prev;
      const clone = structuredClone(prev);
      fn(clone);
      scheduleSave(clone);
      return clone;
    });
  }, [scheduleSave]);

  const saveNow = useCallback(async () => {
    if (!stateRef.current) return false;
    writeLocalBackup(stateRef.current);
    try {
      await gameApi.saveState(stateRef.current);
      console.log("[Demonanic Game] SAVE NOW OK");
      return true;
    } catch (e) {
      console.error("[Demonanic Game] SAVE NOW FAILED:", e);
      return false;
    }
  }, [writeLocalBackup]);

  useEffect(() => {
    if (!state || (screen !== "prep" && screen !== "home")) return;

    const id = setInterval(() => {
      setState((prev) => {
        if (!prev) return prev;
        const clone = structuredClone(prev);
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
  }, [screen, !!state, saveNow, writeLocalBackup]);

  // Research continues while a wave is active. Persist locally each tick and
  // send the full state on the existing low-frequency save cadence.
  useEffect(() => {
    if (!state || screen !== "battle") return;
    const id = setInterval(() => {
      setState((prev) => {
        if (!prev?.libraryResearch) return prev;
        const clone = structuredClone(prev);
        advanceLibraryResearch(clone, 1);
        writeLocalBackup(clone);
        return clone;
      });
    }, 1000);
    const save = setInterval(() => saveNow(), 8000);
    return () => { clearInterval(id); clearInterval(save); };
  }, [screen, !!state, saveNow, writeLocalBackup]);

  return (
    <GameCtx.Provider value={{
      state,
      setState,
      mutate,
      saveNow,
      loading,
      loadError,
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

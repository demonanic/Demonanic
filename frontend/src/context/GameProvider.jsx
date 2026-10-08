import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { gameApi } from "@/api";
import { createNewState, produce } from "@/game/logic";
import { emptyEquipmentState } from "@/game/equipment";
import { normalizePerks } from "@/game/perks";
import { heroDerived } from "@/game/logic";

const GameCtx = createContext(null);
export const useGame = () => useContext(GameCtx);

// Backward-compat for older saves.
function normalizeState(s) {
  if (!s || typeof s !== "object") return s;
  if (!s.bench) s.bench = [];
  if (Array.isArray(s.heroes)) {
    s.heroes.forEach((h) => {
      if (h && !h.id) h.id = `${h.cls || h.key}-${Math.random().toString(36).slice(2)}`;
      if (h) {
        h.perks = normalizePerks(h.cls, h.perks);
        if (!h.abilityCooldowns || typeof h.abilityCooldowns !== "object") h.abilityCooldowns = {};
        h.maxHp = heroDerived(h).maxHp;
        if (h.hp > 0) h.hp = Math.min(h.hp, h.maxHp);
      }
    });
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
        if (data.state._offlineGains && data.state._offlineGains.minutes > 1) {
          setOfflineGains(data.state._offlineGains);
        }
        delete data.state._offlineGains;

        const finalState = normalizeState(data.state);
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
        // A genuinely new account has no server state yet.
        const finalState = createNewState();
        normalizeState(finalState);
        writeLocalBackup(finalState);
        await gameApi.saveState(finalState);
        setState(finalState);
        setScreen("squad");
        console.log("[Demonanic Game] NEW PROFILE CREATED");
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

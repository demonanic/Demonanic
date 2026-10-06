import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { gameApi } from "@/api";
import { createNewState, produce } from "@/game/logic";
import { emptyEquipmentState } from "@/game/equipment";

const GameCtx = createContext(null);
export const useGame = () => useContext(GameCtx);

// backward-compat for older saves (add bench/ids/needsSquad, free-placement towers)
function normalizeState(s) {
  if (!s.bench) s.bench = [];
  if (Array.isArray(s.heroes)) s.heroes.forEach((h) => { if (h && !h.id) h.id = `${h.cls || h.key}-${Math.random().toString(36).slice(2)}`; });
  if (s.needsSquad === undefined) s.needsSquad = !(Array.isArray(s.heroes) && s.heroes.length > 0);
  emptyEquipmentState(s);
  // migrate fixed-slot towers -> free-placement list with x,y
  if (Array.isArray(s.towers)) {
    const defaults = [[60, 180], [360, 180], [60, 300], [360, 300], [210, 205]];
    s.towers = s.towers.filter(Boolean);
    s.towers.forEach((t, i) => {
      if (!t.id) t.id = `tw-${Math.random().toString(36).slice(2)}`;
      if (t.x == null || t.y == null) { const d = defaults[i % 5]; t.x = d[0]; t.y = d[1]; }
    });
  } else s.towers = [];
  return s;
}

export function GameProvider({ children }) {
  const [state, setState] = useState(null);
  const [screen, setScreen] = useState("home"); // home|prep|battle|results|profile|armory
  const [loading, setLoading] = useState(true);
  const [offlineGains, setOfflineGains] = useState(null);
  const [lastResult, setLastResult] = useState(null);
  const stateRef = useRef(null);
  const saveTimer = useRef(null);

  stateRef.current = state;

  // load
  useEffect(() => {
    (async () => {
      try {
        const { data } = await gameApi.getState();
        let finalState;
        if (data.state) {
          if (data.state._offlineGains && data.state._offlineGains.minutes > 1) {
            setOfflineGains(data.state._offlineGains);
          }
          delete data.state._offlineGains;
          finalState = normalizeState(data.state);
        } else {
          finalState = createNewState();
          await gameApi.saveState(finalState);
        }
        setState(finalState);
        if (finalState.needsSquad) setScreen("squad");
      } catch (e) {
        const fresh = createNewState();
        setState(fresh);
        setScreen("squad");
      } finally { setLoading(false); }
    })();
  }, []);

  const scheduleSave = useCallback((s) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { gameApi.saveState(s).catch(() => {}); }, 700);
  }, []);

  // mutate helper: clone -> fn(clone) -> set + save
  const mutate = useCallback((fn) => {
    setState((prev) => {
      const clone = structuredClone(prev);
      fn(clone);
      scheduleSave(clone);
      return clone;
    });
  }, [scheduleSave]);

  const saveNow = useCallback(() => {
    if (stateRef.current) gameApi.saveState(stateRef.current).catch(() => {});
  }, []);

  // live production tick during home & prep (client-side); battle handles its own
  const hasState = !!state;
  useEffect(() => {
    if (!hasState || (screen !== "prep" && screen !== "home")) return;
    const id = setInterval(() => {
      setState((prev) => {
        if (!prev) return prev;
        const clone = structuredClone(prev);
        produce(clone, 1);
        return clone;
      });
    }, 1000);
    const save = setInterval(() => saveNow(), 8000);
    return () => { clearInterval(id); clearInterval(save); };
  }, [screen, hasState, saveNow]);

  return (
    <GameCtx.Provider value={{
      state, setState, mutate, saveNow, loading,
      screen, setScreen, offlineGains, setOfflineGains,
      lastResult, setLastResult,
    }}>
      {children}
    </GameCtx.Provider>
  );
}

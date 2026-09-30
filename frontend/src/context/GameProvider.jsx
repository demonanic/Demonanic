import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { gameApi } from "@/api";
import { createNewState, produce } from "@/game/logic";

const GameCtx = createContext(null);
export const useGame = () => useContext(GameCtx);

export function GameProvider({ children }) {
  const [state, setState] = useState(null);
  const [screen, setScreen] = useState("home"); // home|prep|battle|results|profile
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
        if (data.state) {
          if (data.state._offlineGains && data.state._offlineGains.minutes > 1) {
            setOfflineGains(data.state._offlineGains);
          }
          delete data.state._offlineGains;
          setState(data.state);
        } else {
          const fresh = createNewState();
          setState(fresh);
          await gameApi.saveState(fresh);
        }
      } catch (e) {
        setState(createNewState());
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

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { authApi, apiErr } from "@/api";

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);     // null = loading, false = logged out
  const [error, setError] = useState("");

  const boot = useCallback(async () => {
    const token = localStorage.getItem("dm_token");
    if (!token) { setUser(false); return; }
    try {
      const { data } = await authApi.me();
      setUser(data);
    } catch {
      localStorage.removeItem("dm_token");
      setUser(false);
    }
  }, []);

  useEffect(() => { boot(); }, [boot]);

  const login = async (username, password) => {
    setError("");
    try {
      const { data } = await authApi.login(username, password);
      localStorage.setItem("dm_token", data.token);
      setUser(data.user);
      return true;
    } catch (e) { setError(apiErr(e)); return false; }
  };

  const register = async (username, password) => {
    setError("");
    try {
      const { data } = await authApi.register(username, password);
      localStorage.setItem("dm_token", data.token);
      setUser(data.user);
      return true;
    } catch (e) { setError(apiErr(e)); return false; }
  };

  const logout = () => {
    localStorage.removeItem("dm_token");
    setUser(false);
  };

  return (
    <AuthCtx.Provider value={{ user, error, login, register, logout }}>
      {children}
    </AuthCtx.Provider>
  );
}

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";

import { authApi, apiErr } from "@/api";

const AuthCtx = createContext(null);

export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [error, setError] = useState("");

  const boot = useCallback(async () => {
    const token = localStorage.getItem("dm_token");

    console.log(
      "[Demonanic Auth] BOOT token:",
      token ? "present" : "missing"
    );

    if (!token) {
      setUser(false);
      return;
    }

    try {
      console.log("[Demonanic Auth] BOOT /me starting");

      const { data } = await authApi.me();

      console.log("[Demonanic Auth] BOOT /me SUCCESS");

      if (data && typeof data === "object") {
        localStorage.setItem("dm_user", JSON.stringify(data));
      }
      setUser(data);
    } catch (e) {
      console.error("[Demonanic Auth] BOOT /me FAILED:", {
        status: e?.response?.status,
        code: e?.code,
      });

      const status = e?.response?.status;
      if (status === 401 || status === 403) {
        // Only discard credentials when the backend explicitly rejects them.
        localStorage.removeItem("dm_token");
        localStorage.removeItem("dm_user");
        setUser(false);
        return;
      }

      // A timeout/network/server failure is not proof that the session expired.
      // Keep the token and use the last known user identity so GameProvider can
      // attempt server loading and its per-user local backup recovery.
      try {
        const cachedUser = JSON.parse(localStorage.getItem("dm_user") || "null");
        if (cachedUser && typeof cachedUser === "object" && cachedUser.id) {
          console.warn("[Demonanic Auth] RESTORING CACHED USER AFTER TEMPORARY AUTH FAILURE");
          setUser(cachedUser);
          return;
        }
      } catch {
        console.error("[Demonanic Auth] CACHED USER READ FAILED");
      }

      // Older installations may not have a cached user. Preserve the token,
      // but ask the player to log in instead of silently registering a new profile.
      setUser(false);
    }
  }, []);

  useEffect(() => {
    boot();
  }, [boot]);

  const login = async (username, password) => {
    setError("");

    console.log("[Demonanic Auth] LOGIN START");

    try {
      const { data } = await authApi.login(username, password);

      console.log("[Demonanic Auth] LOGIN SUCCESS");

      localStorage.setItem("dm_token", data.token);
      if (data.user && typeof data.user === "object") {
        localStorage.setItem("dm_user", JSON.stringify(data.user));
      }
      console.log("[Demonanic Auth] TOKEN SAVED");

      setUser(data.user);
      return true;
    } catch (e) {
      console.error("[Demonanic Auth] LOGIN FAILED:", {
        status: e?.response?.status,
        code: e?.code,
      });
      const message = apiErr(e);
      setError(message);
      return false;
    }
  };

  const register = async (username, password) => {
    setError("");

    console.log("[Demonanic Auth] REGISTER START");

    try {
      const { data } = await authApi.register(username, password);

      console.log("[Demonanic Auth] REGISTER SUCCESS");

      localStorage.setItem("dm_token", data.token);
      if (data.user && typeof data.user === "object") {
        localStorage.setItem("dm_user", JSON.stringify(data.user));
      }
      setUser(data.user);
      return true;
    } catch (e) {
      console.error("[Demonanic Auth] REGISTER FAILED:", {
        status: e?.response?.status,
        code: e?.code,
      });
      setError(apiErr(e));
      return false;
    }
  };

  const logout = () => {
    console.log("[Demonanic Auth] LOGOUT");
    localStorage.removeItem("dm_token");
    localStorage.removeItem("dm_user");
    setUser(false);
  };

  return (
    <AuthCtx.Provider value={{ user, error, login, register, logout }}>
      {children}
    </AuthCtx.Provider>
  );
}

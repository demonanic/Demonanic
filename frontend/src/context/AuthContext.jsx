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

      console.log("[Demonanic Auth] BOOT /me SUCCESS:", data);

      setUser(data);
    } catch (e) {
      console.error("[Demonanic Auth] BOOT /me FAILED:", e);

      localStorage.removeItem("dm_token");
      setUser(false);
    }
  }, []);

  useEffect(() => {
    boot();
  }, [boot]);

  const login = async (username, password) => {
    setError("");

    console.log("[Demonanic Auth] LOGIN START:", {
      username,
      passwordLength: password?.length || 0,
    });

    try {
      const { data } = await authApi.login(
        username,
        password
      );

      console.log(
        "[Demonanic Auth] LOGIN SUCCESS:",
        data
      );

      localStorage.setItem("dm_token", data.token);

      console.log(
        "[Demonanic Auth] TOKEN SAVED"
      );

      setUser(data.user);

      return true;
    } catch (e) {
      console.error(
        "[Demonanic Auth] LOGIN FAILED:",
        e
      );

      const message = apiErr(e);

      console.error(
        "[Demonanic Auth] DISPLAY ERROR:",
        message
      );

      setError(message);

      return false;
    }
  };

  const register = async (username, password) => {
    setError("");

    console.log("[Demonanic Auth] REGISTER START:", {
      username,
      passwordLength: password?.length || 0,
    });

    try {
      const { data } = await authApi.register(
        username,
        password
      );

      console.log(
        "[Demonanic Auth] REGISTER SUCCESS:",
        data
      );

      localStorage.setItem("dm_token", data.token);

      setUser(data.user);

      return true;
    } catch (e) {
      console.error(
        "[Demonanic Auth] REGISTER FAILED:",
        e
      );

      setError(apiErr(e));

      return false;
    }
  };

  const logout = () => {
    console.log("[Demonanic Auth] LOGOUT");

    localStorage.removeItem("dm_token");
    setUser(false);
  };

  return (
    <AuthCtx.Provider
      value={{
        user,
        error,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthCtx.Provider>
  );
}

import axios from "axios";
import { resolveApiBaseUrl } from "./apiConfig";
import { serializeGameState } from "./game/heroModel";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = resolveApiBaseUrl(BACKEND_URL);

const BACKEND_HOST = API ? new URL(API).hostname : "unconfigured";
console.log("[Demonanic] BACKEND_HOST:", BACKEND_HOST);

const client = axios.create({
  baseURL: API,
  timeout: 30000,
});

client.interceptors.request.use(
  (cfg) => {
    if (!API) return Promise.reject(new Error("Backend URL is not configured."));
    const token = localStorage.getItem("dm_token");

    console.log("[Demonanic API] REQUEST:", {
      method: cfg.method,
      url: `${cfg.baseURL}${cfg.url}`,
      hasToken: !!token,
    });

    if (token) {
      cfg.headers.Authorization = `Bearer ${token}`;
    }

    return cfg;
  },
  (error) => {
    console.error("[Demonanic API] REQUEST SETUP ERROR:", error);
    return Promise.reject(error);
  }
);

client.interceptors.response.use(
  (response) => {
    console.log("[Demonanic API] RESPONSE:", {
      status: response.status,
      url: response.config?.url,
    });

    return response;
  },
  (error) => {
    console.error("[Demonanic API] RESPONSE ERROR:", {
      code: error?.code,
      status: error?.response?.status,
      url: error?.config?.url,
      baseURL: error?.config?.baseURL,
    });

    return Promise.reject(error);
  }
);

export function apiErr(e) {
  const d = e?.response?.data?.detail;

  if (typeof d === "string") return d;

  if (Array.isArray(d)) {
    return d
      .map((x) => x?.msg || JSON.stringify(x))
      .join(" ");
  }

  if (e?.code === "ECONNABORTED") {
    return "Request timed out";
  }

  if (e?.code === "ERR_NETWORK") {
    return "Network Error";
  }

  return e?.message || "Request failed";
}

export const authApi = {
  register: (username, password) =>
    client.post("/auth/register", {
      username,
      password,
    }),

  login: (username, password) =>
    client.post("/auth/login", {
      username,
      password,
    }),

  me: () =>
    client.get("/auth/me"),
};

export const gameApi = {
  getState: () =>
    client.get("/game/state"),

  createState: (state) =>
    client.post("/game/state", { state: serializeGameState(state) }),

  saveState: (state) =>
    client.put("/game/state", {
      state: serializeGameState(state),
    }),

  reward: (
    reward_type,
    provider = "mock_admob",
    context = {}
  ) =>
    client.post("/monetization/reward", {
      reward_type,
      provider,
      context,
    }),
};

export default client;

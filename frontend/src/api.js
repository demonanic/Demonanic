import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export const API = `${BACKEND_URL}/api`;

console.log("[Demonanic] BACKEND_URL:", BACKEND_URL);
console.log("[Demonanic] API:", API);

const client = axios.create({
  baseURL: API,
  timeout: 30000,
});

client.interceptors.request.use(
  (cfg) => {
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
      message: error?.message,
      code: error?.code,
      status: error?.response?.status,
      responseData: error?.response?.data,
      url: error?.config?.url,
      baseURL: error?.config?.baseURL,
    });

    return Promise.reject(error);
  }
);

export function apiErr(e) {
  console.error("[Demonanic API] apiErr:", e);

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

  saveState: (state) =>
    client.put("/game/state", {
      state,
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

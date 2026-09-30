import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

const client = axios.create({ baseURL: API });

client.interceptors.request.use((cfg) => {
  const token = localStorage.getItem("dm_token");
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

export function apiErr(e) {
  const d = e?.response?.data?.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map((x) => x?.msg || JSON.stringify(x)).join(" ");
  return e?.message || "Request failed";
}

export const authApi = {
  register: (username, password) => client.post("/auth/register", { username, password }),
  login: (username, password) => client.post("/auth/login", { username, password }),
  me: () => client.get("/auth/me"),
};

export const gameApi = {
  getState: () => client.get("/game/state"),
  saveState: (state) => client.put("/game/state", { state }),
  reward: (reward_type, provider = "mock_admob", context = {}) =>
    client.post("/monetization/reward", { reward_type, provider, context }),
};

export default client;

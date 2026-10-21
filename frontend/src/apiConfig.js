export function resolveApiBaseUrl(configuredBackendUrl) {
  if (typeof configuredBackendUrl !== "string" || !configuredBackendUrl.trim()) return null;
  try {
    const url = new URL(configuredBackendUrl.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (url.username || url.password || url.search || url.hash) return null;
    const path = url.pathname.replace(/\/+$/, "");
    return `${url.origin}${path}/api`;
  } catch (error) {
    return null;
  }
}

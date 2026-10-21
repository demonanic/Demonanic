const EXPECTED_BACKEND_ORIGIN = "https://demonanic.onrender.com";

function validateAndroidBackendUrl(configuredUrl) {
  if (typeof configuredUrl !== "string" || !configuredUrl.trim()) {
    return {
      valid: false,
      error: "REACT_APP_BACKEND_URL is required for Android production builds.",
    };
  }

  let parsed;
  try {
    parsed = new URL(configuredUrl.trim());
  } catch {
    return {
      valid: false,
      error: "REACT_APP_BACKEND_URL must be a valid HTTPS URL.",
    };
  }

  if (
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    parsed.origin !== EXPECTED_BACKEND_ORIGIN ||
    (parsed.pathname !== "/" && parsed.pathname !== "")
  ) {
    return {
      valid: false,
      error: `Android production builds require the configured HTTPS backend ${new URL(EXPECTED_BACKEND_ORIGIN).hostname}.`,
    };
  }

  return { valid: true, hostname: parsed.hostname };
}

if (require.main === module) {
  const result = validateAndroidBackendUrl(process.env.REACT_APP_BACKEND_URL);
  if (!result.valid) {
    console.error(`Android production build blocked: ${result.error}`);
    process.exitCode = 1;
  } else {
    console.log(`Android production backend configured: ${result.hostname}`);
  }
}

module.exports = { EXPECTED_BACKEND_ORIGIN, validateAndroidBackendUrl };

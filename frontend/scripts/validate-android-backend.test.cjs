const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const test = require("node:test");
const { EXPECTED_BACKEND_ORIGIN, validateAndroidBackendUrl } = require("./validate-android-backend.cjs");

const validatorPath = path.join(__dirname, "validate-android-backend.cjs");

test("accepts the expected production backend hostname", () => {
  assert.deepEqual(
    validateAndroidBackendUrl(`${EXPECTED_BACKEND_ORIGIN}/`),
    { valid: true, hostname: "demonanic.onrender.com" },
  );
});

test("missing configuration fails the Android build with a clear message", () => {
  const env = { ...process.env };
  delete env.REACT_APP_BACKEND_URL;
  const result = spawnSync(process.execPath, [validatorPath], { env, encoding: "utf8" });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /REACT_APP_BACKEND_URL is required/);
});

test("rejects malformed, insecure, local, unrelated, and credential-bearing URLs", () => {
  for (const value of [
    "not a URL",
    "http://demonanic.onrender.com",
    "https://localhost:8000",
    "https://other.example.com",
    "https://user:password@demonanic.onrender.com",
    "https://demonanic.onrender.com/api",
  ]) {
    assert.equal(validateAndroidBackendUrl(value).valid, false, `accepted ${value}`);
  }
});

test("rejects an absent configuration without substituting localhost", () => {
  const result = validateAndroidBackendUrl(undefined);
  assert.equal(result.valid, false);
  assert.match(result.error, /required/);
  assert.doesNotMatch(JSON.stringify(result), /localhost/);
});

import { resolveApiBaseUrl } from "./apiConfig";

describe("backend API configuration", () => {
  test("builds the API base from a configured HTTP(S) origin", () => {
    expect(resolveApiBaseUrl("https://demonanic.onrender.com/")).toBe("https://demonanic.onrender.com/api");
  });

  test.each([undefined, null, "", "   ", "not a URL", "file:///tmp/backend", "https://user:pass@example.com"])(
    "rejects a missing or invalid backend URL (%p)",
    (value) => {
      expect(resolveApiBaseUrl(value)).toBeNull();
    },
  );
});

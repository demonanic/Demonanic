import { isRewardedAdConfirmed } from "./rewards";

describe("rewarded-ad confirmation", () => {
  test.each([
    ["request accepted only", { granted: true }],
    ["mock reward", { granted: true, completed: true, verified: true, mock: true }],
    ["loading response", { loading: true }],
    ["cancelled response", { cancelled: true }],
    ["failed response", { granted: false, completed: false }],
  ])("rejects %s", (_label, data) => {
    expect(isRewardedAdConfirmed(data)).toBe(false);
  });

  test("accepts only a verified, completed, non-mock reward", () => {
    expect(isRewardedAdConfirmed({ granted: true, completed: true, verified: true, mock: false })).toBe(true);
  });
});

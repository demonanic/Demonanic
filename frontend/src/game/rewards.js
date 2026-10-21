export function isRewardedAdConfirmed(data) {
  return data?.granted === true && data?.completed === true &&
    data?.verified === true && data?.mock !== true;
}

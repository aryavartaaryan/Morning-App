export const TAB_BAR_BASE_CLEARANCE = 112;
export const TAB_BAR_PLAYER_CLEARANCE = 68;
export const TAB_BAR_STEP_CLEARANCE = 62; // height of GlobalStepTracker bar

export function getTabBarClearance(bottomInset: number, hasPlayer = false, hasStepBar = false) {
  return (
    bottomInset +
    TAB_BAR_BASE_CLEARANCE +
    (hasPlayer   ? TAB_BAR_PLAYER_CLEARANCE : 0) +
    (hasStepBar  ? TAB_BAR_STEP_CLEARANCE   : 0)
  );
}

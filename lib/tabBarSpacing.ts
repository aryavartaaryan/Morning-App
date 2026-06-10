export const TAB_BAR_BASE_CLEARANCE = 112;
export const TAB_BAR_PLAYER_CLEARANCE = 68;

export function getTabBarClearance(bottomInset: number, hasPlayer = false) {
  return bottomInset + TAB_BAR_BASE_CLEARANCE + (hasPlayer ? TAB_BAR_PLAYER_CLEARANCE : 0);
}

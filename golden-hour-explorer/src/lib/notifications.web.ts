// Web stub — expo-notifications local alerts are not available in browsers.
export function configureNotifications(): void {}
export async function ensureNotificationPermission(): Promise<boolean> {
  return false;
}
export async function scheduleGoldenHourAlert(
  _name: string,
  _at: Date,
  _before?: number,
): Promise<string | null> {
  return null;
}

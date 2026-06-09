import * as Notifications from "expo-notifications";
import { SchedulableTriggerInputTypes } from "expo-notifications";

/** Foreground display behaviour. Call once at app start. */
export function configureNotifications(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export async function ensureNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const req = await Notifications.requestPermissionsAsync();
  return req.granted;
}

/**
 * Schedule a local "X minutes to golden hour" reminder. Returns the
 * notification id, or null if the moment has already passed.
 */
export async function scheduleGoldenHourAlert(
  spotName: string,
  goldenHourAt: Date,
  minutesBefore = 15,
): Promise<string | null> {
  const fireAt = new Date(goldenHourAt.getTime() - minutesBefore * 60_000);
  if (fireAt.getTime() <= Date.now()) return null;

  const granted = await ensureNotificationPermission();
  if (!granted) return null;

  return Notifications.scheduleNotificationAsync({
    content: {
      title: `${minutesBefore} min to golden hour`,
      body: `Golden hour at ${spotName} is about to start — time to head out.`,
    },
    trigger: { type: SchedulableTriggerInputTypes.DATE, date: fireAt },
  });
}

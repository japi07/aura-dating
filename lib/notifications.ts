/**
 * Notifications service: register push token + schedule local reminders.
 */
import * as Notifications from 'expo-notifications';
import { localTimeOfNextOpen } from './daily-window';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'expoPushToken';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Request notification permissions + get an Expo push token.
 * Should be called once after the user signs in.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Aura',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FD3A5C',
    });
    await Notifications.setNotificationChannelAsync('proposals', {
      name: 'Daily proposals',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
    });
    await Notifications.setNotificationChannelAsync('dates', {
      name: 'Date reminders',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'default',
    });
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let final = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    final = status;
  }
  if (final !== 'granted') return null;

  try {
    const token = (await Notifications.getExpoPushTokenAsync()).data;
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    return token;
  } catch {
    return null;
  }
}

/** Schedule a local reminder for a confirmed date — fires 2h + 30m before */
export async function scheduleDateReminders(args: {
  dateId: string;
  with: string;
  venue: string;
  startsAt: Date;
}): Promise<string[]> {
  const ids: string[] = [];
  const now = Date.now();

  const offsets: { mins: number; copy: string }[] = [
    { mins: 120, copy: `Date with ${args.with} at ${args.venue} in 2 hours ✨` },
    { mins: 30, copy: `${args.with} in 30 min — ${args.venue}. You've got this 💕` },
  ];

  for (const o of offsets) {
    const triggerTime = args.startsAt.getTime() - o.mins * 60 * 1000;
    if (triggerTime <= now + 60 * 1000) continue; // skip if too close
    try {
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Aura',
          body: o.copy,
          data: { dateId: args.dateId },
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: new Date(triggerTime),
        },
      });
      ids.push(id);
    } catch {}
  }
  return ids;
}

/** Cancel reminders for a cancelled date */
export async function cancelReminders(reminderIds: string[]) {
  for (const id of reminderIds) {
    try { await Notifications.cancelScheduledNotificationAsync(id); } catch {}
  }
}

/**
 * Tell the phone when tonight's window opens.
 *
 * Replaces a 9 AM "your proposals are ready" ping left over from the model
 * where one proposal arrived each morning. Nothing happens at 9 AM any more:
 * everything now starts in a two-hour evening window, and a notification
 * pointing at the wrong hour is worse than none.
 *
 * Scheduled locally rather than pushed. There is no scheduler in this
 * project, and a daily trigger on the device needs no server, survives being
 * offline, and cannot be late. The hour comes from the window itself, so the
 * two can never drift apart.
 */
export async function scheduleWindowOpenReminder(): Promise<string | null> {
  try {
    const { hour, minute } = localTimeOfNextOpen();

    // Cancel any previous one first
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const n of scheduled) {
      const t = (n.content.data as any)?.type;
      // Clears the retired 9 AM reminder too, so anyone upgrading stops
      // being pinged at an hour when nothing happens.
      if (t === 'window-open' || t === 'daily-proposals') {
        await Notifications.cancelScheduledNotificationAsync(n.identifier);
      }
    }
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: "Tonight's window is open ✨",
        body: 'Two hours to start something. A call, a blind date, or ask someone out.',
        data: { type: 'window-open' },
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
      },
    });
    return id;
  } catch {
    return null;
  }
}

export async function getStoredPushToken() {
  try { return await SecureStore.getItemAsync(TOKEN_KEY); } catch { return null; }
}

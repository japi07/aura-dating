/**
 * Notifications service: register push token + schedule local reminders.
 */
import * as Notifications from 'expo-notifications';
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

/** Schedule the daily 9 AM "your proposals are ready" ping */
export async function scheduleDailyProposalReminder(): Promise<string | null> {
  try {
    // Cancel existing daily reminder first
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const n of scheduled) {
      if (n.content.data && (n.content.data as any).type === 'daily-proposals') {
        await Notifications.cancelScheduledNotificationAsync(n.identifier);
      }
    }
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Your proposals are ready ✨',
        body: 'Curated by hand. Open Aura to see who wants to take you out today.',
        data: { type: 'daily-proposals' },
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: 9,
        minute: 0,
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

/**
 * Calendar service — adds confirmed dates to the user's device calendar.
 */
import * as Calendar from 'expo-calendar';
import { Platform, Alert } from 'react-native';

interface DateEvent {
  title: string;
  notes?: string;
  location?: string;
  startsAt: Date;
  durationMinutes?: number;
}

/** Get a writable calendar id (creating one if necessary on iOS) */
async function getDefaultCalendarId(): Promise<string | null> {
  try {
    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    if (Platform.OS === 'ios') {
      const def = await Calendar.getDefaultCalendarAsync();
      return def.id;
    }
    const writable = calendars.find(c => c.allowsModifications) || calendars[0];
    return writable?.id ?? null;
  } catch {
    return null;
  }
}

export async function addDateToCalendar(event: DateEvent): Promise<boolean> {
  try {
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Calendar permission needed',
        'Allow Aura to add your dates so you never miss one.',
      );
      return false;
    }

    const calendarId = await getDefaultCalendarId();
    if (!calendarId) {
      Alert.alert('Could not access calendar');
      return false;
    }

    const start = event.startsAt;
    const end = new Date(start.getTime() + (event.durationMinutes ?? 90) * 60 * 1000);

    await Calendar.createEventAsync(calendarId, {
      title: event.title,
      notes: event.notes,
      location: event.location,
      startDate: start,
      endDate: end,
      alarms: [{ relativeOffset: -120 }, { relativeOffset: -30 }], // 2h + 30min
      timeZone: 'Europe/London',
    });
    return true;
  } catch (e) {
    Alert.alert('Could not add to calendar', 'Please try again.');
    return false;
  }
}

/**
 * The nightly window.
 *
 * Aura is not a place you graze. Everything that starts something — joining a
 * call queue, entering the blind pool, sending a proposal — is only possible
 * between 19:00 and 21:00. Outside those two hours the app still shows you
 * your existing dates and messages; you simply cannot begin anything new.
 *
 * Two consequences worth being deliberate about:
 *
 *  - The hours are London hours, not the phone's. A member travelling, or one
 *    whose phone is set to the wrong zone, has to see the same window as the
 *    person they might be matched with, or the call queue never fills.
 *  - This is a product rule, not a security boundary. It shapes the UI and the
 *    matcher, but a determined client could still call the API outside the
 *    window. That is fine for what it is; nothing here protects anything.
 */

import Constants from 'expo-constants';

/**
 * Testing escape hatch.
 *
 * A two-hour window is unarguable in production and miserable in testing —
 * it means nobody can try any of the three modes outside one slot a day.
 * This reads from expo extra rather than a build constant precisely so it
 * can be flipped in an over-the-air update: turn it on for a testing
 * session, turn it off again, no rebuild either way.
 *
 * Development builds are always open, because waiting until 19:00 to check
 * a layout is absurd.
 */
const alwaysOpen =
  __DEV__ ||
  (Constants.expoConfig?.extra as { windowAlwaysOpen?: boolean } | undefined)
    ?.windowAlwaysOpen === true;

/** True when the window is being bypassed rather than genuinely open. */
export const windowOverridden = alwaysOpen;

/**
 * TESTING HOURS. The product design is 19:00-21:00 - two hours, everyone at
 * once, scarcity doing the work. Nine to nine is deliberately wide so a
 * handful of testers in one city can actually bump into each other, which a
 * two-hour slot makes almost impossible at this scale.
 *
 * Put this back to 19 before there are real members. The countdown, the
 * gating and the copy all read from these two numbers, so it is the only
 * edit needed.
 */
export const WINDOW_OPEN_HOUR = 9;
export const WINDOW_CLOSE_HOUR = 21;
export const WINDOW_TIMEZONE = 'Europe/London';

export interface WindowState {
  open: boolean;
  /** Seconds until 19:00. Zero while open. */
  secondsUntilOpen: number;
  /** Seconds until 21:00. Zero while closed. */
  secondsUntilClose: number;
  /** The instant the state changes next, for scheduling a notification */
  nextChangeAt: Date;
}

interface Parts { y: number; mo: number; d: number; h: number; mi: number; s: number }

/**
 * London wall-clock time for a given instant.
 *
 * Falls back to the device's own clock if Intl time zones are unavailable —
 * on a London phone that is the same answer, and a wrong countdown is a better
 * failure than a crash on the home screen.
 */
function londonParts(at: Date): Parts {
  try {
    const fmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: WINDOW_TIMEZONE,
      hour12: false,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    const p: Record<string, string> = {};
    for (const part of fmt.formatToParts(at)) p[part.type] = part.value;
    return {
      y: +p.year,
      mo: +p.month,
      d: +p.day,
      // Some engines render midnight as 24 under hour12: false
      h: +p.hour % 24,
      mi: +p.minute,
      s: +p.second,
    };
  } catch {
    return {
      y: at.getFullYear(), mo: at.getMonth() + 1, d: at.getDate(),
      h: at.getHours(), mi: at.getMinutes(), s: at.getSeconds(),
    };
  }
}

/**
 * The instant at which London's wall clock reads the given time.
 *
 * Solved by iteration rather than a fixed offset: the gap between London and
 * UTC changes twice a year, and on those two days a hardcoded offset puts the
 * window an hour out.
 */
function londonWallClockToInstant(y: number, mo: number, d: number, h: number): Date {
  const target = Date.UTC(y, mo - 1, d, h, 0, 0);
  let guess = target;
  // Two passes converge even across a DST boundary
  for (let i = 0; i < 2; i++) {
    const p = londonParts(new Date(guess));
    const guessReadsAs = Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s);
    guess += target - guessReadsAs;
  }
  return new Date(guess);
}

export function getWindowState(now: Date = new Date()): WindowState {
  const p = londonParts(now);
  const open = alwaysOpen || (p.h >= WINDOW_OPEN_HOUR && p.h < WINDOW_CLOSE_HOUR);

  if (open) {
    // When overridden outside the real hours, today's close is already past;
    // clamping at zero beats rendering a negative countdown.
    const closeAt = londonWallClockToInstant(p.y, p.mo, p.d, WINDOW_CLOSE_HOUR);
    return {
      open: true,
      secondsUntilOpen: 0,
      secondsUntilClose: Math.max(0, Math.round((closeAt.getTime() - now.getTime()) / 1000)),
      nextChangeAt: closeAt,
    };
  }

  // Before 19:00 it opens today; after 21:00 it opens tomorrow.
  let openAt = londonWallClockToInstant(p.y, p.mo, p.d, WINDOW_OPEN_HOUR);
  if (openAt.getTime() <= now.getTime()) {
    const tomorrow = new Date(now.getTime() + 24 * 3600 * 1000);
    const t = londonParts(tomorrow);
    openAt = londonWallClockToInstant(t.y, t.mo, t.d, WINDOW_OPEN_HOUR);
  }

  return {
    open: false,
    secondsUntilOpen: Math.max(0, Math.round((openAt.getTime() - now.getTime()) / 1000)),
    secondsUntilClose: 0,
    nextChangeAt: openAt,
  };
}

export function isWindowOpen(now: Date = new Date()): boolean {
  return getWindowState(now).open;
}

/** "19:00" — for copy that names the hour rather than counting to it */
export const WINDOW_LABEL = `${WINDOW_OPEN_HOUR}:00`;
export const WINDOW_RANGE_LABEL = `${WINDOW_OPEN_HOUR}:00–${WINDOW_CLOSE_HOUR}:00`;

/** 03:22:15 — the big countdown */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

/** "3h 22m" / "22m" / "45s" — inline copy */
export function formatShort(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds);
  if (s >= 3600) {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  if (s >= 60) return `${Math.floor(s / 60)}m`;
  return `${s}s`;
}

/** The one-liner every gated screen shows when it turns someone away. */
export function closedMessage(secondsUntilOpen: number): string {
  return `Tonight's window opens at ${WINDOW_LABEL} — ${formatShort(secondsUntilOpen)} to go.`;
}

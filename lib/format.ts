/**
 * UK locale-friendly formatting helpers.
 * Avoids dragging in date-fns just for these few cases.
 */

const FMT_DAY: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'short', day: 'numeric' };
const FMT_TIME: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit', hour12: false };
const FMT_RELATIVE: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' };

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', FMT_DAY);
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', FMT_TIME);
}

export function formatDateTime(iso: string): string {
  return `${formatDate(iso)} · ${formatTime(iso)}`;
}

export function formatShort(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', FMT_RELATIVE);
}

/**
 * Friendly countdown: "In 2 hours", "Tomorrow", "Friday", "In 3 days"
 */
export function formatCountdown(iso: string): string {
  const target = new Date(iso).getTime();
  const now = Date.now();
  const diff = target - now;

  if (diff < 0) {
    const past = Math.abs(diff);
    if (past < 60 * 60 * 1000) return 'Just now';
    if (past < 24 * 60 * 60 * 1000) return 'Earlier today';
    return formatShort(iso);
  }

  const minutes = Math.floor(diff / (60 * 1000));
  const hours = Math.floor(diff / (60 * 60 * 1000));
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));

  if (minutes < 60) return `In ${minutes} min`;
  if (hours < 6) return `In ${hours} ${hours === 1 ? 'hour' : 'hours'}`;

  const targetD = new Date(iso);
  const today = new Date();
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  if (targetD.toDateString() === today.toDateString()) return 'Today';
  if (targetD.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
  if (days < 7) return targetD.toLocaleDateString('en-GB', { weekday: 'long' });
  return formatShort(iso);
}

/** Greeting based on London time of day */
export function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

/** Today's date — "Sunday, 26 April" */
export function todayLong(): string {
  return new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
}

/** "He'll pay" / "Split equally" / "She'll pay" */
export function paymentLabel(p: 'he-pays' | 'split' | 'she-pays'): string {
  switch (p) {
    case 'he-pays': return 'He\'ll pay';
    case 'split': return 'Split equally';
    case 'she-pays': return 'You\'ll pay';
  }
}

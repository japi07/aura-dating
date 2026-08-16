/**
 * Live call transport (Daily.co).
 *
 * WHY THIS FILE EXISTS AS A SEAM
 * Every real option for live audio/video on React Native — Daily, LiveKit,
 * Agora, raw WebRTC — is a native module, so none of them can reach existing
 * installs over-the-air. Opening a web call inside expo-web-browser is not a
 * workaround: SFSafariViewController silently auto-denies camera and mic.
 *
 * So everything around the call (queue, matching, the private post-call
 * outcome, creating the real date) ships now, and only the ~90 seconds of
 * actual audio waits for the next binary. This module is the boundary.
 *
 * Follows the same defensive lazy-require pattern as lib/attachment-picker.ts
 * and lib/purchases.ts: read paths degrade silently, write paths throw a
 * human-readable error. A static import here would crash every screen that
 * touches it on the current build — that has already happened once with
 * expo-web-browser and took down the Events tab.
 */
import Constants from 'expo-constants';

const extra = (Constants.expoConfig?.extra ?? {}) as { dailyEnabled?: boolean };

let Daily: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  Daily = require('@daily-co/react-native-daily-js');
} catch {
  Daily = null;
}

/**
 * True only when the native SDK is actually in this binary. Screens must
 * branch on this rather than assuming calls work.
 */
export const callTransportAvailable = !!Daily?.createCallObject && extra.dailyEnabled !== false;

export const CALL_UNAVAILABLE_MESSAGE =
  'Live calls arrive in the next app update.';

export interface CallSession {
  join(roomUrl: string, token?: string): Promise<void>;
  leave(): Promise<void>;
  setMuted(muted: boolean): Promise<void>;
  setCameraOn(on: boolean): Promise<void>;
  on(event: 'joined' | 'left' | 'participant-joined' | 'error', cb: (e?: any) => void): void;
  destroy(): Promise<void>;
}

/**
 * Create a call session. Throws a friendly error on builds without the SDK —
 * callers should check callTransportAvailable first and show the waitlist
 * state instead of relying on this throwing.
 */
export async function createCallSession(): Promise<CallSession> {
  if (!callTransportAvailable) throw new Error(CALL_UNAVAILABLE_MESSAGE);

  const call = Daily.createCallObject({
    audioSource: true,
    videoSource: false,
  });

  return {
    async join(roomUrl: string, token?: string) {
      await call.join({ url: roomUrl, token });
    },
    async leave() {
      await call.leave();
    },
    async setMuted(muted: boolean) {
      await call.setLocalAudio(!muted);
    },
    async setCameraOn(on: boolean) {
      await call.setLocalVideo(on);
    },
    on(event, cb) {
      const map: Record<string, string> = {
        joined: 'joined-meeting',
        left: 'left-meeting',
        'participant-joined': 'participant-joined',
        error: 'error',
      };
      call.on(map[event] ?? event, cb);
    },
    async destroy() {
      await call.destroy();
    },
  };
}

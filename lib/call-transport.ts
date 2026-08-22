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
 * outcome, creating the real date) ships now, and only the minutes of actual
 * audio wait for the next binary. This module is the boundary.
 *
 * Follows the same defensive lazy-require pattern as lib/attachment-picker.ts
 * and lib/purchases.ts: read paths degrade silently, write paths throw a
 * human-readable error. A static import here would crash every screen that
 * touches it on the current build — that has already happened once with
 * expo-web-browser and took down the Events tab.
 *
 * TWO RUNTIME CONFLICTS TO RESPECT (iOS, both real):
 *  - AVAudioSession is process-wide and WebRTC assumes it owns it. Do not play
 *    an expo-video with sound while a call is live, or it gets ducked to the
 *    earpiece and sometimes stays quiet afterwards.
 *  - expo-camera and Daily cannot both hold the mic or camera. The verify and
 *    video-intro screens must be unmounted before joining, and vice versa.
 */
import { NativeModules } from 'react-native';
import Constants from 'expo-constants';

const extra = (Constants.expoConfig?.extra ?? {}) as { dailyEnabled?: boolean };

/**
 * Check the native side BEFORE importing, not after.
 *
 * Since the SDK is in package.json its JavaScript now rides along in every OTA
 * update, including updates delivered to binaries built before it existed. So
 * the JS resolving proves nothing. Worse, the module builds a NativeEventEmitter
 * over WebRTCModule at import time, which throws an invariant on iOS when the
 * native module is missing — so a plain require() here would be an exception on
 * every launch of the current TestFlight build.
 *
 * These two module names are what the Daily and WebRTC pods register, and they
 * only exist in a binary that actually shipped the native code.
 */
const nativeSideIsPresent =
  !!NativeModules.DailyNativeUtils && !!NativeModules.WebRTCModule;

let Daily: any = null;
if (nativeSideIsPresent) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('@daily-co/react-native-daily-js');
    Daily = mod?.default ?? mod;
  } catch {
    Daily = null;
  }
}

/**
 * True only when the native SDK is actually in this binary. Screens must
 * branch on this rather than assuming calls work.
 */
export const callTransportAvailable =
  !!Daily?.createCallObject && extra.dailyEnabled !== false;

export const CALL_UNAVAILABLE_MESSAGE = 'Live calls arrive in the next app update.';

export type CallEvent =
  | 'joined'
  | 'left'
  | 'participant-joined'
  | 'participant-left'
  | 'error';

export interface JoinOptions {
  roomUrl: string;
  token: string;
  /** Pinned server-side by the meeting token; passed for the local UI only */
  displayName?: string;
  video?: boolean;
}

export interface CallSession {
  join(opts: JoinOptions): Promise<void>;
  leave(): Promise<void>;
  setMuted(muted: boolean): void;
  isMuted(): boolean;
  setSpeakerOn(on: boolean): Promise<void>;
  setCameraOn(on: boolean): void;
  on(event: CallEvent, cb: (e?: any) => void): void;
  destroy(): Promise<void>;
}

/**
 * Create a call session. Throws a friendly error on builds without the SDK —
 * callers should check callTransportAvailable first and show the waiting state
 * instead of relying on this throwing.
 */
export async function createCallSession(medium: 'audio' | 'video' = 'audio'): Promise<CallSession> {
  if (!callTransportAvailable) throw new Error(CALL_UNAVAILABLE_MESSAGE);

  const video = medium === 'video';

  // createCallObject is a singleton and throws on a second call. A screen that
  // was force-closed mid-call can leave one behind, so reclaim it rather than
  // failing the next join.
  let call = Daily.getCallInstance?.();
  if (call && !call.isDestroyed?.()) {
    try { await call.destroy(); } catch { /* already gone */ }
    call = null;
  }

  call = Daily.createCallObject({
    audioSource: true,
    videoSource: video,
    subscribeToTracksAutomatically: true,
  });

  // 'voice' routes to the earpiece like a phone call; 'video' uses the
  // loudspeaker. Getting this wrong makes an audio date feel like a webinar.
  try { call.setNativeInCallAudioMode(video ? 'video' : 'voice'); } catch { /* older SDKs */ }

  return {
    async join({ roomUrl, token, displayName, video: withVideo }) {
      await call.join({
        url: roomUrl,
        token,
        startVideoOff: !(withVideo ?? video),
        startAudioOff: false,
        userName: displayName,
      });
    },
    async leave() {
      try { await call.leave(); } catch { /* already left, or ejected by Daily */ }
    },
    setMuted(muted: boolean) {
      call.setLocalAudio(!muted); // synchronous and chainable, not a promise
    },
    isMuted() {
      return !call.localAudio();
    },
    async setSpeakerOn(on: boolean) {
      try {
        await call.setAudioDevice(on ? 'speakerphone' : 'earpiece');
      } catch {
        // Device names vary by platform; fall back to the audio mode switch
        try { call.setNativeInCallAudioMode(on ? 'video' : 'voice'); } catch { /* noop */ }
      }
    },
    setCameraOn(on: boolean) {
      call.setLocalVideo(on);
    },
    on(event, cb) {
      const map: Record<CallEvent, string> = {
        joined: 'joined-meeting',
        left: 'left-meeting',
        'participant-joined': 'participant-joined',
        'participant-left': 'participant-left',
        error: 'error',
      };
      call.on(map[event] ?? event, cb);
    },
    async destroy() {
      try { await call.destroy(); } catch { /* already destroyed */ }
    },
  };
}

/**
 * Daily's error strings, in English.
 *
 * `account-missing-payment-method` in particular reads like a bug in this app
 * and is nothing of the sort: rooms are created through the management API,
 * which works on an unbilled account, but opening a media session is refused
 * until a card is on file. Every step succeeds except the last one, which is
 * the most confusing possible way for it to fail.
 */
export function explainCallError(raw: unknown): string {
  const code = String((raw as any)?.errorMsg ?? (raw as any)?.message ?? raw ?? '');

  if (code.includes('account-missing-payment-method')) {
    return 'Live calls are not switched on for this account yet. '
      + 'Add a payment method in the Daily.co dashboard and calls will connect.';
  }
  if (code.includes('exp-room') || code.includes('room-expired')) {
    return 'That call had already finished.';
  }
  if (code.includes('not-allowed') || code.includes('invalid-token')) {
    return 'Your place in this call could not be verified. Try joining again.';
  }
  if (code.includes('meeting-full') || code.includes('max-participants')) {
    return 'Someone else already joined that call.';
  }
  if (/network|connection|timeout/i.test(code)) {
    return 'The connection dropped. Check your signal and try again.';
  }
  return code || 'The connection failed.';
}

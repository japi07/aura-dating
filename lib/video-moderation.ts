/**
 * Video moderation by frame sampling.
 *
 * OpenAI's moderation model only accepts images and text, so we pull a few
 * stills from the video on-device and screen those. It's not frame-by-frame
 * coverage — a determined bad actor could hide something between samples —
 * but it catches the obvious cases cheaply, using the OpenAI key we already
 * have, with no extra vendor.
 *
 * Frames are sent as base64 so we never upload a frame just to check it.
 *
 * expo-video-thumbnails is a native module, so it's lazy-required: in a build
 * that predates it we skip video screening rather than crash or block uploads.
 */
import * as FileSystem from 'expo-file-system/legacy';
import { getSupabase, supabaseEnabled } from './supabase';

let VideoThumbnails: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  VideoThumbnails = require('expo-video-thumbnails');
} catch {
  VideoThumbnails = null;
}

/** True when this build can extract frames (i.e. video screening is possible). */
export const videoModerationAvailable = !!VideoThumbnails?.getThumbnailAsync;

export interface VideoModerationResult {
  ok: boolean;
  /** Categories that tripped, if any */
  categories?: string[];
  /** False when we couldn't actually screen it (missing module, errors) */
  screened: boolean;
}

/** Screen one still frame. Fails open so a moderation outage can't block users. */
async function screenFrame(uri: string): Promise<{ flagged: boolean; categories?: string[] }> {
  try {
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const { data, error } = await getSupabase().functions.invoke('moderate-image', {
      body: { imageBase64: base64, mimeType: 'image/jpeg' },
    });
    if (error) return { flagged: false };
    return { flagged: !!data?.flagged, categories: data?.categories };
  } catch {
    return { flagged: false };
  }
}

/**
 * Sample frames across a video and screen each one.
 * Returns ok:false as soon as any frame is flagged.
 *
 * @param localUri  the on-device video file
 * @param durationSec  recorded duration, used to spread the samples out
 * @param sampleCount  how many frames to check (default 4)
 */
export async function moderateVideo(
  localUri: string,
  durationSec?: number,
  sampleCount = 4,
): Promise<VideoModerationResult> {
  if (!supabaseEnabled || !videoModerationAvailable || !localUri) {
    return { ok: true, screened: false };
  }

  // Spread samples across the clip; default to a 15s assumption when we
  // don't know the duration, and always include an early frame.
  const total = Math.max(durationSec ?? 15, 1);
  const points = Array.from({ length: sampleCount }, (_, i) =>
    Math.floor((total * 1000 * (i + 0.5)) / sampleCount),
  );

  const frameUris: string[] = [];
  try {
    for (const time of points) {
      try {
        const { uri } = await VideoThumbnails.getThumbnailAsync(localUri, { time, quality: 0.6 });
        frameUris.push(uri);
      } catch {
        // A single frame failing (e.g. past the end) shouldn't abort the rest
      }
    }

    if (frameUris.length === 0) return { ok: true, screened: false };

    const results = await Promise.all(frameUris.map(screenFrame));
    const bad = results.find((r) => r.flagged);
    return bad
      ? { ok: false, categories: bad.categories, screened: true }
      : { ok: true, screened: true };
  } catch {
    return { ok: true, screened: false };
  } finally {
    // Clean up the extracted frames — they're only needed for the check
    await Promise.all(
      frameUris.map((u) => FileSystem.deleteAsync(u, { idempotent: true }).catch(() => {})),
    );
  }
}

/** Friendly message shown when a video is rejected. */
export const VIDEO_REJECTED_MESSAGE =
  'That video didn\'t pass our content guidelines. Please record another one.';

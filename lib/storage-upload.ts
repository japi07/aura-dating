/**
 * Upload helpers for Supabase Storage.
 *
 * React Native can't stream a file:// URI straight into supabase-js, so we
 * read the file as base64 and upload the decoded ArrayBuffer — the pattern
 * recommended by Supabase for Expo apps.
 */
import { decode } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system/legacy';
import { getSupabase } from './supabase';

/**
 * Upload a local file (file:// URI) to a storage bucket.
 * Returns the public URL for public buckets, or the storage path for
 * private ones (pass `publicUrl: false`).
 */
export async function uploadLocalFile(args: {
  bucket: string;
  /** Destination path inside the bucket — must start with `${userId}/` to satisfy RLS */
  path: string;
  localUri: string;
  contentType: string;
  publicUrl?: boolean;
}): Promise<string> {
  const supabase = getSupabase();
  const base64 = await FileSystem.readAsStringAsync(args.localUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const { error } = await supabase.storage
    .from(args.bucket)
    .upload(args.path, decode(base64), { contentType: args.contentType, upsert: true });
  if (error) throw error;

  if (args.publicUrl === false) return args.path;
  const { data } = supabase.storage.from(args.bucket).getPublicUrl(args.path);
  return data.publicUrl;
}

/** True if a URI points at a device-local file that still needs uploading */
export function isLocalUri(uri?: string | null): boolean {
  return !!uri && (uri.startsWith('file://') || uri.startsWith('ph://') || uri.startsWith('content://'));
}

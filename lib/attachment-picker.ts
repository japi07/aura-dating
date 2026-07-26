/**
 * Pick an attachment for a proposal — a PDF/PPT deck, an image of a hand-drawn
 * plan, whatever makes the invitation feel personal.
 *
 * expo-document-picker is a native module, so it only exists in a build made
 * after it was installed. We lazy-require it and fall back to the image picker
 * (already native in every build) so attaching still works today.
 */
import * as ImagePicker from 'expo-image-picker';

export interface PickedAttachment {
  uri: string;
  name: string;
  mimeType: string;
}

let DocumentPicker: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  DocumentPicker = require('expo-document-picker');
} catch {
  DocumentPicker = null;
}

/** True when full document picking (PDF/PPT/etc.) is available in this build. */
export const documentPickingAvailable = !!DocumentPicker?.getDocumentAsync;

/** Guess a sensible mime type from a filename when the picker doesn't give one. */
function guessMime(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    pdf: 'application/pdf',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    key: 'application/vnd.apple.keynote',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    heic: 'image/heic',
  };
  return map[ext] ?? 'application/octet-stream';
}

/**
 * Open the picker. Returns null when the user cancels.
 * Uses documents when available, otherwise images.
 */
export async function pickAttachment(): Promise<PickedAttachment | null> {
  if (documentPickingAvailable) {
    const res = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'application/vnd*', 'image/*', 'text/*'],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (res.canceled || !res.assets?.length) return null;
    const a = res.assets[0];
    const name = a.name || 'attachment';
    return { uri: a.uri, name, mimeType: a.mimeType || guessMime(name) };
  }

  // Fallback: images only (works in builds without expo-document-picker)
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.9,
  });
  if (res.canceled || !res.assets?.length) return null;
  const a = res.assets[0];
  const name = a.fileName || `plan_${Date.now()}.jpg`;
  return { uri: a.uri, name, mimeType: a.mimeType || guessMime(name) };
}

/** A friendly icon name for a mime type (Ionicons). */
export function iconForMime(mime?: string): string {
  if (!mime) return 'document-outline';
  if (mime.startsWith('image/')) return 'image-outline';
  if (mime.includes('pdf')) return 'document-text-outline';
  if (mime.includes('presentation') || mime.includes('powerpoint') || mime.includes('keynote')) return 'easel-outline';
  if (mime.includes('word') || mime.startsWith('text/')) return 'document-text-outline';
  return 'document-outline';
}

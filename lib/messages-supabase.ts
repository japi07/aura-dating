/**
 * Video / file exchange on a proposal.
 *
 * Not a chat: every message carries a short video or an attachment, with an
 * optional one-line caption. Both parties can keep sharing a little more
 * before they meet, without it turning into weeks of texting.
 */
import { getSupabase, supabaseEnabled, BUCKETS } from './supabase';
import { uploadLocalFile, isLocalUri, remoteOnly } from './storage-upload';
import { getSessionUserId } from './proposals-supabase';

export interface ThreadMessage {
  id: string;
  proposalId: string;
  senderId: string;
  senderName: string;
  senderPhotoUrl?: string;
  caption?: string;
  videoUrl?: string;
  videoDurationSec?: number;
  attachmentUrl?: string;
  attachmentName?: string;
  attachmentType?: string;
  createdAt: string;
  /** True when the signed-in user sent it */
  mine: boolean;
}

/** Every message on a proposal, oldest first. */
export async function fetchThread(proposalId: string): Promise<ThreadMessage[]> {
  if (!supabaseEnabled) return [];
  const supabase = getSupabase();
  const uid = await getSessionUserId();
  if (!uid) return [];

  const { data, error } = await supabase
    .from('proposal_messages')
    .select('*, sender:profiles!proposal_messages_sender_id_fkey(name, photo_url)')
    .eq('proposal_id', proposalId)
    .order('created_at', { ascending: true });
  if (error) throw error;

  return (data ?? []).map((r: any) => ({
    id: r.id,
    proposalId: r.proposal_id,
    senderId: r.sender_id,
    senderName: r.sender?.name ?? 'Member',
    senderPhotoUrl: remoteOnly([r.sender?.photo_url])[0],
    caption: r.caption ?? undefined,
    videoUrl: r.video_url ?? undefined,
    videoDurationSec: r.video_duration_sec ?? undefined,
    attachmentUrl: r.attachment_url ?? undefined,
    attachmentName: r.attachment_name ?? undefined,
    attachmentType: r.attachment_type ?? undefined,
    createdAt: r.created_at,
    mine: r.sender_id === uid,
  }));
}

/**
 * Send a message. Local video/attachment URIs are uploaded first.
 * At least one of `videoUri` or `attachment` must be provided.
 */
export async function sendThreadMessage(args: {
  proposalId: string;
  caption?: string;
  videoUri?: string;
  videoDurationSec?: number;
  attachment?: { uri: string; name: string; mimeType: string };
}): Promise<void> {
  const supabase = getSupabase();
  const uid = await getSessionUserId();
  if (!uid) throw new Error('You need to be signed in');
  if (!args.videoUri && !args.attachment) {
    throw new Error('Record a video or attach a file to send');
  }

  let videoUrl: string | undefined;
  if (args.videoUri) {
    videoUrl = isLocalUri(args.videoUri)
      ? await uploadLocalFile({
          bucket: BUCKETS.PROPOSAL_VIDEOS,
          path: `${uid}/msg_${Date.now()}.mp4`,
          localUri: args.videoUri,
          contentType: 'video/mp4',
        })
      : args.videoUri;
  }

  let attachmentUrl: string | undefined;
  if (args.attachment) {
    const safeName = args.attachment.name.replace(/[^\w.\-]/g, '_');
    attachmentUrl = isLocalUri(args.attachment.uri)
      ? await uploadLocalFile({
          bucket: BUCKETS.PROPOSAL_ATTACHMENTS,
          path: `${uid}/msg_${Date.now()}_${safeName}`,
          localUri: args.attachment.uri,
          contentType: args.attachment.mimeType,
        })
      : args.attachment.uri;
  }

  const { error } = await supabase.from('proposal_messages').insert({
    proposal_id: args.proposalId,
    sender_id: uid,
    caption: args.caption?.trim() || null,
    video_url: videoUrl ?? null,
    video_duration_sec: args.videoDurationSec ?? null,
    attachment_url: attachmentUrl ?? null,
    attachment_name: args.attachment?.name ?? null,
    attachment_type: args.attachment?.mimeType ?? null,
  });
  if (error) throw error;
}

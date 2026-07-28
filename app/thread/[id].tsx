import React, { useCallback, useEffect, useState } from 'react';
import {
  StyleSheet, View, Text, ScrollView, TouchableOpacity, TextInput,
  StatusBar, Alert, ActivityIndicator, Image, Linking, RefreshControl,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useVideoPlayer, VideoView } from 'expo-video';
import { COLORS } from '@/constants/colors';
import { fetchThread, sendThreadMessage, type ThreadMessage } from '@/lib/messages-supabase';
import { pickAttachment, iconForMime, type PickedAttachment } from '@/lib/attachment-picker';

const MAX_VIDEO_SEC = 30;

/**
 * A light exchange before the date: swap a few more videos or files.
 * Intentionally video/file-first rather than a text chat.
 */
export default function ThreadScreen() {
  const router = useRouter();
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const proposalId = String(id);

  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);

  const [caption, setCaption] = useState('');
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const [attachment, setAttachment] = useState<PickedAttachment | null>(null);

  const load = useCallback(async () => {
    try {
      setMessages(await fetchThread(proposalId));
    } catch (e: any) {
      Alert.alert('Could not load', e?.message || 'Please try again.');
    }
  }, [proposalId]);

  useEffect(() => { (async () => { await load(); setLoading(false); })(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const recordVideo = async () => {
    const cam = await ImagePicker.requestCameraPermissionsAsync();
    if (!cam.granted) {
      Alert.alert('Camera permission needed', 'We need camera access to record your video.');
      return;
    }
    await (ImagePicker as any).requestMicrophonePermissionsAsync?.();
    const res = await ImagePicker.launchCameraAsync({
      mediaTypes: ['videos'],
      videoMaxDuration: MAX_VIDEO_SEC,
      videoQuality: 1,
      cameraType: ImagePicker.CameraType.front,
    });
    if (!res.canceled && res.assets[0]) {
      setVideoUri(res.assets[0].uri);
      setVideoDuration(res.assets[0].duration ? Math.round(res.assets[0].duration / 1000) : null);
    }
  };

  const chooseFile = async () => {
    try {
      const picked = await pickAttachment();
      if (picked) setAttachment(picked);
    } catch (e: any) {
      Alert.alert('Could not attach', e?.message || 'Please try again.');
    }
  };

  const send = async () => {
    if (!videoUri && !attachment) {
      Alert.alert('Nothing to send', 'Record a short video or attach a file first.');
      return;
    }
    setSending(true);
    try {
      await sendThreadMessage({
        proposalId,
        caption,
        videoUri: videoUri ?? undefined,
        videoDurationSec: videoDuration ?? undefined,
        attachment: attachment ?? undefined,
      });
      setCaption(''); setVideoUri(null); setVideoDuration(null); setAttachment(null);
      await load();
    } catch (e: any) {
      Alert.alert('Could not send', e?.message || 'Please try again.');
    } finally {
      setSending(false);
    }
  };

  const other = name || 'them';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color={COLORS.TEXT} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>{other}</Text>
          <Text style={styles.sub}>Videos & files · before you meet</Text>
        </View>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.BRAND} />}
        >
          {loading ? (
            <View style={styles.empty}><ActivityIndicator color={COLORS.BRAND} /></View>
          ) : messages.length === 0 ? (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons name="videocam-outline" size={36} color={COLORS.BRAND} />
              </View>
              <Text style={styles.emptyTitle}>Say a little more</Text>
              <Text style={styles.emptySub}>
                Send {other} another short video or a file — the plan, a playlist,
                a photo of where you'll meet. No endless texting.
              </Text>
            </View>
          ) : (
            messages.map((m) => <MessageBubble key={m.id} m={m} />)
          )}
        </ScrollView>

        {/* Composer */}
        <View style={styles.composer}>
          {(videoUri || attachment) && (
            <View style={styles.pendingRow}>
              {videoUri && (
                <View style={styles.pendingChip}>
                  <Ionicons name="videocam" size={13} color={COLORS.BRAND} />
                  <Text style={styles.pendingText}>
                    Video{videoDuration ? ` · ${videoDuration}s` : ''}
                  </Text>
                  <TouchableOpacity onPress={() => { setVideoUri(null); setVideoDuration(null); }}>
                    <Ionicons name="close" size={14} color={COLORS.TEXT_MUTED} />
                  </TouchableOpacity>
                </View>
              )}
              {attachment && (
                <View style={styles.pendingChip}>
                  <Ionicons name={iconForMime(attachment.mimeType) as any} size={13} color={COLORS.BRAND} />
                  <Text style={styles.pendingText} numberOfLines={1}>{attachment.name}</Text>
                  <TouchableOpacity onPress={() => setAttachment(null)}>
                    <Ionicons name="close" size={14} color={COLORS.TEXT_MUTED} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          <TextInput
            style={styles.captionInput}
            placeholder="Add a line (optional)"
            placeholderTextColor={COLORS.TEXT_MUTED}
            value={caption}
            onChangeText={setCaption}
            maxLength={140}
          />

          <View style={styles.composerRow}>
            <TouchableOpacity style={styles.iconBtn} onPress={recordVideo} activeOpacity={0.8}>
              <Ionicons name="videocam" size={20} color={COLORS.BRAND} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={chooseFile} activeOpacity={0.8}>
              <Ionicons name="attach" size={20} color={COLORS.BRAND} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sendBtn, (sending || (!videoUri && !attachment)) && { opacity: 0.55 }]}
              onPress={send}
              disabled={sending || (!videoUri && !attachment)}
              activeOpacity={0.88}
            >
              {sending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="send" size={16} color="#fff" />
                  <Text style={styles.sendText}>Send</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function MessageBubble({ m }: { m: ThreadMessage }) {
  const player = useVideoPlayer(m.videoUrl ?? '', (p) => { p.loop = false; });

  return (
    <View style={[styles.bubbleWrap, m.mine ? styles.bubbleRight : styles.bubbleLeft]}>
      {!m.mine && (
        <View style={styles.senderRow}>
          {m.senderPhotoUrl ? (
            <Image source={{ uri: m.senderPhotoUrl }} style={styles.senderAvatar} />
          ) : (
            <View style={[styles.senderAvatar, styles.senderAvatarEmpty]}>
              <Ionicons name="person" size={12} color={COLORS.TEXT_MUTED} />
            </View>
          )}
          <Text style={styles.senderName}>{m.senderName.split(' ')[0]}</Text>
        </View>
      )}

      <View style={[styles.bubble, m.mine && styles.bubbleMine]}>
        {!!m.videoUrl && (
          <View style={styles.videoBox}>
            <VideoView player={player} style={StyleSheet.absoluteFillObject} contentFit="cover" nativeControls />
          </View>
        )}

        {!!m.attachmentUrl && (
          <TouchableOpacity
            style={styles.fileRow}
            onPress={() => Linking.openURL(m.attachmentUrl!).catch(() =>
              Alert.alert('Could not open', 'This file could not be opened.'))}
            activeOpacity={0.85}
          >
            <Ionicons name={iconForMime(m.attachmentType) as any} size={18} color={m.mine ? '#fff' : COLORS.BRAND} />
            <Text style={[styles.fileName, m.mine && { color: '#fff' }]} numberOfLines={1}>
              {m.attachmentName || 'Attachment'}
            </Text>
            <Ionicons name="open-outline" size={15} color={m.mine ? 'rgba(255,255,255,0.85)' : COLORS.TEXT_MUTED} />
          </TouchableOpacity>
        )}

        {!!m.caption && (
          <Text style={[styles.caption, m.mine && { color: '#fff' }]}>{m.caption}</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.BG },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.BORDER_LIGHT, backgroundColor: COLORS.SURFACE,
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 17, fontWeight: '800', color: COLORS.TEXT },
  sub: { fontSize: 11, color: COLORS.TEXT_MUTED, marginTop: 1 },

  list: { padding: 16, gap: 14, paddingBottom: 24 },

  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 24 },
  emptyIcon: {
    width: 74, height: 74, borderRadius: 24, backgroundColor: COLORS.BRAND_MUTED,
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: COLORS.TEXT, marginBottom: 8 },
  emptySub: { fontSize: 14, color: COLORS.TEXT_MUTED, textAlign: 'center', lineHeight: 20 },

  bubbleWrap: { maxWidth: '86%' },
  bubbleLeft: { alignSelf: 'flex-start' },
  bubbleRight: { alignSelf: 'flex-end' },
  senderRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 5, marginLeft: 4 },
  senderAvatar: { width: 20, height: 20, borderRadius: 10 },
  senderAvatarEmpty: { backgroundColor: COLORS.BRAND_MUTED, justifyContent: 'center', alignItems: 'center' },
  senderName: { fontSize: 11, fontWeight: '700', color: COLORS.TEXT_MUTED },

  bubble: {
    backgroundColor: COLORS.SURFACE, borderRadius: 18, padding: 10, gap: 8,
    borderWidth: 1, borderColor: COLORS.BORDER_LIGHT,
  },
  bubbleMine: { backgroundColor: COLORS.BRAND, borderColor: COLORS.BRAND },
  videoBox: { width: 210, aspectRatio: 9 / 14, borderRadius: 12, overflow: 'hidden', backgroundColor: '#15121F' },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4, paddingHorizontal: 2 },
  fileName: { flex: 1, fontSize: 13, fontWeight: '700', color: COLORS.TEXT },
  caption: { fontSize: 14, color: COLORS.TEXT, lineHeight: 19, paddingHorizontal: 2 },

  composer: {
    borderTopWidth: 1, borderTopColor: COLORS.BORDER_LIGHT, backgroundColor: COLORS.SURFACE,
    padding: 12, paddingBottom: 20, gap: 10,
  },
  pendingRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pendingChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '100%',
    backgroundColor: COLORS.BRAND_MUTED, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 12,
  },
  pendingText: { fontSize: 12, fontWeight: '700', color: COLORS.BRAND, flexShrink: 1 },
  captionInput: {
    backgroundColor: COLORS.BG, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1, borderColor: COLORS.BORDER, fontSize: 14, color: COLORS.TEXT,
  },
  composerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: {
    width: 46, height: 46, borderRadius: 14, justifyContent: 'center', alignItems: 'center',
    backgroundColor: COLORS.BRAND_MUTED, borderWidth: 1.5, borderColor: COLORS.BRAND,
  },
  sendBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 46, borderRadius: 14, backgroundColor: COLORS.BRAND,
  },
  sendText: { fontSize: 14, fontWeight: '800', color: '#fff' },
});

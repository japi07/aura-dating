/**
 * VideoMessage — the video introduction shown in a proposal.
 * Auto-plays muted on mount; tap to enlarge + unmute.
 */
import React, { useState, useEffect } from 'react';
import {
  StyleSheet, View, Text, TouchableOpacity, Image,
  Modal, Pressable, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEvent } from 'expo';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '@/constants/colors';

interface Props {
  videoUrl: string;
  poster?: string;
  durationSec?: number;
  fromName: string;
}

export function VideoMessage({ videoUrl, poster, durationSec, fromName }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [hasPlayed, setHasPlayed] = useState(false);

  // Inline player: muted, loops, auto-plays
  const inlinePlayer = useVideoPlayer(videoUrl, (player) => {
    player.loop = true;
    player.muted = true;
    player.play();
  });

  // Fullscreen player: with sound
  const expandedPlayer = useVideoPlayer(videoUrl, (player) => {
    player.muted = false;
    player.loop = false;
  });

  const inlineStatus = useEvent(inlinePlayer, 'statusChange', { status: inlinePlayer.status });

  useEffect(() => {
    if (inlineStatus?.status === 'readyToPlay') setHasPlayed(true);
  }, [inlineStatus?.status]);

  // Start the expanded player when modal opens; pause it when it closes
  useEffect(() => {
    if (expanded) {
      expandedPlayer.currentTime = 0;
      expandedPlayer.play();
    } else {
      try { expandedPlayer.pause(); } catch {}
    }
  }, [expanded]);

  return (
    <>
      <View style={styles.wrap}>
        {/* Header strip */}
        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <Ionicons name="videocam" size={13} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerLabel}>VIDEO MESSAGE</Text>
            <Text style={styles.headerName}>From {fromName}</Text>
          </View>
          {durationSec ? (
            <View style={styles.duration}>
              <Text style={styles.durationText}>{durationSec}s</Text>
            </View>
          ) : null}
        </View>

        {/* Video preview */}
        <Pressable style={styles.videoBox} onPress={() => setExpanded(true)}>
          {!hasPlayed && poster ? (
            <Image source={{ uri: poster }} style={StyleSheet.absoluteFillObject} />
          ) : null}
          <VideoView
            player={inlinePlayer}
            style={StyleSheet.absoluteFillObject}
            contentFit="cover"
            nativeControls={false}
            allowsFullscreen={false}
            allowsPictureInPicture={false}
          />

          {/* Soft overlay so tap target is obvious */}
          <LinearGradient
            colors={['transparent', 'rgba(20,16,40,0.4)']}
            locations={[0.55, 1]}
            style={StyleSheet.absoluteFillObject}
          />

          {/* Tap-to-expand hint */}
          <View style={styles.playPill}>
            <Ionicons name="volume-mute" size={13} color="#fff" />
            <Text style={styles.playPillText}>Tap for sound</Text>
          </View>

          {/* Expand chevron */}
          <View style={styles.expandBtn}>
            <Ionicons name="expand" size={14} color="#fff" />
          </View>
        </Pressable>
      </View>

      {/* Fullscreen modal */}
      <Modal
        visible={expanded}
        animationType="fade"
        transparent={false}
        onRequestClose={() => setExpanded(false)}
        statusBarTranslucent
      >
        <View style={styles.modalRoot}>
          <StatusBar barStyle="light-content" />
          <VideoView
            player={expandedPlayer}
            style={StyleSheet.absoluteFillObject}
            contentFit="contain"
            nativeControls={true}
          />
          <TouchableOpacity style={styles.closeBtn} onPress={() => setExpanded(false)}>
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: '#fff', borderRadius: 22, overflow: 'hidden', marginBottom: 18,
    borderWidth: 1, borderColor: COLORS.BORDER_LIGHT,
    shadowColor: '#1A0F26', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06,
    shadowRadius: 10, elevation: 4,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 11,
    backgroundColor: COLORS.SURFACE,
    borderBottomWidth: 1, borderBottomColor: COLORS.BORDER_LIGHT,
  },
  headerIcon: {
    width: 28, height: 28, borderRadius: 9, backgroundColor: COLORS.BRAND,
    justifyContent: 'center', alignItems: 'center',
  },
  headerLabel: {
    fontSize: 9, fontWeight: '900', color: COLORS.BRAND,
    letterSpacing: 1.5, marginBottom: 1,
  },
  headerName: { fontSize: 13, fontWeight: '700', color: COLORS.TEXT },
  duration: {
    backgroundColor: COLORS.BRAND_MUTED, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8,
  },
  durationText: { fontSize: 11, fontWeight: '800', color: COLORS.BRAND, letterSpacing: 0.3 },

  videoBox: {
    width: '100%', aspectRatio: 9 / 13,
    backgroundColor: '#15121F', position: 'relative',
  },
  playPill: {
    position: 'absolute', bottom: 12, left: 12,
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14,
  },
  playPillText: { fontSize: 11, color: '#fff', fontWeight: '600' },
  expandBtn: {
    position: 'absolute', bottom: 12, right: 12,
    width: 30, height: 30, borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center',
  },

  modalRoot: { flex: 1, backgroundColor: '#000', justifyContent: 'center' },
  closeBtn: {
    position: 'absolute', top: 50, right: 20,
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center', alignItems: 'center',
  },
});

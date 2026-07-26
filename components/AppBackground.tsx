import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, Image, Animated } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { useBgContext } from '@/lib/bgContext';

export default function AppBackground() {
  const { bgUri, wallpaperMode } = useBgContext();
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // We keep the video mounted when in video mode, but crossfade cleanly.
  // Actually, to keep it simple, we just render the Image or the Video.
  
  if (wallpaperMode === 'video') {
    return (
      <View style={StyleSheet.absoluteFillObject}>
        {/* Fallback image behind the video in case it takes a moment to load */}
        {bgUri && (
          <Image
            source={{ uri: bgUri }}
            style={StyleSheet.absoluteFillObject}
            resizeMode="cover"
          />
        )}
        <Video
          source={require('@/assets/videos/calming_video.mp4')}
          style={StyleSheet.absoluteFillObject}
          resizeMode={ResizeMode.COVER}
          isLooping
          shouldPlay
          isMuted
        />
      </View>
    );
  }

  // Solar or Pinned mode
  return (
    <View style={StyleSheet.absoluteFillObject}>
      <Image
        source={bgUri ? { uri: bgUri } : undefined}
        style={StyleSheet.absoluteFillObject}
        resizeMode="cover"
      />
    </View>
  );
}

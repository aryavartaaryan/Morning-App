import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, Image, Animated } from 'react-native';
import { useBgContext } from '@/lib/bgContext';

export default function AppBackground() {
  const { bgUri } = useBgContext();

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

import re

with open('app/(tabs)/sleep.tsx', 'r') as f:
    content = f.read()

start_marker = "{/* ── PERFECTLY CENTERED PLAY/PAUSE ORB ── */}"
end_marker = "{/* ── BOTTOM TEXT & SCRUBBER CLUSTER ── */}"

start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

if start_idx == -1 or end_idx == -1:
    print("Markers not found")
    exit(1)

new_content = """{/* ── INNOVATIVE IMMERSIVE AUDIO VISUALIZATION ── */}
      <Animated.View
        style={[StyleSheet.absoluteFillObject, {
          alignItems: 'center', justifyContent: 'center',
          zIndex: 5,
        }]}
        pointerEvents="none"
      >
        {/* Massive outer aura */}
        <Animated.View
          style={{
            position: 'absolute', width: REEL_W * 1.6, height: REEL_W * 1.6, borderRadius: REEL_W,
            borderWidth: StyleSheet.hairlineWidth, borderColor: (sound.color || '#a78bfa') + '15',
            backgroundColor: (sound.color || '#a78bfa') + '08',
            transform: [{ scale: externalBreath.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1.1] }) }],
          }}
        />
        {/* Secondary wave */}
        <Animated.View
          style={{
            position: 'absolute', width: REEL_W * 1.1, height: REEL_W * 1.1, borderRadius: REEL_W,
            borderWidth: 1, borderColor: (sound.color || '#a78bfa') + '25',
            transform: [{ scale: externalBreath.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.05] }) }],
          }}
        />
        {/* Audio-reactive inner wave */}
        <Animated.View
          style={{
            position: 'absolute', width: REEL_W * 0.6, height: REEL_W * 0.6, borderRadius: REEL_W,
            borderWidth: 1.5, borderColor: (sound.color || '#a78bfa') + '50',
            shadowColor: sound.color || '#a78bfa', shadowOpacity: 0.4, shadowRadius: 30, shadowOffset: { width: 0, height: 0 },
            transform: [{
              scale: isActive && isPlaying && !isPaused
                ? meteringAnim.interpolate({ inputRange: [0, 1], outputRange: [1.0, 1.15] })
                : externalBreath.interpolate({ inputRange: [0, 1], outputRange: [0.98, 1.02] })
            }],
          }}
        />
      </Animated.View>

      {/* Loading Spinner */}
      {isActive && isAudioLoading && !isPlaying && (
        <View style={[StyleSheet.absoluteFillObject, { alignItems: 'center', justifyContent: 'center', zIndex: 10 }]} pointerEvents="none">
          <BlurView intensity={40} tint="dark" style={{ padding: 20, borderRadius: 99, overflow: 'hidden' }}>
            <ActivityIndicator size="large" color="#fff" />
          </BlurView>
        </View>
      )}

      {/* ── PREMIUM TAP-ANYWHERE PLAY/PAUSE ANIMATION ── */}
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFillObject, {
          alignItems: 'center', justifyContent: 'center',
          opacity: playTapAnim, transform: [{ scale: playTapScaleAnim }], zIndex: 50,
        }]}
      >
        <BlurView
          intensity={60}
          tint="light"
          style={{
            width: 100, height: 100, borderRadius: 50,
            overflow: 'hidden',
            alignItems: 'center', justifyContent: 'center',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.4)',
            shadowColor: '#000',
            shadowOpacity: 0.3,
            shadowRadius: 20,
            shadowOffset: { width: 0, height: 0 },
          }}
        >
          <Ionicons
            name={(isPlaying && !isPaused) ? 'pause' : 'play'}
            size={48} color="#FFF" style={{ marginLeft: (isPlaying && !isPaused) ? 0 : 6 }}
          />
        </BlurView>
      </Animated.View>

      """

updated = content[:start_idx] + new_content + content[end_idx:]

with open('app/(tabs)/sleep.tsx', 'w') as f:
    f.write(updated)

print("Replaced!")

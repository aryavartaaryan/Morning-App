import re

with open('app/(tabs)/sleep.tsx', 'r') as f:
    content = f.read()

# 1. Inject spinAnim
spin_inject = """const externalBreath = useRef(new Animated.Value(0)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!isActive) return;
    Animated.loop(
      Animated.timing(spinAnim, { toValue: 1, duration: 12000, useNativeDriver: true, easing: Easing.linear })
    ).start();
  }, [isActive, spinAnim]);"""

content = content.replace("const externalBreath = useRef(new Animated.Value(0)).current;", spin_inject)


# 2. Replace the visualization block
old_vis = """{/* ── INNOVATIVE IMMERSIVE AUDIO VISUALIZATION ── */}
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
      </Animated.View>"""

new_vis = """{/* ── ULTRA-PREMIUM REACTIVE AURA VISUALIZATION ── */}
      <Animated.View
        style={[StyleSheet.absoluteFillObject, {
          alignItems: 'center', justifyContent: 'center',
          zIndex: 5,
        }]}
        pointerEvents="none"
      >
        {/* Deep Ambient Core Glow */}
        <Animated.View
          style={{
            position: 'absolute',
            width: REEL_W * 0.6,
            height: REEL_W * 0.6,
            borderRadius: REEL_W * 0.3,
            backgroundColor: sound.color || '#a78bfa',
            opacity: isActive && isPlaying && !isPaused ? meteringAnim.interpolate({ inputRange: [0, 1], outputRange: [0.05, 0.25] }) : 0.05,
            transform: [{ scale: isActive && isPlaying && !isPaused ? meteringAnim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.5] }) : externalBreath.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.0] }) }],
            shadowColor: sound.color || '#a78bfa',
            shadowOpacity: 1,
            shadowRadius: 80,
            shadowOffset: { width: 0, height: 0 },
          }}
        />

        {/* Rotating Energy Ring (Dashed/Fragmented look via borders) */}
        <Animated.View
          style={{
            position: 'absolute',
            width: REEL_W * 0.75,
            height: REEL_W * 0.75,
            borderRadius: REEL_W * 0.375,
            borderWidth: 1.5,
            borderColor: 'transparent',
            borderTopColor: (sound.color || '#a78bfa') + '70',
            borderBottomColor: (sound.color || '#a78bfa') + '15',
            opacity: isActive && isPlaying && !isPaused ? meteringAnim.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0.7] }) : 0.1,
            transform: [
              { rotate: spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) },
              { scale: isActive && isPlaying && !isPaused ? meteringAnim.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1.25] }) : externalBreath.interpolate({ inputRange: [0, 1], outputRange: [0.98, 1.02] }) }
            ],
          }}
        />

        {/* Counter-Rotating Outer Ripple */}
        <Animated.View
          style={{
            position: 'absolute',
            width: REEL_W * 0.95,
            height: REEL_W * 0.95,
            borderRadius: REEL_W * 0.475,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: (sound.color || '#a78bfa') + '40',
            opacity: isActive && isPlaying && !isPaused ? meteringAnim.interpolate({ inputRange: [0, 1], outputRange: [0.1, 0.4] }) : 0.05,
            transform: [
              { rotate: spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['360deg', '0deg'] }) },
              { scale: isActive && isPlaying && !isPaused ? meteringAnim.interpolate({ inputRange: [0, 1], outputRange: [1.05, 1.4] }) : externalBreath.interpolate({ inputRange: [0, 1], outputRange: [1.05, 1.1] }) }
            ],
          }}
        />
        
        {/* Core Sharp Pulse Ring */}
        <Animated.View
          style={{
            position: 'absolute',
            width: 130,
            height: 130,
            borderRadius: 65,
            borderWidth: 2,
            borderColor: (sound.color || '#ffffff') + '60',
            shadowColor: sound.color || '#ffffff',
            shadowOpacity: 0.5,
            shadowRadius: 15,
            shadowOffset: { width: 0, height: 0 },
            opacity: isActive && isPlaying && !isPaused ? meteringAnim.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }) : 0.1,
            transform: [{ scale: isActive && isPlaying && !isPaused ? meteringAnim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.2] }) : externalBreath.interpolate({ inputRange: [0, 1], outputRange: [0.98, 1.02] }) }],
          }}
        />
      </Animated.View>"""

if old_vis in content:
    content = content.replace(old_vis, new_vis)
else:
    print("WARNING: Could not find old_vis text!")

with open('app/(tabs)/sleep.tsx', 'w') as f:
    f.write(content)

print("Updates applied.")

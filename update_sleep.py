import re

with open('app/(tabs)/sleep.tsx', 'r') as f:
    content = f.read()

# 1. Update handleScreenTap
old_tap = """  const handleScreenTap = useCallback(() => {
    bumpControlsRef.current();
    if (durationOpen) { setDurationOpen(false); return; }
    isPlaying ? onToggle() : onPlay();
    playTapScaleAnim.setValue(0.6);
    playTapAnim.setValue(0);
    Animated.parallel([
      Animated.timing(playTapAnim, { toValue: 1, duration: 140, useNativeDriver: true }),
      Animated.spring(playTapScaleAnim, { toValue: 1, tension: 200, friction: 8, useNativeDriver: true }),
    ]).start();
    if (playTapTimerRef.current) clearTimeout(playTapTimerRef.current);
    playTapTimerRef.current = setTimeout(() => {
      Animated.timing(playTapAnim, { toValue: 0, duration: 380, useNativeDriver: true }).start();
    }, 1100);
  }, [isPlaying, isPaused, durationOpen]);"""

new_tap = """  const handleScreenTap = useCallback(() => {
    if (durationOpen) { setDurationOpen(false); return; }
    // User requested touching screen anywhere should NOT cause play/pause.
    // It should just toggle the UI visibility or bump controls.
    bumpControlsRef.current();
  }, [durationOpen]);"""

content = content.replace(old_tap, new_tap)


# 2. Remove PREMIUM TAP-ANYWHERE PLAY/PAUSE ANIMATION
tap_anim_regex = re.compile(r"\{\/\*\s*── PREMIUM TAP-ANYWHERE PLAY/PAUSE ANIMATION ──\s*\*\/\}.*?<\/Animated\.View>", re.DOTALL)
content = tap_anim_regex.sub("", content)


# 3. Redesign Bottom Cluster
old_bottom = """        {/* Floating Mini-Player (Skip / Timer / Skip) - ALWAYS VISIBLE, ULTRA PREMIUM GLASS */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 32 }}>
          <BlurView intensity={35} tint="dark" style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12,
            paddingHorizontal: 16, paddingVertical: 10,
            borderRadius: 36,
            backgroundColor: 'rgba(255,255,255,0.06)',
            borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.2)',
            shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 16, shadowOffset: { width: 0, height: 8 },
            overflow: 'hidden'
          }}>
            {/* Skip Back */}
            <TouchableOpacity
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPrev?.(); }}
              activeOpacity={0.6}
              disabled={!hasPrev}
              style={{ opacity: hasPrev ? 1 : 0.3, padding: 8, paddingHorizontal: 12 }}
            >
              <Ionicons name="play-skip-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>

            {/* Timer Pill - Integrated into the glass bar */}
            <TouchableOpacity
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setDurationOpen(v => !v); }}
              activeOpacity={0.75}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 6,
                backgroundColor: durationOpen ? (sound.color + '40') : 'rgba(0,0,0,0.25)',
                paddingHorizontal: 16, paddingVertical: 8,
                borderRadius: 20,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: durationOpen ? sound.color : 'rgba(255,255,255,0.1)',
              }}
            >
              {(() => {
                const opt = activeDurationOptions.find(o => o.id === selectedDurationId) ?? (activeDurationOptions.find(o => o.id === '1h') || activeDurationOptions[0]);
                return (
                  <>
                    <Ionicons name={opt.icon} size={14} color={durationOpen ? sound.color : 'rgba(255,255,255,0.9)'} />
                    <Text style={{ fontSize: 13, fontWeight: '700', color: durationOpen ? sound.color : 'rgba(255,255,255,0.9)', letterSpacing: 0.5 }}>{opt.label}</Text>
                  </>
                );
              })()}
            </TouchableOpacity>

            {/* Skip Forward */}
            <TouchableOpacity
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onNext?.(); }}
              activeOpacity={0.6}
              disabled={!hasNext}
              style={{ opacity: hasNext ? 1 : 0.3, padding: 8, paddingHorizontal: 12 }}
            >
              <Ionicons name="play-skip-forward" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </BlurView>
        </View>

        {/* Timer dropdown */}
        {durationOpen && (
          <View style={{
            position: 'absolute', top: -140,"""

new_bottom = """        {/* Floating Mini-Player - ALWAYS VISIBLE, ULTRA PREMIUM GLASS */}
        <View style={{ alignItems: 'center', justifyContent: 'center', marginBottom: 32, gap: 16 }}>
          
          {/* Timer Pill - Moved above the transport controls */}
          <TouchableOpacity
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setDurationOpen(v => !v); }}
            activeOpacity={0.75}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 6,
              backgroundColor: durationOpen ? (sound.color + '40') : 'rgba(0,0,0,0.4)',
              paddingHorizontal: 14, paddingVertical: 6,
              borderRadius: 20,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: durationOpen ? sound.color : 'rgba(255,255,255,0.15)',
              shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
            }}
          >
            {(() => {
              const opt = activeDurationOptions.find(o => o.id === selectedDurationId) ?? (activeDurationOptions.find(o => o.id === '1h') || activeDurationOptions[0]);
              return (
                <>
                  <Ionicons name={opt.icon} size={13} color={durationOpen ? sound.color : 'rgba(255,255,255,0.9)'} />
                  <Text style={{ fontSize: 12, fontWeight: '700', color: durationOpen ? sound.color : 'rgba(255,255,255,0.9)', letterSpacing: 0.5 }}>{opt.label}</Text>
                </>
              );
            })()}
          </TouchableOpacity>

          {/* Transport Controls */}
          <BlurView intensity={45} tint="dark" style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24,
            paddingHorizontal: 28, paddingVertical: 14,
            borderRadius: 40,
            backgroundColor: 'rgba(255,255,255,0.08)',
            borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.25)',
            shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 20, shadowOffset: { width: 0, height: 10 },
            overflow: 'hidden'
          }}>
            {/* Skip Back */}
            <TouchableOpacity
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPrev?.(); }}
              activeOpacity={0.6}
              disabled={!hasPrev}
              style={{ opacity: hasPrev ? 1 : 0.3, padding: 8 }}
            >
              <Ionicons name="play-skip-back" size={26} color="#FFFFFF" />
            </TouchableOpacity>

            {/* Play/Pause Button - Unique Premium Design */}
            <TouchableOpacity
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); isPlaying ? onToggle() : onPlay(); }}
              activeOpacity={0.8}
              style={{
                width: 64, height: 64, borderRadius: 32,
                backgroundColor: sound.color ? (sound.color + '30') : 'rgba(255,255,255,0.1)',
                borderWidth: 1.5, borderColor: sound.color ? (sound.color + '80') : 'rgba(255,255,255,0.4)',
                alignItems: 'center', justifyContent: 'center',
                shadowColor: sound.color || '#fff', shadowOpacity: 0.4, shadowRadius: 15, shadowOffset: { width: 0, height: 0 },
              }}
            >
              {isActive && isAudioLoading && !isPlaying ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons
                  name={(isPlaying && !isPaused) ? 'pause' : 'play'}
                  size={32} color="#FFFFFF"
                  style={{ marginLeft: (isPlaying && !isPaused) ? 0 : 3 }}
                />
              )}
            </TouchableOpacity>

            {/* Skip Forward */}
            <TouchableOpacity
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onNext?.(); }}
              activeOpacity={0.6}
              disabled={!hasNext}
              style={{ opacity: hasNext ? 1 : 0.3, padding: 8 }}
            >
              <Ionicons name="play-skip-forward" size={26} color="#FFFFFF" />
            </TouchableOpacity>
          </BlurView>
        </View>

        {/* Timer dropdown */}
        {durationOpen && (
          <View style={{
            position: 'absolute', bottom: 130,"""

if old_bottom in content:
    content = content.replace(old_bottom, new_bottom)
else:
    print("WARNING: Could not find old_bottom text!")

with open('app/(tabs)/sleep.tsx', 'w') as f:
    f.write(content)

print("Updates applied.")

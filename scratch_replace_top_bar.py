import re

with open('app/(tabs)/sleep.tsx', 'r') as f:
    content = f.read()

target = """        {/* Premium Sound Menu Button */}
        {onOpenLibrary && ("""

replacement = """        {/* ── INNOVATIVE TOP PLAY/PAUSE BUTTON ── */}
        <View style={{ position: 'absolute', left: 0, right: 0, alignItems: 'center', pointerEvents: 'box-none' }}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              const activeSound = reelData[activeIndexRef.current];
              if (!activeSound) return;
              if (playingId === activeSound.id) {
                onToggle();
              } else {
                onPlaySound(activeSound.id);
              }
            }}
          >
            <BlurView intensity={50} tint="dark" style={{
              flexDirection: 'row', alignItems: 'center', gap: 10,
              paddingHorizontal: 20, height: 44, borderRadius: 22,
              backgroundColor: 'rgba(255,255,255,0.06)',
              borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.25)',
              overflow: 'hidden'
            }}>
              {(() => {
                const activeSound = reelData[activeIndex];
                const isPlayingActive = playingId === activeSound?.id && !isPaused;
                const isLoadingActive = playingId === activeSound?.id && isAudioLoading;
                const activeColor = activeSound?.color || '#FFFFFF';

                if (isLoadingActive) {
                  return <ActivityIndicator size="small" color="#fff" style={{ transform: [{ scale: 0.8 }] }} />;
                }

                if (isPlayingActive) {
                  return (
                    <>
                      <Animated.View style={{ transform: [{ scale: meteringAnim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.2] }) }] }}>
                        <Ionicons name="pause" size={18} color={activeColor} />
                      </Animated.View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, height: 14 }}>
                        <Animated.View style={{ width: 2.5, borderRadius: 1.5, backgroundColor: activeColor, height: meteringAnim.interpolate({ inputRange: [0, 1], outputRange: [4, 12] }) }} />
                        <Animated.View style={{ width: 2.5, borderRadius: 1.5, backgroundColor: activeColor, height: meteringAnim.interpolate({ inputRange: [0, 1], outputRange: [6, 14] }) }} />
                        <Animated.View style={{ width: 2.5, borderRadius: 1.5, backgroundColor: activeColor, height: meteringAnim.interpolate({ inputRange: [0, 1], outputRange: [3, 10] }) }} />
                      </View>
                    </>
                  );
                }

                // Paused / stopped
                return (
                  <>
                    <Ionicons name="play" size={18} color="#FFFFFF" style={{ marginLeft: 2 }} />
                    <Text style={{ fontSize: 11, fontWeight: '800', color: '#FFFFFF', letterSpacing: 1.5, textTransform: 'uppercase' }}>PLAY</Text>
                  </>
                );
              })()}
            </BlurView>
          </TouchableOpacity>
        </View>

        {/* Premium Sound Menu Button */}
        {onOpenLibrary && ("""

if target in content:
    content = content.replace(target, replacement)
    with open('app/(tabs)/sleep.tsx', 'w') as f:
        f.write(content)
    print("Top bar updated!")
else:
    print("Target not found in file!")


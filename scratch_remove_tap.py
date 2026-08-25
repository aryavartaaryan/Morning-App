import re

with open('app/(tabs)/sleep.tsx', 'r') as f:
    content = f.read()

# Replace handleScreenTap
tap_target = """  const handleScreenTap = useCallback(() => {
    bumpControlsRef.current();
    if (durationOpen) { setDurationOpen(false); return; }
    setTapIconName(isPlaying && !isPaused ? 'pause' : 'play');
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

tap_replacement = """  const handleScreenTap = useCallback(() => {
    bumpControlsRef.current();
    if (durationOpen) { setDurationOpen(false); return; }
  }, [durationOpen]);"""

content = content.replace(tap_target, tap_replacement)

# Remove the tap animation view
anim_target_start = "{/* ── PREMIUM TAP-ANYWHERE PLAY/PAUSE ANIMATION ── */}"
anim_target_end = "</Animated.View>"

start_idx = content.find(anim_target_start)
if start_idx != -1:
    end_idx = content.find(anim_target_end, start_idx) + len(anim_target_end)
    # Remove it completely
    content = content[:start_idx] + content[end_idx:]

with open('app/(tabs)/sleep.tsx', 'w') as f:
    f.write(content)

print("Cleaned up tap-to-play!")

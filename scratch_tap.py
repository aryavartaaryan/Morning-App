import re

with open('app/(tabs)/sleep.tsx', 'r') as f:
    content = f.read()

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

if tap_target in content:
    print("Found tap_target!")
else:
    print("Not found tap_target")


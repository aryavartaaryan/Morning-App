import re

with open('app/(tabs)/sleep.tsx', 'r') as f:
    content = f.read()

# Replace the state definition area
state_target = "const [isScrubbing, setIsScrubbing] = useState(false);"
state_replacement = "const [isScrubbing, setIsScrubbing] = useState(false);\n  const [tapIconName, setTapIconName] = useState<'play' | 'pause'>('play');"

content = content.replace(state_target, state_replacement)

# Replace handleScreenTap
tap_target = """  const handleScreenTap = useCallback(() => {
    bumpControlsRef.current();
    if (durationOpen) { setDurationOpen(false); return; }
    isPlaying ? onToggle() : onPlay();
    playTapScaleAnim.setValue(0.6);"""

tap_replacement = """  const handleScreenTap = useCallback(() => {
    bumpControlsRef.current();
    if (durationOpen) { setDurationOpen(false); return; }
    setTapIconName(isPlaying && !isPaused ? 'pause' : 'play');
    isPlaying ? onToggle() : onPlay();
    playTapScaleAnim.setValue(0.6);"""

content = content.replace(tap_target, tap_replacement)

# Replace the icon in the template
icon_target = """<Ionicons
            name={(isPlaying && !isPaused) ? 'pause' : 'play'}
            size={48} color="#FFF" style={{ marginLeft: (isPlaying && !isPaused) ? 0 : 6 }}
          />"""

icon_replacement = """<Ionicons
            name={tapIconName}
            size={48} color="#FFF" style={{ marginLeft: tapIconName === 'play' ? 6 : 0 }}
          />"""

content = content.replace(icon_target, icon_replacement)

with open('app/(tabs)/sleep.tsx', 'w') as f:
    f.write(content)

print("Applied!")

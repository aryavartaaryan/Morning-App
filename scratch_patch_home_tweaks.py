import sys

def main():
    file_path = 'app/(tabs)/index.tsx'
    with open(file_path, 'r') as f:
        content = f.read()

    # 1. Update the dock padding: Math.max(insets.bottom, 16) + 80 -> Math.max(insets.bottom, 16) + 55
    target_dock_pad = "paddingBottom: Math.max(insets.bottom, 16) + 80"
    rep_dock_pad = "paddingBottom: Math.max(insets.bottom, 16) + 55"
    if target_dock_pad in content:
        content = content.replace(target_dock_pad, rep_dock_pad)
    else:
        print("Dock padding target not found")

    # 2. Update Dock left button text and icon
    target_dock_btn = """                  {/* Insights */}
                  <TouchableOpacity
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSheetOpen(true); }}
                    activeOpacity={0.65}
                    style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRightWidth: 0.5, borderRightColor: 'rgba(255,255,255,0.10)' }}
                  >
                    <Ionicons name="compass-outline" size={20} color="#E2E8F0" />
                    <Text style={{ fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,0.8)', marginTop: 6, letterSpacing: 0.3 }}>Insights</Text>
                  </TouchableOpacity>"""
                  
    rep_dock_btn = """                  {/* Almanac */}
                  <TouchableOpacity
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSheetOpen(true); }}
                    activeOpacity={0.65}
                    style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRightWidth: 0.5, borderRightColor: 'rgba(255,255,255,0.10)' }}
                  >
                    <Ionicons name="journal-outline" size={20} color="#E2E8F0" />
                    <Text style={{ fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,0.8)', marginTop: 6, letterSpacing: 0.3 }}>Almanac</Text>
                  </TouchableOpacity>"""
                  
    if target_dock_btn in content:
        content = content.replace(target_dock_btn, rep_dock_btn)
    else:
        print("Dock button target not found")

    # 3. Reduce global margins
    # Main container gap: gap: 16 -> gap: 12
    target_gap = "<View style={{ width: '100%', paddingHorizontal: 24, alignItems: 'center', gap: 16 }}>"
    rep_gap = "<View style={{ width: '100%', paddingHorizontal: 24, alignItems: 'center', gap: 12 }}>"
    if target_gap in content:
        content = content.replace(target_gap, rep_gap)
        
    # Biorhythm card padding
    target_bio_pad = "paddingVertical: 36,"
    rep_bio_pad = "paddingVertical: 24,"
    # Wait, make sure we only replace it in the Biorhythm card
    if target_bio_pad in content:
        content = content.replace(target_bio_pad, rep_bio_pad, 1)

    # Active Bio-State Panel padding and margin
    target_active_pad = """                      width: '100%',
                      borderRadius: 24,
                      borderWidth: 0.5,
                      borderColor: 'rgba(255,255,255,0.2)',
                      paddingVertical: 14,"""
    rep_active_pad = """                      width: '100%',
                      borderRadius: 24,
                      borderWidth: 0.5,
                      borderColor: 'rgba(255,255,255,0.2)',
                      paddingVertical: 12,"""
    if target_active_pad in content:
        content = content.replace(target_active_pad, rep_active_pad)
        
    # ScrollView top/bottom padding
    target_scroll_pad = "paddingVertical: 12"
    rep_scroll_pad = "paddingVertical: 6"
    if target_scroll_pad in content:
        content = content.replace(target_scroll_pad, rep_scroll_pad)

    # 4. Add Breathing Animation
    target_aura_def = """const AmbientAura = ({ color }: { color: string }) => {
  const anim1 = React.useRef(new Animated.Value(0)).current;
  const anim2 = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.loop(
      Animated.parallel(["""
      
    rep_aura_def = """const AmbientAura = ({ color }: { color: string }) => {
  const anim1 = React.useRef(new Animated.Value(0)).current;
  const anim2 = React.useRef(new Animated.Value(0)).current;
  const breatheAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(breatheAnim, { toValue: 1, duration: 4000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(breatheAnim, { toValue: 0, duration: 4000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(
      Animated.parallel(["""

    if target_aura_def in content:
        content = content.replace(target_aura_def, rep_aura_def)
    else:
        print("Aura def target not found")

    target_aura_render = """  const opacity2 = anim2.interpolate({ inputRange: [0, 1], outputRange: [0.05, 0.20] });

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      {/* Top Left Aura Blob */}"""
      
    rep_aura_render = """  const opacity2 = anim2.interpolate({ inputRange: [0, 1], outputRange: [0.05, 0.20] });
  const breatheOpacity = breatheAnim.interpolate({ inputRange: [0, 1], outputRange: [0.0, 0.55] });

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      {/* Premium Breathing Dark Overlay */}
      <Animated.View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#000', opacity: breatheOpacity }]} />
      
      {/* Top Left Aura Blob */}"""
      
    if target_aura_render in content:
        content = content.replace(target_aura_render, rep_aura_render)
    else:
        print("Aura render target not found")

    with open(file_path, 'w') as f:
        f.write(content)
        
    print("Patched tweaks successfully!")

if __name__ == '__main__':
    main()

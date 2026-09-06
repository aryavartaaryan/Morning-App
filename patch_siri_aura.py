import sys

def main():
    file_path = 'app/(tabs)/index.tsx'
    with open(file_path, 'r') as f:
        content = f.read()

    aura_start = "const AmbientAura = ({ color }: { color: string }) => {"
    aura_end = "    </View>\n  );\n};"
    
    a_start_idx = content.find(aura_start)
    a_end_idx = content.find(aura_end, a_start_idx)
    
    if a_start_idx != -1 and a_end_idx != -1:
        new_aura = """const AmbientAura = ({ color }: { color: string }) => {
  const { bgUri } = useBgContext();
  const breatheAnim = React.useRef(new Animated.Value(0)).current;
  const rotateAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    // Breathing cycle for opacity and scale
    Animated.loop(
      Animated.sequence([
        Animated.timing(breatheAnim, { toValue: 1, duration: 8000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(breatheAnim, { toValue: 0, duration: 8000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();

    // Endless slow rotation for the Siri-style cloud
    Animated.loop(
      Animated.timing(rotateAnim, { toValue: 1, duration: 25000, easing: Easing.linear, useNativeDriver: true })
    ).start();
  }, []);

  // Background dims slightly to let the aura shine
  const bgOpacity = breatheAnim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 0.4] });
  
  // The energy cloud blooms (scales up and fades in)
  const cloudOpacity = breatheAnim.interpolate({ inputRange: [0, 1], outputRange: [0.0, 0.65] });
  const cloudScale = breatheAnim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.3] });
  
  const rotation = rotateAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const revRotation = rotateAnim.interpolate({ inputRange: [0, 1], outputRange: ['360deg', '0deg'] });

  return (
    <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#000' }]} pointerEvents="none">
      <Animated.Image 
        source={{ uri: bgUri }} 
        style={[StyleSheet.absoluteFillObject, { opacity: bgOpacity }]} 
        resizeMode="cover"
      />
      
      {/* ── The Siri-Style Amorphous Energy Cloud ── */}
      <Animated.View style={[StyleSheet.absoluteFillObject, { 
        alignItems: 'center', justifyContent: 'center',
        opacity: cloudOpacity,
        transform: [{ scale: cloudScale }, { rotate: rotation }]
      }]}>
        {/* Deep Violet Core */}
        <View style={{
          position: 'absolute', width: 280, height: 400, borderRadius: 200,
          backgroundColor: '#8B5CF6', opacity: 0.6,
          transform: [{ translateX: -40 }, { translateY: -50 }],
          shadowColor: '#8B5CF6', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 100, elevation: 20
        }} />
        {/* Soft Gold / Amber Edge */}
        <View style={{
          position: 'absolute', width: 300, height: 300, borderRadius: 150,
          backgroundColor: '#F59E0B', opacity: 0.4,
          transform: [{ translateX: 60 }, { translateY: 40 }],
          shadowColor: '#F59E0B', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 100, elevation: 20
        }} />
        {/* Cosmic Blue Swirl */}
        <Animated.View style={{
          position: 'absolute', width: 250, height: 350, borderRadius: 175,
          backgroundColor: '#3B82F6', opacity: 0.5,
          transform: [{ translateX: 10 }, { translateY: 60 }, { rotate: revRotation }],
          shadowColor: '#3B82F6', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 100, elevation: 20
        }} />
      </Animated.View>
"""
        content = content[:a_start_idx] + new_aura + content[a_end_idx:]
        with open(file_path, 'w') as f:
            f.write(content)
        print("Patched Siri Aura successfully.")

if __name__ == "__main__":
    main()

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
  const driftAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(breatheAnim, { toValue: 1, duration: 8000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(breatheAnim, { toValue: 0, duration: 8000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(
      Animated.timing(driftAnim, { toValue: 1, duration: 15000, easing: Easing.linear, useNativeDriver: true })
    ).start();
  }, []);

  const bgOpacity = breatheAnim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 0.4] });
  
  // Create 15 particles
  const particles = Array.from({ length: 15 }).map((_, i) => {
    const startY = 800 + (i * 50);
    const endY = -200;
    const xOffset = Math.sin(i) * 150;
    const size = 10 + (i % 3) * 10;
    const delay = (i * 1000) % 15000;
    
    const translateY = driftAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [startY, endY]
    });
    
    return (
      <Animated.View
        key={i}
        style={{
          position: 'absolute',
          width: size, height: size, borderRadius: size / 2,
          backgroundColor: i % 2 === 0 ? '#FCD34D' : '#38BDF8',
          opacity: 0.3,
          left: '50%',
          marginLeft: xOffset,
          transform: [{ translateY }],
          shadowColor: i % 2 === 0 ? '#FCD34D' : '#38BDF8',
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 1,
          shadowRadius: 20,
        }}
      />
    );
  });

  return (
    <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#000' }]} pointerEvents="none">
      <Animated.Image 
        source={{ uri: bgUri }} 
        style={[StyleSheet.absoluteFillObject, { opacity: bgOpacity }]} 
        resizeMode="cover"
      />
      
      {/* ── Bioluminescent Swarm (Option 3 Demo) ── */}
      <View style={StyleSheet.absoluteFillObject}>
        {particles}
      </View>
"""
        content = content[:a_start_idx] + new_aura + content[a_end_idx:]
        with open(file_path, 'w') as f:
            f.write(content)
        print("Patched Particle Swarm successfully.")

if __name__ == "__main__":
    main()

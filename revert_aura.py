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

  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(breatheAnim, { toValue: 1, duration: 7500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(breatheAnim, { toValue: 0, duration: 7500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const imageOpacity = breatheAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1.0] });

  return (
    <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#000' }]} pointerEvents="none">
      <Animated.Image 
        source={{ uri: bgUri }} 
        style={[StyleSheet.absoluteFillObject, { opacity: imageOpacity }]} 
        resizeMode="cover"
      />
"""
        content = content[:a_start_idx] + new_aura + content[a_end_idx:]
        with open(file_path, 'w') as f:
            f.write(content)
        print("Removed aura successfully.")

if __name__ == "__main__":
    main()

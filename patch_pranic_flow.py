import sys

def main():
    file_path = 'app/(tabs)/index.tsx'
    with open(file_path, 'r') as f:
        content = f.read()

    # Find the AmbientAura component
    start_str = "const AmbientAura = ({ color }: { color: string }) => {"
    end_str = "};\n"
    
    start_idx = content.find(start_str)
    if start_idx == -1:
        print("AmbientAura not found")
        sys.exit(1)
        
    end_idx = content.find(end_str, start_idx)
    
    new_aura = """const AmbientAura = ({ color }: { color: string }) => {
  const { bgUri } = useBgContext();
  const anim1 = React.useRef(new Animated.Value(0)).current;
  const anim2 = React.useRef(new Animated.Value(0)).current;
  const breatheAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(breatheAnim, { toValue: 1, duration: 7500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(breatheAnim, { toValue: 0, duration: 7500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(anim1, { toValue: 1, duration: 25000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(anim1, { toValue: 0, duration: 25000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(anim2, { toValue: 1, duration: 30000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(anim2, { toValue: 0, duration: 30000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
      ])
    ).start();
  }, []);

  const translateY1 = anim1.interpolate({ inputRange: [0, 1], outputRange: [-100, 100] });
  const scale1 = anim1.interpolate({ inputRange: [0, 1], outputRange: [1, 1.2] });
  // Parallax background breathing scale
  const bgScale = breatheAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.03] });
  
  // Ultra premium transparent aura
  const opacity1 = anim1.interpolate({ inputRange: [0, 1], outputRange: [0.0, 0.08] });

  const translateY2 = anim2.interpolate({ inputRange: [0, 1], outputRange: [100, -100] });
  const scale2 = anim2.interpolate({ inputRange: [0, 1], outputRange: [1.1, 0.95] });
  const opacity2 = anim2.interpolate({ inputRange: [0, 1], outputRange: [0.0, 0.08] });
  
  // Cinematic dark breathing overlay
  const breatheOpacity = breatheAnim.interpolate({ inputRange: [0, 1], outputRange: [0.05, 0.4] });

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      <Animated.Image 
        source={bgUri ? { uri: bgUri } : undefined} 
        style={[StyleSheet.absoluteFillObject, { transform: [{ scale: bgScale }] }]} 
        resizeMode="cover" 
      />
      
      <Animated.View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#000000', opacity: breatheOpacity }]} />
      
      <Animated.View style={{
        position: 'absolute', top: '5%', left: '-25%', width: 650, height: 650, borderRadius: 325,
        backgroundColor: color, opacity: opacity1, transform: [{ translateY: translateY1 }, { scale: scale1 }],
      }} />
      
      <Animated.View style={{
        position: 'absolute', top: '45%', right: '-25%', width: 750, height: 750, borderRadius: 375,
        backgroundColor: color, opacity: opacity2, transform: [{ translateY: translateY2 }, { scale: scale2 }],
      }} />
    </View>
  );
"""
    
    content = content[:start_idx] + new_aura + content[end_idx:]
    
    # Remove `<AppBackground />` from index.tsx since AmbientAura now handles it
    if "<AppBackground />" in content:
        content = content.replace("<AppBackground />", "")
    else:
        print("Warning: <AppBackground /> not found")

    with open(file_path, 'w') as f:
        f.write(content)

if __name__ == '__main__':
    main()

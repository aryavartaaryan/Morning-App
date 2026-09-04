import sys

def main():
    file_path = 'app/(tabs)/index.tsx'
    with open(file_path, 'r') as f:
        content = f.read()

    # Find AmbientAura component
    start_str = "const AmbientAura = ({ color }: { color: string }) => {"
    end_str = "};\n"
    
    start_idx = content.find(start_str)
    if start_idx == -1:
        print("AmbientAura not found")
        sys.exit(1)
        
    end_idx = content.find(end_str, start_idx)
    
    new_aura = """const AmbientAura = ({ color }: { color: string }) => {
  const anim1 = React.useRef(new Animated.Value(0)).current;
  const anim2 = React.useRef(new Animated.Value(0)).current;
  const breatheAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(breatheAnim, { toValue: 1, duration: 6000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(breatheAnim, { toValue: 0, duration: 6000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
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
  // Make aura very light and transparent
  const opacity1 = anim1.interpolate({ inputRange: [0, 1], outputRange: [0.0, 0.07] });

  const translateY2 = anim2.interpolate({ inputRange: [0, 1], outputRange: [100, -100] });
  const scale2 = anim2.interpolate({ inputRange: [0, 1], outputRange: [1.1, 0.95] });
  const opacity2 = anim2.interpolate({ inputRange: [0, 1], outputRange: [0.0, 0.07] });
  
  // Premium deep breathing overlay
  const breatheOpacity = breatheAnim.interpolate({ inputRange: [0, 1], outputRange: [0.0, 0.25] });

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      <Animated.View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#000000', opacity: breatheOpacity }]} />
      
      <Animated.View style={{
        position: 'absolute', top: '10%', left: '-20%', width: 600, height: 600, borderRadius: 300,
        backgroundColor: color, opacity: opacity1, transform: [{ translateY: translateY1 }, { scale: scale1 }],
      }} />
      
      <Animated.View style={{
        position: 'absolute', top: '50%', right: '-20%', width: 700, height: 700, borderRadius: 350,
        backgroundColor: color, opacity: opacity2, transform: [{ translateY: translateY2 }, { scale: scale2 }],
      }} />
    </View>
  );
"""
    
    content = content[:start_idx] + new_aura + content[end_idx:]
    with open(file_path, 'w') as f:
        f.write(content)

if __name__ == '__main__':
    main()

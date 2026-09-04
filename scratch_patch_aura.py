import sys

def main():
    file_path = 'app/(tabs)/index.tsx'
    with open(file_path, 'r') as f:
        content = f.read()

    target_aura_block = """const AmbientAura = ({ color }: { color: string }) => {
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
      Animated.parallel([
        Animated.sequence([
          Animated.timing(anim1, { toValue: 1, duration: 18000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(anim1, { toValue: 0, duration: 18000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(anim2, { toValue: 1, duration: 22000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(anim2, { toValue: 0, duration: 22000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
      ])
    ).start();
  }, []);

  const translateY1 = anim1.interpolate({ inputRange: [0, 1], outputRange: [-150, 150] });
  const scale1 = anim1.interpolate({ inputRange: [0, 1], outputRange: [1, 1.4] });
  const opacity1 = anim1.interpolate({ inputRange: [0, 1], outputRange: [0.05, 0.20] });

  const translateY2 = anim2.interpolate({ inputRange: [0, 1], outputRange: [150, -150] });
  const scale2 = anim2.interpolate({ inputRange: [0, 1], outputRange: [1.2, 0.9] });
  const opacity2 = anim2.interpolate({ inputRange: [0, 1], outputRange: [0.05, 0.20] });
  const breatheOpacity = breatheAnim.interpolate({ inputRange: [0, 1], outputRange: [0.0, 0.55] });

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      {/* Premium Breathing Dark Overlay */}
      <Animated.View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#000', opacity: breatheOpacity }]} />
      
      {/* Top Left Aura Blob */}
      <Animated.View style={{
        position: 'absolute', top: '10%', left: '-40%', width: 800, height: 800, borderRadius: 400,
        backgroundColor: color, opacity: opacity1, transform: [{ translateY: translateY1 }, { scale: scale1 }],
      }} />
      
      {/* Bottom Right Aura Blob */}
      <Animated.View style={{
        position: 'absolute', top: '45%', right: '-40%', width: 900, height: 900, borderRadius: 450,
        backgroundColor: color, opacity: opacity2, transform: [{ translateY: translateY2 }, { scale: scale2 }],
      }} />
      
      {/* Universal Soft Tint */}
      <Animated.View style={[StyleSheet.absoluteFillObject, { backgroundColor: color, opacity: 0.04 }]} />
    </View>
  );
};"""

    replacement_aura_block = """const AmbientAura = ({ color }: { color: string }) => {
  const anim1 = React.useRef(new Animated.Value(0)).current;
  const anim2 = React.useRef(new Animated.Value(0)).current;
  const breatheAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(breatheAnim, { toValue: 1, duration: 4500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(breatheAnim, { toValue: 0, duration: 4500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
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
  // Calming, extremely subtle opacity
  const opacity1 = anim1.interpolate({ inputRange: [0, 1], outputRange: [0.03, 0.12] });

  const translateY2 = anim2.interpolate({ inputRange: [0, 1], outputRange: [100, -100] });
  const scale2 = anim2.interpolate({ inputRange: [0, 1], outputRange: [1.1, 0.95] });
  const opacity2 = anim2.interpolate({ inputRange: [0, 1], outputRange: [0.03, 0.12] });
  
  // Calming dark blue breathing overlay like sleep page instead of pure black
  const breatheOpacity = breatheAnim.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.45] });

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      {/* Sleep-page style dark calming breathing overlay */}
      <Animated.View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#0f172a', opacity: breatheOpacity }]} />
      
      {/* Top Left Aura Blob - Using deep calming purple/blue instead of stark daytime color */}
      <Animated.View style={{
        position: 'absolute', top: '10%', left: '-20%', width: 600, height: 600, borderRadius: 300,
        backgroundColor: '#3b0764', opacity: opacity1, transform: [{ translateY: translateY1 }, { scale: scale1 }],
      }} />
      
      {/* Bottom Right Aura Blob */}
      <Animated.View style={{
        position: 'absolute', top: '50%', right: '-20%', width: 700, height: 700, borderRadius: 350,
        backgroundColor: '#172554', opacity: opacity2, transform: [{ translateY: translateY2 }, { scale: scale2 }],
      }} />
    </View>
  );
};"""

    if target_aura_block in content:
        content = content.replace(target_aura_block, replacement_aura_block)
        print("Replaced AmbientAura successfully.")
    else:
        print("Could not find AmbientAura block.")

    with open(file_path, 'w') as f:
        f.write(content)

if __name__ == '__main__':
    main()

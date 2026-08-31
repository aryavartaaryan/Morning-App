import sys
import re

def main():
    file_path = 'app/(tabs)/index.tsx'
    with open(file_path, 'r') as f:
        content = f.read()

    # Define the AmbientAura component
    aura_comp = """
const AmbientAura = ({ color }: { color: string }) => {
  const anim1 = React.useRef(new Animated.Value(0)).current;
  const anim2 = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
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
  const opacity1 = anim1.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.35] });

  const translateY2 = anim2.interpolate({ inputRange: [0, 1], outputRange: [150, -150] });
  const scale2 = anim2.interpolate({ inputRange: [0, 1], outputRange: [1.2, 0.9] });
  const opacity2 = anim2.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.35] });

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
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
      <Animated.View style={[StyleSheet.absoluteFillObject, { backgroundColor: color, opacity: 0.1 }]} />
    </View>
  );
};
"""

    # Insert it before the `export default`
    export_str = "export default withScreenBoundary(DailyTab, 'Home');"
    if export_str not in content:
        print("Export not found!")
        sys.exit(1)
        
    content = content.replace(export_str, aura_comp + "\n" + export_str)

    # Insert it into the render tree right after the background and dark overlay
    render_target = """      {/* ── Dark Overlay for Contrast ── */}
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.45)' }]} />"""
      
    render_replacement = """      {/* ── Dark Overlay for Contrast ── */}
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.45)' }]} />
      
      {/* ── Dynamic Ambient Aura (Living UI) ── */}
      <AmbientAura color={currentPeriod?.color || '#00D4B8'} />"""
      
    if render_target not in content:
        print("Render target not found!")
        sys.exit(1)
        
    content = content.replace(render_target, render_replacement)
    
    with open(file_path, 'w') as f:
        f.write(content)
        
    print("Patched Ambient Aura successfully!")

if __name__ == '__main__':
    main()

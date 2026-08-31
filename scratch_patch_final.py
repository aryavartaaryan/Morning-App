import sys

def main():
    file_path = 'app/(tabs)/index.tsx'
    with open(file_path, 'r') as f:
        content = f.read()

    # 1. Fix dock paddingBottom
    target_dock = "paddingBottom: Math.max(insets.bottom, 16) + 12"
    rep_dock = "paddingBottom: Math.max(insets.bottom, 16) + 80"
    
    if target_dock in content:
        content = content.replace(target_dock, rep_dock)
    else:
        print("Dock target not found!")
        
    # 2. Fix AmbientAura opacity
    target_aura_blobs = """  const opacity1 = anim1.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.35] });

  const translateY2 = anim2.interpolate({ inputRange: [0, 1], outputRange: [150, -150] });
  const scale2 = anim2.interpolate({ inputRange: [0, 1], outputRange: [1.2, 0.9] });
  const opacity2 = anim2.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.35] });"""
  
    rep_aura_blobs = """  const opacity1 = anim1.interpolate({ inputRange: [0, 1], outputRange: [0.05, 0.20] });

  const translateY2 = anim2.interpolate({ inputRange: [0, 1], outputRange: [150, -150] });
  const scale2 = anim2.interpolate({ inputRange: [0, 1], outputRange: [1.2, 0.9] });
  const opacity2 = anim2.interpolate({ inputRange: [0, 1], outputRange: [0.05, 0.20] });"""

    if target_aura_blobs in content:
        content = content.replace(target_aura_blobs, rep_aura_blobs)
    else:
        print("Aura blobs target not found!")
        
    target_aura_tint = """      {/* Universal Soft Tint */}
      <Animated.View style={[StyleSheet.absoluteFillObject, { backgroundColor: color, opacity: 0.1 }]} />"""
      
    rep_aura_tint = """      {/* Universal Soft Tint */}
      <Animated.View style={[StyleSheet.absoluteFillObject, { backgroundColor: color, opacity: 0.04 }]} />"""

    if target_aura_tint in content:
        content = content.replace(target_aura_tint, rep_aura_tint)
    else:
        print("Aura tint target not found!")

    with open(file_path, 'w') as f:
        f.write(content)
        
    print("Patched dock padding and aura opacity successfully!")

if __name__ == '__main__':
    main()

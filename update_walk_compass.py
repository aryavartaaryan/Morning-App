import re

with open("app/(tabs)/walk.tsx", "r") as f:
    text = f.read()

# 1. Update HarmonyCompassSVG to accept gyroX and gyroY
old_compass_sig = "const HarmonyCompassSVG = ({ size, activeZoneData, pulseAnim, compassRotAnim, compassInnerRotAnim, breathingScaleAnim }: any) => {"
new_compass_sig = "const HarmonyCompassSVG = ({ size, activeZoneData, pulseAnim, compassRotAnim, compassInnerRotAnim, breathingScaleAnim, gyroX, gyroY }: any) => {"
text = text.replace(old_compass_sig, new_compass_sig)

# 2. Add 3D perspective transforms
# Find the return ( ... <View style={{ width: size
old_return = "return (\n    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>"
new_return = """  // 3D Parallax interpolation
  const rotX = gyroY ? gyroY.interpolate({ inputRange: [-15, 15], outputRange: ['-25deg', '25deg'], extrapolate: 'clamp' }) : '0deg';
  const rotY = gyroX ? gyroX.interpolate({ inputRange: [-15, 15], outputRange: ['-25deg', '25deg'], extrapolate: 'clamp' }) : '0deg';

  return (
    <Animated.View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center', transform: [{ perspective: 1000 }, { rotateX: rotX }, { rotateY: rotY }] }}>"""
text = text.replace(old_return, new_return)

# Also replace the closing </View> of HarmonyCompassSVG to </Animated.View>
# Since there are multiple Views, we need to be careful. The outer view ends at the end of the component.
# It's right before `};`
text = re.sub(r'</View>\n  \);\n};', '</Animated.View>\n  );\n};', text)

# 3. Update the Energy Beam path
old_beam = """                  {/* Energy Beam */}
                  <Path
                    d={`M ${center} ${center - r * 0.1} L ${center + r * 0.95} ${center - 8} A ${r * 0.95} ${r * 0.95} 0 0 1 ${center + r * 0.95} ${center + 8} Z`}
                    fill={`url(#beamGlow-${index})`}
                    opacity={0.6}
                  />"""

# Using 45 degree spread (22.5 each way). sin(22.5)=0.38268, cos(22.5)=0.92388
new_beam = """                  {/* Energy Beam */}
                  <Path
                    d={`M ${center} ${center} L ${center + r * 0.95 * 0.92388} ${center - r * 0.95 * 0.38268} A ${r * 0.95} ${r * 0.95} 0 0 1 ${center + r * 0.95 * 0.92388} ${center + r * 0.95 * 0.38268} Z`}
                    fill={`url(#beamGlow-${index})`}
                    opacity={0.4}
                  />"""
text = text.replace(old_beam, new_beam)

# 4. Pass gyroX and gyroY to HarmonyCompassSVG in the render method
old_compass_usage = """          <HarmonyCompassSVG 
            size={W * 0.85} 
            activeZoneData={activeZoneData} 
            pulseAnim={pulseAnim} 
            compassRotAnim={compassRotAnim}
            compassInnerRotAnim={compassInnerRotAnim}
            breathingScaleAnim={breathingScaleAnim}
          />"""

new_compass_usage = """          <HarmonyCompassSVG 
            size={W * 0.85} 
            activeZoneData={activeZoneData} 
            pulseAnim={pulseAnim} 
            compassRotAnim={compassRotAnim}
            compassInnerRotAnim={compassInnerRotAnim}
            breathingScaleAnim={breathingScaleAnim}
            gyroX={gyroX}
            gyroY={gyroY}
          />"""
text = text.replace(old_compass_usage, new_compass_usage)

# 5. Reset state on blur (useFocusEffect)
# First, import useFocusEffect
if "useFocusEffect" not in text:
    text = text.replace("import { useSafeAreaInsets }", "import { useFocusEffect } from 'expo-router';\nimport { useSafeAreaInsets }")
    text = text.replace("import React, { useState, useEffect, useRef }", "import React, { useState, useEffect, useRef, useCallback }")

# Insert useFocusEffect inside HarmonyCompassScreen
# We can find `const fadeAnim = useRef(new Animated.Value(0)).current;` and put it after that.
hook_code = """
  // Reset state when screen loses focus
  useFocusEffect(
    useCallback(() => {
      return () => {
        setIsCompassActive(false);
        setSelectedZone(null);
        setDropdownOpen(false);
      };
    }, [])
  );
"""

if "useFocusEffect(\n    useCallback(" not in text:
    text = text.replace("const fadeAnim = useRef(new Animated.Value(0)).current;", "const fadeAnim = useRef(new Animated.Value(0)).current;\n" + hook_code)

with open("app/(tabs)/walk.tsx", "w") as f:
    f.write(text)

print("Compass enhancements applied.")

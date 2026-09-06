import sys
import re

def main():
    file_path = 'app/(tabs)/index.tsx'
    with open(file_path, 'r') as f:
        content = f.read()

    # 1. Add Switch import if missing
    if "Switch" not in content[:1000]:
        content = content.replace("from 'react-native';", ", Switch } from 'react-native';")

    # 2. Update Bio-State Card Shadow
    old_card_style = """                      <BlurView intensity={50} tint="dark" style={{
                        width: '100%',
                        borderRadius: 24,
                        borderWidth: 0.5,
                        borderColor: 'rgba(255,255,255,0.2)',
                        paddingVertical: 14,
                        paddingHorizontal: 20,
                        overflow: 'hidden',
                        backgroundColor: 'rgba(0,0,0,0.3)',
                      }}>"""
                      
    new_card_style = """                      <BlurView intensity={50} tint="dark" style={{
                        width: '100%',
                        borderRadius: 24,
                        borderWidth: 1,
                        borderColor: 'rgba(255,255,255,0.15)',
                        paddingVertical: 20,
                        paddingHorizontal: 20,
                        overflow: 'hidden',
                        backgroundColor: 'rgba(10,10,10,0.4)',
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 24 },
                        shadowOpacity: 0.6,
                        shadowRadius: 32,
                        elevation: 20,
                      }}>"""
    
    if old_card_style in content:
        content = content.replace(old_card_style, new_card_style)
    else:
        # regex replace
        content = re.sub(
            r"<BlurView intensity=\{50\} tint=\"dark\" style=\{\{[^}]*backgroundColor: 'rgba\(0,0,0,0\.3\)',\s*\}\}>",
            new_card_style,
            content,
            flags=re.MULTILINE
        )

    # 3. Update Cultivate / Pause lists with Toggles
    # Look for the map function inside the columns
    old_cultivate = """                              {currentPeriod.activities.slice(0, 2).map((act, i) => (
                                <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
                                  <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: currentPeriod.color || '#4ade80', marginTop: 6 }} />
                                  <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.9)', fontWeight: '500', lineHeight: 16, flex: 1 }}>{act}</Text>
                                </View>
                              ))}"""
                              
    new_cultivate = """                              {currentPeriod.activities.slice(0, 3).map((act: string, i: number) => (
                                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                                    <Ionicons name="leaf-outline" size={12} color={currentPeriod.color || '#4ade80'} />
                                    <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.9)', fontWeight: '500', flex: 1 }} numberOfLines={1}>{act}</Text>
                                  </View>
                                  <Switch 
                                    trackColor={{ false: 'rgba(255,255,255,0.1)', true: 'rgba(252, 211, 77, 0.5)' }}
                                    thumbColor={'#fff'}
                                    ios_backgroundColor="rgba(255,255,255,0.1)"
                                    style={{ transform: [{ scaleX: 0.6 }, { scaleY: 0.6 }] }}
                                    value={false}
                                  />
                                </View>
                              ))}"""
                              
    old_pause = """                              {currentPeriod.avoidances && currentPeriod.avoidances.slice(0, 2).map((act, i) => (
                                <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
                                  <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: '#f87171', marginTop: 6 }} />
                                  <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: '500', lineHeight: 16, flex: 1 }}>{act}</Text>
                                </View>
                              ))}"""
                              
    new_pause = """                              {currentPeriod.avoidances && currentPeriod.avoidances.slice(0, 3).map((act: string, i: number) => (
                                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                                    <Ionicons name="close-circle-outline" size={12} color="#f87171" />
                                    <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: '500', flex: 1 }} numberOfLines={1}>{act}</Text>
                                  </View>
                                  <Switch 
                                    trackColor={{ false: 'rgba(255,255,255,0.1)', true: 'rgba(248, 113, 113, 0.5)' }}
                                    thumbColor={'#fff'}
                                    ios_backgroundColor="rgba(255,255,255,0.1)"
                                    style={{ transform: [{ scaleX: 0.6 }, { scaleY: 0.6 }] }}
                                    value={false}
                                  />
                                </View>
                              ))}"""
                              
    content = content.replace(old_cultivate, new_cultivate)
    content = content.replace(old_pause, new_pause)
    
    # 4. Localized Auras for Option A
    # Find AmbientAura return statement
    old_aura = """  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      <Animated.Image 
        source={{ uri: bgUri }} 
        style={[StyleSheet.absoluteFillObject, { transform: [{ scale: bgScale }] }]} 
        resizeMode="cover" 
      />
      <Animated.View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#000', opacity: breatheOpacity }]} />
      
      {/* Thermo-responsive Auras */}
      <Animated.View style={{
        position: 'absolute',
        top: -100, left: -100,
        width: 400, height: 400,
        borderRadius: 200,
        backgroundColor: color,
        opacity: opacity1,
        transform: [{ translateY: translateY1 }, { scale: scale1 }],
        filter: [{ blur: 60 }]
      }} />
      
      <Animated.View style={{
        position: 'absolute',
        bottom: -100, right: -100,
        width: 350, height: 350,
        borderRadius: 175,
        backgroundColor: secondaryColor,
        opacity: opacity2,
        transform: [{ translateY: translateY2 }, { scale: scale2 }],
        filter: [{ blur: 50 }]
      }} />
    </View>
  );"""
  
    new_aura = """  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      <Animated.Image 
        source={{ uri: bgUri }} 
        style={[StyleSheet.absoluteFillObject, { transform: [{ scale: bgScale }] }]} 
        resizeMode="cover" 
      />
      {/* Constant 60% overlay, pulsing up to 80% on exhale */}
      <Animated.View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#000', opacity: breatheOpacity }]} />
      
      {/* 
        OPTION A Auras: 
        Aura 1 (Golden) positioned precisely behind the top Mantra card.
        Aura 2 (Orange) positioned behind the Bio-State card.
      */}
      <Animated.View style={{
        position: 'absolute',
        top: '15%', left: '10%', right: '10%',
        height: 250,
        borderRadius: 150,
        backgroundColor: '#FCD34D', // Deep glowing Gold
        opacity: opacity1,
        transform: [{ scale: scale1 }],
      }} />
      
      <Animated.View style={{
        position: 'absolute',
        top: '45%', left: '5%', right: '5%',
        height: 250,
        borderRadius: 150,
        backgroundColor: '#EA580C', // Deep Orange
        opacity: opacity2,
        transform: [{ scale: scale2 }],
      }} />
    </View>
  );"""
  
    # Adjust breatheOpacity to match 60% base overlay mentioned in prompt
    old_breatheOpacity = "const breatheOpacity = breatheAnim.interpolate({ inputRange: [0, 1], outputRange: [0.0, 0.55] });"
    new_breatheOpacity = "const breatheOpacity = breatheAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0.75] });"
    content = content.replace(old_breatheOpacity, new_breatheOpacity)
    
    # Adjust aura opacities to pulse significantly behind the cards
    old_op1 = "const opacity1 = anim1.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.0, 0.25, 0.05] });"
    new_op1 = "const opacity1 = breatheAnim.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.35] });"
    content = content.replace(old_op1, new_op1)
    
    old_op2 = "const opacity2 = anim2.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.0, 0.22, 0.04] });"
    new_op2 = "const opacity2 = breatheAnim.interpolate({ inputRange: [0, 1], outputRange: [0.1, 0.25] });"
    content = content.replace(old_op2, new_op2)

    # Note: I replaced the interpolation logic for opacity1 and opacity2 to use `breatheAnim` instead of `anim1/anim2` 
    # so they pulse in perfect harmony with the background breath, creating that "Aura Ebb & Flow" exactly as requested.

    if old_aura in content:
        content = content.replace(old_aura, new_aura)

    with open(file_path, 'w') as f:
        f.write(content)

if __name__ == "__main__":
    main()

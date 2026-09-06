import sys
import re

def main():
    file_path = 'app/(tabs)/index.tsx'
    with open(file_path, 'r') as f:
        content = f.read()

    # Find the block we want to replace
    start_marker = "                        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>"
    end_marker = "                        </View>\n                      </BlurView>"
    
    start_idx = content.find(start_marker)
    if start_idx == -1:
        print("Could not find start marker")
        return
        
    end_idx = content.find(end_marker, start_idx)
    if end_idx == -1:
        print("Could not find end marker")
        return

    # Let's also patch the pct calculation into the top of the function
    calc_start = "                  const minsLeftRem = minsLeft % 60;\n                  const timeStr = hrsLeft > 0 ? `${hrsLeft}h ${minsLeftRem}m` : `${minsLeftRem}m`;"
    calc_replacement = """                  const minsLeftRem = minsLeft % 60;
                  const timeStr = hrsLeft > 0 ? `${hrsLeft}h ${minsLeftRem}m` : `${minsLeftRem}m`;
                  const start = currentPeriod.startH;
                  const end = currentPeriod.endH;
                  const total = end > start ? end - start : (24 - start) + end;
                  const elapsed = nowH > start ? nowH - start : (24 - start) + nowH;
                  const pct = Math.min(100, Math.max(0, (elapsed / total) * 100));"""
                  
    content = content.replace(calc_start, calc_replacement)

    new_card_ui = """                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20 }}>
                          {/* Left: Progress Ring */}
                          <View style={{ position: 'relative', width: 68, height: 68, alignItems: 'center', justifyContent: 'center' }}>
                            <Svg width={68} height={68} viewBox="0 0 68 68" style={{ transform: [{ rotate: '-90deg' }] }}>
                              <SvgCircle cx={34} cy={34} r={30} stroke="rgba(255,255,255,0.06)" strokeWidth={5} fill="none" />
                              <SvgCircle 
                                cx={34} 
                                cy={34} 
                                r={30} 
                                stroke={currentPeriod.color || '#FCD34D'} 
                                strokeWidth={5} 
                                fill="none" 
                                strokeDasharray={`${30 * 2 * Math.PI}`} 
                                strokeDashoffset={`${30 * 2 * Math.PI * (1 - (pct / 100))}`} 
                                strokeLinecap="round" 
                              />
                            </Svg>
                            <View style={{ position: 'absolute', alignItems: 'center', justifyContent: 'center' }}>
                              <Text style={{ fontSize: 13, fontWeight: '800', color: '#FFF' }}>{hrsLeft}h</Text>
                              <Text style={{ fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.6)' }}>{minsLeftRem}m</Text>
                            </View>
                          </View>
                          
                          {/* Right: Text & Minimalist Icons */}
                          <View style={{ flex: 1, gap: 4 }}>
                            <Text style={{ fontSize: 9, fontWeight: '800', color: '#FFF', letterSpacing: 1.5, textTransform: 'uppercase', opacity: 0.5 }}>ACTIVE BIO-STATE</Text>
                            <Text style={{ fontSize: 14, fontWeight: '800', color: currentPeriod.color || '#FCD34D', letterSpacing: 0.5, lineHeight: 18 }}>{currentPeriod.englishLabel}</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 }}>
                              <Ionicons name="moon-outline" size={14} color="rgba(255,255,255,0.7)" />
                              <Ionicons name="water-outline" size={14} color="rgba(255,255,255,0.7)" />
                              <Ionicons name="leaf-outline" size={14} color="rgba(255,255,255,0.7)" />
                              <View style={{ width: 1, height: 12, backgroundColor: 'rgba(255,255,255,0.15)', marginHorizontal: 4 }} />
                              <Ionicons name="cafe-outline" size={14} color="rgba(255,255,255,0.2)" />
                              <Ionicons name="phone-portrait-outline" size={14} color="rgba(255,255,255,0.2)" />
                            </View>
                          </View>
                          <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.2)" />
"""

    content = content[:start_idx] + new_card_ui + content[end_idx:]

    # Now let's patch the AmbientAura to make the aura golden and strictly behind the Mantra card.
    # We will search for AmbientAura component.
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

  const bgScale = breatheAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] });
  const breatheOpacity = breatheAnim.interpolate({ inputRange: [0, 1], outputRange: [0.0, 0.45] });
  
  // The Localized Golden Aura (Behind Mantra Card)
  const auraScale = breatheAnim.interpolate({ inputRange: [0, 1], outputRange: [1.0, 1.4] });
  const auraOpacity = breatheAnim.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.45] });

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      <Animated.Image 
        source={{ uri: bgUri }} 
        style={[StyleSheet.absoluteFillObject, { transform: [{ scale: bgScale }] }]} 
        resizeMode="cover"
        blurRadius={6}
      />
      
      {/* ── Localized Golden Aura (Top Half Only) ── */}
      <Animated.View style={{
        position: 'absolute',
        top: '15%',
        left: '10%',
        right: '10%',
        height: '40%',
        backgroundColor: '#FCD34D',
        borderRadius: 200,
        opacity: auraOpacity,
        transform: [{ scale: auraScale }],
        shadowColor: '#FBBF24',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 100,
        elevation: 20,
      }} />
      <Animated.View style={{
        position: 'absolute',
        top: '15%',
        left: '10%',
        right: '10%',
        height: '40%',
        backgroundColor: '#F59E0B',
        borderRadius: 200,
        opacity: breatheAnim.interpolate({ inputRange: [0, 1], outputRange: [0.0, 0.3] }),
        transform: [{ scale: auraScale }],
        shadowColor: '#F59E0B',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 60,
      }} />

      <Animated.View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#000', opacity: breatheOpacity }]} />
      {/* Base heavy overlay to make everything pop */}
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.5)' }]} />
"""
        content = content[:a_start_idx] + new_aura + content[a_end_idx:]

    with open(file_path, 'w') as f:
        f.write(content)

if __name__ == "__main__":
    main()

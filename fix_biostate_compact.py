import sys

def main():
    file_path = 'app/(tabs)/index.tsx'
    with open(file_path, 'r') as f:
        content = f.read()

    start_marker = "                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20 }}>"
    end_marker = "                      </BlurView>"
    
    start_idx = content.find(start_marker)
    end_idx = content.find(end_marker, start_idx)
    
    if start_idx != -1 and end_idx != -1:
        new_layout = """                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                          {/* Progress Ring */}
                          <View style={{ position: 'relative', width: 56, height: 56, alignItems: 'center', justifyContent: 'center' }}>
                            <Svg width={56} height={56} viewBox="0 0 56 56" style={{ transform: [{ rotate: '-90deg' }] }}>
                              <SvgCircle cx={28} cy={28} r={24} stroke="rgba(255,255,255,0.06)" strokeWidth={4} fill="none" />
                              <SvgCircle 
                                cx={28} cy={28} r={24} 
                                stroke={currentPeriod.color || '#A78BFA'} 
                                strokeWidth={4} fill="none" 
                                strokeDasharray={`${24 * 2 * Math.PI}`} 
                                strokeDashoffset={`${24 * 2 * Math.PI * (1 - (pct / 100))}`} 
                                strokeLinecap="round" 
                              />
                            </Svg>
                            <View style={{ position: 'absolute', alignItems: 'center', justifyContent: 'center' }}>
                              <Text style={{ fontSize: 13, fontWeight: '800', color: '#FFF' }}>{hrsLeft}h</Text>
                              <Text style={{ fontSize: 9, fontWeight: '700', color: 'rgba(255,255,255,0.6)' }}>{minsLeftRem}m</Text>
                            </View>
                          </View>
                          
                          {/* Details */}
                          <View style={{ flex: 1, gap: 2 }}>
                            <Text style={{ fontSize: 9, fontWeight: '800', color: 'rgba(255,255,255,0.5)', letterSpacing: 1.2, textTransform: 'uppercase' }}>ACTIVE BIO-STATE</Text>
                            <Text style={{ fontSize: 15, fontWeight: '800', color: currentPeriod.color || '#A78BFA', letterSpacing: 0 }}>{currentPeriod.englishLabel}</Text>
                            
                            {/* Icons Row */}
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                              <Ionicons name="moon-outline" size={13} color="rgba(255,255,255,0.7)" />
                              <Ionicons name="water-outline" size={13} color="rgba(255,255,255,0.7)" />
                              <Ionicons name="leaf-outline" size={13} color="rgba(255,255,255,0.7)" />
                              <Text style={{ color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>|</Text>
                              <Ionicons name="desktop-outline" size={13} color="rgba(255,255,255,0.2)" />
                              <Ionicons name="phone-portrait-outline" size={13} color="rgba(255,255,255,0.2)" />
                            </View>
                          </View>
                          
                          <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.2)" />
                        </View>
                        
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
                          <Text style={{ fontSize: 9, fontWeight: '600', color: 'rgba(255,255,255,0.3)', letterSpacing: 0.5, textTransform: 'uppercase' }}>Tap to view metabolic state</Text>
                          <Ionicons name="chevron-forward" size={9} color="rgba(255,255,255,0.3)" style={{ marginLeft: 4 }} />
                        </View>
"""
        content = content[:start_idx] + new_layout + content[end_idx:]

        # Make the padding of the card container smaller as well
        content = content.replace("paddingVertical: 20,\n                        paddingHorizontal: 20,", "paddingVertical: 14,\n                        paddingHorizontal: 16,")

        with open(file_path, 'w') as f:
            f.write(content)
        print("Fixed Bio-State bug and made it compact.")
    else:
        print("Could not find start/end markers.")

if __name__ == "__main__":
    main()

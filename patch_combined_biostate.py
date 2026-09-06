import sys

def main():
    file_path = 'app/(tabs)/index.tsx'
    with open(file_path, 'r') as f:
        content = f.read()

    start_marker = "                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>"
    end_marker = "                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 18 }}>"
    
    start_idx = content.find(start_marker)
    if start_idx == -1:
        print("Could not find start marker")
        return
        
    end_idx = content.find(end_marker, start_idx)
    if end_idx == -1:
        print("Could not find end marker")
        return

    new_layout = """                        {/* Top Section: Ring & Title */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20, marginBottom: 16 }}>
                          {/* Progress Ring */}
                          <View style={{ position: 'relative', width: 64, height: 64, alignItems: 'center', justifyContent: 'center' }}>
                            <Svg width={64} height={64} viewBox="0 0 64 64" style={{ transform: [{ rotate: '-90deg' }] }}>
                              <SvgCircle cx={32} cy={32} r={28} stroke="rgba(255,255,255,0.06)" strokeWidth={4} fill="none" />
                              <SvgCircle 
                                cx={32} cy={32} r={28} 
                                stroke={currentPeriod.color || '#8B5CF6'} 
                                strokeWidth={4} fill="none" 
                                strokeDasharray={`${28 * 2 * Math.PI}`} 
                                strokeDashoffset={`${28 * 2 * Math.PI * (1 - (pct / 100))}`} 
                                strokeLinecap="round" 
                              />
                            </Svg>
                            <View style={{ position: 'absolute', alignItems: 'center', justifyContent: 'center' }}>
                              <Text style={{ fontSize: 13, fontWeight: '800', color: '#FFF' }}>{hrsLeft}h</Text>
                              <Text style={{ fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.6)' }}>{minsLeftRem}m</Text>
                            </View>
                          </View>
                          
                          {/* Title */}
                          <View style={{ flex: 1, gap: 4 }}>
                            <Text style={{ fontSize: 9, fontWeight: '800', color: '#FFF', letterSpacing: 1.5, textTransform: 'uppercase', opacity: 0.5 }}>ACTIVE BIO-STATE</Text>
                            <Text style={{ fontSize: 15, fontWeight: '800', color: currentPeriod.color || '#8B5CF6', letterSpacing: 0.5 }}>{currentPeriod.englishLabel}</Text>
                          </View>
                        </View>
                        
                        <View style={{ width: '100%', height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginBottom: 16 }} />

                        {/* Bottom Section: Columns */}
                        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                          {/* Cultivate Column */}
                          <View style={{ flex: 1, gap: 10 }}>
                            <Text style={{ fontSize: 10, fontWeight: '800', color: currentPeriod.color || '#8B5CF6', letterSpacing: 1.2, textTransform: 'uppercase' }}>Cultivate</Text>
                            {currentPeriod.activities.slice(0, 3).map((act: string, i: number) => (
                              <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
                                <View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: 'rgba(255,255,255,0.7)', marginTop: 6 }} />
                                <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.9)', fontWeight: '400', lineHeight: 16, flex: 1 }}>{act}</Text>
                              </View>
                            ))}
                          </View>
                          
                          <View style={{ width: 1, height: '100%', backgroundColor: 'rgba(255,255,255,0.1)' }} />
                          
                          {/* Pause Column */}
                          <View style={{ flex: 1, gap: 10 }}>
                            <Text style={{ fontSize: 10, fontWeight: '800', color: '#F43F5E', letterSpacing: 1.2, textTransform: 'uppercase' }}>Pause</Text>
                            {currentPeriod.avoidances && currentPeriod.avoidances.slice(0, 3).map((act: string, i: number) => (
                              <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
                                <View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: 'rgba(244, 63, 94, 0.7)', marginTop: 6 }} />
                                <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: '400', lineHeight: 16, flex: 1 }}>{act}</Text>
                              </View>
                            ))}
                          </View>
                        </View>
                        
"""

    content = content[:start_idx] + new_layout + content[end_idx:]

    with open(file_path, 'w') as f:
        f.write(content)
    print("Patched combined Bio-State layout successfully.")

if __name__ == "__main__":
    main()

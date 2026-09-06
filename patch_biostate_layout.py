import sys

def main():
    file_path = 'app/(tabs)/index.tsx'
    with open(file_path, 'r') as f:
        content = f.read()

    start_marker = "                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20 }}>"
    end_marker = "                        </View>\n                      </BlurView>"
    
    start_idx = content.find(start_marker)
    if start_idx == -1:
        print("Could not find start marker")
        return
        
    end_idx = content.find(end_marker, start_idx)
    if end_idx == -1:
        print("Could not find end marker")
        return

    new_layout = """                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: currentPeriod.color || '#8B5CF6' }} />
                            <Text style={{ fontSize: 13, fontWeight: '800', color: '#FFF', letterSpacing: 1.5, textTransform: 'uppercase' }}>
                              {currentPeriod.englishLabel}
                            </Text>
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Ionicons name="hourglass-outline" size={10} color="rgba(255,255,255,0.4)" />
                            <Text style={{ fontSize: 9, fontWeight: '700', color: 'rgba(255,255,255,0.5)', letterSpacing: 0.5, textTransform: 'uppercase' }}>
                              Ends in {timeStr}
                            </Text>
                          </View>
                        </View>
                        
                        <View style={{ width: '100%', height: 2, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 1, marginBottom: 16 }}>
                          <View style={{ width: `${pct}%`, height: '100%', backgroundColor: currentPeriod.color || '#8B5CF6', borderRadius: 1 }} />
                        </View>

                        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                          {/* Cultivate Column */}
                          <View style={{ flex: 1, gap: 10 }}>
                            <Text style={{ fontSize: 10, fontWeight: '800', color: currentPeriod.color || '#8B5CF6', letterSpacing: 1.2, textTransform: 'uppercase' }}>Cultivate</Text>
                            {currentPeriod.activities.slice(0, 3).map((act: string, i: number) => (
                              <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
                                <View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: 'rgba(255,255,255,0.7)', marginTop: 6 }} />
                                <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.9)', fontWeight: '400', lineHeight: 18, flex: 1 }}>{act}</Text>
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
                                <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: '400', lineHeight: 18, flex: 1 }}>{act}</Text>
                              </View>
                            ))}
                          </View>
                        </View>
                        
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 18 }}>
                          <Text style={{ fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,0.3)', letterSpacing: 0.5, textTransform: 'uppercase' }}>Tap to view metabolic state</Text>
                          <Ionicons name="chevron-forward" size={10} color="rgba(255,255,255,0.3)" style={{ marginLeft: 4 }} />
"""

    content = content[:start_idx] + new_layout + content[end_idx:]

    with open(file_path, 'w') as f:
        f.write(content)
    print("Patched Bio-State layout successfully.")

if __name__ == "__main__":
    main()

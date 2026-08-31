import sys

def main():
    file_path = 'app/(tabs)/index.tsx'
    with open(file_path, 'r') as f:
        content = f.read()

    # Part 1: Increase paddingVertical of Body Rhythm card
    target1 = """                      paddingVertical: 20,
                      paddingHorizontal: 16,"""
    replacement1 = """                      paddingVertical: 36,
                      paddingHorizontal: 16,"""
    
    if target1 not in content:
        print("Target 1 not found!")
        sys.exit(1)
        
    content = content.replace(target1, replacement1)
    
    # Part 2: Replace spacer and bottom row with expanded bio-state and weather
    # I will find the start of the spacer and the start of the VISIONOS dock
    start_str = "              {/* Spacer between center content and bottom controls */}"
    end_str = "              {/* ── VISIONOS FLOATING GLASS DOCK — 3 columns ── */}"
    
    start_idx = content.find(start_str)
    end_idx = content.find(end_str)
    
    if start_idx == -1 or end_idx == -1:
        print("Markers not found!")
        sys.exit(1)

    new_section = """              {/* Spacer between center content and bottom controls */}
              <View style={{ flex: 1 }} />

              {/* 3. Expanded Active Bio-State Panel */}
              <View style={{ width: '100%', paddingHorizontal: 24, marginBottom: 16 }}>
                 {currentPeriod && (
                    <BlurView intensity={50} tint="dark" style={{
                      width: '100%',
                      borderRadius: 24,
                      borderWidth: 0.5,
                      borderColor: 'rgba(255,255,255,0.2)',
                      paddingVertical: 20,
                      paddingHorizontal: 20,
                      overflow: 'hidden',
                      backgroundColor: 'rgba(0,0,0,0.3)',
                    }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 }}>
                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: currentPeriod.color || '#4ade80' }} />
                        <Text style={{ fontSize: 10, fontWeight: '700', color: '#FFF', letterSpacing: 1.5, textTransform: 'uppercase' }}>Active Bio-State</Text>
                      </View>
                      
                      <View style={{ gap: 12 }}>
                        {currentPeriod.activities.slice(0, 3).map((act, i) => (
                          <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                            <Ionicons name="checkmark-circle" size={16} color={currentPeriod.color || '#4ade80'} />
                            <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.9)', fontWeight: '500', lineHeight: 18, flex: 1 }}>{act}</Text>
                          </View>
                        ))}
                        {currentPeriod.avoidances && currentPeriod.avoidances.length > 0 && (
                           <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 4, opacity: 0.7 }}>
                             <Ionicons name="close-circle" size={16} color="#f87171" />
                             <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: '500', lineHeight: 18, flex: 1 }}>Avoid: {currentPeriod.avoidances[0]}</Text>
                           </View>
                        )}
                      </View>
                    </BlurView>
                 )}
              </View>

              {/* 4. Weather Button (Fixed below Bio-State) */}
              <View style={{ width: '100%', paddingHorizontal: 24, marginBottom: 16, alignItems: 'center' }}>
                 {weather && (
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        router.push('/weather');
                      }}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(0,0,0,0.3)', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)' }}
                    >
                      <Text style={{ fontSize: 14 }}>{weather.emoji}</Text>
                      <Text style={{ fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif', fontSize: 14, fontWeight: '700', color: '#FFF' }}>{weather.temp}°</Text>
                      <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)' }} />
                      <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', fontWeight: '600' }}>{weather.condition}</Text>
                    </TouchableOpacity>
                 )}
              </View>

"""

    content = content[:start_idx] + new_section + content[end_idx:]

    with open(file_path, 'w') as f:
        f.write(content)
        
    print("Patched layout expanded successfully!")

if __name__ == '__main__':
    main()

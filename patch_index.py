import sys

def main():
    file_path = 'app/(tabs)/index.tsx'
    with open(file_path, 'r') as f:
        content = f.read()

    # 1. Update Active Bio-State Header
    old_header = """                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: currentPeriod.color || '#4ade80' }} />
                            <Text style={{ fontSize: 10, fontWeight: '700', color: '#FFF', letterSpacing: 1.5, textTransform: 'uppercase' }}>
                              Active Bio-State
                            </Text>
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <Ionicons name="hourglass-outline" size={10} color="rgba(255,255,255,0.5)" />
                            <Text style={{ fontSize: 9, fontWeight: '600', color: 'rgba(255,255,255,0.5)', letterSpacing: 0.5, textTransform: 'uppercase' }}>
                              Ends in {timeStr}
                            </Text>
                          </View>
                        </View>"""
                        
    new_header = """                        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
                          <View style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: currentPeriod.color || '#4ade80' }} />
                              <Text style={{ fontSize: 9, fontWeight: '800', color: '#FFF', letterSpacing: 1.2, textTransform: 'uppercase', opacity: 0.8 }}>
                                Active Bio-State
                              </Text>
                            </View>
                            <Text style={{ fontSize: 16, fontWeight: '800', color: currentPeriod.color || '#4ade80', letterSpacing: 0.5, textTransform: 'uppercase', marginLeft: 12 }}>
                              {currentPeriod.englishLabel}
                            </Text>
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                            <Ionicons name="hourglass-outline" size={10} color="rgba(255,255,255,0.5)" />
                            <Text style={{ fontSize: 9, fontWeight: '600', color: 'rgba(255,255,255,0.5)', letterSpacing: 0.5, textTransform: 'uppercase' }}>
                              Ends in {timeStr}
                            </Text>
                          </View>
                        </View>"""
                        
    if old_header in content:
        content = content.replace(old_header, new_header)
        print("Patched Bio-State header")
    else:
        print("Could not find old_header")

    # 2. Update background animation (breatheOpacity and aura opacity)
    old_breathe = "const breatheOpacity = breatheAnim.interpolate({ inputRange: [0, 1], outputRange: [0.10, 0.60] });"
    new_breathe = "const breatheOpacity = breatheAnim.interpolate({ inputRange: [0, 1], outputRange: [0.0, 0.55] });"
    content = content.replace(old_breathe, new_breathe)
    
    old_aura1 = "const opacity1 = anim1.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.0, 0.18, 0.05] });"
    new_aura1 = "const opacity1 = anim1.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.0, 0.28, 0.05] });"
    content = content.replace(old_aura1, new_aura1)
    
    old_aura2 = "const opacity2 = anim2.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.0, 0.16, 0.04] });"
    new_aura2 = "const opacity2 = anim2.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.0, 0.25, 0.04] });"
    content = content.replace(old_aura2, new_aura2)
    
    # Optional: ensure DailyIntentionCard import doesn't get messed up
    # Write back
    with open(file_path, 'w') as f:
        f.write(content)
        
if __name__ == "__main__":
    main()

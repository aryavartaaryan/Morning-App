import sys

def main():
    file_path = 'app/(tabs)/index.tsx'
    with open(file_path, 'r') as f:
        content = f.read()

    target = """                  {/* Vitality */}
                  <TouchableOpacity
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSheetOpen(true); }}
                    activeOpacity={0.65}
                    style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRightWidth: 0.5, borderRightColor: 'rgba(255,255,255,0.10)' }}
                  >
                    <Ionicons name="sunny-outline" size={20} color="#E2E8F0" />
                    <Text style={{ fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,0.8)', marginTop: 6, letterSpacing: 0.3 }}>Vitality</Text>
                  </TouchableOpacity>

                  {/* Focus */}
                  <TouchableOpacity
                    onPress={() => { setShowStressScanner(true); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); }}
                    activeOpacity={0.65}
                    style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRightWidth: 0.5, borderRightColor: 'rgba(255,255,255,0.10)' }}
                  >
                    <Ionicons name="pulse-outline" size={20} color="#E2E8F0" />
                    <Text style={{ fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,0.8)', marginTop: 6, letterSpacing: 0.5 }}>Focus</Text>
                  </TouchableOpacity>"""
                  
    replacement = """                  {/* Insights */}
                  <TouchableOpacity
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSheetOpen(true); }}
                    activeOpacity={0.65}
                    style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRightWidth: 0.5, borderRightColor: 'rgba(255,255,255,0.10)' }}
                  >
                    <Ionicons name="compass-outline" size={20} color="#E2E8F0" />
                    <Text style={{ fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,0.8)', marginTop: 6, letterSpacing: 0.3 }}>Insights</Text>
                  </TouchableOpacity>

                  {/* Vitality */}
                  <TouchableOpacity
                    onPress={() => { setShowStressScanner(true); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); }}
                    activeOpacity={0.65}
                    style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRightWidth: 0.5, borderRightColor: 'rgba(255,255,255,0.10)' }}
                  >
                    <Ionicons name="pulse-outline" size={20} color="#E2E8F0" />
                    <Text style={{ fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,0.8)', marginTop: 6, letterSpacing: 0.5 }}>Vitality</Text>
                  </TouchableOpacity>"""

    if target not in content:
        print("Target not found!")
        sys.exit(1)
        
    content = content.replace(target, replacement)
    
    with open(file_path, 'w') as f:
        f.write(content)
        
    print("Patched text successfully!")

if __name__ == '__main__':
    main()

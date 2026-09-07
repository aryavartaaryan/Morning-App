import sys

def main():
    file_path = 'app/(tabs)/index.tsx'
    with open(file_path, 'r') as f:
        content = f.read()

    # The exact block we inserted in the previous step
    old_dock = """        {/* ── ORIGINAL 3-BUTTON DOCK (GUARANTEED VISIBLE) ── */}
        <View style={{ flexDirection: 'row', width: '100%', paddingBottom: 16, paddingTop: 16, backgroundColor: 'transparent', borderTopWidth: 0 }}>
          {/* Almanac */}
          <TouchableOpacity
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSheetOpen(true); }}
            activeOpacity={0.65}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="journal-outline" size={22} color="rgba(255,255,255,0.8)" />
            <Text style={{ fontSize: 11, fontWeight: '500', color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>Almanac</Text>
          </TouchableOpacity>

          {/* Vitality */}
          <TouchableOpacity
            onPress={() => { setShowStressScanner(true); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); }}
            activeOpacity={0.65}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="pulse-outline" size={22} color="rgba(255,255,255,0.8)" />
            <Text style={{ fontSize: 11, fontWeight: '500', color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>Vitality</Text>
          </TouchableOpacity>

          {/* Soundscapes */}
          <TouchableOpacity
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.navigate('/(tabs)/sleep' as never); }}
            activeOpacity={0.65}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="stats-chart-outline" size={22} color="rgba(255,255,255,0.8)" />
            <Text style={{ fontSize: 11, fontWeight: '500', color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>Soundscapes</Text>
          </TouchableOpacity>
        </View>"""
        
    new_dock = """        {/* ── PREMIUM VISIONOS GLASS DOCK ── */}
        <View style={{ width: '100%', paddingHorizontal: 20, paddingBottom: 12, paddingTop: 6 }}>
          <BlurView intensity={80} tint="dark" style={{
            flexDirection: 'row',
            borderRadius: 28,
            borderWidth: 0.5,
            borderColor: 'rgba(255,255,255,0.12)',
            backgroundColor: 'rgba(10,10,10,0.3)',
            overflow: 'hidden',
          }}>
            {/* Almanac */}
            <TouchableOpacity
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSheetOpen(true); }}
              activeOpacity={0.65}
              style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRightWidth: 0.5, borderRightColor: 'rgba(255,255,255,0.08)' }}
            >
              <Ionicons name="journal-outline" size={18} color="#E2E8F0" />
              <Text style={{ fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,0.8)', marginTop: 4, letterSpacing: 0.3 }}>Almanac</Text>
            </TouchableOpacity>

            {/* Vitality */}
            <TouchableOpacity
              onPress={() => { setShowStressScanner(true); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); }}
              activeOpacity={0.65}
              style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRightWidth: 0.5, borderRightColor: 'rgba(255,255,255,0.08)' }}
            >
              <Ionicons name="pulse-outline" size={18} color="#E2E8F0" />
              <Text style={{ fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,0.8)', marginTop: 4, letterSpacing: 0.5 }}>Vitality</Text>
            </TouchableOpacity>

            {/* Soundscapes */}
            <TouchableOpacity
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.navigate('/(tabs)/sleep' as never); }}
              activeOpacity={0.65}
              style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 10 }}
            >
              <Ionicons name="stats-chart-outline" size={18} color="#E2E8F0" />
              <Text style={{ fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,0.8)', marginTop: 4, letterSpacing: 0.3 }}>Soundscapes</Text>
            </TouchableOpacity>
          </BlurView>
        </View>"""
        
    if old_dock in content:
        content = content.replace(old_dock, new_dock)
        with open(file_path, 'w') as f:
            f.write(content)
        print("Restored VisionOS BlurView dock.")
    else:
        print("Could not find the plain dock to replace.")

if __name__ == "__main__":
    main()

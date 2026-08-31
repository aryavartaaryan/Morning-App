import sys

def main():
    file_path = 'app/(tabs)/index.tsx'
    with open(file_path, 'r') as f:
        content = f.read()

    start_str = "        {/* ══ PREMIUM FLOATING HEADER PILL ══ */}"
    end_str = "              {/* === REFINED EDITORIAL CURATOR LAYOUT"
    
    start_idx = content.find(start_str)
    end_idx = content.find(end_str)
    
    if start_idx == -1 or end_idx == -1:
        print("Markers not found!")
        sys.exit(1)

    replacement = """        {/* ══ PREMIUM FLOATING HEADER PILL ══ */}
        <View style={{ paddingTop: 10, paddingBottom: 8, zIndex: 10, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' }}>
          {(() => {
            const hMoon = getMoonPhase(new Date());
            const hP    = getPanchangData();
            let phaseText = '';
            const dayNum = hP.tithiInPaksha;
            const isWaxing = hP.paksha === 'Shukla';
            if (dayNum === 15) {
              phaseText = isWaxing ? 'Full Moon' : 'New Moon';
            } else if (dayNum >= 1 && dayNum <= 6) {
              phaseText = isWaxing ? 'Waxing Crescent' : 'Waning Gibbous';
            } else if (dayNum >= 7 && dayNum <= 8) {
              phaseText = isWaxing ? 'First Quarter' : 'Third Quarter';
            } else {
              phaseText = isWaxing ? 'Waxing Gibbous' : 'Waning Crescent';
            }
            return (
              <BlurView intensity={50} tint="light" style={{
                borderRadius: 24, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.3)',
                overflow: 'hidden', flexDirection: 'row', alignItems: 'center', gap: 8,
                paddingHorizontal: 20, paddingVertical: 12, backgroundColor: 'rgba(255,255,255,0.15)'
              }}>
                <MoonSVG tithiNum={hMoon.tithiNum} size={16} />
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#111', letterSpacing: 0.3 }}>{phaseText}</Text>
              </BlurView>
            );
          })()}

          {/* Settings Button Floating Right */}
          <TouchableOpacity
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/(tabs)/settings' as never); }}
            style={{ position: 'absolute', right: 24, top: 20 }}
            hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
          >
            <Ionicons name="settings-outline" size={24} color="rgba(255,255,255,0.8)" />
          </TouchableOpacity>
        </View>

        <View style={{ flex: 1, justifyContent: 'space-between', alignItems: 'center', paddingBottom: insets.bottom + 70 }}>
              
"""
    
    content = content[:start_idx] + replacement + content[end_idx:]

    with open(file_path, 'w') as f:
        f.write(content)
        
    print("Patched Header successfully!")

if __name__ == '__main__':
    main()

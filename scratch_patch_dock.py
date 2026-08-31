import sys

def main():
    file_path = 'app/(tabs)/index.tsx'
    with open(file_path, 'r') as f:
        content = f.read()

    # Part 1: Fix Header (Compact and Centered)
    target_header = """        {/* ══ PREMIUM FLOATING HEADER PILL ══ */}
        <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 8, zIndex: 10 }}>
          <BlurView intensity={45} tint="dark" style={{
            borderRadius: 24,
            borderWidth: 0.5,
            borderColor: 'rgba(255,255,255,0.12)',
            overflow: 'hidden',
          }}>
            <LinearGradient
              colors={['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.01)']}
              start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 16, paddingRight: 8, paddingVertical: 8 }}>
              
              {/* LEFT: Lunar Data + Date (Western Friendly) */}
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
                
                const lunarText = dayNum === 15 ? phaseText : `${phaseText} • Day ${dayNum}`;
                
                return (
                  <View key="tithi" style={{ alignItems: 'flex-start', gap: 2, flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <MoonSVG tithiNum={hMoon.tithiNum} size={13} />
                      <Text style={{ fontSize: 11, fontWeight: '700', color: '#E2E8F0', letterSpacing: 0.3 }} numberOfLines={1}>{lunarText}</Text>
                    </View>
                    <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', fontWeight: '600', marginTop: 2 }}>{heroDate}</Text>
                  </View>
                );
              })()}



                {/* Settings Button (Perfectly Fitted) */}
                <TouchableOpacity
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/(tabs)/settings' as never); }}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: 'rgba(255,255,255,0.08)',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 0.5,
                    borderColor: 'rgba(255,255,255,0.1)',
                  }}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="settings-outline" size={20} color="rgba(255,255,255,0.85)" />
                </TouchableOpacity>
              </View>
            </View>
          </BlurView>
        </View>"""
        
    replacement_header = """        {/* ══ PREMIUM FLOATING HEADER PILL ══ */}
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
            style={{ position: 'absolute', right: 24, top: 12 }}
            hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
          >
            <Ionicons name="settings-outline" size={24} color="rgba(255,255,255,0.8)" />
          </TouchableOpacity>
        </View>"""

    if target_header not in content:
        print("Header target not found!")
    else:
        content = content.replace(target_header, replacement_header)
        
    # Part 2: Fix Dock
    target_dock = """                  {/* Almanac */}
                  <TouchableOpacity
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSheetOpen(true); }}
                    activeOpacity={0.65}
                    style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRightWidth: 0.5, borderRightColor: 'rgba(255,255,255,0.10)' }}
                  >
                    <Ionicons name="book-outline" size={17} color="#FDB931" />
                    <Text style={{ fontSize: 9, fontWeight: '700', color: 'rgba(255,255,255,0.7)', marginTop: 4, letterSpacing: 0.3 }}>Almanac</Text>
                  </TouchableOpacity>

                  {/* ── STRESS SCAN — centre, prominent ── */}
                  <TouchableOpacity
                    onPress={() => { setShowStressScanner(true); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); }}
                    activeOpacity={0.75}
                    style={{ flex: 1.3, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRightWidth: 0.5, borderRightColor: 'rgba(255,255,255,0.10)', backgroundColor: `${currentPeriod?.color ?? '#34d399'}12` }}
                  >
                    {/* Live pulse dot */}
                    <View style={{ position: 'relative', alignItems: 'center' }}>
                      <Ionicons name="pulse" size={19} color={currentPeriod?.color ?? '#34d399'} />
                      <View style={{ position: 'absolute', top: -2, right: -6, width: 6, height: 6, borderRadius: 3, backgroundColor: currentPeriod?.color ?? '#34d399', shadowColor: currentPeriod?.color ?? '#34d399', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 4 }} />
                    </View>
                    <Text style={{ fontSize: 9, fontWeight: '800', color: currentPeriod?.color ?? '#34d399', marginTop: 4, letterSpacing: 0.5 }}>Stress Scan</Text>
                  </TouchableOpacity>

                  {/* Sounds */}
                  <TouchableOpacity
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.navigate('/(tabs)/sleep' as never); }}
                    activeOpacity={0.65}
                    style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 12 }}
                  >
                    <Ionicons name="musical-notes-outline" size={17} color="#80FFFF" />
                    <Text style={{ fontSize: 9, fontWeight: '700', color: 'rgba(255,255,255,0.7)', marginTop: 4, letterSpacing: 0.3 }}>Sounds</Text>
                  </TouchableOpacity>"""
                  
    replacement_dock = """                  {/* Vitality */}
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
                  </TouchableOpacity>

                  {/* Soundscapes */}
                  <TouchableOpacity
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.navigate('/(tabs)/sleep' as never); }}
                    activeOpacity={0.65}
                    style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14 }}
                  >
                    <Ionicons name="stats-chart-outline" size={20} color="#E2E8F0" />
                    <Text style={{ fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,0.8)', marginTop: 6, letterSpacing: 0.3 }}>Soundscapes</Text>
                  </TouchableOpacity>"""

    if target_dock not in content:
        print("Dock target not found!")
    else:
        content = content.replace(target_dock, replacement_dock)
        
    with open(file_path, 'w') as f:
        f.write(content)
        
    print("Patched Header and Dock successfully!")

if __name__ == '__main__':
    main()

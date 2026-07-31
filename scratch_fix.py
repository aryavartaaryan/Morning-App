import re

with open('app/(tabs)/index.tsx', 'r') as f:
    content = f.read()

# 1. Add import
if "import { HeroGeometricAnimation }" not in content:
    content = content.replace("import { AnimatedAlmanacButton } from '@/components/AnimatedAlmanacButton';", "import { AnimatedAlmanacButton } from '@/components/AnimatedAlmanacButton';\nimport { HeroGeometricAnimation } from '@/components/HeroGeometricAnimation';")

# 2. Increase HERO_RS size
content = content.replace("const HERO_RS  = compact ? 216 : 275;", "const HERO_RS  = compact ? 238 : 302;")

# 3. Replace the header (to be full width and fix overlap)
old_header = """      <TouchableOpacity
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/(tabs)/settings' as never); }}
        style={{
          position: 'absolute',
          top: (Platform.OS === 'android' ? Math.max(insets.top, StatusBar.currentHeight ?? 0) : (insets.top ?? 44)) + 12,
          right: 12,
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor: 'rgba(0,0,0,0.4)',
          borderWidth: 1.5,
          borderColor: 'rgba(255,255,255,0.25)',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.4,
          shadowRadius: 8,
          elevation: 5,
        }}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="settings-outline" size={17} color="rgba(255,255,255,0.95)" />
      </TouchableOpacity>

        {/* ── Elegant header card — static, non-clickable ── */}
        <View style={{ paddingHorizontal: 0, paddingTop: 0, paddingBottom: 16, zIndex: 10 }}>
          <BlurView intensity={60} tint="dark" style={{ borderRadius: 0, borderWidth: 0, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.15)', backgroundColor: 'rgba(20,25,40,0.5)', paddingBottom: 12 }}>
            <LinearGradient
              colors={['rgba(255,255,255,0.10)', 'rgba(255,255,255,0.03)', 'transparent']}
              start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
              style={StyleSheet.absoluteFillObject} />
            {/* Bottom shimmer line hinting expansion */}
            <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.10)' }} />

            {/* Main row */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingTop: 12 }}>

              {/* LEFT: weather emoji + temp + condition */}
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: 9 }}>
                {weather ? (
                  <>
                    <Text style={{ fontSize: 26 }}>{weather.emoji}</Text>
                    <View>
                      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 5 }}>
                        <Text style={{ fontSize: 18, fontWeight: '900', color: '#FFFFFF', letterSpacing: -0.5 }}>{weather.temp}°</Text>
                        <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', fontWeight: '600' }}>{weather.condition}</Text>
                      </View>
                      {weather.city ? (
                        <Text style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.38)', fontWeight: '600', marginTop: 1 }}>{weather.city}</Text>
                      ) : null}
                    </View>
                  </>
                ) : (
                  <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.34)', fontWeight: '600' }}>
                    {weatherLoading ? 'Loading weather…' : 'Tap to load weather'}
                  </Text>
                )}
              </View>

              {/* CENTER: moon + tithi */}
              {(() => {
                const hMoon = getMoonPhase(new Date());
                const hP    = getPanchangData();
                const ordinals = ['','1st','2nd','3rd','4th','5th','6th','7th','8th','9th','10th','11th','12th','13th','14th',''];
                let displayName = hP.tithiName;
                if (hP.tithiInPaksha >= 1 && hP.tithiInPaksha <= 14) {
                   displayName = `${ordinals[hP.tithiInPaksha]} Day (${hP.tithiName})`;
                } else if (hP.tithiInPaksha === 15) {
                   displayName = hP.paksha === 'Shukla' ? 'Full Moon (Purnima)' : 'New Moon (Amavasya)';
                }
                return (
                  <View style={{ flex: 1, alignItems: 'center', gap: 1, paddingHorizontal: 8, borderLeftWidth: 0.5, borderRightWidth: 0.5, borderColor: 'rgba(255,255,255,0.10)' }}>
                    <View style={{ marginBottom: 1 }}><MoonSVG tithiNum={hMoon.tithiNum} size={14} /></View>
                    <Text style={{ fontSize: 8.5, fontWeight: '800', color: 'rgba(196,181,253,0.90)' }} numberOfLines={1}>{displayName}</Text>
                    <Text style={{ fontSize: 7, color: 'rgba(255,255,255,0.38)', fontWeight: '600', letterSpacing: 0.3 }}>{hMoon.illumination}% lit</Text>
                  </View>
                );
              })()}

              {/* RIGHT: solar context */}
              {solarContext ? (
                <View style={{ flex: 1, alignItems: 'flex-end', gap: 1, paddingRight: 48 }}>
                  <Text style={{ fontSize: 7.5, fontWeight: '700', color: 'rgba(255,255,255,0.42)', letterSpacing: 0.5 }}>{solarContext.label1}</Text>
                  <Text style={{ fontSize: 12.5, fontWeight: '900', color: solarContext.isLive ? solarContext.color : 'rgba(255,255,255,0.90)', letterSpacing: -0.2 }}>{solarContext.mainText}</Text>
                  <Text style={{ fontSize: 7.5, fontWeight: '700', color: solarContext.color, letterSpacing: 0.5 }}>{solarContext.label2}</Text>
                </View>
              ) : (
                <View style={{ flex: 1 }} />
              )}



            </View>
          </BlurView>
        </View>"""

new_header = """      {/* Premium Floating Settings Button */}
      <TouchableOpacity
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/(tabs)/settings' as never); }}
        style={{
          position: 'absolute',
          top: (Platform.OS === 'android' ? Math.max(insets.top, StatusBar.currentHeight ?? 0) : (insets.top ?? 44)) + 4,
          right: 20,
          width: 30,
          height: 30,
          borderRadius: 15,
          backgroundColor: 'rgba(255,255,255,0.15)',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.3)',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.3,
          shadowRadius: 5,
        }}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="settings-outline" size={16} color="rgba(255,255,255,0.95)" />
      </TouchableOpacity>

        {/* ── Elegant Full-Width Header ── */}
        <View style={{ paddingHorizontal: 0, paddingTop: 0, paddingBottom: 16, zIndex: 10 }}>
          <BlurView intensity={60} tint="dark" style={{ 
            borderRadius: 0, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.15)', 
            backgroundColor: 'rgba(20,25,40,0.5)', paddingVertical: 12, paddingHorizontal: 16,
            shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20
          }}>
            <LinearGradient
              colors={['rgba(255,255,255,0.10)', 'rgba(255,255,255,0.03)', 'transparent']}
              start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
              style={StyleSheet.absoluteFillObject} />

            {/* Main row */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>

              {/* LEFT: weather emoji + temp + condition */}
              <View style={{ flex: 1.1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: 6 }}>
                {weather ? (
                  <>
                    <Text style={{ fontSize: 24 }}>{weather.emoji}</Text>
                    <View>
                      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                        <Text style={{ fontSize: 17, fontWeight: '900', color: '#FFFFFF', letterSpacing: -0.5 }}>{weather.temp}°</Text>
                      </View>
                      <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', fontWeight: '700' }} numberOfLines={1}>{weather.condition}</Text>
                    </View>
                  </>
                ) : (
                  <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.34)', fontWeight: '600' }}>
                    {weatherLoading ? 'Loading…' : 'Tap to load'}
                  </Text>
                )}
              </View>

              {/* CENTER: moon + tithi */}
              {(() => {
                const hMoon = getMoonPhase(new Date());
                const hP    = getPanchangData();
                const ordinals = ['','1st','2nd','3rd','4th','5th','6th','7th','8th','9th','10th','11th','12th','13th','14th',''];
                let displayName = hP.tithiName;
                if (hP.tithiInPaksha >= 1 && hP.tithiInPaksha <= 14) {
                   displayName = `${ordinals[hP.tithiInPaksha]} Day`;
                } else if (hP.tithiInPaksha === 15) {
                   displayName = hP.paksha === 'Shukla' ? 'Full Moon' : 'New Moon';
                }
                return (
                  <View style={{ flex: 0.9, alignItems: 'center', gap: 2, paddingHorizontal: 4, borderLeftWidth: 1, borderRightWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
                    <View style={{ marginBottom: 1 }}><MoonSVG tithiNum={hMoon.tithiNum} size={15} /></View>
                    <Text style={{ fontSize: 9, fontWeight: '800', color: 'rgba(196,181,253,0.95)' }} numberOfLines={1}>{displayName}</Text>
                    <Text style={{ fontSize: 7.5, color: 'rgba(255,255,255,0.5)', fontWeight: '600', letterSpacing: 0.3 }}>{hMoon.illumination}% lit</Text>
                  </View>
                );
              })()}

              {/* RIGHT: solar context */}
              {solarContext ? (
                <View style={{ flex: 1.1, alignItems: 'flex-end', justifyContent: 'center', paddingRight: 6 }}>
                  <Text style={{ fontSize: 7.5, fontWeight: '700', color: 'rgba(255,255,255,0.5)', letterSpacing: 0.5 }}>{solarContext.label1}</Text>
                  <Text style={{ fontSize: 12.5, fontWeight: '900', color: solarContext.isLive ? solarContext.color : 'rgba(255,255,255,0.95)', letterSpacing: -0.2 }} numberOfLines={1}>{solarContext.mainText}</Text>
                  <Text style={{ fontSize: 7.5, fontWeight: '700', color: solarContext.color, letterSpacing: 0.5 }}>{solarContext.label2}</Text>
                </View>
              ) : (
                <View style={{ flex: 1.1 }} />
              )}

            </View>
          </BlurView>
        </View>"""
content = content.replace(old_header, new_header)

# 4. Remove local HeroGeometricAnimation and sacredDots using regex
pattern = r"// ── Hero Geometric Animation \(from Sound Reel\) ──\nfunction sacredDots.*?function HeroGeometricAnimation\(.*?return \(\n.*?</View>\n  \);\n}\n"
content = re.sub(pattern, "// ── Hero Geometric Animation (Imported) ──\n", content, flags=re.DOTALL)

with open('app/(tabs)/index.tsx', 'w') as f:
    f.write(content)

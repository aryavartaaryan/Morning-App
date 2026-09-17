import re

with open('app/(tabs)/index.tsx', 'r') as f:
    content = f.read()

# Define the new clock section
new_clock = """                {/* 3. The Unified Ayurvedic Bio-State Clock (Premium Centerpiece) */}
                <View style={{ width: '100%', marginTop: 12 }}>
                 {currentPeriod && (() => {
                  const now = new Date();
                  const nowH = now.getHours() + now.getMinutes() / 60;
                  const leftH = currentPeriod.endH - nowH;
                  const minsLeft = leftH > 0 ? Math.floor(leftH * 60) : 0;
                  const hrsLeft = Math.floor(minsLeft / 60);
                  const minsLeftRem = minsLeft % 60;
                  const timeStr = hrsLeft > 0 ? `${hrsLeft}h ${minsLeftRem}m` : `${minsLeftRem}m`;
                  
                  // Rotate so midnight is top (0 deg)
                  const timeRotation = (nowH * 15) - 90;
                  
                  const isVata = currentPeriod.dosha === 'vata';
                  const isPitta = currentPeriod.dosha === 'pitta';
                  const isKapha = currentPeriod.dosha === 'kapha';
                  
                  const pittaColor = isPitta ? '#D4AF37' : 'rgba(212, 175, 55, 0.15)';
                  const vataColor = isVata ? '#60A5FA' : 'rgba(96, 165, 250, 0.15)';
                  const kaphaColor = isKapha ? '#4ADE80' : 'rgba(74, 222, 128, 0.15)';
                  
                  const activeColor = isPitta ? '#D4AF37' : isVata ? '#60A5FA' : '#4ADE80';

                  return (
                    <TouchableOpacity 
                      activeOpacity={0.85} 
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setShowStory(true);
                      }}
                    >
                      <BlurView intensity={60} tint="dark" style={{
                        width: '100%',
                        borderRadius: 32,
                        borderWidth: 1,
                        borderColor: 'rgba(212, 175, 55, 0.15)',
                        paddingVertical: 32,
                        paddingHorizontal: 16,
                        overflow: 'hidden',
                        backgroundColor: 'rgba(15, 12, 10, 0.45)',
                        alignItems: 'center',
                      }}>
                        <Text style={{ fontSize: 13, fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif', fontWeight: '600', color: 'rgba(212, 175, 55, 0.8)', letterSpacing: 2, marginBottom: 28, textTransform: 'uppercase' }}>Ayurvedic Bio-State</Text>
                        
                        <View style={{ position: 'relative', width: 260, height: 260, alignItems: 'center', justifyContent: 'center' }}>
                          {/* Text Labels positioned around the dial */}
                          <Text style={{ position: 'absolute', top: 10, right: 30, fontSize: 11, fontWeight: '600', letterSpacing: 2, color: 'rgba(255,255,255,0.4)', transform: [{rotate: '30deg'}] }}>VATA</Text>
                          <Text style={{ position: 'absolute', bottom: 40, right: 10, fontSize: 11, fontWeight: '600', letterSpacing: 2, color: 'rgba(255,255,255,0.4)', transform: [{rotate: '-45deg'}] }}>PITTA</Text>
                          <Text style={{ position: 'absolute', bottom: 10, left: 40, fontSize: 11, fontWeight: '600', letterSpacing: 2, color: 'rgba(255,255,255,0.4)', transform: [{rotate: '30deg'}] }}>KAPHA</Text>
                          <Text style={{ position: 'absolute', top: 40, left: 10, fontSize: 11, fontWeight: '600', letterSpacing: 2, color: 'rgba(255,255,255,0.4)', transform: [{rotate: '-45deg'}] }}>KAPHA</Text>
                          <Text style={{ position: 'absolute', top: -5, left: 110, fontSize: 11, fontWeight: '600', letterSpacing: 2, color: 'rgba(255,255,255,0.4)' }}>PITTA</Text>
                          <Text style={{ position: 'absolute', bottom: -5, left: 110, fontSize: 11, fontWeight: '600', letterSpacing: 2, color: 'rgba(255,255,255,0.4)' }}>VATA</Text>

                          <Svg width={220} height={220} viewBox="0 0 220 220">
                            {/* Inner ambient ring */}
                            <SvgCircle cx={110} cy={110} r={95} stroke="rgba(255,255,255,0.03)" strokeWidth={30} fill="none" />
                            <SvgCircle cx={110} cy={110} r={80} stroke="rgba(212, 175, 55, 0.1)" strokeWidth={1} fill="none" />
                            <SvgCircle cx={110} cy={110} r={110} stroke="rgba(212, 175, 55, 0.2)" strokeWidth={1} fill="none" />
                            
                            <G transform="rotate(-90 110 110)">
                              {/* Pitta (10am-2pm, 10pm-2am) */}
                              <SvgCircle cx={110} cy={110} r={95} stroke={pittaColor} strokeWidth={isPitta ? 8 : 4} fill="none" strokeDasharray="104.7 523.6" strokeDashoffset="-261.8" />
                              <SvgCircle cx={110} cy={110} r={95} stroke={pittaColor} strokeWidth={isPitta ? 8 : 4} fill="none" strokeDasharray="52.35 575.9" strokeDashoffset="0" />
                              <SvgCircle cx={110} cy={110} r={95} stroke={pittaColor} strokeWidth={isPitta ? 8 : 4} fill="none" strokeDasharray="52.35 575.9" strokeDashoffset="-575.9" />

                              {/* Vata (2pm-6pm, 2am-6am) */}
                              <SvgCircle cx={110} cy={110} r={95} stroke={vataColor} strokeWidth={isVata ? 8 : 4} fill="none" strokeDasharray="104.7 523.6" strokeDashoffset="-52.35" />
                              <SvgCircle cx={110} cy={110} r={95} stroke={vataColor} strokeWidth={isVata ? 8 : 4} fill="none" strokeDasharray="104.7 523.6" strokeDashoffset="-366.5" />

                              {/* Kapha (6am-10am, 6pm-10pm) */}
                              <SvgCircle cx={110} cy={110} r={95} stroke={kaphaColor} strokeWidth={isKapha ? 8 : 4} fill="none" strokeDasharray="104.7 523.6" strokeDashoffset="-157.0" />
                              <SvgCircle cx={110} cy={110} r={95} stroke={kaphaColor} strokeWidth={isKapha ? 8 : 4} fill="none" strokeDasharray="104.7 523.6" strokeDashoffset="-471.2" />
                              
                              {/* Time Pointer */}
                              <G rotation={timeRotation + 90} origin="110,110">
                                {/* Thin elegant line from center to edge */}
                                <Line x1={110} y1={110} x2={110} y2={15} stroke={activeColor} strokeWidth={2} strokeOpacity={0.8} />
                                <SvgCircle cx={110} cy={15} r={4} fill={activeColor} />
                                <SvgCircle cx={110} cy={15} r={10} stroke={activeColor} strokeWidth={1} fill="none" strokeOpacity={0.5} />
                              </G>
                            </G>
                          </Svg>
                          
                          {/* Inner Data Centerpiece */}
                          <View style={{ position: 'absolute', width: 150, height: 150, borderRadius: 75, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(10, 8, 5, 0.7)', borderWidth: 1, borderColor: 'rgba(212, 175, 55, 0.1)' }}>
                            <Text style={{ fontSize: 10, fontWeight: '700', color: activeColor, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4 }}>
                              {currentPeriod.dosha} PHASE
                            </Text>
                            <Text style={{ fontSize: 18, fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif', fontWeight: '700', color: '#FFF', textAlign: 'center', paddingHorizontal: 12, lineHeight: 22, textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: {width: 0, height: 2}, textShadowRadius: 4 }}>
                              {currentPeriod.englishLabel}
                            </Text>
                            
                            <View style={{ width: 40, height: 1, backgroundColor: 'rgba(212, 175, 55, 0.3)', marginVertical: 10 }} />
                            
                            <Text style={{ fontSize: 16, fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif', fontWeight: '600', color: '#FFF' }}>{timeStr}</Text>
                            <Text style={{ fontSize: 9, fontWeight: '600', color: 'rgba(255,255,255,0.4)', letterSpacing: 1, marginTop: 2, textTransform: 'uppercase' }}>Remaining</Text>
                          </View>
                        </View>

                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 24 }}>
                          <Text style={{ fontSize: 9, fontWeight: '600', color: 'rgba(255,255,255,0.4)', letterSpacing: 1.5, textTransform: 'uppercase' }}>Tap to explore cycle</Text>
                          <Ionicons name="chevron-forward" size={9} color="rgba(255,255,255,0.4)" style={{ marginLeft: 4 }} />
                        </View>
                      </BlurView>
                    </TouchableOpacity>
                  );
                 })()}
                </View>"""

# We'll use regex to replace the old block with the new block.
pattern = re.compile(r'\{\/\*\s*3\.\s*The Unified Ayurvedic Bio-State Clock.*?\}\s*<\/View>', re.DOTALL)
new_content, count = pattern.subn(new_clock, content)

if count == 0:
    print("Could not find the target block to replace.")
else:
    with open('app/(tabs)/index.tsx', 'w') as f:
        f.write(new_content)
    print(f"Successfully replaced clock block. Replacements made: {count}")

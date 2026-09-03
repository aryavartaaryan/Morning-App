import sys

def main():
    file_path = 'app/(tabs)/index.tsx'
    with open(file_path, 'r') as f:
        content = f.read()

    # 1. Import LunarStoryModal
    target_imports = "import { MetabolicStoryModal } from '@/components/MetabolicStoryModal';"
    rep_imports = """import { MetabolicStoryModal } from '@/components/MetabolicStoryModal';
import { LunarStoryModal } from '@/components/LunarStoryModal';"""
    if target_imports in content:
        content = content.replace(target_imports, rep_imports)

    # 2. Add showLunarModal state
    target_state = "const [showStory, setShowStory] = useState(false);"
    rep_state = """const [showStory, setShowStory] = useState(false);
  const [showLunarModal, setShowLunarModal] = useState(false);"""
    if target_state in content:
        content = content.replace(target_state, rep_state)

    # 3. Make Moon Phase header tappable
    target_header = """            return (
              <BlurView intensity={50} tint="light" style={{"""
    rep_header = """            return (
              <TouchableOpacity activeOpacity={0.8} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowLunarModal(true); }}>
              <BlurView intensity={50} tint="light" style={{"""
    
    target_header_close = """              </BlurView>
            );
          })()}"""
    rep_header_close = """              </BlurView>
              </TouchableOpacity>
            );
          })()}"""
    if target_header in content and target_header_close in content:
        content = content.replace(target_header, rep_header, 1)
        content = content.replace(target_header_close, rep_header_close, 1)

    # 4. Render LunarModal
    target_modal_render = "{showStory && currentPeriod && ("
    rep_modal_render = """{showLunarModal && (
        <LunarStoryModal visible={showLunarModal} onClose={() => setShowLunarModal(false)} hMoon={getMoonPhase(new Date())} />
      )}

      {showStory && currentPeriod && ("""
    if target_modal_render in content:
        content = content.replace(target_modal_render, rep_modal_render)

    # 5. Feature A ("The Horizon Line")
    target_horizon = """                                    return `Ends in ${totalMins} mins`;
                                  })()}
                                </Text>
                              </View>"""
    rep_horizon = """                                    return `Ends in ${totalMins} mins`;
                                  })()}
                                </Text>
                              </View>
                              
                              {/* The Horizon Line (Next State Preview) */}
                              <Text style={{ fontSize: 10, fontWeight: '700', color: 'rgba(0,0,0,0.4)', letterSpacing: 0.5, marginTop: 2, marginBottom: 4 }}>
                                {(() => {
                                  const periods = getDoshaPeriods(solarTimes, nowH);
                                  const curIdx = periods.findIndex(p => p.id === currentPeriod.id);
                                  if (curIdx === -1) return '';
                                  const nextPeriod = periods[(curIdx + 1) % periods.length];
                                  const startDec = nextPeriod.startH;
                                  const h = Math.floor(startDec);
                                  const m = Math.round((startDec - h) * 60);
                                  const ampm = h < 12 ? 'AM' : 'PM';
                                  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
                                  const timeStr = `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
                                  return `Next: ${nextPeriod.englishLabel} • ${timeStr}`;
                                })()}
                              </Text>"""
    if target_horizon in content:
        content = content.replace(target_horizon, rep_horizon)
        
    # 6. Active Bio-State Protocol Widget
    target_bio_state = """                      <View style={{ gap: 8 }}>
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
                      </View>"""
                      
    rep_bio_state = """                      <View style={{ gap: 12 }}>
                        {/* Live Progress Bar */}
                        <View style={{ width: '100%', height: 2, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 1 }}>
                          {(() => {
                            const now = new Date().getHours() + new Date().getMinutes() / 60;
                            const start = currentPeriod.startH;
                            const end = currentPeriod.endH;
                            const total = end > start ? end - start : (24 - start) + end;
                            const elapsed = now > start ? now - start : (24 - start) + now;
                            const pct = Math.min(100, Math.max(0, (elapsed / total) * 100));
                            return <View style={{ width: `${pct}%`, height: '100%', backgroundColor: currentPeriod.color || '#4ade80', borderRadius: 1 }} />;
                          })()}
                        </View>
                        
                        {/* Protocol Columns */}
                        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                          <View style={{ flex: 1, gap: 8 }}>
                            <Text style={{ fontSize: 9, fontWeight: '800', color: currentPeriod.color || '#4ade80', letterSpacing: 1.2, textTransform: 'uppercase' }}>Cultivate</Text>
                            {currentPeriod.activities.slice(0, 2).map((act, i) => (
                              <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
                                <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: currentPeriod.color || '#4ade80', marginTop: 6 }} />
                                <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.9)', fontWeight: '500', lineHeight: 16, flex: 1 }}>{act}</Text>
                              </View>
                            ))}
                          </View>
                          
                          <View style={{ width: 1, height: '100%', backgroundColor: 'rgba(255,255,255,0.1)' }} />
                          
                          <View style={{ flex: 1, gap: 8 }}>
                            <Text style={{ fontSize: 9, fontWeight: '800', color: '#f87171', letterSpacing: 1.2, textTransform: 'uppercase' }}>Pause</Text>
                            {currentPeriod.avoidances && currentPeriod.avoidances.slice(0, 2).map((act, i) => (
                              <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
                                <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: '#f87171', marginTop: 6 }} />
                                <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: '500', lineHeight: 16, flex: 1 }}>{act}</Text>
                              </View>
                            ))}
                          </View>
                        </View>
                      </View>"""
                      
    if target_bio_state in content:
        content = content.replace(target_bio_state, rep_bio_state)

    with open(file_path, 'w') as f:
        f.write(content)
        
    print("Patched features successfully!")

if __name__ == '__main__':
    main()

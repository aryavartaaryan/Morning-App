import sys

def main():
    file_path = 'app/(tabs)/index.tsx'
    with open(file_path, 'r') as f:
        lines = f.readlines()

    start_idx = -1
    for i, line in enumerate(lines):
        if "{/* 2. Biorhythm Card (Slim Editorial Frosted Glass) */}" in line:
            start_idx = i
            break
            
    if start_idx == -1:
        print("Could not find Biorhythm Card")
        sys.exit(1)
        
    end_idx = -1
    for i in range(start_idx, len(lines)):
        if "4. Weather Button" in lines[i]:
            end_idx = i
            break

    new_card = """                {/* 2. Zen Monolith Active Bio-State Panel */}
                <View style={{ width: '100%' }}>
                 {currentPeriod && (() => {
                  const nowH = new Date().getHours() + new Date().getMinutes() / 60;
                  const leftH = currentPeriod.endH - nowH;
                  const minsLeft = leftH > 0 ? Math.floor(leftH * 60) : 0;
                  const hrsLeft = Math.floor(minsLeft / 60);
                  const minsLeftRem = minsLeft % 60;
                  const timeStr = hrsLeft > 0 ? `${hrsLeft}h ${minsLeftRem}m` : `${minsLeftRem}m`;
                  
                  return (
                    <TouchableOpacity 
                      activeOpacity={0.85} 
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setShowStory(true);
                      }}
                    >
                      <BlurView intensity={50} tint="dark" style={{
                        width: '100%',
                        borderRadius: 24,
                        borderWidth: 0.5,
                        borderColor: 'rgba(255,255,255,0.2)',
                        paddingVertical: 14,
                        paddingHorizontal: 20,
                        overflow: 'hidden',
                        backgroundColor: 'rgba(0,0,0,0.3)',
                      }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: currentPeriod.color || '#4ade80' }} />
                            <Text style={{ fontSize: 10, fontWeight: '700', color: '#FFF', letterSpacing: 1.5, textTransform: 'uppercase' }}>
                              {currentPeriod.englishLabel}
                            </Text>
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <Ionicons name="hourglass-outline" size={10} color="rgba(255,255,255,0.5)" />
                            <Text style={{ fontSize: 9, fontWeight: '600', color: 'rgba(255,255,255,0.5)', letterSpacing: 0.5, textTransform: 'uppercase' }}>
                              Ends in {timeStr}
                            </Text>
                          </View>
                        </View>
                        
                        <View style={{ gap: 12 }}>
                          {/* Live Progress Bar */}
                          <View style={{ width: '100%', height: 2, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 1 }}>
                            {(() => {
                              const start = currentPeriod.startH;
                              const end = currentPeriod.endH;
                              const total = end > start ? end - start : (24 - start) + end;
                              const elapsed = nowH > start ? nowH - start : (24 - start) + nowH;
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
                        </View>
                      </BlurView>
                    </TouchableOpacity>
                  );
                 })()}
                </View>
              </View>
"""

    if end_idx != -1:
        # Search backwards from end_idx for "              </View>\n" to preserve correct closing tags
        # The structure is: 
        #               </View>
        #             </View>
        #             {/* Spacer removed ... */}
        #             {/* 4. Weather Button
        
        insert_idx = end_idx - 3 # approx before the outer closing view
        new_lines = lines[:start_idx] + [new_card + "\n"] + lines[end_idx-1:]
        with open(file_path, 'w') as f:
            f.writelines(new_lines)
        print("Patched index.tsx successfully")
    else:
        print("Could not find end index")
        sys.exit(1)

if __name__ == "__main__":
    main()

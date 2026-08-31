import sys

def main():
    file_path = 'app/(tabs)/index.tsx'
    with open(file_path, 'r') as f:
        content = f.read()

    target = """                {/* 2. Biorhythm Card (Slim Editorial Frosted Glass) */}
                {currentPeriod && (
                  <PremiumBreatheCard
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setShowStory(true);
                    }}
                  >
                    <BlurView intensity={35} tint="light" style={{
                      borderRadius: 24,
                      borderWidth: 0.5,
                      borderColor: 'rgba(255,255,255,0.6)',
                      paddingVertical: 36,
                      paddingHorizontal: 16,
                      alignItems: 'center',
                      backgroundColor: 'rgba(255,255,255,0.15)',
                      overflow: 'hidden'
                    }}>
                      <Text style={{ fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif', fontSize: 10, fontWeight: '700', color: 'rgba(0,0,0,0.65)', textTransform: 'uppercase', letterSpacing: 2.5, marginBottom: 8 }}>
                        Body Rhythm
                      </Text>
                      
                      <Text style={{ fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif', fontSize: 28, fontWeight: '700', color: '#111111', textAlign: 'center', marginBottom: 12, lineHeight: 32 }} adjustsFontSizeToFit numberOfLines={1}>
                        {currentPeriod.englishLabel}
                      </Text>
                      
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.05)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 }}>
                        <Ionicons name="hourglass-outline" size={13} color="rgba(0,0,0,0.7)" />
                        <Text style={{ fontSize: 12, fontWeight: '600', color: 'rgba(0,0,0,0.8)', letterSpacing: 0.3 }}>
                          {(() => {
                            const nowH = new Date().getHours() + new Date().getMinutes() / 60;
                            const leftH = currentPeriod.endH - nowH;
                            if (leftH <= 0) return 'Ending soon';
                            const totalMins = Math.floor(leftH * 60);
                            if (totalMins >= 60) {
                              const hrs = Math.floor(totalMins / 60);
                              const mins = totalMins % 60;
                              return `Ends in ${hrs}h ${mins}m`;
                            }
                            return `Ends in ${totalMins} mins`;
                          })()}
                        </Text>
                      </View>
                    </BlurView>
                  </PremiumBreatheCard>
                )}"""

    replacement = """                {/* 2. Biorhythm Card (Slim Editorial Frosted Glass) */}
                {currentPeriod && (() => {
                  const nowH = new Date().getHours() + new Date().getMinutes() / 60;
                  const sacredHour = getSacredHourInfo(nowH, solarTimes);
                  const isSacred = sacredHour.type !== null;

                  return (
                    <PremiumBreatheCard
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setShowStory(true);
                      }}
                    >
                      <BlurView intensity={35} tint="light" style={{
                        borderRadius: 24,
                        borderWidth: 0.5,
                        borderColor: isSacred ? 'rgba(212,175,55,0.6)' : 'rgba(255,255,255,0.6)',
                        paddingVertical: 36,
                        paddingHorizontal: 16,
                        alignItems: 'center',
                        backgroundColor: isSacred ? 'rgba(212,175,55,0.15)' : 'rgba(255,255,255,0.15)',
                        overflow: 'hidden'
                      }}>
                        {isSacred ? (
                          <>
                            <Text style={{ fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif', fontSize: 10, fontWeight: '700', color: 'rgba(180,140,40,1)', textTransform: 'uppercase', letterSpacing: 2.5, marginBottom: 8 }}>
                              {sacredHour.type === 'sunrise' ? 'First Light' : sacredHour.type === 'sunset' ? 'Dusk Transition' : 'Solar Zenith'}
                            </Text>
                            <Text style={{ fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif', fontSize: 28, fontWeight: '700', color: '#111', textAlign: 'center', marginBottom: 12, lineHeight: 32 }} adjustsFontSizeToFit numberOfLines={1}>
                              {sacredHour.type === 'sunrise' ? 'Awaken' : sacredHour.type === 'sunset' ? 'Release' : 'Align'}
                            </Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(212,175,55,0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, borderWidth: 0.5, borderColor: 'rgba(212,175,55,0.4)' }}>
                              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#B48C28' }} />
                              <Text style={{ fontSize: 11, fontWeight: '800', color: '#000', letterSpacing: 1.5 }}>MEDITATE</Text>
                            </View>
                          </>
                        ) : (
                          <>
                            <Text style={{ fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif', fontSize: 10, fontWeight: '700', color: 'rgba(0,0,0,0.65)', textTransform: 'uppercase', letterSpacing: 2.5, marginBottom: 8 }}>
                              Body Rhythm
                            </Text>
                            
                            <Text style={{ fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif', fontSize: 28, fontWeight: '700', color: '#111111', textAlign: 'center', marginBottom: 12, lineHeight: 32 }} adjustsFontSizeToFit numberOfLines={1}>
                              {currentPeriod.englishLabel}
                            </Text>
                            
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.05)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 }}>
                              <Ionicons name="hourglass-outline" size={13} color="rgba(0,0,0,0.7)" />
                              <Text style={{ fontSize: 12, fontWeight: '600', color: 'rgba(0,0,0,0.8)', letterSpacing: 0.3 }}>
                                {(() => {
                                  const leftH = currentPeriod.endH - nowH;
                                  if (leftH <= 0) return 'Ending soon';
                                  const totalMins = Math.floor(leftH * 60);
                                  if (totalMins >= 60) {
                                    const hrs = Math.floor(totalMins / 60);
                                    const mins = totalMins % 60;
                                    return `Ends in ${hrs}h ${mins}m`;
                                  }
                                  return `Ends in ${totalMins} mins`;
                                })()}
                              </Text>
                            </View>
                          </>
                        )}
                      </BlurView>
                    </PremiumBreatheCard>
                  );
                })()}"""

    if target not in content:
        print("Target not found!")
        sys.exit(1)
        
    content = content.replace(target, replacement)
    
    with open(file_path, 'w') as f:
        f.write(content)
        
    print("Patched Sacred Hour UI successfully!")

if __name__ == '__main__':
    main()

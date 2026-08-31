import sys

def main():
    file_path = 'app/(tabs)/index.tsx'
    with open(file_path, 'r') as f:
        content = f.read()

    # Part 1: Remove solarContext from top header
    target1 = """                {/* Solar Info (Clean & Premium) */}
                <View style={{ alignItems: 'flex-end', justifyContent: 'center' }}>
                  {solarContext ? (
                    <>
                      <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' }}>
                        {solarContext.label1.replace("Today's ", "").replace("Tomorrow's ", "Tmrw ")}
                      </Text>
                      <Text style={{ fontSize: 14, fontWeight: '800', color: solarContext.isLive ? solarContext.color : '#F8FAFC', letterSpacing: 0.2, marginTop: 1 }} numberOfLines={1}>
                        {solarContext.mainText}
                      </Text>
                      {solarContext.isLive && (
                        <Text style={{ fontSize: 9, color: solarContext.color, fontWeight: '700', marginTop: 1 }}>{solarContext.label2}</Text>
                      )}
                    </>
                  ) : null}
                </View>"""
    
    if target1 not in content:
        print("Target 1 not found!")
        sys.exit(1)
        
    content = content.replace(target1, "")
    
    # Part 2: Add solarContext inside Body Rhythm card
    target2 = """                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.05)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 }}>
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
                            </View>"""
                            
    replacement2 = """                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
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
                              
                              {/* Solar Info Pill */}
                              {solarContext && (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.05)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 }}>
                                  <Ionicons name="sunny-outline" size={13} color="rgba(0,0,0,0.7)" />
                                  <Text style={{ fontSize: 12, fontWeight: '600', color: 'rgba(0,0,0,0.8)', letterSpacing: 0.3 }}>
                                    {solarContext.label1.replace("Today's ", "").replace("Tomorrow's ", "Tmrw ")} {solarContext.mainText}
                                  </Text>
                                </View>
                              )}
                            </View>"""
                            
    if target2 not in content:
        print("Target 2 not found!")
        sys.exit(1)
        
    content = content.replace(target2, replacement2)
    
    with open(file_path, 'w') as f:
        f.write(content)
        
    print("Patched Solar Context successfully!")

if __name__ == '__main__':
    main()

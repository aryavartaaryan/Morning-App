import sys

def main():
    file_path = 'app/(tabs)/index.tsx'
    with open(file_path, 'r') as f:
        content = f.read()

    start_marker = "                        {/* Top Section: Ring & Title */}"
    end_marker = "                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 18 }}>"
    
    start_idx = content.find(start_marker)
    end_idx = content.find(end_marker, start_idx)
    
    if start_idx != -1 and end_idx != -1:
        new_layout = """                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20 }}>
                          {/* Progress Ring */}
                          <View style={{ position: 'relative', width: 68, height: 68, alignItems: 'center', justifyContent: 'center' }}>
                            <Svg width={68} height={68} viewBox="0 0 68 68" style={{ transform: [{ rotate: '-90deg' }] }}>
                              <SvgCircle cx={34} cy={34} r={30} stroke="rgba(255,255,255,0.06)" strokeWidth={4} fill="none" />
                              <SvgCircle 
                                cx={34} cy={34} r={30} 
                                stroke="#A78BFA" 
                                strokeWidth={4} fill="none" 
                                strokeDasharray={`${30 * 2 * Math.PI}`} 
                                strokeDashoffset={`${30 * 2 * Math.PI * (1 - (pct / 100))}`} 
                                strokeLinecap="round" 
                              />
                            </Svg>
                            <View style={{ position: 'absolute', alignItems: 'center', justifyContent: 'center' }}>
                              <Text style={{ fontSize: 16, fontWeight: '800', color: '#FFF' }}>{hrsLeft}h</Text>
                              <Text style={{ fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.6)' }}>{minsLeftRem}m</Text>
                            </View>
                          </View>
                          
                          {/* Details */}
                          <View style={{ flex: 1, gap: 4 }}>
                            <Text style={{ fontSize: 10, fontWeight: '800', color: 'rgba(255,255,255,0.5)', letterSpacing: 1.5, textTransform: 'uppercase' }}>ACTIVE BIO-STATE</Text>
                            <Text style={{ fontSize: 17, fontWeight: '800', color: '#A78BFA', letterSpacing: 0 }}>Creative Peak Hours</Text>
                            
                            {/* Icons Row */}
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 }}>
                              <Ionicons name="moon-outline" size={16} color="rgba(255,255,255,0.7)" />
                              <Ionicons name="water-outline" size={16} color="rgba(255,255,255,0.7)" />
                              <Ionicons name="leaf-outline" size={16} color="rgba(255,255,255,0.7)" />
                              <Text style={{ color: 'rgba(255,255,255,0.2)', fontSize: 14 }}>|</Text>
                              <Ionicons name="desktop-outline" size={16} color="rgba(255,255,255,0.2)" />
                              <Ionicons name="phone-portrait-outline" size={16} color="rgba(255,255,255,0.2)" />
                            </View>
                          </View>
                          
                          <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.2)" />
                        </View>

                        <View style={{ width: '100%', height: 1 }} />
                        
"""
        content = content[:start_idx] + new_layout + content[end_idx:]

        # Also patch the outer container style of Bio-State to use View instead of BlurView with exact colors
        b_start = "<BlurView intensity={50} tint=\"dark\" style={{"
        b_end = "                      }}>"
        
        b_start_idx = content.find(b_start)
        if b_start_idx != -1:
            # We want to replace `<BlurView ...>` and its `</BlurView>` with a standard `<View>`.
            # Find the matching `</BlurView>` which is below the content.
            # Easiest way is to just replace the opening tag and closing tag string literals.
            content = content.replace(b_start, "<View style={{")
            
            # The properties to change: backgroundColor to 'rgba(25, 25, 25, 0.85)', borderWidth to 0.
            bg_old = "backgroundColor: 'rgba(15,15,15,0.55)',"
            bg_new = "backgroundColor: 'rgba(25, 25, 25, 0.85)',"
            content = content.replace(bg_old, bg_new)
            
            bw_old = "borderWidth: 0.5,"
            bw_new = "borderWidth: 0,"
            content = content.replace(bw_old, bw_new)
            
            # Replace </BlurView> with </View> where it wraps the biostate card.
            # In my previous scripts, it was:
            # `                        </View>\n                      </BlurView>`
            # Let's replace the one just after `Tap to view metabolic state`
            content = content.replace("                      </BlurView>", "                      </View>")

        with open(file_path, 'w') as f:
            f.write(content)
        print("Patched Bio-State layout successfully.")

if __name__ == "__main__":
    main()

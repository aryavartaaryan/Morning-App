import sys

def main():
    file_path = 'components/MetabolicStoryModal.tsx'
    with open(file_path, 'r') as f:
        content = f.read()

    # 1. Add SVG import if not present
    if "import Svg, { Circle as SvgCircle } from 'react-native-svg';" not in content:
        import_idx = content.find("import { Ionicons } from '@expo/vector-icons';")
        if import_idx != -1:
            content = content[:import_idx] + "import Svg, { Circle as SvgCircle } from 'react-native-svg';\nimport { Ionicons } from '@expo/vector-icons';" + content[import_idx + len("import { Ionicons } from '@expo/vector-icons';"):]

    # 2. Replace the time window card content
    start_marker = "            {/* Dynamic Real-Time Window Card */}"
    end_marker = "            </View>"
    
    # But wait, there are multiple `</View>` closing tags. Let's find the specific block.
    # The block ends before `{/* ════ SECTION: DO & AVOID PROTOCOLS ════ */}` or `{/* ════ SECTION: THE REAL SCIENCE OF EARTH'S TILT ════ */}` depending on previous restructures.
    
    start_idx = content.find(start_marker)
    
    # The end of the timeWindowCard is the </View> just before the next SECTION.
    # Let's find the next "            {/* ════ SECTION:"
    next_section_idx = content.find("            {/* ════ SECTION:", start_idx)
    if next_section_idx == -1:
        next_section_idx = content.find("            {/* ════", start_idx)
        
    if start_idx != -1 and next_section_idx != -1:
        new_layout = """            {/* Dynamic Real-Time Window Card */}
            <View style={[S.timeWindowCard, { padding: 16 }]}>
              <LinearGradient
                colors={['rgba(255,255,255,0.07)', 'rgba(255,255,255,0.02)']}
                style={StyleSheet.absoluteFillObject}
              />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                  {/* Circular Progress Ring */}
                  <View style={{ position: 'relative', width: 68, height: 68, alignItems: 'center', justifyContent: 'center' }}>
                    <Svg width={68} height={68} viewBox="0 0 68 68" style={{ transform: [{ rotate: '-90deg' }] }}>
                      <SvgCircle cx={34} cy={34} r={30} stroke="rgba(255,255,255,0.06)" strokeWidth={5} fill="none" />
                      <SvgCircle 
                        cx={34} cy={34} r={30} 
                        stroke={accent} 
                        strokeWidth={5} fill="none" 
                        strokeDasharray={`${30 * 2 * Math.PI}`} 
                        strokeDashoffset={`${30 * 2 * Math.PI * (1 - prog)}`} 
                        strokeLinecap="round" 
                      />
                    </Svg>
                    <View style={{ position: 'absolute', alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: 13, fontWeight: '800', color: '#FFF' }}>{Math.round(prog * 100)}%</Text>
                    </View>
                  </View>
                  
                  {/* Details */}
                  <View style={{ flex: 1 }}>
                    <Text style={S.cardEyebrow}>DYNAMIC SOLAR WINDOW</Text>
                    <Text style={[S.windowTimeText, { color: accent, fontSize: 17, marginTop: 2 }]} numberOfLines={1} adjustsFontSizeToFit>
                      {period.startLabel} — {period.endLabel}
                    </Text>
                    <Text style={[S.progressSubText, { marginTop: 4 }]}>{remStr}</Text>
                  </View>
                </View>
                
                <View style={[S.activeBadge, { backgroundColor: `${accent}20`, borderColor: `${accent}50`, alignSelf: 'flex-start', marginLeft: 10 }]}>
                  <Text style={[S.activeBadgeText, { color: accent }]}>LIVE</Text>
                </View>
              </View>
            </View>

"""
        content = content[:start_idx] + new_layout + content[next_section_idx:]

    with open(file_path, 'w') as f:
        f.write(content)
    print("Patched Modal progress ring successfully.")

if __name__ == "__main__":
    main()

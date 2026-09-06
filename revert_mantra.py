import sys

def main():
    file_path = 'components/DailyIntentionCard.tsx'
    with open(file_path, 'r') as f:
        content = f.read()

    start_marker = "          <BlurView intensity={50} tint=\"dark\" style={styles.cardInner}>"
    end_marker = "            <View style={styles.affordanceRow}>"
    
    start_idx = content.find(start_marker)
    end_idx = content.find(end_marker, start_idx)
    
    if start_idx != -1 and end_idx != -1:
        new_layout = """          <View style={[styles.cardInner, { backgroundColor: 'rgba(25, 25, 25, 0.85)', borderWidth: 0 }]}>
            {/* ── Mantra Title ── */}
            <View style={[styles.titleRow, { marginBottom: 16 }]}>
               <View style={[styles.goldDot, { backgroundColor: '#FCD34D' }]} />
               <Text style={[styles.titleText, { color: '#FCD34D', letterSpacing: 1.5, fontSize: 10, fontWeight: '700' }]}>TODAY'S MANTRA</Text>
            </View>

            {/* ── Mantra Transliteration ── */}
            <Text style={{ 
                fontFamily: 'serif', fontStyle: 'italic', fontSize: 20, color: '#FFF', 
                textAlign: 'center', lineHeight: 28, marginBottom: 16 
            }}>
                Om sarve bhavantu sukhinah{"\\n"}sarve santu niramayah
            </Text>

            {/* ── English Meaning ── */}
            <Text style={{ 
                fontFamily: 'sans-serif', fontStyle: 'italic', fontSize: 12, color: 'rgba(255,255,255,0.6)', 
                textAlign: 'center', lineHeight: 18, marginBottom: 24, paddingHorizontal: 16 
            }}>
                "May all be happy, may all be free from illness. May no one suffer."
            </Text>

"""
        content = content[:start_idx] + new_layout + content[end_idx:]

        # Update affordance row style
        old_afford = """            <View style={styles.affordanceRow}>
              <Text style={styles.affordanceText}>Tap to explore</Text>
              <Ionicons name="chevron-forward" size={10} color="rgba(255,255,255,0.45)" />
            </View>
          </BlurView>"""
        new_afford = """            <View style={[styles.affordanceRow, { marginTop: 0 }]}>
              <Text style={[styles.affordanceText, { color: 'rgba(255,255,255,0.3)', fontWeight: '700', letterSpacing: 1.5 }]}>TAP TO EXPLORE</Text>
              <Ionicons name="chevron-forward" size={12} color="rgba(255,255,255,0.3)" />
            </View>
          </View>"""
        content = content.replace(old_afford, new_afford)

        with open(file_path, 'w') as f:
            f.write(content)
        print("Patched Mantra card successfully.")

if __name__ == "__main__":
    main()

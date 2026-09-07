import sys

def main():
    file_path = 'app/(tabs)/index.tsx'
    with open(file_path, 'r') as f:
        content = f.read()

    # First, let's remove the current Dock from wherever it is.
    dock_start = "{/* ── VISIONOS FLOATING GLASS DOCK"
    scroll_end = "      </SafeAreaView>"
    
    start_idx = content.find(dock_start)
    if start_idx == -1:
        print("Could not find dock.")
        return
        
    end_idx = content.find("</View>", start_idx) # finds the first </View>
    # Wait, the dock has nested views. Let's just find a unique string after the dock.
    after_dock = "      </SafeAreaView>"
    
    # Actually, the dock is currently inside the ScrollView right?
    # Let's just search for the whole block or use regex.
    import re
    # We want to remove from dock_start to the closing </View> of the dock.
    dock_pattern = r"\{/\* ── VISIONOS FLOATING GLASS DOCK.*?</TouchableOpacity>\s*</BlurView>\s*</View>"
    content = re.sub(dock_pattern, "", content, flags=re.DOTALL)
    
    # Now, we insert the new exact screenshot-matching dock right before </SafeAreaView>
    new_dock = """
        {/* ── ORIGINAL 3-BUTTON DOCK (GUARANTEED VISIBLE) ── */}
        <View style={{ flexDirection: 'row', width: '100%', paddingBottom: 16, paddingTop: 16, backgroundColor: 'transparent', borderTopWidth: 0 }}>
          {/* Almanac */}
          <TouchableOpacity
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSheetOpen(true); }}
            activeOpacity={0.65}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="journal-outline" size={22} color="rgba(255,255,255,0.8)" />
            <Text style={{ fontSize: 11, fontWeight: '500', color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>Almanac</Text>
          </TouchableOpacity>

          {/* Vitality */}
          <TouchableOpacity
            onPress={() => { setShowStressScanner(true); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); }}
            activeOpacity={0.65}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="pulse-outline" size={22} color="rgba(255,255,255,0.8)" />
            <Text style={{ fontSize: 11, fontWeight: '500', color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>Vitality</Text>
          </TouchableOpacity>

          {/* Soundscapes */}
          <TouchableOpacity
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.navigate('/(tabs)/sleep' as never); }}
            activeOpacity={0.65}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="stats-chart-outline" size={22} color="rgba(255,255,255,0.8)" />
            <Text style={{ fontSize: 11, fontWeight: '500', color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>Soundscapes</Text>
          </TouchableOpacity>
        </View>
"""
    
    # Insert new dock right before </SafeAreaView>
    content = content.replace("      </SafeAreaView>", new_dock + "\n      </SafeAreaView>")

    with open(file_path, 'w') as f:
        f.write(content)
    print("Forced dock outside ScrollView successfully.")

if __name__ == "__main__":
    main()

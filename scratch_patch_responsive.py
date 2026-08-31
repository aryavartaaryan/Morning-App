import sys

def main():
    file_path = 'app/(tabs)/index.tsx'
    with open(file_path, 'r') as f:
        content = f.read()

    # 1. Replace the outer container opening
    target_start = """        <View style={{ flex: 1, justifyContent: 'space-between', alignItems: 'center', paddingBottom: insets.bottom + 30 }}>
              
              {/* === REFINED EDITORIAL CURATOR LAYOUT (MULTI-BILLION DOLLAR APP STYLE) === */}
              {/* Spacer for optical centering */}
              <View style={{ flex: 0.1 }} />"""
              
    rep_start = """        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 12 }} showsVerticalScrollIndicator={false}>
              
              {/* === REFINED EDITORIAL CURATOR LAYOUT (MULTI-BILLION DOLLAR APP STYLE) === */}"""
              
    if target_start not in content:
        print("target_start not found!")
    else:
        content = content.replace(target_start, rep_start)


    # 2. Remove the flex: 1 spacer
    target_mid = """              {/* Spacer between center content and bottom controls */}
              <View style={{ flex: 1 }} />"""
    rep_mid = """              {/* Spacer removed for ScrollView layout */}"""
    
    if target_mid not in content:
        print("target_mid not found!")
    else:
        content = content.replace(target_mid, rep_mid)


    # 3. Close ScrollView before the Dock and update Dock's bottom padding
    target_dock = """              {/* ── VISIONOS FLOATING GLASS DOCK — 3 columns ── */}
              <View style={{ width: '100%', paddingHorizontal: 28, paddingBottom: 4, marginTop: 6 }}>"""
              
    rep_dock = """        </ScrollView>

        {/* ── VISIONOS FLOATING GLASS DOCK — 3 columns (Fixed at bottom) ── */}
        <View style={{ width: '100%', paddingHorizontal: 28, paddingBottom: Math.max(insets.bottom, 16) + 12, paddingTop: 10, backgroundColor: 'transparent' }}>"""

    if target_dock not in content:
        print("target_dock not found!")
    else:
        content = content.replace(target_dock, rep_dock)
        
    # 4. Remove the stray closing </View> at the end
    target_end = """                </BlurView>
              </View>
            </View>
      </SafeAreaView>"""
      
    rep_end = """                </BlurView>
              </View>
      </SafeAreaView>"""
      
    if target_end not in content:
        print("target_end not found!")
    else:
        content = content.replace(target_end, rep_end)

    with open(file_path, 'w') as f:
        f.write(content)
        
    print("Patched ScrollView responsive layout successfully!")

if __name__ == '__main__':
    main()

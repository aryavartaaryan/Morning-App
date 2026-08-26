import os

file_path = "app/(tabs)/sleep.tsx"

with open(file_path, "r") as f:
    content = f.read()

# We need to replace the entire current hero section.
# It starts at: {/* Premium Sticky Search & Library Actions (Compact) */}
# And ends before: {/* ── Content container ── */}

start_marker = "{/* Premium Sticky Search & Library Actions (Compact) */}"
end_marker = "{/* ── Content container ── */}"

if start_marker in content and end_marker in content:
    start_idx = content.find(start_marker)
    end_idx = content.find(end_marker)
    
    prefix = content[:start_idx]
    suffix = content[end_idx:]
    
    new_hero = """        {/* ── Option 1: The Vision Pro Glass Island ── */}
        <View style={{ paddingHorizontal: 16, paddingTop: insets.top + 12, marginBottom: 16, zIndex: 10 }}>
          <BlurView intensity={55} tint="dark" style={{
            borderRadius: 28, padding: 20, overflow: 'hidden',
            backgroundColor: 'rgba(255,255,255,0.05)',
            borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)'
          }}>
            {/* Header Row */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              {!isSearching ? (
                <View style={{ flex: 1 }}>
                  <Text style={{
                    fontSize: 34, color: '#fff', fontFamily: 'DancingScript_600SemiBold',
                    letterSpacing: 0.5, textShadowColor: 'rgba(200,180,255,0.4)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 24,
                    lineHeight: 40,
                  }}>
                    Welcome to Svara
                  </Text>
                  <Text style={{
                    fontSize: 15, color: 'rgba(255,255,255,0.7)', fontFamily: 'Nunito_400Regular',
                    letterSpacing: 0.3, marginTop: 2,
                  }}>
                    Find your moment of calm.
                  </Text>
                </View>
              ) : (
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 20, paddingHorizontal: 16, height: 48, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' }}>
                  <Ionicons name="search" size={20} color="rgba(255,255,255,0.7)" />
                  <TextInput
                    style={{ flex: 1, color: '#fff', fontSize: 16, fontFamily: 'Nunito_400Regular', padding: 0, marginLeft: 10 }}
                    placeholder="Search premium sounds..."
                    placeholderTextColor="rgba(255,255,255,0.4)"
                    value={searchQuery}
                    onChangeText={(text) => {
                      setSearchQuery(text);
                    }}
                    autoFocus
                    onBlur={() => {
                      if (searchQuery.length === 0) {
                        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                        setIsSearching(false);
                      }
                    }}
                    returnKeyType="search"
                  />
                  {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => { setSearchQuery(''); Keyboard.dismiss(); }} style={{ padding: 4 }}>
                      <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.7)" />
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* Action Buttons (Library & Search Toggle) */}
              {!isSearching && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginLeft: 16, marginTop: 4 }}>
                  <TouchableOpacity activeOpacity={0.7} onPress={() => {
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                    setIsSearching(true);
                  }}>
                    <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' }}>
                      <Ionicons name="search" size={18} color="#fff" />
                    </View>
                  </TouchableOpacity>
                  
                  <TouchableOpacity activeOpacity={0.7} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setLibraryOpen(true); }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 42, borderRadius: 21, backgroundColor: 'rgba(167, 139, 250, 0.15)', paddingHorizontal: 16, borderWidth: 1, borderColor: 'rgba(167, 139, 250, 0.35)' }}>
                      <Ionicons name="musical-notes" size={16} color="#e9d5ff" />
                      <Text style={{ fontSize: 13, color: '#e9d5ff', fontFamily: 'Nunito_800ExtraBold' }}>Library</Text>
                    </View>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Bottom Row: Sonic Therapies Embedded */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 24, paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' }}>
              <Text style={{
                fontSize: 11, color: 'rgba(167, 139, 250, 0.95)', fontFamily: 'Nunito_800ExtraBold',
                letterSpacing: 2, textTransform: 'uppercase'
              }}>
                Sonic Therapies
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#A78BFA', shadowColor: '#A78BFA', shadowOpacity: 0.8, shadowRadius: 4 }} />
                <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)', fontFamily: 'Nunito_600SemiBold', letterSpacing: 0.5, textTransform: 'uppercase' }}>
                  {heroContent ? heroContent.header : displayMode.label} Phase
                </Text>
              </View>
            </View>
          </BlurView>
        </View>

        <Animated.ScrollView
          ref={(r) => { _pageScrollRef = r; }}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 120, paddingTop: 4 }}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={8}
          onScroll={onMainScroll}
          overScrollMode="never"
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
        >

"""
    
    # We must also fix the search overlay `top` property to match the new island height.
    # Island padding = 20+20=40. Top row ~48. Gap 24. Bottom row ~16 + 16 padding = 32. Total ~ 144. + 16 marginTop + 12 inset.
    # Let's set top to insets.top + 170.
    
    new_content = prefix + new_hero + suffix
    
    overlay_target = "top: insets.top + 62,"
    overlay_replacement = "top: insets.top + 165,"
    if overlay_target in new_content:
        new_content = new_content.replace(overlay_target, overlay_replacement)
        
    with open(file_path, "w") as f:
        f.write(new_content)
    print("Replaced successfully!")
else:
    print("Could not find markers.")


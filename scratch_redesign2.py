import os

file_path = "app/(tabs)/sleep.tsx"

with open(file_path, "r") as f:
    content = f.read()

# I will replace the target section.
target = """        {/* Sticky Search & Library Actions */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 24, paddingTop: insets.top + 16, paddingBottom: 12, zIndex: 10 }}>
          {/* Ultra Slim Search Bar */}
          <BlurView intensity={40} tint="dark" style={{ 
            flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6,
            backgroundColor: 'rgba(255,255,255,0.08)', 
            borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.2)', 
            borderRadius: 8, paddingHorizontal: 10, height: 32,
            overflow: 'hidden'
          }}>
            <Ionicons name="search" size={14} color="rgba(255,255,255,0.6)" />
            <TextInput
              style={{ flex: 1, color: '#fff', fontSize: 13, fontFamily: 'Nunito_400Regular', padding: 0 }}
              placeholder="Search sounds..."
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={searchQuery}
              onChangeText={(text) => {
                setSearchQuery(text);
                setIsSearching(text.length > 0);
              }}
              onFocus={() => setIsSearching(true)}
              onBlur={() => {
                if (searchQuery.length === 0) setIsSearching(false);
              }}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => { setSearchQuery(''); setIsSearching(false); Keyboard.dismiss(); }}>
                <Ionicons name="close-circle" size={14} color="rgba(255,255,255,0.6)" />
              </TouchableOpacity>
            )}
          </BlurView>

          {/* Ultra Slim Library Button */}
          <TouchableOpacity
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setLibraryOpen(true); }}
            activeOpacity={0.8}
          >
            <BlurView intensity={40} tint="dark" style={{ 
              flexDirection: 'row', alignItems: 'center', gap: 5, 
              backgroundColor: 'rgba(167, 139, 250, 0.15)',
              borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(167, 139, 250, 0.3)', 
              borderRadius: 8, paddingHorizontal: 10, height: 32,
              overflow: 'hidden'
            }}>
              <Ionicons name="musical-notes" size={12} color="#d8b4fe" />
              <Text style={{ fontSize: 12, color: '#e9d5ff', fontFamily: 'Nunito_700Bold', letterSpacing: 0.3 }}>
                Library
              </Text>
            </BlurView>
          </TouchableOpacity>
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

          <View style={{ width: W, alignItems: 'flex-start', justifyContent: 'flex-start', paddingHorizontal: 24, marginBottom: 8 }}>

            {/* Welcome Greeting */}
            <Text style={{
              fontSize: 28, color: '#fff', fontFamily: 'DancingScript_600SemiBold',
              letterSpacing: 0.5, textAlign: 'left',
              textShadowColor: 'rgba(200,180,255,0.35)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 20,
              lineHeight: 32,
            }}>
              Welcome to Svara
            </Text>

            <Text style={{
              fontSize: 14, color: 'rgba(255,255,255,0.7)', fontFamily: 'Nunito_400Regular',
              letterSpacing: 0.3, marginTop: 2, marginBottom: 12,
            }}>
              Find your moment of calm.
            </Text>

            {/* Sonic Therapies & Circadian Phase */}
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6, opacity: 0.85,
              borderLeftWidth: 2, borderLeftColor: 'rgba(167, 139, 250, 0.5)', paddingLeft: 12
            }}>
              <View>
                <Text style={{
                  fontSize: 14, color: '#fff', fontFamily: 'Nunito_700Bold',
                  letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4
                }}>
                  Sonic Therapies
                </Text>
                
                {/* Circadian phase pill */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, opacity: 0.8 }}>
                  <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#A78BFA', shadowColor: '#A78BFA', shadowOpacity: 1, shadowRadius: 5 }} />
                  <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.8)', fontFamily: 'Nunito_600SemiBold', letterSpacing: 1.6, textTransform: 'uppercase' }}>
                    Currently in your {heroContent ? heroContent.header.toLowerCase() : displayMode.label.toLowerCase()} phase
                  </Text>
                </View>
              </View>
            </View>

          </View>"""


replacement = """        {/* Premium Sticky Search & Library Actions */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 24, paddingTop: insets.top + 20, paddingBottom: 16, zIndex: 10 }}>
          {/* Premium Pill Search Bar */}
          <BlurView intensity={50} tint="dark" style={{ 
            flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
            backgroundColor: 'rgba(255,255,255,0.06)', 
            borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', 
            borderRadius: 24, paddingHorizontal: 16, height: 44,
            overflow: 'hidden'
          }}>
            <Ionicons name="search" size={18} color="rgba(255,255,255,0.7)" />
            <TextInput
              style={{ flex: 1, color: '#fff', fontSize: 15, fontFamily: 'Nunito_400Regular', padding: 0 }}
              placeholder="Search sounds..."
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={searchQuery}
              onChangeText={(text) => {
                setSearchQuery(text);
                setIsSearching(text.length > 0);
              }}
              onFocus={() => setIsSearching(true)}
              onBlur={() => {
                if (searchQuery.length === 0) setIsSearching(false);
              }}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => { setSearchQuery(''); setIsSearching(false); Keyboard.dismiss(); }} style={{ padding: 4 }}>
                <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.7)" />
              </TouchableOpacity>
            )}
          </BlurView>

          {/* Premium Pill Library Button */}
          <TouchableOpacity
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setLibraryOpen(true); }}
            activeOpacity={0.8}
          >
            <BlurView intensity={60} tint="dark" style={{ 
              flexDirection: 'row', alignItems: 'center', gap: 8, 
              backgroundColor: 'rgba(167, 139, 250, 0.15)',
              borderWidth: 1, borderColor: 'rgba(167, 139, 250, 0.35)', 
              borderRadius: 24, paddingHorizontal: 16, height: 44,
              overflow: 'hidden'
            }}>
              <Ionicons name="musical-notes" size={16} color="#e9d5ff" />
              <Text style={{ fontSize: 14, color: '#e9d5ff', fontFamily: 'Nunito_700Bold', letterSpacing: 0.3 }}>
                Library
              </Text>
            </BlurView>
          </TouchableOpacity>
        </View>

        <Animated.ScrollView
          ref={(r) => { _pageScrollRef = r; }}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 120, paddingTop: 8 }}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={8}
          onScroll={onMainScroll}
          overScrollMode="never"
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
        >

          <View style={{ width: W, alignItems: 'flex-start', justifyContent: 'flex-start', paddingHorizontal: 24, marginBottom: 20 }}>
            {/* Welcome Greeting */}
            <Text style={{
              fontSize: 34, color: '#fff', fontFamily: 'DancingScript_600SemiBold',
              letterSpacing: 0.5, textAlign: 'left',
              textShadowColor: 'rgba(200,180,255,0.4)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 24,
              lineHeight: 40,
            }}>
              Welcome to Svara
            </Text>

            <Text style={{
              fontSize: 16, color: 'rgba(255,255,255,0.75)', fontFamily: 'Nunito_400Regular',
              letterSpacing: 0.3, marginTop: 4, marginBottom: 24,
            }}>
              Find your moment of calm.
            </Text>

            {/* Sonic Therapies & Circadian Phase - Redesigned */}
            <View style={{
              width: '100%',
              flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
              backgroundColor: 'rgba(255,255,255,0.04)',
              borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
              borderRadius: 16, padding: 16,
            }}>
              <View>
                <Text style={{
                  fontSize: 12, color: 'rgba(167, 139, 250, 0.9)', fontFamily: 'Nunito_800ExtraBold',
                  letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6
                }}>
                  Sonic Therapies
                </Text>
                
                {/* Circadian phase pill */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#A78BFA', shadowColor: '#A78BFA', shadowOpacity: 0.8, shadowRadius: 4 }} />
                  <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)', fontFamily: 'Nunito_600SemiBold', letterSpacing: 0.5 }}>
                    {heroContent ? heroContent.header : displayMode.label} Phase
                  </Text>
                </View>
              </View>
              <Ionicons name="sparkles" size={20} color="rgba(167, 139, 250, 0.6)" />
            </View>

          </View>"""


if target in content:
    new_content = content.replace(target, replacement)
    with open(file_path, "w") as f:
        f.write(new_content)
    print("Replaced successfully!")
else:
    print("Target not found.")


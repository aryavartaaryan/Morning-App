import re

with open('/Users/hotelnamastebharatinn/Desktop/Morning-App/app/(tabs)/sleep.tsx', 'r') as f:
    content = f.read()

# Replace cardW in AnthologyScreen
content = content.replace(
    "const cardW = Math.floor(W * 0.48 * 0.85); // 15% reduction for premium feel",
    "const cardW = Math.floor(W * 0.38); // Glassmorphism layout: ~2.5 cards per row"
)

# Fix horizontal grids title "ultra premium multi-million dollar title"
# Look for "Ultra-Premium Volume Header"
old_header = """                  {/* Ultra-Premium Volume Header */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16, paddingHorizontal: 20 }}>
                    <View style={{ width: 4, height: 16, borderRadius: 2, backgroundColor: collection.themeColor }} />
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#fff', letterSpacing: 3, fontFamily: 'Nunito_700Bold', textTransform: 'uppercase' }}>
                      {volumeTitle}
                    </Text>
                    <View style={{ flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.08)' }} />
                  </View>"""

new_header = """                  {/* Premium Volume Header (Glassmorphism Style) */}
                  <View style={{ marginBottom: 18, paddingHorizontal: 20 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: collection.themeColor + '30', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: collection.themeColor + '50' }}>
                        <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: collection.themeColor, shadowColor: collection.themeColor, shadowOpacity: 1, shadowRadius: 4 }} />
                      </View>
                      <Text style={{ fontSize: 10, fontWeight: '800', color: collection.themeColor, letterSpacing: 2, fontFamily: 'Nunito_800ExtraBold', textTransform: 'uppercase' }}>
                        Curated Collection
                      </Text>
                    </View>
                    <Text style={{ fontSize: 20, color: '#fff', fontFamily: 'CormorantGaramond_600SemiBold', letterSpacing: 0.5 }}>
                      {volumeTitle}
                    </Text>
                  </View>"""
content = content.replace(old_header, new_header)

# Ensure CormorantGaramond_600SemiBold is imported or use an existing elegant font.
# In previous explorations, DancingScript or similar is used. Wait, what fonts are available?
# Let's replace CormorantGaramond_600SemiBold with a known font like 'CormorantGaramond_600SemiBold' if it exists, or 'Georgia', or just keep 'Nunito_700Bold' with larger size but more elegant styling. Let's use 'Nunito_400Regular' with larger size, or see what fonts they have.
# The user's screenshot has "Vedic Mantras Library" in a script font (maybe DancingScript).
# We can use `fontFamily: 'DancingScript_600SemiBold'` if it exists (it does, see line 4698: `fontFamily: 'DancingScript_600SemiBold'`).
# Let's actually use standard elegant styling. 

new_header_safe = """                  {/* Premium Volume Header (Glassmorphism Style) */}
                  <View style={{ marginBottom: 18, paddingHorizontal: 20 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: collection.themeColor + '30', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: collection.themeColor + '50' }}>
                        <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: collection.themeColor, shadowColor: collection.themeColor, shadowOpacity: 1, shadowRadius: 4 }} />
                      </View>
                      <Text style={{ fontSize: 9, fontWeight: '800', color: collection.themeColor, letterSpacing: 2, fontFamily: 'Nunito_800ExtraBold', textTransform: 'uppercase' }}>
                        Curated Collection
                      </Text>
                    </View>
                    <Text style={{ fontSize: 18, color: 'rgba(255,255,255,0.95)', fontFamily: 'Nunito_700Bold', letterSpacing: 0.5 }}>
                      {volumeTitle}
                    </Text>
                  </View>"""
content = content.replace(new_header, new_header_safe) # in case it was already replaced
content = content.replace(old_header, new_header_safe)

# Also Top nav / title "Sonic Therapies"
# Let's find:
# {/* Top Nav */}
#           <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, paddingHorizontal: 20 }}>
#             <TouchableOpacity onPress={handleClose} activeOpacity={0.8} style={{ overflow: 'hidden', borderRadius: 99, paddingVertical: 4 }}>
old_nav = """          {/* Top Nav */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, paddingHorizontal: 20 }}>
            <TouchableOpacity onPress={handleClose} activeOpacity={0.8} style={{ overflow: 'hidden', borderRadius: 99, paddingVertical: 4 }}>
              <BlurView intensity={42} tint="dark" style={{
                flexDirection: 'row', alignItems: 'center', gap: 7,
                paddingHorizontal: 14, paddingVertical: 8,
                borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.15)',
              }}>
                <Ionicons name="chevron-back" size={15} color="#fff" />
                <Text style={{ fontSize: 13, color: '#fff', fontFamily: 'Nunito_600SemiBold', letterSpacing: 0.3 }}>Back</Text>
              </BlurView>
            </TouchableOpacity>
          </View>"""

new_nav = """          {/* Top Nav - Glassmorphism Premium */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 24, paddingHorizontal: 20, position: 'relative' }}>
            <TouchableOpacity onPress={handleClose} activeOpacity={0.8} style={{ position: 'absolute', left: 20, zIndex: 10, padding: 8, paddingLeft: 0 }}>
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
                <Ionicons name="chevron-back" size={18} color="#fff" style={{ marginLeft: -2 }} />
              </View>
            </TouchableOpacity>
            
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 16, color: '#fff', fontFamily: 'Nunito_700Bold', letterSpacing: 0.5 }}>Sonic Therapies</Text>
              <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', fontFamily: 'Nunito_600SemiBold', letterSpacing: 1.5, marginTop: 2, textTransform: 'uppercase' }}>Premium Library</Text>
            </View>
          </View>"""
content = content.replace(old_nav, new_nav)

with open('/Users/hotelnamastebharatinn/Desktop/Morning-App/app/(tabs)/sleep.tsx', 'w') as f:
    f.write(content)


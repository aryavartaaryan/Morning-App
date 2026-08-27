import re

with open("app/(tabs)/walk.tsx", "r") as f:
    text = f.read()

# 1. Fix the bug in handleZoneSelect
old_handle = """  const handleZoneSelect = (zoneId: ZoneId) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedZone(zoneId);
    setDropdownOpen(false);
  };"""

new_handle = """  const handleZoneSelect = (zoneId: ZoneId) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedZone(zoneId);
    setDropdownOpen(false);
    setIsCompassActive(true);
  };"""

text = text.replace(old_handle, new_handle)

# 2. Update the header in the render
old_header_render = """        {/* Header */}
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 40) }]}>
          <Text style={styles.headerTitle}>Harmony Compass</Text>
          <Text style={styles.headerSubtitle}>Sacred Space Intelligence</Text>
        </View>"""

new_header_render = """        {/* Header */}
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 40) }]}>
          <Text style={styles.headerTitle}>Rhythm</Text>
          <Text style={styles.headerSubtitle}>LIVE VASTU ALIGNMENT</Text>
        </View>"""

# We'll just replace styles
# headerTitle -> DancingScript_600SemiBold, size 26
old_headerTitle = """  headerTitle: {
    fontFamily: FONTS.serif,
    fontSize: 28,
    color: COLORS.ivory,
    letterSpacing: 1,
    marginBottom: 4,
  },"""

new_headerTitle = """  headerTitle: {
    fontFamily: 'DancingScript_600SemiBold',
    fontSize: 32,
    color: '#FFF',
    marginBottom: 2,
    textShadowColor: 'rgba(201,162,75,0.4)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },"""

text = text.replace(old_headerTitle, new_headerTitle)

old_headerSubtitle = """  headerSubtitle: {
    fontFamily: FONTS.sans,
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.gold,
    letterSpacing: 3,
    textTransform: 'uppercase',
  },"""

new_headerSubtitle = """  headerSubtitle: {
    fontFamily: FONTS.sans,
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.gold,
    letterSpacing: 4,
    textTransform: 'uppercase',
    opacity: 0.8,
  },"""

text = text.replace(old_headerSubtitle, new_headerSubtitle)

with open("app/(tabs)/walk.tsx", "w") as f:
    f.write(text)

print("Updates applied.")

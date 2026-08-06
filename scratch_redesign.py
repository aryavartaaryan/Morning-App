import re

with open('./app/(tabs)/index.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update DayDetailSheet styles
# Drag handle: Make it thinner and softer
content = content.replace(
    "<View style={{ width: 44, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.18)' }} />",
    "<View style={{ width: 36, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)', shadowColor: '#FFF', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.3, shadowRadius: 3, elevation: 1 }} />"
)

# Floating close button: Blur and finer text
content = content.replace(
    "style={{ position: 'absolute', top: 14, right: 18, zIndex: 20, width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', backgroundColor: 'rgba(255,255,255,0.07)', alignItems: 'center', justifyContent: 'center' }}>\n            <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, fontWeight: '700' }}>✕</Text>",
    "style={{ position: 'absolute', top: 14, right: 18, zIndex: 20, width: 32, height: 32, borderRadius: 16, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.3)', backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 8, overflow: 'hidden' }}>\n            <BlurView intensity={30} tint=\"light\" style={StyleSheet.absoluteFillObject} />\n            <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '400', opacity: 0.8 }}>✕</Text>"
)


# 2. Update WeatherSection WSEC styles
content = content.replace(
    "intensity={60} tint=\"dark\" style={StyleSheet.absoluteFillObject}",
    "intensity={85} tint=\"dark\" style={StyleSheet.absoluteFillObject}"
)

content = content.replace(
    "colors={['rgba(10,12,28,0.78)', 'rgba(6,8,20,0.88)', 'rgba(10,12,28,0.72)']}",
    "colors={['rgba(14,21,48,0.85)', 'rgba(5,9,20,0.92)', 'rgba(14,21,48,0.80)']}"
)

# Update WSEC stylesheet
content = re.sub(
    r"container: \{\s*marginHorizontal: 10, marginTop: 1, marginBottom: 2,\s*borderRadius: 20,\s*overflow: 'hidden',\s*borderWidth: 1,\s*borderColor: 'rgba\(255,255,255,0\.13\)',\s*shadowColor: '#000',\s*shadowOffset: \{ width: 0, height: 14 \},\s*shadowOpacity: 0\.55,\s*shadowRadius: 28,\s*elevation: 18,\s*\}",
    "container: {\n    marginHorizontal: 12, marginTop: 2, marginBottom: 4,\n    borderRadius: 24,\n    overflow: 'hidden',\n    borderWidth: 1,\n    borderColor: 'rgba(255,255,255,0.25)',\n    shadowColor: '#60a5fa',\n    shadowOffset: { width: 0, height: 12 },\n    shadowOpacity: 0.15,\n    shadowRadius: 32,\n    elevation: 18,\n  }",
    content
)

content = re.sub(
    r"bigTemp: \{\s*fontSize: 24,\s*fontWeight: '900',\s*color: '#FFFFFF',\s*letterSpacing: -0\.5\s*\}",
    "bigTemp: { fontSize: 30, fontWeight: '300', color: '#FFFFFF', letterSpacing: -1.5, textShadowColor: 'rgba(255,255,255,0.2)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 8 }",
    content
)

content = re.sub(
    r"cond: \{\s*fontSize: 13,\s*color: 'rgba\(255,255,255,0\.85\)',\s*fontWeight: '800'\s*\}",
    "cond: { fontSize: 13, color: 'rgba(255,255,255,0.95)', fontWeight: '600', letterSpacing: 0.2 }",
    content
)

content = re.sub(
    r"chip: \{\s*paddingHorizontal: 6,\s*paddingVertical: 3,\s*borderRadius: 8,\s*backgroundColor: 'rgba\(255,255,255,0\.06\)',\s*borderWidth: 0\.5,\s*borderColor: 'rgba\(255,255,255,0\.12\)'\s*\}",
    "chip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.25)', shadowColor: '#FFF', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.1, shadowRadius: 4 }",
    content
)

content = re.sub(
    r"hourCard: \{\s*alignItems: 'center',\s*paddingHorizontal: 10,\s*paddingVertical: 3,\s*borderRadius: 16,\s*backgroundColor: 'rgba\(255,255,255,0\.03\)',\s*borderWidth: 1,\s*borderColor: 'rgba\(255,255,255,0\.08\)',\s*minWidth: 54,\s*gap: 2\s*\}",
    "hourCard: { alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.15)', minWidth: 56, gap: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8 }",
    content
)
content = re.sub(
    r"hourCardNow: \{\s*backgroundColor: 'rgba\(255,255,255,0\.1\)',\s*borderColor: 'rgba\(255,255,255,0\.2\)'\s*\}",
    "hourCardNow: { backgroundColor: 'rgba(96, 165, 250, 0.25)', borderColor: 'rgba(96, 165, 250, 0.5)', shadowColor: '#60a5fa', shadowOpacity: 0.3, shadowRadius: 10 }",
    content
)


# 3. Update CosmicCompactCard
# Main container
content = content.replace(
    "borderWidth: 1,\n        borderColor: 'rgba(255,255,255,0.13)',\n        shadowColor: '#000',\n        shadowOffset: { width: 0, height: 14 },\n        shadowOpacity: 0.55,\n        shadowRadius: 28,\n        elevation: 18,",
    "borderWidth: 1,\n        borderColor: 'rgba(255,255,255,0.22)',\n        shadowColor: '#fbbf24',\n        shadowOffset: { width: 0, height: 16 },\n        shadowOpacity: 0.12,\n        shadowRadius: 36,\n        elevation: 20,"
)

# Gradient background of CosmicCompactCard
content = content.replace(
    "<LinearGradient\n          colors={['rgba(10,12,28,0.78)', 'rgba(6,8,20,0.88)', 'rgba(10,12,28,0.72)']}",
    "<LinearGradient\n          colors={['rgba(28,21,14,0.85)', 'rgba(10,8,20,0.95)', 'rgba(20,12,28,0.80)']}"
)

content = content.replace(
    "marginHorizontal: 6,\n        marginTop: 1,\n        marginBottom: 1,\n        borderRadius: 20,",
    "marginHorizontal: 12,\n        marginTop: 6,\n        marginBottom: 6,\n        borderRadius: 24,"
)

# Header typography
content = content.replace(
    "fontSize: 22, fontWeight: '900', color: '#FFFFFF', letterSpacing: -0.3, lineHeight: 26",
    "fontSize: 26, fontWeight: '300', color: '#FFFFFF', letterSpacing: -0.5, lineHeight: 30, textShadowColor: 'rgba(255,255,255,0.25)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 8"
)

# Expandable Panchanga Rows typography & spacing
content = content.replace(
    "paddingVertical: 3, gap: 10",
    "paddingVertical: 6, gap: 12"
)
content = content.replace(
    "fontSize: 11.5, fontWeight: '900', color: '#FFFFFFEE', letterSpacing: 0.2",
    "fontSize: 13, fontWeight: '600', color: '#FFFFFF', letterSpacing: 0.4"
)
content = content.replace(
    "backgroundColor: row.color + '0D',\n                    borderWidth: 1,\n                    borderColor: row.color + '2A',",
    "backgroundColor: 'rgba(255,255,255,0.06)',\n                    borderWidth: 1,\n                    borderColor: row.color + '40',\n                    shadowColor: row.color,\n                    shadowOffset: { width: 0, height: 4 },\n                    shadowOpacity: 0.15,\n                    shadowRadius: 12,"
)

with open('./app/(tabs)/index.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Redesign applied.")

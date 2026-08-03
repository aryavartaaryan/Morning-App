import os
import re

tabs = [
    'app/(tabs)/settings.tsx',
    'app/(tabs)/reports.tsx',
    'app/(tabs)/alarms.tsx',
    'app/(tabs)/walk.tsx',
    'app/(tabs)/sleep.tsx'
]

# 1. Fix all back handlers to navigate to '/' instead of '/(tabs)'
for t in tabs:
    if os.path.exists(t):
        with open(t, 'r') as f:
            c = f.read()
        c = c.replace("router.navigate('/(tabs)')", "router.navigate('/')")
        with open(t, 'w') as f:
            f.write(c)

# 2. Modernize settings UI
s_file = 'app/(tabs)/settings.tsx'
with open(s_file, 'r') as f:
    s_content = f.read()

# Update GlassCard style
old_glass = """const glass = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
});"""

new_glass = """const glass = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 8,
  },
});"""
s_content = s_content.replace(old_glass, new_glass)

# Update ToggleRow style
old_tog = """const tog = StyleSheet.create({
  row:    { flexDirection: 'row', alignItems: 'center', paddingLeft: 16 },
  content: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingRight: 16 },
  border: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.1)' },
  icon:   { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  title:  { fontSize: 14, color: '#fff', fontWeight: '600', letterSpacing: 0.5 },
  sub:    { fontSize: 11.5, color: 'rgba(235,235,245,0.55)', marginTop: 4, lineHeight: 16, letterSpacing: 0.2 },
});"""

new_tog = """const tog = StyleSheet.create({
  row:    { flexDirection: 'row', alignItems: 'center', paddingLeft: 18 },
  content: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingVertical: 18, paddingRight: 18 },
  border: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.15)' },
  icon:   { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 18, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } },
  title:  { fontSize: 15, color: '#fff', fontWeight: '700', letterSpacing: 0.3 },
  sub:    { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 4, lineHeight: 16, letterSpacing: 0.2 },
});"""
s_content = s_content.replace(old_tog, new_tog)

# Update SectionHeader style
old_sec = """const sec = StyleSheet.create({
  row:   { marginHorizontal: 24, marginTop: 32, marginBottom: 10 },
  label: { fontSize: 11, letterSpacing: 2.5, color: 'rgba(255,255,255,0.45)', fontWeight: '700' },
});"""

new_sec = """const sec = StyleSheet.create({
  row:   { marginHorizontal: 26, marginTop: 36, marginBottom: 12 },
  label: { fontSize: 10, letterSpacing: 3, color: 'rgba(255,255,255,0.5)', fontWeight: '800', textTransform: 'uppercase' },
});"""
s_content = s_content.replace(old_sec, new_sec)

# Update WallpaperPicker card style
old_wp = """const wp = StyleSheet.create({
  card: { marginHorizontal: 16, marginTop: 4, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: 'rgba(20,20,20,0.4)' },
  previewImg: { height: 240, width: '100%', justifyContent: 'flex-end' },
  previewContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', padding: 20 },
  previewTime: { fontSize: 11, color: 'rgba(255,255,255,0.65)', fontWeight: '800', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 8 },
  previewName: { fontSize: 17, color: '#fff', fontWeight: '800', letterSpacing: 0.6, textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 6 },
  previewBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)', backgroundColor: 'rgba(255,255,255,0.15)' },
  previewBtnTxt: { color: '#fff', fontSize: 12, fontWeight: '800', letterSpacing: 0.8 },
});"""

new_wp = """const wp = StyleSheet.create({
  card: { marginHorizontal: 16, marginTop: 4, borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', backgroundColor: 'rgba(20,20,20,0.6)', shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.5, shadowRadius: 24, elevation: 12 },
  previewImg: { height: 240, width: '100%', justifyContent: 'flex-end' },
  previewContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', padding: 24 },
  previewTime: { fontSize: 10, color: 'rgba(255,255,255,0.8)', fontWeight: '900', textTransform: 'uppercase', letterSpacing: 2.5, marginBottom: 6 },
  previewName: { fontSize: 20, color: '#fff', fontWeight: '900', letterSpacing: 0.8, textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 3 }, textShadowRadius: 8 },
  previewBtn: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)', backgroundColor: 'rgba(255,255,255,0.25)' },
  previewBtnTxt: { color: '#fff', fontSize: 12, fontWeight: '800', letterSpacing: 1.2 },
});"""
s_content = s_content.replace(old_wp, new_wp)

with open(s_file, 'w') as f:
    f.write(s_content)

print("Done patching UI and back handlers.")

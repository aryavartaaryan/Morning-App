import os

s_file = 'app/(tabs)/settings.tsx'
with open(s_file, 'r') as f:
    s_content = f.read()

# Update GlassCard style - make it slimmer
old_glass = """const glass = StyleSheet.create({
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

new_glass = """const glass = StyleSheet.create({
  card: {
    marginHorizontal: 20,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
});"""
s_content = s_content.replace(old_glass, new_glass)

# Update ToggleRow style - make it slimmer
old_tog = """const tog = StyleSheet.create({
  row:    { flexDirection: 'row', alignItems: 'center', paddingLeft: 18 },
  content: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingVertical: 18, paddingRight: 18 },
  border: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.15)' },
  icon:   { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 18, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } },
  title:  { fontSize: 14, color: '#fff', fontWeight: '400', letterSpacing: 0.6 },
  sub:    { fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 4, lineHeight: 16, letterSpacing: 0.3 },
});"""

new_tog = """const tog = StyleSheet.create({
  row:    { flexDirection: 'row', alignItems: 'center', paddingLeft: 16 },
  content: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingRight: 16 },
  border: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.1)' },
  icon:   { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 16, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  title:  { fontSize: 14, color: '#fff', fontWeight: '300', letterSpacing: 0.8 },
  sub:    { fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 4, lineHeight: 16, letterSpacing: 0.4 },
});"""
s_content = s_content.replace(old_tog, new_tog)

# Update WallpaperPicker card style - smaller card size
old_wp = """const wp = StyleSheet.create({
  card: { marginHorizontal: 16, marginTop: 4, borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', backgroundColor: 'rgba(20,20,20,0.6)', shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.5, shadowRadius: 24, elevation: 12 },
  previewImg: { height: 240, width: '100%', justifyContent: 'flex-end' },
  previewContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', padding: 24 },
  previewTime: { fontSize: 10, color: 'rgba(255,255,255,0.6)', fontWeight: '500', textTransform: 'uppercase', letterSpacing: 2.5, marginBottom: 6 },
  previewName: { fontSize: 18, color: '#fff', fontWeight: '400', letterSpacing: 0.8, textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 6 },
  previewBtn: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', backgroundColor: 'rgba(255,255,255,0.1)' },
  previewBtnTxt: { color: '#fff', fontSize: 11, fontWeight: '500', letterSpacing: 1.2 },
});"""

new_wp = """const wp = StyleSheet.create({
  card: { marginHorizontal: 20, marginTop: 4, borderRadius: 20, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.25)', backgroundColor: 'rgba(20,20,20,0.6)', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 8 },
  previewImg: { height: 160, width: '100%', justifyContent: 'flex-end' },
  previewContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', padding: 18 },
  previewTime: { fontSize: 9, color: 'rgba(255,255,255,0.5)', fontWeight: '500', textTransform: 'uppercase', letterSpacing: 3, marginBottom: 4 },
  previewName: { fontSize: 16, color: '#fff', fontWeight: '300', letterSpacing: 1, textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  previewBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.4)', backgroundColor: 'rgba(255,255,255,0.15)' },
  previewBtnTxt: { color: '#fff', fontSize: 10, fontWeight: '500', letterSpacing: 1.5 },
});"""
s_content = s_content.replace(old_wp, new_wp)

# Also adjust permission section to be slimmer
old_perm = """const perm = StyleSheet.create({
  row:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  border: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.15)', marginLeft: 34 },
  dot:    { width: 6, height: 6, borderRadius: 3, marginRight: 10 },
  label:  { flex: 1, fontSize: 14, letterSpacing: 0.1 },
  fixBtn: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.15)', paddingVertical: 14, alignItems: 'center' },
});"""

new_perm = """const perm = StyleSheet.create({
  row:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 },
  border: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.1)', marginLeft: 28 },
  dot:    { width: 4, height: 4, borderRadius: 2, marginRight: 12 },
  label:  { flex: 1, fontSize: 13, letterSpacing: 0.4, fontWeight: '300' },
  fixBtn: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.1)', paddingVertical: 12, alignItems: 'center' },
});"""
s_content = s_content.replace(old_perm, new_perm)

with open(s_file, 'w') as f:
    f.write(s_content)

print("Settings page slimmed down.")

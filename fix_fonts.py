import os

s_file = 'app/(tabs)/settings.tsx'
with open(s_file, 'r') as f:
    s_content = f.read()

# Update ToggleRow style
old_tog = """const tog = StyleSheet.create({
  row:    { flexDirection: 'row', alignItems: 'center', paddingLeft: 18 },
  content: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingVertical: 18, paddingRight: 18 },
  border: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.15)' },
  icon:   { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 18, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } },
  title:  { fontSize: 15, color: '#fff', fontWeight: '700', letterSpacing: 0.3 },
  sub:    { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 4, lineHeight: 16, letterSpacing: 0.2 },
});"""

new_tog = """const tog = StyleSheet.create({
  row:    { flexDirection: 'row', alignItems: 'center', paddingLeft: 18 },
  content: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingVertical: 18, paddingRight: 18 },
  border: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.15)' },
  icon:   { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 18, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } },
  title:  { fontSize: 14, color: '#fff', fontWeight: '400', letterSpacing: 0.6 },
  sub:    { fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 4, lineHeight: 16, letterSpacing: 0.3 },
});"""
s_content = s_content.replace(old_tog, new_tog)

# Update SectionHeader style
old_sec = """const sec = StyleSheet.create({
  row:   { marginHorizontal: 26, marginTop: 36, marginBottom: 12 },
  label: { fontSize: 10, letterSpacing: 3, color: 'rgba(255,255,255,0.5)', fontWeight: '800', textTransform: 'uppercase' },
});"""

new_sec = """const sec = StyleSheet.create({
  row:   { marginHorizontal: 26, marginTop: 36, marginBottom: 12 },
  label: { fontSize: 10, letterSpacing: 3.5, color: 'rgba(255,255,255,0.4)', fontWeight: '500', textTransform: 'uppercase' },
});"""
s_content = s_content.replace(old_sec, new_sec)

# Update WallpaperPicker card style
old_wp = """const wp = StyleSheet.create({
  card: { marginHorizontal: 16, marginTop: 4, borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', backgroundColor: 'rgba(20,20,20,0.6)', shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.5, shadowRadius: 24, elevation: 12 },
  previewImg: { height: 240, width: '100%', justifyContent: 'flex-end' },
  previewContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', padding: 24 },
  previewTime: { fontSize: 10, color: 'rgba(255,255,255,0.8)', fontWeight: '900', textTransform: 'uppercase', letterSpacing: 2.5, marginBottom: 6 },
  previewName: { fontSize: 20, color: '#fff', fontWeight: '900', letterSpacing: 0.8, textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 3 }, textShadowRadius: 8 },
  previewBtn: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)', backgroundColor: 'rgba(255,255,255,0.25)' },
  previewBtnTxt: { color: '#fff', fontSize: 12, fontWeight: '800', letterSpacing: 1.2 },
});"""

new_wp = """const wp = StyleSheet.create({
  card: { marginHorizontal: 16, marginTop: 4, borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', backgroundColor: 'rgba(20,20,20,0.6)', shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.5, shadowRadius: 24, elevation: 12 },
  previewImg: { height: 240, width: '100%', justifyContent: 'flex-end' },
  previewContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', padding: 24 },
  previewTime: { fontSize: 10, color: 'rgba(255,255,255,0.6)', fontWeight: '500', textTransform: 'uppercase', letterSpacing: 2.5, marginBottom: 6 },
  previewName: { fontSize: 18, color: '#fff', fontWeight: '400', letterSpacing: 0.8, textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 6 },
  previewBtn: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', backgroundColor: 'rgba(255,255,255,0.1)' },
  previewBtnTxt: { color: '#fff', fontSize: 11, fontWeight: '500', letterSpacing: 1.2 },
});"""
s_content = s_content.replace(old_wp, new_wp)

# Update main Settings header
old_s = """const S = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: '#000000' },
  header:  { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 16 },
  headerTitle: { fontSize: 26, fontWeight: '800', color: '#fff', letterSpacing: 1.2 },"""

new_s = """const S = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: '#000000' },
  header:  { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 16 },
  headerTitle: { fontSize: 28, fontWeight: '300', color: '#fff', letterSpacing: 1.5 },"""
s_content = s_content.replace(old_s, new_s)


with open(s_file, 'w') as f:
    f.write(s_content)

print("Done adjusting fonts to be slim and elegant.")

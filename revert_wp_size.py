import os

s_file = 'app/(tabs)/settings.tsx'
with open(s_file, 'r') as f:
    s_content = f.read()

# Restore WallpaperPicker card size
old_wp = """const wp = StyleSheet.create({
  card: { marginHorizontal: 20, marginTop: 4, borderRadius: 20, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.25)', backgroundColor: 'rgba(20,20,20,0.6)', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 8 },
  previewImg: { height: 160, width: '100%', justifyContent: 'flex-end' },
  previewContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', padding: 18 },
  previewTime: { fontSize: 9, color: 'rgba(255,255,255,0.5)', fontWeight: '500', textTransform: 'uppercase', letterSpacing: 3, marginBottom: 4 },
  previewName: { fontSize: 16, color: '#fff', fontWeight: '300', letterSpacing: 1, textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  previewBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.4)', backgroundColor: 'rgba(255,255,255,0.15)' },
  previewBtnTxt: { color: '#fff', fontSize: 10, fontWeight: '500', letterSpacing: 1.5 },
});"""

new_wp = """const wp = StyleSheet.create({
  card: { marginHorizontal: 16, marginTop: 4, borderRadius: 24, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.25)', backgroundColor: 'rgba(20,20,20,0.6)', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 8 },
  previewImg: { height: 240, width: '100%', justifyContent: 'flex-end' },
  previewContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', padding: 24 },
  previewTime: { fontSize: 10, color: 'rgba(255,255,255,0.6)', fontWeight: '500', textTransform: 'uppercase', letterSpacing: 3, marginBottom: 6 },
  previewName: { fontSize: 18, color: '#fff', fontWeight: '300', letterSpacing: 1, textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 6 },
  previewBtn: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 24, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.3)', backgroundColor: 'rgba(255,255,255,0.1)' },
  previewBtnTxt: { color: '#fff', fontSize: 11, fontWeight: '500', letterSpacing: 1.5 },
});"""

s_content = s_content.replace(old_wp, new_wp)

with open(s_file, 'w') as f:
    f.write(s_content)

print("Restored wallpaper card size")

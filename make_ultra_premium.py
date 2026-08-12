import re

with open('/Users/hotelnamastebharatinn/Desktop/Morning-App/app/wallpaper.tsx', 'r') as f:
    content = f.read()

# 1. Update Floating Apply Button
apply_btn_regex = r"(<TouchableOpacity activeOpacity=\{0\.9\} onPress=\{handleApply\} style=\{styles\.applyBtn\}>[\s\S]*?<Text style=\{styles\.applyText\}>Set Wallpaper</Text>\s*</TouchableOpacity>)"
new_apply_btn = """<TouchableOpacity activeOpacity={0.8} onPress={handleApply} style={styles.applyBtn}>
            <BlurView intensity={70} tint="light" style={StyleSheet.absoluteFillObject} />
            <Ionicons name="color-wand" size={20} color="#000" />
            <Text style={styles.applyText}>Set Wallpaper</Text>
          </TouchableOpacity>"""
content = re.sub(apply_btn_regex, new_apply_btn, content)

# 2. Update Thumbnail render (add gradient)
thumbnail_render_regex = r"(<AsyncWallpaperImage bgKey=\{key as string\} />)([\s\S]*?)(?=\{isActive && \()"
new_thumbnail_render = """\\1
                  <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.5)']}
                    locations={[0.5, 1]}
                    style={StyleSheet.absoluteFillObject}
                    pointerEvents="none"
                  />
                  """
content = re.sub(thumbnail_render_regex, new_thumbnail_render, content)

# 3. Update Styles
styles_to_replace = {
    r"applyBtn: \{[\s\S]*?\},": """applyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 99,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.8)',
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
  },""",
    r"dockContainer: \{[\s\S]*?\},": """dockContainer: {
    height: height * 0.65,
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    overflow: 'hidden',
    paddingTop: 24,
    borderTopWidth: 1.5,
    borderTopColor: 'rgba(255,255,255,0.3)',
    borderLeftWidth: 0.5,
    borderLeftColor: 'rgba(255,255,255,0.1)',
    borderRightWidth: 0.5,
    borderRightColor: 'rgba(255,255,255,0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.5,
    shadowRadius: 30,
  },""",
    r"thumbnailContainer: \{[\s\S]*?\},": """thumbnailContainer: {
    width: (width - 48 - 16) / 2, // 2 columns: screen_width - side_paddings(24*2) - gap(16)
    aspectRatio: 0.65, // taller, more elegant portrait aspect ratio
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },""",
    r"thumbnailContainerSelected: \{[\s\S]*?\},": """thumbnailContainerSelected: {
    borderColor: '#fff',
    borderWidth: 2,
    transform: [{ scale: 1.03 }],
    shadowColor: '#fff',
    shadowOpacity: 0.6,
    shadowRadius: 15,
  },""",
    r"thumbnailActiveBadge: \{[\s\S]*?\},": """thumbnailActiveBadge: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.8)',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },""",
    r"thumbnailSolarBadge: \{[\s\S]*?\}": """thumbnailSolarBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(251, 191, 36, 0.8)',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 4,
  }"""
}

for old, new in styles_to_replace.items():
    content = re.sub(old, new, content)

with open('/Users/hotelnamastebharatinn/Desktop/Morning-App/app/wallpaper.tsx', 'w') as f:
    f.write(content)
print("Updated UI to ultra-premium.")

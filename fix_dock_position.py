import sys

def main():
    file_path = 'app/(tabs)/index.tsx'
    with open(file_path, 'r') as f:
        content = f.read()

    # Find the VisionOS floating glass dock
    dock_marker = "{/* ── VISIONOS FLOATING GLASS DOCK — 3 columns (Fixed at bottom) ── */}"
    old_style = "<View style={{ position: 'absolute', bottom: 10, width: '100%', paddingHorizontal: 28, paddingBottom: Math.max(insets.bottom, 10), paddingTop: 10, backgroundColor: 'transparent' }}>"
    new_style = "<View style={{ width: '100%', paddingHorizontal: 24, paddingBottom: 16, paddingTop: 12, backgroundColor: 'transparent' }}>"
    
    if old_style in content:
        content = content.replace(old_style, new_style)
        
        # Also let's reduce the ScrollView paddingBottom slightly since the dock is no longer floating over it
        old_scroll = "<ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-start', alignItems: 'center', paddingTop: 16, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>"
        new_scroll = "<ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-start', alignItems: 'center', paddingTop: 16, paddingBottom: 20 }} showsVerticalScrollIndicator={false}>"
        content = content.replace(old_scroll, new_scroll)

        with open(file_path, 'w') as f:
            f.write(content)
        print("Fixed Dock position successfully.")
    else:
        print("Could not find the Dock style block.")

if __name__ == "__main__":
    main()

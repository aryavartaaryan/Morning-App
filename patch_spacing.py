import sys

def main():
    file_path = 'app/(tabs)/index.tsx'
    with open(file_path, 'r') as f:
        content = f.read()

    # Fix ScrollView centering
    old_scrollview = "        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 6, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>"
    new_scrollview = "        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-start', alignItems: 'center', paddingTop: 16, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>"
    
    content = content.replace(old_scrollview, new_scrollview)

    # Fix gap between Mantra and BioState
    old_gap = "              <View style={{ width: '100%', paddingHorizontal: 24, alignItems: 'center', gap: 8 }}>"
    new_gap = "              <View style={{ width: '100%', paddingHorizontal: 24, alignItems: 'center', gap: 16 }}>"
    
    content = content.replace(old_gap, new_gap)

    # Note: We should also update the Golden Aura position since the Mantra card will move up!
    # The aura was at top: '10%'. Since Mantra card is no longer vertically centered, it will be higher.
    # We might need to adjust the aura position. Let's move it to top: '5%' or '2%' depending on the screen.
    # We will just change top: '10%' to top: '4%' in AmbientAura.
    old_aura1 = """      <Animated.View style={{
        position: 'absolute',
        top: '10%',"""
    new_aura1 = """      <Animated.View style={{
        position: 'absolute',
        top: '6%',"""
        
    content = content.replace(old_aura1, new_aura1)

    with open(file_path, 'w') as f:
        f.write(content)
    print("Patched spacing successfully.")

if __name__ == "__main__":
    main()

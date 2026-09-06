import sys

def main():
    file_path = 'app/(tabs)/index.tsx'
    with open(file_path, 'r') as f:
        content = f.read()

    bad_block = """                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 18 }}>
                          <Text style={{ fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,0.3)', letterSpacing: 0.5, textTransform: 'uppercase' }}>Tap to view metabolic state</Text>
                          <Ionicons name="chevron-forward" size={10} color="rgba(255,255,255,0.3)" style={{ marginLeft: 4 }} />
                        </BlurView>
                      </View>"""
                      
    good_block = """                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 18 }}>
                          <Text style={{ fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,0.3)', letterSpacing: 0.5, textTransform: 'uppercase' }}>Tap to view metabolic state</Text>
                          <Ionicons name="chevron-forward" size={10} color="rgba(255,255,255,0.3)" style={{ marginLeft: 4 }} />
                        </View>
                      </BlurView>"""

    content = content.replace(bad_block, good_block)

    with open(file_path, 'w') as f:
        f.write(content)
    print("Fixed syntax error.")

if __name__ == "__main__":
    main()

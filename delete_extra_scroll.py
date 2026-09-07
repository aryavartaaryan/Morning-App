import sys

def main():
    file_path = 'app/(tabs)/index.tsx'
    with open(file_path, 'r') as f:
        content = f.read()

    target = """              </View>

        </ScrollView>

        {/* ── VISIONOS FLOATING GLASS DOCK — 3 columns (Fixed at bottom) ── */}"""
        
    replacement = """              </View>

        {/* ── VISIONOS FLOATING GLASS DOCK — 3 columns (Fixed at bottom) ── */}"""
    
    if target in content:
        content = content.replace(target, replacement)
        with open(file_path, 'w') as f:
            f.write(content)
        print("Deleted extra ScrollView closing tag.")
    else:
        print("Could not find the target to delete.")

if __name__ == "__main__":
    main()

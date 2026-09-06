import sys

def main():
    file_path = 'app/(tabs)/index.tsx'
    with open(file_path, 'r') as f:
        content = f.read()

    # The corrupted block looks like this:
    old_corrupted = """                        paddingVertical: 20,
                        paddingHorizontal: 20,
                                       <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20 }}>"""

    fixed = """                        paddingVertical: 20,
                        paddingHorizontal: 20,
                        overflow: 'hidden',
                        backgroundColor: 'rgba(10,10,10,0.4)',
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 24 },
                        shadowOpacity: 0.6,
                        shadowRadius: 32,
                        elevation: 20,
                      }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20 }}>"""

    if old_corrupted in content:
        content = content.replace(old_corrupted, fixed)
        with open(file_path, 'w') as f:
            f.write(content)
        print("Fixed corrupted BlurView block.")
    else:
        print("Could not find the corrupted block to fix.")

if __name__ == "__main__":
    main()

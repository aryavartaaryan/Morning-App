import sys

def main():
    file_path = 'app/(tabs)/index.tsx'
    with open(file_path, 'r') as f:
        content = f.read()

    target = """                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>"""
    replacement = """                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: 10, paddingHorizontal: 4 }}>"""

    if target not in content:
        print("Target not found!")
        sys.exit(1)
        
    content = content.replace(target, replacement)
    
    with open(file_path, 'w') as f:
        f.write(content)
        
    print("Patched flex wrap successfully!")

if __name__ == '__main__':
    main()

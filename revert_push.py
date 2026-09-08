import sys

def main():
    file_path = 'app/(tabs)/index.tsx'
    with open(file_path, 'r') as f:
        content = f.read()

    # The block we modified in the previous step
    old_wrapper = """                {/* 2. Zen Monolith Active Bio-State Panel */}
                <View style={{ width: '100%', marginTop: 24 }}>"""
                
    new_wrapper = """                {/* 2. Zen Monolith Active Bio-State Panel */}
                <View style={{ width: '100%', marginTop: 8 }}>"""
                
    if old_wrapper in content:
        content = content.replace(old_wrapper, new_wrapper)
        with open(file_path, 'w') as f:
            f.write(content)
        print("Reduced Bio-State marginTop from 24 to 8.")
    else:
        print("Could not find the target string to revert.")

if __name__ == "__main__":
    main()

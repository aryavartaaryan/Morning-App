import sys

def main():
    file_path = 'app/(tabs)/index.tsx'
    with open(file_path, 'r') as f:
        content = f.read()

    # We want to increase the space between Daily Intention and the Bio-State panel
    target = "{/* 2. Zen Monolith Active Bio-State Panel */}"
    
    # Let's add a marginTop to the Bio-State panel wrapper
    old_wrapper = """                {/* 2. Zen Monolith Active Bio-State Panel */}
                <View style={{ width: '100%' }}>"""
                
    new_wrapper = """                {/* 2. Zen Monolith Active Bio-State Panel */}
                <View style={{ width: '100%', marginTop: 24 }}>"""
                
    if old_wrapper in content:
        content = content.replace(old_wrapper, new_wrapper)
        with open(file_path, 'w') as f:
            f.write(content)
        print("Pushed down Bio-State panel and Weather button successfully.")
    else:
        print("Could not find the target string to push down.")

if __name__ == "__main__":
    main()

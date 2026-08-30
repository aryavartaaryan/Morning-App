import sys

def main():
    file_path = 'app/(tabs)/index.tsx'
    with open(file_path, 'r') as f:
        content = f.read()

    target = """              {/* === REFINED EDITORIAL CURATOR LAYOUT (MULTI-BILLION DOLLAR APP STYLE) === */}
              {/* Spacer for optical centering */}
              <View style={{ flex: 1 }} />"""
              
    if target not in content:
        print("Target not found!")
        sys.exit(1)

    replacement = """              {/* === REFINED EDITORIAL CURATOR LAYOUT (MULTI-BILLION DOLLAR APP STYLE) === */}
              {/* Spacer for optical centering */}
              <View style={{ flex: 0.3 }} />"""

    new_content = content.replace(target, replacement)
    
    with open(file_path, 'w') as f:
        f.write(new_content)
        
    print("Patched flex spacer successfully!")

if __name__ == '__main__':
    main()

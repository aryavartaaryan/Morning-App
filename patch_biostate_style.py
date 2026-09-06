import sys

def main():
    file_path = 'app/(tabs)/index.tsx'
    with open(file_path, 'r') as f:
        content = f.read()

    # The Bio-State card styling is inline inside index.tsx
    old_style = """                        borderRadius: 24,
                        borderWidth: 1,
                        borderColor: 'rgba(255,255,255,0.15)',
                        paddingVertical: 20,
                        paddingHorizontal: 20,
                        overflow: 'hidden',
                        backgroundColor: 'rgba(10,10,10,0.4)',
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 24 },
                        shadowOpacity: 0.6,
                        shadowRadius: 32,
                        elevation: 20,
                      }}>"""
                      
    new_style = """                        borderRadius: 24,
                        borderWidth: 0.5,
                        borderColor: 'rgba(255,255,255,0.1)',
                        paddingVertical: 20,
                        paddingHorizontal: 20,
                        overflow: 'hidden',
                        backgroundColor: 'rgba(15,15,15,0.55)',
                      }}>"""

    content = content.replace(old_style, new_style)

    with open(file_path, 'w') as f:
        f.write(content)
        
if __name__ == "__main__":
    main()

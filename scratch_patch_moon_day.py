import sys

def main():
    file_path = 'app/(tabs)/index.tsx'
    with open(file_path, 'r') as f:
        content = f.read()

    target = """            return (
              <BlurView intensity={50} tint="light" style={{
                borderRadius: 24, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.3)',
                overflow: 'hidden', flexDirection: 'row', alignItems: 'center', gap: 8,
                paddingHorizontal: 20, paddingVertical: 12, backgroundColor: 'rgba(255,255,255,0.15)'
              }}>
                <MoonSVG tithiNum={hMoon.tithiNum} size={16} />
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#111', letterSpacing: 0.3 }}>{phaseText}</Text>
              </BlurView>
            );"""
            
    replacement = """            return (
              <BlurView intensity={50} tint="light" style={{
                borderRadius: 24, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.3)',
                overflow: 'hidden', flexDirection: 'row', alignItems: 'center', gap: 12,
                paddingHorizontal: 22, paddingVertical: 10, backgroundColor: 'rgba(255,255,255,0.2)'
              }}>
                <MoonSVG tithiNum={hMoon.tithiNum} size={22} />
                <View style={{ flexDirection: 'column', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: '#111', letterSpacing: 0.3 }}>{phaseText}</Text>
                  <Text style={{ fontSize: 9, fontWeight: '800', color: 'rgba(0,0,0,0.55)', letterSpacing: 1.2, textTransform: 'uppercase', marginTop: 1 }}>
                    LUNAR DAY {dayNum}
                  </Text>
                </View>
              </BlurView>
            );"""

    if target not in content:
        print("Target not found!")
        sys.exit(1)
        
    content = content.replace(target, replacement)
    
    with open(file_path, 'w') as f:
        f.write(content)
        
    print("Patched lunar day successfully!")

if __name__ == '__main__':
    main()

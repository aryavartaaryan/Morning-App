import sys

def main():
    file_path = 'app/(tabs)/index.tsx'
    with open(file_path, 'r') as f:
        content = f.read()

    target = """                            <View style={{ position: 'absolute', alignItems: 'center', justifyContent: 'center' }}>
                              <Text style={{ fontSize: 13, fontWeight: '800', color: '#FFF' }}>{hrsLeft}h</Text>
                              <Text style={{ fontSize: 9, fontWeight: '700', color: 'rgba(255,255,255,0.6)' }}>{minsLeftRem}m</Text>
                            </View>"""
                            
    replacement = """                            <View style={{ position: 'absolute', alignItems: 'center', justifyContent: 'center' }}>
                              {hrsLeft > 0 ? (
                                <>
                                  <Text style={{ fontSize: 13, fontWeight: '800', color: '#FFF' }}>{hrsLeft}h</Text>
                                  <Text style={{ fontSize: 9, fontWeight: '700', color: 'rgba(255,255,255,0.6)' }}>{minsLeftRem}m</Text>
                                </>
                              ) : (
                                <>
                                  <Text style={{ fontSize: 14, fontWeight: '800', color: '#FFF' }}>{minsLeftRem}</Text>
                                  <Text style={{ fontSize: 9, fontWeight: '700', color: 'rgba(255,255,255,0.6)' }}>mins</Text>
                                </>
                              )}
                            </View>"""
    
    if target in content:
        content = content.replace(target, replacement)
        with open(file_path, 'w') as f:
            f.write(content)
        print("Updated time format for < 1 hour.")
    else:
        print("Could not find the target text block.")

if __name__ == "__main__":
    main()

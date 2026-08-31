import sys

def main():
    file_path = 'app/(tabs)/index.tsx'
    with open(file_path, 'r') as f:
        content = f.read()

    # 1. Spacer for optical centering
    target1 = """              {/* Spacer for optical centering */}
              <View style={{ flex: 0.3 }} />"""
    rep1 = """              {/* Spacer for optical centering */}
              <View style={{ flex: 0.1 }} />"""
    
    # 2. gap between Intention and Biorhythm
    target2 = """              <View style={{ width: '100%', paddingHorizontal: 24, alignItems: 'center', gap: 28 }}>"""
    rep2 = """              <View style={{ width: '100%', paddingHorizontal: 24, alignItems: 'center', gap: 16 }}>"""

    # 3. Active Bio-State Panel padding & gap
    target3 = """                    <BlurView intensity={50} tint="dark" style={{
                      width: '100%',
                      borderRadius: 24,
                      borderWidth: 0.5,
                      borderColor: 'rgba(255,255,255,0.2)',
                      paddingVertical: 20,
                      paddingHorizontal: 20,
                      overflow: 'hidden',
                      backgroundColor: 'rgba(0,0,0,0.3)',
                    }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 }}>
                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: currentPeriod.color || '#4ade80' }} />
                        <Text style={{ fontSize: 10, fontWeight: '700', color: '#FFF', letterSpacing: 1.5, textTransform: 'uppercase' }}>Active Bio-State</Text>
                      </View>
                      
                      <View style={{ gap: 12 }}>"""
                      
    rep3 = """                    <BlurView intensity={50} tint="dark" style={{
                      width: '100%',
                      borderRadius: 24,
                      borderWidth: 0.5,
                      borderColor: 'rgba(255,255,255,0.2)',
                      paddingVertical: 14,
                      paddingHorizontal: 20,
                      overflow: 'hidden',
                      backgroundColor: 'rgba(0,0,0,0.3)',
                    }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: currentPeriod.color || '#4ade80' }} />
                        <Text style={{ fontSize: 10, fontWeight: '700', color: '#FFF', letterSpacing: 1.5, textTransform: 'uppercase' }}>Active Bio-State</Text>
                      </View>
                      
                      <View style={{ gap: 8 }}>"""

    # 4. Weather Button marginBottom
    target4 = """              {/* 4. Weather Button (Fixed below Bio-State) */}
              <View style={{ width: '100%', paddingHorizontal: 24, marginBottom: 16, alignItems: 'center' }}>"""
    rep4 = """              {/* 4. Weather Button (Fixed below Bio-State) */}
              <View style={{ width: '100%', paddingHorizontal: 24, marginBottom: 8, alignItems: 'center' }}>"""

    # 5. paddingBottom of the main view
    target5 = """<View style={{ flex: 1, justifyContent: 'space-between', alignItems: 'center', paddingBottom: insets.bottom + 70 }}>"""
    rep5 = """<View style={{ flex: 1, justifyContent: 'space-between', alignItems: 'center', paddingBottom: insets.bottom + 30 }}>"""

    content = content.replace(target1, rep1)
    content = content.replace(target2, rep2)
    content = content.replace(target3, rep3)
    content = content.replace(target4, rep4)
    content = content.replace(target5, rep5)

    with open(file_path, 'w') as f:
        f.write(content)
        
    print("Patched spacing successfully!")

if __name__ == '__main__':
    main()

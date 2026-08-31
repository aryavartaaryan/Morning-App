import sys

def main():
    file_path = 'app/(tabs)/index.tsx'
    with open(file_path, 'r') as f:
        content = f.read()

    target = """                  );
                })()}
                
              </View>

              {/* Spacer between center content and bottom controls */}
              <View style={{ flex: 1 }} />

              {/* 3. Expanded Active Bio-State Panel */}
              <View style={{ width: '100%', paddingHorizontal: 24, marginBottom: 16 }}>
                 {currentPeriod && (
                    <BlurView intensity={50} tint="dark" style={{"""
                    
    replacement = """                  );
                })()}

                {/* 3. Expanded Active Bio-State Panel (Grouped for equal spacing) */}
                <View style={{ width: '100%' }}>
                 {currentPeriod && (
                    <BlurView intensity={50} tint="dark" style={{"""

    target2 = """                        )}
                      </View>
                    </BlurView>
                 )}
              </View>

              {/* 4. Weather Button (Fixed below Bio-State) */}"""
              
    replacement2 = """                        )}
                      </View>
                    </BlurView>
                 )}
                </View>
              </View>

              {/* Spacer between center content and bottom controls */}
              <View style={{ flex: 1 }} />

              {/* 4. Weather Button (Fixed below Bio-State) */}"""

    if target not in content:
        print("Target 1 not found!")
    else:
        content = content.replace(target, replacement)
        
    if target2 not in content:
        print("Target 2 not found!")
    else:
        content = content.replace(target2, replacement2)

    with open(file_path, 'w') as f:
        f.write(content)
        
    print("Patched equal gaps successfully!")

if __name__ == '__main__':
    main()

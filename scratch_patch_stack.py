import sys

def main():
    file_path = 'app/(tabs)/index.tsx'
    with open(file_path, 'r') as f:
        content = f.read()

    # The pills container
    target_pills = """                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: 10, paddingHorizontal: 4 }}>"""
    replacement_pills = """                            <View style={{ flexDirection: 'column', alignItems: 'center', gap: 8, paddingHorizontal: 4 }}>"""
    
    if target_pills not in content:
        print("Pills target not found!")
    else:
        content = content.replace(target_pills, replacement_pills)
        
    # We also need to add a "Tap to explore" or Chevron.
    # Where does the Biorhythm Card end? It's wrapped in `PremiumBreatheCard`
    # Let's find the end of the `BlurView` for the non-sacred state, or just add it at the very bottom of the card.
    target_card_end = """                              )}
                            </View>
                          </>
                        )}
                      </BlurView>
                    </PremiumBreatheCard>"""
                    
    replacement_card_end = """                              )}
                            </View>
                            
                            {/* Affordance to show it's tappable */}
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 16, opacity: 0.5 }}>
                              <Text style={{ fontSize: 9, fontWeight: '600', color: '#111', letterSpacing: 0.5, textTransform: 'uppercase' }}>Tap to explore</Text>
                              <Ionicons name="chevron-forward" size={10} color="#111" />
                            </View>
                          </>
                        )}
                      </BlurView>
                    </PremiumBreatheCard>"""

    if target_card_end not in content:
        print("Card end target not found!")
    else:
        content = content.replace(target_card_end, replacement_card_end)
        
    # Let's also do it for the Sacred State:
    target_sacred_end = """                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(212,175,55,0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, borderWidth: 0.5, borderColor: 'rgba(212,175,55,0.4)' }}>
                              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#B48C28' }} />
                              <Text style={{ fontSize: 11, fontWeight: '800', color: '#000', letterSpacing: 1.5 }}>MEDITATE</Text>
                            </View>
                          </>
                        ) : ("""
                        
    replacement_sacred_end = """                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(212,175,55,0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, borderWidth: 0.5, borderColor: 'rgba(212,175,55,0.4)' }}>
                              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#B48C28' }} />
                              <Text style={{ fontSize: 11, fontWeight: '800', color: '#000', letterSpacing: 1.5 }}>MEDITATE</Text>
                            </View>
                            
                            {/* Affordance */}
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 16, opacity: 0.6 }}>
                              <Text style={{ fontSize: 9, fontWeight: '700', color: '#997B22', letterSpacing: 0.5, textTransform: 'uppercase' }}>Tap to explore</Text>
                              <Ionicons name="chevron-forward" size={10} color="#997B22" />
                            </View>
                          </>
                        ) : ("""
                        
    if target_sacred_end not in content:
        print("Sacred end target not found!")
    else:
        content = content.replace(target_sacred_end, replacement_sacred_end)

    with open(file_path, 'w') as f:
        f.write(content)
        
    print("Patched index.tsx successfully!")

if __name__ == '__main__':
    main()

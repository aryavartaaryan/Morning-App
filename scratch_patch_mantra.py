import sys

def main():
    file_path = 'app/(tabs)/index.tsx'
    with open(file_path, 'r') as f:
        content = f.read()

    # 1. Imports
    target_imports = "import { LunarStoryModal } from '@/components/LunarStoryModal';"
    rep_imports = """import { LunarStoryModal } from '@/components/LunarStoryModal';
import { MantraModal, getDailyMantra } from '@/components/MantraModal';"""
    if target_imports in content:
        content = content.replace(target_imports, rep_imports)

    # 2. Add state
    target_state = "const [showLunarModal, setShowLunarModal] = useState(false);"
    rep_state = """const [showLunarModal, setShowLunarModal] = useState(false);
  const [showMantraModal, setShowMantraModal] = useState(false);
  const dailyMantra = getDailyMantra();"""
    if target_state in content:
        content = content.replace(target_state, rep_state)
        
    # Render MantraModal
    target_modal_render = "{showLunarModal && ("
    rep_modal_render = """{showMantraModal && (
        <MantraModal visible={showMantraModal} onClose={() => setShowMantraModal(false)} mantra={dailyMantra} />
      )}
      
      {showLunarModal && ("""
    if target_modal_render in content:
        content = content.replace(target_modal_render, rep_modal_render)

    # 3. AmbientAura tweaks (Lighter aura, longer breathing)
    target_aura_times = """        Animated.timing(breatheAnim, { toValue: 1, duration: 4000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(breatheAnim, { toValue: 0, duration: 4000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),"""
    rep_aura_times = """        Animated.timing(breatheAnim, { toValue: 1, duration: 6000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(breatheAnim, { toValue: 0, duration: 6000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),"""
    if target_aura_times in content:
        content = content.replace(target_aura_times, rep_aura_times)

    target_aura_op1 = "const opacity1 = anim1.interpolate({ inputRange: [0, 1], outputRange: [0.05, 0.20] });"
    rep_aura_op1 = "const opacity1 = anim1.interpolate({ inputRange: [0, 1], outputRange: [0.0, 0.12] });"
    if target_aura_op1 in content:
        content = content.replace(target_aura_op1, rep_aura_op1)
        
    target_aura_op2 = "const opacity2 = anim2.interpolate({ inputRange: [0, 1], outputRange: [0.05, 0.20] });"
    rep_aura_op2 = "const opacity2 = anim2.interpolate({ inputRange: [0, 1], outputRange: [0.0, 0.12] });"
    if target_aura_op2 in content:
        content = content.replace(target_aura_op2, rep_aura_op2)
        
    target_breathe_op = "const breatheOpacity = breatheAnim.interpolate({ inputRange: [0, 1], outputRange: [0.0, 0.55] });"
    rep_breathe_op = "const breatheOpacity = breatheAnim.interpolate({ inputRange: [0, 1], outputRange: [0.0, 0.35] });"
    if target_breathe_op in content:
        content = content.replace(target_breathe_op, rep_breathe_op)
        
    # 4. Intention card -> Mantra card
    target_intention_card = """              <View style={{ width: '100%' }}>
                 {currentPeriod ? (
                    <BlurView intensity={60} tint="dark" style={{
                      width: '100%',
                      borderRadius: 24,
                      borderWidth: 0.5,
                      borderColor: 'rgba(255,255,255,0.2)',
                      paddingVertical: 12,
                      paddingHorizontal: 20,
                      overflow: 'hidden',
                      backgroundColor: 'rgba(0,0,0,0.2)',
                    }}>
                      <Text style={{ fontSize: 9, fontWeight: '700', color: 'rgba(255,255,255,0.6)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4, textAlign: 'center' }}>
                        Today I will...
                      </Text>
                      <Text style={{ fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif', fontSize: 16, fontWeight: '700', color: '#FFF', textAlign: 'center', lineHeight: 22 }}>
                        {currentPeriod.intention}
                      </Text>
                    </BlurView>
                 ) : null}
              </View>"""
              
    rep_intention_card = """              <TouchableOpacity activeOpacity={0.8} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowMantraModal(true); }} style={{ width: '100%' }}>
                 {currentPeriod ? (
                    <BlurView intensity={60} tint="dark" style={{
                      width: '100%',
                      borderRadius: 24,
                      borderWidth: 0.5,
                      borderColor: 'rgba(255,255,255,0.2)',
                      paddingVertical: 14,
                      paddingHorizontal: 20,
                      overflow: 'hidden',
                      backgroundColor: 'rgba(0,0,0,0.2)',
                      alignItems: 'center',
                    }}>
                      <Text style={{ fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif', fontSize: 16, fontWeight: '500', color: 'rgba(255,255,255,0.95)', textAlign: 'center', lineHeight: 22, fontStyle: 'italic' }}>
                        "{dailyMantra.english}"
                      </Text>
                    </BlurView>
                 ) : null}
              </TouchableOpacity>"""
              
    if target_intention_card in content:
        content = content.replace(target_intention_card, rep_intention_card)
    else:
        print("Intention card not found!")

    with open(file_path, 'w') as f:
        f.write(content)

if __name__ == '__main__':
    main()

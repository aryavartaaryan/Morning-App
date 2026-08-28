import re

with open('components/MetabolicStoryModal.tsx', 'r') as f:
    content = f.read()

western_explainer_match = re.search(r'(const WESTERN_EXPLAINER:.*?};)\n\n// ── CARD 0', content, re.DOTALL)
if western_explainer_match:
    western_explainer = western_explainer_match.group(1)
else:
    western_explainer = "const WESTERN_EXPLAINER: any = {};"

new_content = f"""
import React, {{ useEffect, useState, useRef }} from 'react';
import {{
  View, Text, Modal, TouchableOpacity,
  StyleSheet, Dimensions, Animated, ScrollView
}} from 'react-native';
import {{ LinearGradient }} from 'expo-linear-gradient';
import {{ BlurView }} from 'expo-blur';
import * as Haptics from 'expo-haptics';
import type {{ DoshaPeriod }} from '@/lib/ayurvedicPeriods';
import type {{ SolarTimes }} from '@/lib/solar';
import {{ WELLNESS, PERIOD_SANSKRIT, PERIOD_EXTENDED }} from '@/lib/wellnessData';
import {{ Ionicons }} from '@expo/vector-icons';

const {{ width: W, height: H }} = Dimensions.get('window');

const DOSHA_COLOR: Record<string, string> = {{
  kapha: '#34d399',
  pitta: '#fb923c',
  vata:  '#a78bfa',
}};

{western_explainer}

export default function MetabolicStoryModal({{
  period,
  solarTimes,
  onClose,
}}: {{
  period: DoshaPeriod;
  solarTimes: SolarTimes | null;
  onClose: () => void;
}}) {{
  const accent = period.color || DOSHA_COLOR[period.dosha] || '#00D4B8';
  const ex = WESTERN_EXPLAINER[period.id];
  const w = WELLNESS[period.id];
  const s = PERIOD_SANSKRIT[period.id];
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(H * 0.3)).current;

  useEffect(() => {{
    Animated.parallel([
      Animated.timing(fadeAnim, {{ toValue: 1, duration: 400, useNativeDriver: true }}),
      Animated.spring(slideAnim, {{ toValue: 0, tension: 50, friction: 9, useNativeDriver: true }})
    ]]).start();
  }}, []);

  const handleClose = () => {{
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.parallel([
      Animated.timing(fadeAnim, {{ toValue: 0, duration: 250, useNativeDriver: true }}),
      Animated.timing(slideAnim, {{ toValue: H * 0.4, duration: 250, useNativeDriver: true }})
    ]).start(onClose);
  }};

  return (
    <Modal transparent visible animationType="none" onRequestClose={{handleClose}}>
      <Animated.View style={{[StyleSheet.absoluteFillObject, {{ opacity: fadeAnim }}]}}>
        <BlurView intensity={{70}} tint="dark" style={{StyleSheet.absoluteFillObject}}>
          <TouchableOpacity style={{StyleSheet.absoluteFillObject}} activeOpacity={{1}} onPress={{handleClose}} />
        </BlurView>
        <LinearGradient
          colors={{[accent + '1A', 'transparent']}}
          style={{StyleSheet.absoluteFillObject}}
          pointerEvents="none"
        />
      </Animated.View>

      <Animated.View style={{[S.sheet, {{ transform: [{{ translateY: slideAnim }}], opacity: fadeAnim }}]}}>
        <View style={{S.dragIndicator}} />
        
        <ScrollView 
          showsVerticalScrollIndicator={{false}} 
          contentContainerStyle={{S.scrollContent}}
          bounces={{true}}
        >
          {{/* Header Section */}}
          <View style={{S.headerRow}}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
               <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: accent, shadowColor: accent, shadowRadius: 6, shadowOpacity: 0.8, shadowOffset: {{width:0,height:0}} }} />
               <Text style={{ fontSize: 12, fontWeight: '900', color: accent, letterSpacing: 2.5, textTransform: 'uppercase' }}>ACTIVE PHASE</Text>
            </View>
            <TouchableOpacity hitSlop={{{{ top: 20, bottom: 20, left: 20, right: 20 }}}} onPress={{handleClose}} style={{S.closeBtn}}>
              <Ionicons name="close" size={{24}} color="rgba(255,255,255,0.5)" />
            </TouchableOpacity>
          </View>
          
          <Text style={{S.timeLabel}}>{{period.startLabel}} — {{period.endLabel}}</Text>
          
          {{ex ? (
            <>
              <Text style={{S.heroTitle}}>{{ex.headline}}</Text>
              <Text style={{S.tagline}}>{{ex.tagline}}</Text>

              {{/* Modern Science Block */}}
              <View style={{S.section}}>
                <Text style={{S.sectionLabel, color: 'rgba(255,255,255,0.4)'}}>MODERN CHRONOBIOLOGY</Text>
                <Text style={{S.bodyText}}>{{ex.what}}</Text>
              </View>

              {{/* Why it matters */}}
              <View style={{S.section}}>
                <Text style={{S.sectionLabel, color: accent}}>WHY IT MATTERS</Text>
                <Text style={{S.bodyText}}>{{ex.whyMatters}}</Text>
              </View>

              {{/* Key Stats / Facts */}}
              <View style={{S.statsRow}}>
                {{ex.topFact.map((f: any, i: number) => (
                  <View key={{i}} style={{S.statBox}}>
                    <Text style={{ fontSize: 28, marginBottom: 8 }}>{{f.icon}}</Text>
                    <Text style={{[S.statValue, {{ color: accent }}]}}>{{f.label}}</Text>
                    <Text style={{S.statLabel}}>{{f.value}}</Text>
                  </View>
                ))}}
              </View>
            </>
          ) : (
            <Text style={{S.heroTitle}}>{{period.sciTitle}}</Text>
          )}}

          {{/* Divider */}}
          <View style={{ width: '100%', height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: 32 }} />

          {{/* Ayurvedic Wisdom Block */}}
          <View style={{S.section}}>
            <Text style={{S.sectionLabel, color: 'rgba(255,255,255,0.4)'}}>5,000 YEAR OLD AYURVEDIC SCIENCE</Text>
            
            {{s && (
              <View style={{S.sanskritBox, borderLeftColor: accent}}>
                <Text style={{ fontSize: 32, fontWeight: '900', color: accent, marginBottom: 4 }}>{{s.sanskrit}}</Text>
                <Text style={{ fontSize: 16, color: 'rgba(255,255,255,0.7)', fontStyle: 'italic' }}>"{{s.meaning}}"</Text>
              </View>
            )}}

            {{w && (
              <>
                <Text style={{S.bodyText}}>{{w.ayurvedaBrief}}</Text>
                
                {{/* Elements */}}
                <View style={{ flexDirection: 'row', gap: 12, marginTop: 24, flexWrap: 'wrap' }}>
                  {{w.elements.map((el: any, i: number) => (
                    <View key={{i}} style={{S.elementChip}}>
                      <Text style={{ fontSize: 18, marginRight: 6 }}>{{el.emoji}}</Text>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: '#FFF' }}>{{el.name.split(' ')[0]}}</Text>
                    </View>
                  ))}}
                </View>
              </>
            )}}
          </View>
          
          <View style={{ height: 60 }} />
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}}

const S = StyleSheet.create({{
  sheet: {{
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    height: H * 0.85,
    backgroundColor: 'rgba(12, 12, 18, 0.95)',
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  }},
  dragIndicator: {{
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center',
    marginTop: 12,
  }},
  scrollContent: {{
    padding: 28,
    paddingTop: 16,
  }},
  headerRow: {{
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  }},
  closeBtn: {{
    width: 32, height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center', justifyContent: 'center'
  }},
  timeLabel: {{
    fontSize: 14,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 2,
    marginBottom: 12,
    textTransform: 'uppercase'
  }},
  heroTitle: {{
    fontSize: 40,
    fontWeight: '300',
    color: '#FFFFFF',
    lineHeight: 46,
    fontFamily: 'serif',
    marginBottom: 16,
  }},
  tagline: {{
    fontSize: 16,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '500',
    lineHeight: 24,
    marginBottom: 40,
  }},
  section: {{
    marginBottom: 32,
  }},
  sectionLabel: {{
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginBottom: 16,
    textTransform: 'uppercase',
  }},
  bodyText: {{
    fontSize: 17,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 26,
    fontWeight: '400',
  }},
  statsRow: {{
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 10,
  }},
  statBox: {{
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  }},
  statValue: {{
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 4,
    textAlign: 'center',
  }},
  statLabel: {{
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '500',
    textAlign: 'center',
  }},
  sanskritBox: {{
    borderLeftWidth: 3,
    paddingLeft: 20,
    marginBottom: 24,
  }},
  elementChip: {{
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  }}
}});
"""

with open('components/MetabolicStoryModal.tsx', 'w') as f:
    f.write(new_content)


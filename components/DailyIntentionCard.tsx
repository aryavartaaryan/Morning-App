import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, Animated, StyleSheet, Easing, LayoutAnimation, UIManager, Platform, Modal, KeyboardAvoidingView, ScrollView } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useIntentionStore } from '../lib/intentionStore';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const BUILT_IN_IDEAS = [
  "be present",
  "go with the flow",
  "focus on gratitude",
  "breathe deeply",
  "let go of what I can't control",
  "embrace joy"
];

export function DailyIntentionCard() {
  const { load, isLoaded, history, addIntention, logIntention } = useIntentionStore();
  const [inputText, setInputText] = useState('');
  const [showWriteModal, setShowWriteModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showLogModal, setShowLogModal] = useState(false);
  const [pendingIntention, setPendingIntention] = useState('');
  
  // Write Modal State
  const [activeTab, setActiveTab] = useState<'recent' | 'ideas'>('recent');

  // Log Modal Animation State
  const [isLogging, setIsLogging] = useState(false);
  const logButtonScale = useRef(new Animated.Value(1)).current;
  const logSuccessOpacity = useRef(new Animated.Value(0)).current;
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  
  useEffect(() => {
    load();
  }, []);

  const d = new Date();
  const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const todayRecord = history.find(h => h.date === todayStr);
  const items = todayRecord?.items || [];
  const hasIntention = items.length > 0;
  const activeItem = items[0];
  const isLogged = hasIntention && activeItem.completed;

  // Extract recent unique intentions
  const recentIntentions = useMemo(() => {
    const recents = new Set<string>();
    history.slice().reverse().forEach(record => {
      record.items.forEach(item => {
        if (item.text) recents.add(item.text.toLowerCase());
      });
    });
    return Array.from(recents).slice(0, 10);
  }, [history]);

  useEffect(() => {
    if (isLoaded) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true })
      ]).start();
    }
  }, [isLoaded]);

  if (!isLoaded) return null;

  const handleSetIntention = (text: string) => {
    if (text.trim()) {
      setPendingIntention(text.trim());
      setShowWriteModal(false);
      setShowConfirmModal(true);
    }
  };

  const handleConfirmTap = () => {
    Animated.sequence([
      Animated.timing(logButtonScale, { toValue: 0.9, duration: 150, useNativeDriver: true }),
      Animated.timing(logButtonScale, { toValue: 1.1, duration: 150, useNativeDriver: true }),
      Animated.timing(logButtonScale, { toValue: 0, duration: 300, easing: Easing.in(Easing.back(2)), useNativeDriver: true })
    ]).start(() => {
      setIsLogging(true);
      Animated.timing(logSuccessOpacity, { toValue: 1, duration: 500, useNativeDriver: true }).start(() => {
        setTimeout(() => {
          addIntention(pendingIntention);
          setInputText('');
          setShowConfirmModal(false);
          setIsLogging(false);
          logButtonScale.setValue(1);
          logSuccessOpacity.setValue(0);
        }, 2000);
      });
    });
  };

  const handleTapToLog = () => {
    // Start premium animation
    Animated.sequence([
      Animated.timing(logButtonScale, { toValue: 0.9, duration: 150, useNativeDriver: true }),
      Animated.timing(logButtonScale, { toValue: 1.1, duration: 150, useNativeDriver: true }),
      Animated.timing(logButtonScale, { toValue: 0, duration: 300, easing: Easing.in(Easing.back(2)), useNativeDriver: true })
    ]).start(() => {
      setIsLogging(true);
      Animated.timing(logSuccessOpacity, { toValue: 1, duration: 500, useNativeDriver: true }).start(() => {
        // Wait a couple seconds, then close and actually log it
        setTimeout(() => {
          logIntention(activeItem.id);
          setShowLogModal(false);
          // Reset states for future
          setIsLogging(false);
          logButtonScale.setValue(1);
          logSuccessOpacity.setValue(0);
        }, 2000);
      });
    });
  };

  const handleHomeCardPress = () => {
    if (!hasIntention) {
      setShowWriteModal(true);
    } else if (!isLogged) {
      setShowLogModal(true);
    }
  };

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      
      {/* ── HOME SCREEN UI ── */}
      <TouchableOpacity activeOpacity={0.8} onPress={handleHomeCardPress} style={styles.homeCardWrapper}>
        <BlurView intensity={60} tint="dark" style={styles.premiumGlassCard}>
          {!hasIntention ? (
            <View style={styles.homeContentCenter}>
              <Text style={styles.homePrefixText}>Today I will...</Text>
              <Text style={styles.homePlaceholderText}>set your intention here</Text>
            </View>
          ) : isLogged ? (
            <View style={styles.homeContentCenter}>
              <Text style={styles.homePrefixTextLight}>Intention complete</Text>
              <Text style={styles.homeIntentionText}>{activeItem.text}</Text>
              <Text style={styles.homePrefixTextLight}>See you tomorrow</Text>
            </View>
          ) : (
            <View style={styles.homeContentCenter}>
              <Text style={styles.homePrefixText}>Today I will...</Text>
              <Text style={styles.homeIntentionText}>{activeItem.text}</Text>
            </View>
          )}
        </BlurView>
      </TouchableOpacity>

      {/* ── WRITE MODAL (MIDDLE SCREEN) ── */}
      <Modal visible={showWriteModal} transparent={true} animationType="slide" onRequestClose={() => setShowWriteModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalBg}>
          <BlurView intensity={100} tint="light" style={styles.modalBlurLight}>
            {/* Header area removed for premium look, relies on back button */}
            <View style={{ height: Platform.OS === 'ios' ? 60 : 40 }} />
            
            <View style={styles.writeContentTop}>
              <Text style={styles.writePrefixText}>Today I will...</Text>
              <TextInput
                style={styles.modalInputFullScreen}
                placeholder="set your intention here"
                placeholderTextColor="rgba(0,0,0,0.3)"
                value={inputText}
                onChangeText={setInputText}
                autoFocus={true}
                returnKeyType="done"
                maxLength={60}
                onSubmitEditing={() => handleSetIntention(inputText)}
              />
            </View>

            <View style={styles.tabContainer}>
              <TouchableOpacity onPress={() => setActiveTab('recent')} style={[styles.tabButton, activeTab === 'recent' && styles.tabButtonActive]}>
                <Text style={[styles.tabText, activeTab === 'recent' && styles.tabTextActive]}>Recent</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setActiveTab('ideas')} style={[styles.tabButton, activeTab === 'ideas' && styles.tabButtonActive]}>
                <Text style={[styles.tabText, activeTab === 'ideas' && styles.tabTextActive]}>Ideas</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.listContainer} keyboardShouldPersistTaps="handled">
              {(activeTab === 'recent' ? recentIntentions : BUILT_IN_IDEAS).map((itemText, idx) => (
                <TouchableOpacity 
                  key={idx} 
                  style={styles.listItem}
                  onPress={() => handleSetIntention(itemText)}
                >
                  <Text style={styles.listItemText}>{itemText}</Text>
                  <Ionicons name="heart-outline" size={18} color="#00D4B8" />
                </TouchableOpacity>
              ))}
              {activeTab === 'recent' && recentIntentions.length === 0 && (
                <Text style={styles.emptyText}>No recent intentions yet.</Text>
              )}
            </ScrollView>
            
          </BlurView>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── CONFIRM SET INTENTION MODAL ── */}
      <Modal visible={showConfirmModal} transparent={true} animationType="slide" onRequestClose={() => setShowConfirmModal(false)}>
        <BlurView intensity={100} tint="light" style={styles.modalBlurLight}>
          {/* Header area removed for premium look */}
          <View style={{ height: Platform.OS === 'ios' ? 60 : 40 }} />
          
          <View style={styles.logContentCenter}>
            <Text style={styles.writePrefixText}>Today I will...</Text>
            <Text style={styles.logIntentionText}>{pendingIntention}</Text>
          </View>

          <View style={styles.logBottomArea}>
            {!isLogging ? (
              <View style={{ alignItems: 'center' }}>
                <Animated.View style={{ transform: [{ scale: logButtonScale }] }}>
                  <TouchableOpacity activeOpacity={0.8} style={styles.tapToLogBtn} onPress={handleConfirmTap}>
                    <Text style={styles.tapToLogText}>Tap to set</Text>
                  </TouchableOpacity>
                </Animated.View>
                <TouchableOpacity 
                  onPress={() => { setShowConfirmModal(false); setShowWriteModal(true); }}
                  style={{ flexDirection: 'row', alignItems: 'center', marginTop: 24, gap: 6 }}
                >
                  <Ionicons name="arrow-undo-outline" size={16} color="#4EAA8D" />
                  <Text style={{ color: '#4EAA8D', fontWeight: '600' }}>Reset</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Animated.View style={{ opacity: logSuccessOpacity, alignItems: 'center' }}>
                <Ionicons name="checkmark-circle" size={64} color="#10B981" />
                <Text style={styles.successMessage}>Your intention is set, all the best.</Text>
              </Animated.View>
            )}
          </View>
        </BlurView>
      </Modal>

      {/* ── LOG MODAL (RIGHT SCREEN) ── */}
      <Modal visible={showLogModal} transparent={true} animationType="slide" onRequestClose={() => setShowLogModal(false)}>
        <BlurView intensity={100} tint="light" style={styles.modalBlurLight}>
          <View style={styles.modalHeaderFullScreen}>
            <View style={{ flex: 1 }} />
            <TouchableOpacity hitSlop={{top:20,bottom:20,left:20,right:20}}>
              <Ionicons name="ellipsis-horizontal" size={24} color="#000" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.logContentCenter}>
            <Text style={styles.writePrefixText}>Today I will...</Text>
            <Text style={styles.logIntentionText}>{activeItem?.text}</Text>
          </View>

          <View style={styles.logBottomArea}>
            {!isLogging ? (
              <Animated.View style={{ transform: [{ scale: logButtonScale }] }}>
                <TouchableOpacity 
                  activeOpacity={0.8}
                  style={styles.tapToLogBtn}
                  onPress={handleTapToLog}
                >
                  <Text style={styles.tapToLogText}>Tap to Log</Text>
                </TouchableOpacity>
              </Animated.View>
            ) : (
              <Animated.View style={{ opacity: logSuccessOpacity, alignItems: 'center' }}>
                <Ionicons name="checkmark-circle" size={64} color="#10B981" />
                <Text style={styles.successMessage}>Your intention is set, all the best.</Text>
              </Animated.View>
            )}
          </View>
        </BlurView>
      </Modal>

    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: -20, // Perfectly balanced between the top header and hero ring
    left: 20,
    right: 20,
    zIndex: 100, elevation: 100,
    alignItems: 'center',
  },
  homeCardWrapper: {
    width: '100%',
    alignItems: 'center',
  },
  premiumGlassCard: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    overflow: 'hidden',
    backgroundColor: 'rgba(20,25,40,0.5)',
    width: '100%',
    alignItems: 'center',
  },
  homeContentCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  homePrefixText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '500',
  },
  homePrefixTextLight: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '400',
  },
  homePlaceholderText: {
    fontSize: 17,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.9)',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  homeIntentionText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    textAlign: 'center',
  },
  
  // MODALS
  modalBg: {
    flex: 1,
  },
  modalBlurLight: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.85)', // Light premium theme from screenshots
  },
  modalHeaderFullScreen: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
  },
  
  // WRITE MODAL SPECIFIC
  writeContentTop: {
    alignItems: 'center',
    paddingTop: 40,
    paddingHorizontal: 24,
  },
  writePrefixText: {
    fontSize: 14,
    color: '#555',
    marginBottom: 8,
  },
  modalInputFullScreen: {
    fontSize: 26,
    color: 'rgba(0,0,0,0.2)',
    fontWeight: '600',
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    marginBottom: 40,
    minHeight: 40,
  },
  tabContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
    marginHorizontal: 30,
  },
  tabButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabButtonActive: {
    borderBottomColor: '#000',
  },
  tabText: {
    fontSize: 15,
    color: '#888',
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#000',
    fontWeight: '700',
  },
  listContainer: {
    flex: 1,
    paddingHorizontal: 30,
    paddingTop: 10,
  },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.6)',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginBottom: 8,
  },
  listItemText: {
    fontSize: 15,
    color: '#333',
    fontWeight: '500',
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    marginTop: 30,
    fontSize: 14,
  },
  
  // LOG MODAL SPECIFIC
  logContentCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    marginTop: -80,
  },
  logIntentionText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#000',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    textAlign: 'center',
    marginTop: 10,
  },
  logBottomArea: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 80,
    height: 200,
  },
  tapToLogBtn: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#4EAA8D', // Soft green from screenshot
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 15,
    borderColor: 'rgba(78, 170, 141, 0.2)', // outer ring effect
  },
  tapToLogText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 15,
  },
  successMessage: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    textAlign: 'center',
  }
});

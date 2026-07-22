import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, Animated, StyleSheet, Easing, LayoutAnimation, UIManager, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useIntentionStore } from '../lib/intentionStore';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export function DailyIntentionCard() {
  const { load, isLoaded, history, currentStreak, addIntention, toggleIntention } = useIntentionStore();
  const [inputText, setInputText] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [logged, setLogged] = useState(false);
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  
  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (isLoaded) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true })
      ]).start();
    }
  }, [isLoaded]);

  if (!isLoaded) return null;

  const d = new Date();
  const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  
  const todayRecord = history.find(h => h.date === todayStr);
  const items = todayRecord?.items || [];
  const allCompleted = items.length > 0 && items.every(i => i.completed);
  
  useEffect(() => {
    if (!allCompleted) setLogged(false);
  }, [allCompleted]);

  const pastHistory = history.filter(h => h.date !== todayStr).reverse(); // latest first

  const handleSubmit = () => {
    if (inputText.trim()) {
      addIntention(inputText.trim());
      setInputText('');
    }
  };

  const toggleHistory = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowHistory(!showHistory);
  };

  if (allCompleted && logged && !showHistory) {
    return (
      <Animated.View style={[styles.container, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <TouchableOpacity activeOpacity={0.9} onPress={toggleHistory}>
          <BlurView intensity={50} tint="dark" style={styles.blurCard}>
            <View style={styles.completedContent}>
              <Ionicons name="checkmark-circle" size={24} color="#10B981" />
              <Text style={styles.completedText}>Intentions complete. See you tomorrow.</Text>
              {currentStreak > 0 && (
                <Text style={styles.streakBadge}>🔥 Day {currentStreak} of 7</Text>
              )}
            </View>
          </BlurView>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <BlurView intensity={70} tint="dark" style={styles.blurCard}>
        
        <View style={styles.header}>
          <Text style={styles.title}>{showHistory ? "History" : "Daily Intention"}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            {currentStreak > 0 && (
              <View style={styles.streakPill}>
                <Text style={styles.streakText}>🔥 Day {currentStreak} of 7</Text>
              </View>
            )}
            {pastHistory.length > 0 && (
              <TouchableOpacity onPress={toggleHistory} style={styles.historyBtn}>
                <Ionicons name={showHistory ? "close" : "time-outline"} size={18} color="rgba(255,255,255,0.7)" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {!showHistory ? (
          <>
            {items.map((item) => (
              <TouchableOpacity 
                key={item.id} 
                activeOpacity={0.8}
                onPress={() => toggleIntention(item.id)}
                style={styles.itemRow}
              >
                <View style={[styles.checkbox, item.completed && styles.checkboxActive]}>
                   {item.completed && <Ionicons name="checkmark" size={14} color="#FFF" />}
                </View>
                <Text style={[styles.itemText, item.completed && styles.itemTextCompleted]}>
                  {item.text}
                </Text>
              </TouchableOpacity>
            ))}

            <TextInput
              style={styles.input}
              placeholder={items.length === 0 ? "Set your intention for today..." : "Add another intention..."}
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={inputText}
              onChangeText={setInputText}
              onSubmitEditing={handleSubmit}
              returnKeyType="done"
              maxLength={120}
              autoCorrect={true}
            />

            {allCompleted && !logged && (
              <TouchableOpacity 
                activeOpacity={0.8}
                onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setLogged(true); }} 
                style={styles.logBtn}
              >
                <Text style={styles.logBtnText}>Log Intentions</Text>
              </TouchableOpacity>
            )}
          </>
        ) : (
          <View style={styles.historyList}>
            {pastHistory.map(day => (
              <View key={day.date} style={styles.historyDay}>
                <Text style={styles.historyDate}>{new Date(day.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric'})}</Text>
                {day.items.map(item => (
                  <View key={item.id} style={styles.itemRow}>
                    <Ionicons name={item.completed ? "checkmark-circle" : "ellipse-outline"} size={16} color={item.completed ? "#10B981" : "rgba(255,255,255,0.3)"} style={{ marginRight: 10 }} />
                    <Text style={[styles.itemText, { fontSize: 15 }, item.completed && styles.itemTextCompleted]}>
                      {item.text}
                    </Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        )}
      </BlurView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: -50,
    left: 20,
    right: 20,
    zIndex: 100,
  },
  blurCard: {
    width: '100%',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    overflow: 'hidden',
    backgroundColor: 'rgba(20,22,35,0.5)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.8)',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  streakPill: {
    backgroundColor: 'rgba(255,120,70,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,120,70,0.3)',
  },
  streakText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FF9A76',
    textTransform: 'uppercase',
  },
  historyBtn: {
    padding: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.4)',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxActive: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  itemText: {
    fontSize: 17,
    color: '#FFF',
    fontWeight: '500',
    flex: 1,
  },
  itemTextCompleted: {
    color: 'rgba(255,255,255,0.4)',
    textDecorationLine: 'line-through',
  },
  input: {
    fontSize: 17,
    color: '#FFF',
    padding: 0,
    fontWeight: '500',
    marginTop: 4,
  },
  completedContent: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  completedText: {
    fontSize: 15,
    color: '#FFF',
    fontWeight: '600',
    textAlign: 'center',
  },
  streakBadge: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FF9A76',
    marginTop: 2,
  },
  historyList: {
    maxHeight: 250,
  },
  historyDay: {
    marginBottom: 16,
  },
  historyDate: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  logBtn: {
    backgroundColor: '#10B981',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  logBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  }
});

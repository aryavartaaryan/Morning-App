import sys

def main():
    file_path = 'components/DailyIntentionCard.tsx'
    
    new_content = """import React, { useRef, useEffect } from 'react';
import { View, Text, Animated, StyleSheet, Platform } from 'react-native';

const PREMIUM_INTENTIONS = [
  "let go of what I can't control",
  "embrace stillness and presence",
  "trust the timing of my life",
  "nurture my body with care",
  "breathe deeply into the present",
  "speak to myself with kindness",
  "find joy in the smallest moments",
  "release tension and invite peace",
  "stay grounded in my own truth",
  "radiate calm and positive energy",
  "cultivate patience within myself",
  "move through the day with grace",
  "honor my boundaries and rest",
  "listen to the wisdom of my body"
];

function getDayOfYear(date: Date) {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = (date.getTime() - start.getTime()) + ((start.getTimezoneOffset() - date.getTimezoneOffset()) * 60 * 1000);
  const oneDay = 1000 * 60 * 60 * 24;
  return Math.floor(diff / oneDay);
}

export function DailyIntentionCard() {
  const scale = useRef(new Animated.Value(0.96)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    Animated.parallel([
      Animated.timing(scale, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: true,
      })
    ]).start();
  }, []);

  const dayIndex = getDayOfYear(new Date()) % PREMIUM_INTENTIONS.length;
  const dailyIntention = PREMIUM_INTENTIONS[dayIndex];

  return (
    <Animated.View style={[styles.container, { transform: [{ scale }], opacity }]}>
      <View style={styles.transparentWhisper}>
        <View style={styles.homeContentCenter}>
          <Text style={styles.homePrefixText}>
            Today I will...
          </Text>
          <Text style={styles.homeIntentionText} numberOfLines={2}>
            {dailyIntention}
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    zIndex: 100, 
    elevation: 100,
    alignItems: 'center',
    marginBottom: 10,
  },
  transparentWhisper: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    width: 'auto',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 20,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  homeContentCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  homePrefixText: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '600',
  },
  homeIntentionText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    textAlign: 'center',
    marginTop: 2,
  },
});
"""

    with open(file_path, 'w') as f:
        f.write(new_content)
        
    print("Rewrote DailyIntentionCard successfully!")

if __name__ == '__main__':
    main()

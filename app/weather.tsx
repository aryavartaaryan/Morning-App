import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Platform, StatusBar, LayoutAnimation, UIManager, ActivityIndicator } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { fetchWeather, cachedWeather, type WeatherData } from '@/lib/weather';
import { SafeAreaView } from 'react-native';

const { width, height } = Dimensions.get('window');

// Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Premium Color Palettes based on time/weather
const gradients = {
  day: ['#2A84FF', '#4FACFE', '#00F2FE'] as const,
  night: ['#0B101E', '#1B2845', '#274060'] as const,
  sunset: ['#FF512F', '#F09819', '#FF7E5F'] as const,
  rain: ['#1E3C72', '#2A5298', '#3A7BD5'] as const,
};

export default function WeatherScreen() {
  const router = useRouter();
  const [weather, setWeather] = useState<WeatherData | null>(cachedWeather);
  const [expandedDayIndex, setExpandedDayIndex] = useState<number | null>(null);

  useEffect(() => {
    loadWeather();
  }, []);

  const loadWeather = async () => {
    const data = await fetchWeather();
    if (data) {
      setWeather(data);
    }
  };

  const toggleDay = (index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedDayIndex(expandedDayIndex === index ? null : index);
  };

  const getTheme = () => {
    if (!weather) return gradients.night;
    const h = new Date().getHours();
    const isNight = h < 6 || h > 18;
    const condition = weather.condition.toLowerCase();
    if (condition.includes('rain') || condition.includes('drizzle') || condition.includes('storm')) return gradients.rain;
    if (h >= 17 && h <= 18) return gradients.sunset;
    return isNight ? gradients.night : gradients.day;
  };

  const themeColors = getTheme();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={themeColors} style={StyleSheet.absoluteFillObject} start={{x: 0, y: 0}} end={{x: 1, y: 1}} />
      
      {/* Background Decorative Circles */}
      <View style={[styles.glowCircle, { top: -height * 0.05, right: -width * 0.1, backgroundColor: 'rgba(255,255,255,0.08)' }]} />
      <View style={[styles.glowCircle, { bottom: -height * 0.1, left: -width * 0.15, backgroundColor: 'rgba(255,255,255,0.03)' }]} />

      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backBtn} 
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.back();
            }}
          >
            <BlurView intensity={20} tint="light" style={styles.backBtnInner}>
              <Text style={styles.backText}>← Back</Text>
            </BlurView>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{weather?.city || 'My Location'}</Text>
          <View style={{ width: 80 }} />
        </View>

        {!weather ? (
          <View style={styles.skeletonContainer}>
            <ActivityIndicator size="small" color="rgba(255,255,255,0.5)" />
            <Text style={styles.skeletonText}>Loading Weather...</Text>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            
            {/* 1. Main Current Weather Section - Compact & Smart */}
            <View style={styles.mainCurrent}>
              <View style={styles.mainTopRow}>
                <Text style={styles.mainEmoji}>{weather.emoji}</Text>
                <View style={styles.tempGroup}>
                  <Text style={styles.mainTemp}>{weather.temp}</Text>
                  <Text style={styles.degSymbol}>°</Text>
                </View>
              </View>
              <Text style={styles.conditionText}>{weather.condition} • Feels like {weather.feelsLike}°</Text>
            </View>

            {/* 2. Extra Metrics Row (4 columns) */}
            <View style={styles.metricsRow}>
              <MetricItem icon="💧" label="Humidity" value={`${weather.humidity}%`} />
              <MetricItem icon="💨" label="Wind" value={`${weather.windSpeed || 0} km/h`} />
              <MetricItem icon="☁️" label="Clouds" value={`${weather.cloudCover || 0}%`} />
              <MetricItem icon="☔" label="Rain" value={`${weather.precipitation || 0} mm`} />
            </View>

            {/* 3. 24-Hour Forecast */}
            <View style={styles.sectionCard}>
              <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFillObject} />
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Hourly Forecast</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hourlyScroll}>
                {weather.hourly.map((h, i) => (
                  <View key={i} style={styles.hourlyItem}>
                    <Text style={styles.hourlyTime}>{i === 0 ? 'Now' : `${h.hour}:00`}</Text>
                    <Text style={styles.hourlyEmoji}>{h.emoji}</Text>
                    <Text style={styles.hourlyTemp}>{h.temp}°</Text>
                    {h.precipProb > 10 ? (
                      <Text style={styles.hourlyPrecip}>{h.precipProb}%</Text>
                    ) : (
                      <View style={{height: 14}} />
                    )}
                  </View>
                ))}
              </ScrollView>
            </View>

            {/* 4. 14-Day Forecast */}
            <View style={[styles.sectionCard, { marginBottom: 40 }]}>
              <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFillObject} />
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>14-Day Outlook</Text>
              </View>
              <View style={styles.dailyContainer}>
                {weather.daily.map((d, i) => {
                  const isExpanded = expandedDayIndex === i;
                  return (
                    <TouchableOpacity 
                      key={i} 
                      style={styles.dailyRowWrapper} 
                      activeOpacity={0.7} 
                      onPress={() => toggleDay(i)}
                    >
                      <View style={styles.dailyRow}>
                        <Text style={styles.dailyDay}>{d.dayLabel}</Text>
                        <View style={styles.dailyEmojiContainer}>
                          <Text style={styles.dailyRowEmoji}>{d.emoji}</Text>
                        </View>
                        <View style={styles.dailyTemps}>
                          <Text style={styles.dailyMin}>{d.minTemp}°</Text>
                          {/* Visual Temp Bar */}
                          <View style={styles.tempBarContainer}>
                            <LinearGradient 
                              colors={['rgba(255,255,255,0.2)', 'rgba(255,255,255,0.9)']} 
                              start={{x: 0, y: 0}} end={{x: 1, y: 0}}
                              style={[styles.tempBar, { width: `${Math.min(100, Math.max(15, (d.maxTemp - d.minTemp) * 8))}%` }]} 
                            />
                          </View>
                          <Text style={styles.dailyMax}>{d.maxTemp}°</Text>
                        </View>
                      </View>
                      
                      {/* Expanded Details */}
                      {isExpanded && (
                        <View style={styles.expandedDetails}>
                          <Text style={styles.expandedText}>Condition: {d.condition}</Text>
                          <Text style={styles.expandedText}>
                            Precipitation: {d.precipitation > 0 ? `${d.precipitation} mm` : 'None expected'}
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

function MetricItem({ icon, label, value }: { icon: string, label: string, value: string }) {
  return (
    <View style={styles.metricItem}>
      <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFillObject} />
      <Text style={styles.metricIcon}>{icon}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  glowCircle: {
    position: 'absolute',
    width: width * 1.2,
    height: width * 1.2,
    borderRadius: width,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 40 : 10,
    paddingBottom: 5,
  },
  backBtn: {
    width: 80,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
  },
  backBtnInner: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  backText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  skeletonContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  skeletonText: {
    color: 'rgba(255,255,255,0.6)',
    marginTop: 12,
    fontSize: 14,
    fontWeight: '500',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 40,
  },
  mainCurrent: {
    alignItems: 'center',
    marginBottom: 20,
  },
  mainTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainEmoji: {
    fontSize: 64,
    marginRight: 12,
    shadowColor: '#FFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
  },
  tempGroup: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  mainTemp: {
    fontSize: 64,
    fontWeight: '300',
    color: '#FFF',
    fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'sans-serif-light',
    letterSpacing: -2,
  },
  degSymbol: {
    fontSize: 28,
    fontWeight: '300',
    color: 'rgba(255,255,255,0.7)',
    marginTop: 6,
  },
  conditionText: {
    fontSize: 15,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.9)',
    marginTop: 2,
    letterSpacing: 0.3,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  metricItem: {
    width: '23%',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 4,
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  metricIcon: {
    fontSize: 18,
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 13,
    color: '#FFF',
    fontWeight: '700',
    marginBottom: 2,
  },
  metricLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  sectionCard: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: 16,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  sectionTitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  hourlyScroll: {
    padding: 12,
  },
  hourlyItem: {
    alignItems: 'center',
    marginRight: 20,
  },
  hourlyTime: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  hourlyEmoji: {
    fontSize: 22,
    marginBottom: 6,
  },
  hourlyTemp: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
  hourlyPrecip: {
    color: '#60A5FA',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 4,
  },
  dailyContainer: {
    paddingTop: 4,
    paddingBottom: 8,
  },
  dailyRowWrapper: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.03)',
  },
  dailyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  dailyDay: {
    width: 50,
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
  },
  dailyEmojiContainer: {
    width: 40,
    alignItems: 'center',
  },
  dailyRowEmoji: {
    fontSize: 20,
  },
  dailyTemps: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 12,
  },
  dailyMin: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    fontWeight: '600',
    width: 28,
  },
  tempBarContainer: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 2,
    marginHorizontal: 10,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tempBar: {
    height: '100%',
    borderRadius: 2,
  },
  dailyMax: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
    width: 28,
    textAlign: 'right',
  },
  expandedDetails: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: 2,
    marginLeft: 90,
  },
  expandedText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    marginBottom: 4,
    fontStyle: 'italic',
  }
});

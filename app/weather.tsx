import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Dimensions, Platform, StatusBar } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { fetchWeather, type WeatherData } from '@/lib/weather';

const { width, height } = Dimensions.get('window');

// Premium Color Palettes based on time/weather
const gradients = {
  day: ['#4facfe', '#00f2fe', '#0062ff'] as const,
  night: ['#0f2027', '#203a43', '#2c5364'] as const,
  sunset: ['#ff7e5f', '#feb47b', '#f953c6'] as const,
  rain: ['#3a7bd5', '#3a6073', '#1e3c72'] as const,
};

export default function WeatherScreen() {
  const router = useRouter();
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWeather();
  }, []);

  const loadWeather = async () => {
    setLoading(true);
    const data = await fetchWeather();
    setWeather(data);
    setLoading(false);
  };

  const getTheme = () => {
    if (!weather) return gradients.night;
    const h = new Date().getHours();
    const isNight = h < 6 || h > 18;
    if (weather.condition.toLowerCase().includes('rain') || weather.condition.toLowerCase().includes('drizzle')) return gradients.rain;
    if (h >= 17 && h <= 18) return gradients.sunset;
    return isNight ? gradients.night : gradients.day;
  };

  const themeColors = getTheme();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={themeColors} style={StyleSheet.absoluteFillObject} start={{x: 0, y: 0}} end={{x: 1, y: 1}} />
      
      {/* Background Decorative Circles */}
      <View style={[styles.glowCircle, { top: -height * 0.1, right: -width * 0.2, backgroundColor: 'rgba(255,255,255,0.1)' }]} />
      <View style={[styles.glowCircle, { bottom: -height * 0.1, left: -width * 0.2, backgroundColor: 'rgba(255,255,255,0.05)' }]} />

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
            <BlurView intensity={30} tint="light" style={styles.backBtnInner}>
              <Text style={styles.backText}>← Back</Text>
            </BlurView>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{weather?.city || 'Weather'}</Text>
          <View style={{ width: 70 }} />
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#FFFFFF" />
            <Text style={styles.loadingText}>Fetching Atmos...</Text>
          </View>
        ) : !weather ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>Unable to load weather data.</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={loadWeather}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.scrollContent}>
            
            {/* Top Section: Main + Metrics Side by Side */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <View style={styles.mainCurrent}>
                <Text style={styles.mainEmoji}>{weather.emoji}</Text>
                <View style={styles.tempRow}>
                  <Text style={styles.mainTemp}>{weather.temp}</Text>
                  <Text style={styles.degSymbol}>°</Text>
                </View>
                <Text style={styles.conditionText}>{weather.condition}</Text>
                <Text style={styles.feelsLike}>Feels like {weather.feelsLike}°</Text>
              </View>
              
              <View style={{ width: '45%', gap: 10 }}>
                <MetricTile icon="💧" label="Humid" value={`${weather.humidity}%`} />
                <MetricTile icon="💨" label="Wind" value={`${weather.windSpeed || 0}k/h`} />
              </View>
            </View>

            {/* Middle Section: 24-Hour Forecast */}
            <View style={styles.sectionCard}>
              <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFillObject} />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hourlyScroll} contentContainerStyle={{ paddingHorizontal: 16 }}>
                {weather.hourly.map((h, i) => (
                  <View key={i} style={styles.hourlyItem}>
                    <Text style={styles.hourlyTime}>{i === 0 ? 'Now' : `${h.hour}:00`}</Text>
                    <Text style={styles.hourlyEmoji}>{h.emoji}</Text>
                    <Text style={styles.hourlyTemp}>{h.temp}°</Text>
                    {h.precipProb > 10 && <Text style={styles.hourlyPrecip}>{h.precipProb}%</Text>}
                  </View>
                ))}
              </ScrollView>
            </View>

            {/* Bottom Section: 7-Day Forecast (Trimmed to fit screen) */}
            <View style={[styles.sectionCard, { flex: 1, marginBottom: 20 }]}>
              <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFillObject} />
              <View style={styles.dailyContainer}>
                {weather.daily.slice(0, 7).map((d, i) => (
                  <View key={i} style={styles.dailyRow}>
                    <Text style={styles.dailyDay}>{d.dayLabel}</Text>
                    <View style={styles.dailyEmojiContainer}>
                      <Text style={styles.dailyRowEmoji}>{d.emoji}</Text>
                    </View>
                    <View style={styles.dailyTemps}>
                      <Text style={styles.dailyMin}>{d.minTemp}°</Text>
                      <View style={styles.tempBarContainer}>
                        <LinearGradient 
                          colors={['rgba(255,255,255,0.2)', 'rgba(255,255,255,0.8)']} 
                          start={{x: 0, y: 0}} end={{x: 1, y: 0}}
                          style={[styles.tempBar, { width: `${Math.min(100, Math.max(20, (d.maxTemp - d.minTemp) * 8))}%` }]} 
                        />
                      </View>
                      <Text style={styles.dailyMax}>{d.maxTemp}°</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

function MetricTile({ icon, label, value }: { icon: string, label: string, value: string }) {
  return (
    <View style={styles.metricTile}>
      <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFillObject} />
      <LinearGradient colors={['rgba(255,255,255,0.15)', 'rgba(255,255,255,0.02)']} style={StyleSheet.absoluteFillObject} start={{x:0, y:0}} end={{x:0, y:1}} />
      <Text style={styles.metricIcon}>{icon}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

// Ensure SafeAreaView is imported from react-native above
import { SafeAreaView as RNSafeAreaView } from 'react-native';
const SafeAreaView = RNSafeAreaView;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  glowCircle: {
    position: 'absolute',
    width: width * 1.5,
    height: width * 1.5,
    borderRadius: width,
    
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 40 : 10,
    paddingBottom: 10,
  },
  backBtn: {
    width: 80,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
  },
  backBtnInner: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#FFF',
    marginTop: 16,
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: 1,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: 16,
    marginBottom: 20,
  },
  retryBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
  },
  retryText: {
    color: '#FFF',
    fontWeight: '600',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  mainCurrent: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 40,
  },
  mainEmoji: {
    fontSize: 100,
    shadowColor: '#FFF',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  tempRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 10,
  },
  mainTemp: {
    fontSize: 96,
    fontWeight: '200',
    color: '#FFF',
    fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'sans-serif-thin',
    letterSpacing: -4,
  },
  degSymbol: {
    fontSize: 40,
    fontWeight: '300',
    color: 'rgba(255,255,255,0.6)',
    marginTop: 15,
  },
  conditionText: {
    fontSize: 24,
    fontWeight: '500',
    color: '#FFF',
    marginTop: -10,
    letterSpacing: 1,
  },
  feelsLike: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 8,
    fontWeight: '500',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  metricTile: {
    width: '48%',
    borderRadius: 24,
    padding: 16,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  metricIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  metricLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  metricValue: {
    fontSize: 20,
    color: '#FFF',
    fontWeight: '700',
  },
  sectionCard: {
    borderRadius: 30,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    marginBottom: 30,
  },
  sectionHeader: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  sectionTitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  hourlyScroll: {
    padding: 20,
  },
  hourlyItem: {
    alignItems: 'center',
    marginRight: 24,
  },
  hourlyTime: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  hourlyEmoji: {
    fontSize: 28,
    marginBottom: 8,
  },
  hourlyTemp: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
  },
  hourlyPrecip: {
    color: '#60a5fa',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  dailyContainer: {
    padding: 10,
  },
  dailyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  dailyDay: {
    width: 60,
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  dailyEmojiContainer: {
    width: 50,
    alignItems: 'center',
  },
  dailyRowEmoji: {
    fontSize: 24,
  },
  dailyRowPrecip: {
    color: '#60a5fa',
    fontSize: 10,
    fontWeight: '800',
  },
  dailyTemps: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 20,
  },
  dailyMin: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 16,
    fontWeight: '600',
    width: 35,
  },
  tempBarContainer: {
    flex: 1,
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 3,
    marginHorizontal: 15,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tempBar: {
    height: '100%',
    borderRadius: 3,
  },
  dailyMax: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
    width: 35,
    textAlign: 'right',
  },
});

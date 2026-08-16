import * as Location from 'expo-location';

export interface HourlyPoint {
  hour: number;
  temp: number;
  weatherCode: number;
  emoji: string;
  precipProb: number;
}

export interface DailyPoint {
  date: string;
  dayLabel: string;
  maxTemp: number;
  minTemp: number;
  weatherCode: number;
  emoji: string;
  condition: string;
  precipitation: number;
}

export interface WeatherData {
  temp: number;
  feelsLike: number;
  humidity: number;
  weatherCode: number;
  condition: string;
  emoji: string;
  city?: string;
  hourly: HourlyPoint[];
  daily: DailyPoint[];
  lat?: number;
  lon?: number;
  precipitation?: number;
  rain?: number;
  cloudCover?: number;
  windSpeed?: number;
  windGusts?: number;
}

const WMO: Record<number, { condition: string; emoji: string }> = {
  0:  { condition: 'Clear Sky',      emoji: '☀️' },
  1:  { condition: 'Mostly Clear',   emoji: '🌤️' },
  2:  { condition: 'Partly Cloudy',  emoji: '⛅' },
  3:  { condition: 'Overcast',       emoji: '☁️' },
  45: { condition: 'Foggy',          emoji: '🌫️' },
  48: { condition: 'Icy Fog',        emoji: '🌫️' },
  51: { condition: 'Light Drizzle',  emoji: '🌦️' },
  53: { condition: 'Drizzle',        emoji: '🌦️' },
  55: { condition: 'Heavy Drizzle',  emoji: '🌧️' },
  61: { condition: 'Light Rain',     emoji: '🌧️' },
  63: { condition: 'Rain',           emoji: '🌧️' },
  65: { condition: 'Heavy Rain',     emoji: '🌧️' },
  71: { condition: 'Light Snow',     emoji: '🌨️' },
  73: { condition: 'Snow',           emoji: '❄️' },
  75: { condition: 'Heavy Snow',     emoji: '❄️' },
  80: { condition: 'Showers',        emoji: '🌦️' },
  81: { condition: 'Rain Showers',   emoji: '🌧️' },
  82: { condition: 'Heavy Showers',  emoji: '⛈️' },
  95: { condition: 'Thunderstorm',   emoji: '⛈️' },
  96: { condition: 'Hail Storm',     emoji: '⛈️' },
  99: { condition: 'Heavy Hail',     emoji: '⛈️' },
};

function getWeatherInfo(code: number, isDay = 1): { condition: string; emoji: string } {
  const base = WMO[code] ?? WMO[Math.floor(code / 10) * 10] ?? { condition: 'Unknown', emoji: '🌡️' };
  if (isDay === 0 && (code === 0 || code === 1)) {
    return { condition: base.condition, emoji: '🌙' };
  }
  return base;
}

// Override the model weathercode using actual real-time measured values.
// Open-Meteo's weathercode can lag reality; precipitation/rain/showers are
// measured values that reflect what is actually falling RIGHT NOW.
function realWeatherCode(
  modelCode: number,
  rain: number,
  showers: number,
  snowfall: number,
  precipitation: number,
  cloudCover: number,
): number {
  const totalRain = rain + showers;

  // If measured precipitation is effectively zero, override ANY rain/snow/storm model code
  // to a cloud-cover based code. Open-Meteo often predicts rain that never arrives.
  if (precipitation <= 0.05 && totalRain <= 0.05 && snowfall === 0) {
    if (modelCode >= 51) { // Any drizzle, rain, snow, shower, storm
      if (cloudCover >= 80) return 3;  // Overcast
      if (cloudCover >= 50) return 2;  // Partly Cloudy
      if (cloudCover >= 25) return 1;  // Mostly Clear
      return 0;                        // Clear Sky
    }
    return modelCode; // Do not allow noise to escalate non-rain codes
  }

  // Otherwise, use measured values to escalate or confirm severity
  if (snowfall > 0.5)     return 75; // Heavy Snow
  if (snowfall > 0)       return 71; // Light Snow
  if (totalRain > 4.0)    return 65; // Heavy Rain
  if (totalRain > 1.5)    return 63; // Rain
  if (totalRain > 0.3)    return 61; // Light Rain
  if (precipitation > 0)  return 51; // Light Drizzle
  
  return modelCode;
}

let cachedWeather: WeatherData | null = null;
let lastFetchTime = 0;

export async function fetchWeather(force = false): Promise<WeatherData | null> {
  if (!force && cachedWeather && Date.now() - lastFetchTime < 15 * 60 * 1000) {
    return cachedWeather;
  }
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;

    let loc = await Location.getLastKnownPositionAsync();
    if (!loc) {
      loc = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise<null>(r => setTimeout(() => r(null), 8000))
      ]) as Location.LocationObject | null;
    }
    if (!loc) return null;
    const { latitude, longitude } = loc.coords;

    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${latitude.toFixed(4)}&longitude=${longitude.toFixed(4)}` +
      `&current=temperature_2m,apparent_temperature,relative_humidity_2m,weathercode` +
      `,precipitation,rain,showers,snowfall,cloud_cover,wind_speed_10m,wind_gusts_10m,wind_direction_10m,is_day` +
      `&hourly=temperature_2m,weathercode,precipitation_probability,is_day,wind_speed_10m` +
      `&daily=temperature_2m_max,temperature_2m_min,weathercode,precipitation_sum` +
      `&forecast_days=14&timezone=auto&models=best_match`;

    const controller  = new AbortController();
    const fetchTimeout = setTimeout(() => controller.abort(), 12_000);
    const res = await fetch(url, { signal: controller.signal }).finally(() => clearTimeout(fetchTimeout));
    if (!res.ok) return null;

    const json = await res.json();
    const c = json.current;

    const rain      = c.rain       ?? 0;
    const showers   = c.showers    ?? 0;
    const snowfall  = c.snowfall   ?? 0;
    const precip    = c.precipitation ?? 0;
    const cloudCov  = c.cloud_cover ?? 0;
    const effectiveCode = realWeatherCode(c.weathercode, rain, showers, snowfall, precip, cloudCov);
    const info = getWeatherInfo(effectiveCode, c.is_day ?? 1);

    let city: string | undefined;
    try {
      const [place] = await Location.reverseGeocodeAsync({ latitude, longitude });
      city = place?.city ?? place?.subregion ?? undefined;
    } catch { /* silent — city is optional */ }

    // Build 24-hour forecast strip starting from current hour
    const nowHour = new Date().getHours();
    const hourlyTemps: number[] = json.hourly?.temperature_2m ?? [];
    const hourlyCodes: number[] = json.hourly?.weathercode ?? [];
    const hourlyIsDay: number[]  = json.hourly?.is_day ?? [];
    const hourlyPrecipProb: number[] = json.hourly?.precipitation_probability ?? [];
    const hourly: HourlyPoint[] = [];
    for (let i = 0; i < 48 && hourly.length < 24; i++) {
      const h = (json.hourly?.time?.[i] as string | undefined);
      if (!h) continue;
      const parsedHour = new Date(h).getHours();
      if (hourly.length === 0 && parsedHour !== nowHour && i < nowHour) continue;
      const code  = hourlyCodes[i] ?? 0;
      const isDayH = hourlyIsDay[i] ?? 1;
      hourly.push({ hour: parsedHour, temp: Math.round(hourlyTemps[i] ?? 0), weatherCode: code, emoji: getWeatherInfo(code, isDayH).emoji, precipProb: Math.round(hourlyPrecipProb[i] ?? 0) });
    }

    // Build 7-day daily forecast
    const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const dailyDates: string[]  = json.daily?.time ?? [];
    const dailyMax: number[]    = json.daily?.temperature_2m_max ?? [];
    const dailyMin: number[]    = json.daily?.temperature_2m_min ?? [];
    const dailyCodes: number[]  = json.daily?.weathercode ?? [];
    const dailyPrec: number[]   = json.daily?.precipitation_sum ?? [];
    const daily: DailyPoint[] = dailyDates.map((dateStr: string, i: number) => {
      const d    = new Date(dateStr);
      const code = dailyCodes[i] ?? 0;
      const inf  = getWeatherInfo(code);
      const isToday = i === 0;
      return {
        date:         dateStr,
        dayLabel:     isToday ? 'Today' : DAY_NAMES[d.getDay()],
        maxTemp:      Math.round(dailyMax[i] ?? 0),
        minTemp:      Math.round(dailyMin[i] ?? 0),
        weatherCode:  code,
        emoji:        inf.emoji,
        condition:    inf.condition,
        precipitation: Math.round((dailyPrec[i] ?? 0) * 10) / 10,
      };
    });

    const finalData = {
      temp: Math.round(c.temperature_2m),
      feelsLike: Math.round(c.apparent_temperature),
      humidity: Math.round(c.relative_humidity_2m),
      weatherCode: effectiveCode,
      condition: info.condition,
      emoji: info.emoji,
      city,
      hourly,
      daily,
      lat: latitude,
      lon: longitude,
      precipitation: Math.round(precip * 10) / 10,
      rain: Math.round((rain + showers) * 10) / 10,
      cloudCover: c.cloud_cover ?? 0,
      windSpeed: Math.round(c.wind_speed_10m ?? 0),
      windGusts: Math.round(c.wind_gusts_10m ?? 0),
    };
    cachedWeather = finalData;
    lastFetchTime = Date.now();
    return finalData;
  } catch {
    return null;
  }
}

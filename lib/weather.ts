import * as Location from 'expo-location';

export interface HourlyPoint {
  hour: number;
  temp: number;
  weatherCode: number;
  emoji: string;
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

function getWeatherInfo(code: number): { condition: string; emoji: string } {
  return WMO[code] ?? WMO[Math.floor(code / 10) * 10] ?? { condition: 'Unknown', emoji: '🌡️' };
}

export async function fetchWeather(): Promise<WeatherData | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;

    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
    const { latitude, longitude } = loc.coords;

    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${latitude.toFixed(4)}&longitude=${longitude.toFixed(4)}` +
      `&current=temperature_2m,apparent_temperature,relative_humidity_2m,weathercode` +
      `&hourly=temperature_2m,weathercode` +
      `&daily=temperature_2m_max,temperature_2m_min,weathercode,precipitation_sum` +
      `&forecast_days=7&timezone=auto`;

    const res = await fetch(url);
    if (!res.ok) return null;

    const json = await res.json();
    const c = json.current;
    const info = getWeatherInfo(c.weathercode);

    let city: string | undefined;
    try {
      const [place] = await Location.reverseGeocodeAsync({ latitude, longitude });
      city = place?.city ?? place?.subregion ?? undefined;
    } catch { /* silent — city is optional */ }

    // Build 24-hour forecast strip starting from current hour
    const nowHour = new Date().getHours();
    const hourlyTemps: number[] = json.hourly?.temperature_2m ?? [];
    const hourlyCodes: number[] = json.hourly?.weathercode ?? [];
    const hourly: HourlyPoint[] = [];
    for (let i = 0; i < 48 && hourly.length < 24; i++) {
      const h = (json.hourly?.time?.[i] as string | undefined);
      if (!h) continue;
      const parsedHour = new Date(h).getHours();
      if (hourly.length === 0 && parsedHour !== nowHour && i < nowHour) continue;
      const code = hourlyCodes[i] ?? 0;
      hourly.push({ hour: parsedHour, temp: Math.round(hourlyTemps[i] ?? 0), weatherCode: code, emoji: getWeatherInfo(code).emoji });
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

    return {
      temp: Math.round(c.temperature_2m),
      feelsLike: Math.round(c.apparent_temperature),
      humidity: Math.round(c.relative_humidity_2m),
      weatherCode: c.weathercode,
      condition: info.condition,
      emoji: info.emoji,
      city,
      hourly,
      daily,
      lat: latitude,
      lon: longitude,
    };
  } catch {
    return null;
  }
}

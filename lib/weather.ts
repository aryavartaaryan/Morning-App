import * as Location from 'expo-location';

export interface WeatherData {
  temp: number;
  feelsLike: number;
  humidity: number;
  weatherCode: number;
  condition: string;
  emoji: string;
  city?: string;
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
      `&timezone=auto`;

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

    return {
      temp: Math.round(c.temperature_2m),
      feelsLike: Math.round(c.apparent_temperature),
      humidity: Math.round(c.relative_humidity_2m),
      weatherCode: c.weathercode,
      condition: info.condition,
      emoji: info.emoji,
      city,
    };
  } catch {
    return null;
  }
}

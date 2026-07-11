/**
 * Solar time calculator — NOAA/Spencer algorithm.
 * Returns sunrise, sunset, solarNoon, AND real-time sun elevation angle.
 * All computed from GPS coordinates — no external library needed.
 *
 * Works globally: handles polar day/night edge cases.
 */
export interface SolarTimes {
  sunrise: number;    // local decimal hours, e.g. 6.05 = 6:03 AM
  sunset: number;     // local decimal hours, e.g. 18.6 = 6:36 PM
  solarNoon: number;  // local decimal hours
}

export function getSolarTimes(lat: number, lon: number, date?: Date): SolarTimes {
  const now = date ?? new Date();
  // Device's UTC offset in hours (positive east)
  const utcOffsetHours = -now.getTimezoneOffset() / 60;

  // Day of year (1-365)
  const startOfYear = new Date(now.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((now.getTime() - startOfYear.getTime()) / 86400000);

  // Day angle (radians) — Spencer 1971
  const gamma = (2 * Math.PI / 365) * (dayOfYear - 1);

  // Equation of time in hours (Spencer's formula, simplified)
  const eqTimeMin =
    229.18 * (
      0.000075
      + 0.001868 * Math.cos(gamma)
      - 0.032077 * Math.sin(gamma)
      - 0.014615 * Math.cos(2 * gamma)
      - 0.040890 * Math.sin(2 * gamma)
    );
  const eqTimeHours = eqTimeMin / 60;

  // Solar declination in radians (Spencer's formula)
  const decl =
    0.006918
    - 0.399912 * Math.cos(gamma)
    + 0.070257 * Math.sin(gamma)
    - 0.006758 * Math.cos(2 * gamma)
    + 0.000907 * Math.sin(2 * gamma)
    - 0.002697 * Math.cos(3 * gamma)
    + 0.001480 * Math.sin(3 * gamma);

  // Sunrise/sunset hour angle (radians → convert to hours)
  // Standard altitude for sunrise/sunset is -0.833 degrees (-50 arcminutes) 
  // due to atmospheric refraction (34') and sun's radius (16')
  const hRad = -0.833 * Math.PI / 180;
  const latRad = (lat * Math.PI) / 180;
  const cosHA = (Math.sin(hRad) - Math.sin(latRad) * Math.sin(decl)) / (Math.cos(latRad) * Math.cos(decl));

  // Edge cases: polar day / polar night
  if (cosHA <= -1) return { sunrise: 0, sunset: 24, solarNoon: 12 };
  if (cosHA >= 1) return { sunrise: 12, sunset: 12, solarNoon: 12 };

  const hourAngleHours = (Math.acos(cosHA) * 180) / Math.PI / 15;

  // Solar noon in local time = 12h - eqTime - (lon offset from standard meridian)
  // More precisely: solarNoonUTC = 12 - eqTime - lon/15
  // then + utcOffset to get local time
  const solarNoon = 12 - eqTimeHours - lon / 15 + utcOffsetHours;
  const sunrise = solarNoon - hourAngleHours;
  const sunset = solarNoon + hourAngleHours;

  return { sunrise, sunset, solarNoon };
}

/**
 * Computes the sun's altitude (elevation) angle in degrees at a given GPS
 * location and moment in time.  Range: −90° (nadir) to +90° (zenith).
 *
 * Key sky thresholds for the ring colour system:
 *   < −18°  → astronomical night  (deep navy/moon)
 *   −18°…−12° → nautical twilight  (dark indigo)
 *   −12°…−6°  → astronomical twilight / Brahma Muhurta (violet)
 *   −6°…0°   → civil twilight / pre-dawn glow (rose-violet)
 *   0°…6°    → horizon / golden sunrise (amber-gold)
 *   6°…20°   → low morning sun (warm gold)
 *   20°…50°  → mid-morning / afternoon sky (sky blue)
 *   50°+     → solar noon zone (white-gold blaze)
 */
export function getSunElevation(lat: number, lon: number, date?: Date): number {
  const now = date ?? new Date();

  // UTC time in decimal hours
  const utcH = now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600;

  // Day of year (1-based)
  const startOfYear = new Date(Date.UTC(now.getUTCFullYear(), 0, 0));
  const dayOfYear   = Math.ceil((now.getTime() - startOfYear.getTime()) / 86400000);

  // Day angle (Spencer 1971)
  const gamma = (2 * Math.PI / 365) * (dayOfYear - 1);

  // Equation of time (minutes)
  const eqTimeMin =
    229.18 * (
      0.000075
      + 0.001868 * Math.cos(gamma)
      - 0.032077 * Math.sin(gamma)
      - 0.014615 * Math.cos(2 * gamma)
      - 0.040890 * Math.sin(2 * gamma)
    );

  // Solar declination (radians)
  const decl =
    0.006918
    - 0.399912 * Math.cos(gamma)
    + 0.070257 * Math.sin(gamma)
    - 0.006758 * Math.cos(2 * gamma)
    + 0.000907 * Math.sin(2 * gamma)
    - 0.002697 * Math.cos(3 * gamma)
    + 0.001480 * Math.sin(3 * gamma);

  // True solar time (minutes)
  const trueSolarTimeMin = utcH * 60 + eqTimeMin + 4 * lon;

  // Hour angle (degrees): 0 = solar noon, negative = AM, positive = PM
  const hourAngleDeg = trueSolarTimeMin / 4 - 180;
  const hourAngleRad = hourAngleDeg * (Math.PI / 180);

  const latRad  = lat  * (Math.PI / 180);

  // Solar elevation (altitude) in radians, then convert to degrees
  const sinElev =
    Math.sin(latRad) * Math.sin(decl)
    + Math.cos(latRad) * Math.cos(decl) * Math.cos(hourAngleRad);

  return Math.asin(Math.max(-1, Math.min(1, sinElev))) * (180 / Math.PI);
}

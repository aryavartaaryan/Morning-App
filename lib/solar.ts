/**
 * Solar time calculator — NOAA/Spencer algorithm.
 * Returns sunrise, sunset, and solarNoon as decimal hours in the DEVICE'S
 * local time (uses the OS timezone offset). No external library needed.
 *
 * Works globally: handles polar day/night edge cases.
 */
export interface SolarTimes {
  sunrise: number;    // local decimal hours, e.g. 6.05 = 6:03 AM
  sunset: number;     // local decimal hours, e.g. 18.6 = 6:36 PM
  solarNoon: number;  // local decimal hours
}

export function getSolarTimes(lat: number, lon: number): SolarTimes {
  const now = new Date();
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
  const latRad = (lat * Math.PI) / 180;
  const cosHA = -Math.tan(latRad) * Math.tan(decl);

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

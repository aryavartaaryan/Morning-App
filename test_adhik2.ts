import { getVedicMonth } from './lib/cosmicData';
const d1 = new Date('2026-05-15T12:00:00Z');
const d2 = new Date('2026-06-15T12:00:00Z');
const d3 = new Date('2026-07-01T12:00:00Z');
const d4 = new Date('2026-07-15T12:00:00Z');
const d5 = new Date('2026-08-15T12:00:00Z');

const dates = [d1, d2, d3, d4, d5];
const CYCLE = 29.53058867;
const KNOWN_NEW_MOON_MS = new Date('2000-01-06T18:14:00Z').getTime();
for (const date of dates) {
  const dJ2000 = (date.getTime() - 946728000000) / 86400000;
  const Ldeg = (280.460 + 0.9856474 * dJ2000) % 360;
  const gdeg = (357.528 + 0.9856003 * dJ2000) % 360;
  const gRad = gdeg * Math.PI / 180;
  const sunTropical = ((Ldeg + 1.915 * Math.sin(gRad) + 0.020 * Math.sin(2 * gRad)) % 360 + 360) % 360;
  const ayanamsha   = 23.85 + 0.0136 * (dJ2000 / 365.25);
  const siderealSun = ((sunTropical - ayanamsha) % 360 + 360) % 360;
  const moonAge  = ((((date.getTime() - KNOWN_NEW_MOON_MS) / 86400000) % CYCLE) + CYCLE) % CYCLE;
  
  const daysToClosingAmavasya = CYCLE - moonAge;
  const sunAtClosingAmavasya = ((siderealSun + daysToClosingAmavasya * 0.9856) % 360 + 360) % 360;
  
  const daysSinceLastAmavasya = moonAge;
  const sunAtLastAmavasya = ((siderealSun - daysSinceLastAmavasya * 0.9856) % 360 + 360) % 360;

  const rashiStart = Math.floor(sunAtLastAmavasya / 30) % 12;
  const rashiEnd = Math.floor(sunAtClosingAmavasya / 30) % 12;
  
  console.log(date.toISOString().split('T')[0], "start:", rashiStart, "end:", rashiEnd, rashiStart === rashiEnd ? "ADHIK!" : "NIJA");
}

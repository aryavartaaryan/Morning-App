/**
 * locationIntel.ts
 * GPS-based Ayurvedic intelligence engine.
 * All calculations are on-device — no external APIs required.
 * Uses device GPS + lib/solar.ts for sunrise/sunset.
 */

import * as Location from 'expo-location';
import { getSolarTimes } from './solar';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ClimateZone =
    | 'tropical'
    | 'arid'
    | 'temperate'
    | 'continental'
    | 'polar'
    | 'mediterranean'
    | 'humid_subtropical';

export type RituSeason =
    | 'Shishira'   // Late winter
    | 'Vasanta'    // Spring
    | 'Grishma'    // Summer
    | 'Varsha'     // Monsoon / Rainy
    | 'Sharad'     // Autumn
    | 'Hemanta';   // Early winter

export type CulturalRegion =
    | 'India'
    | 'WesternEurope'
    | 'USA_Canaad'
    | 'EastAsia'
    | 'MiddleEast'
    | 'LatinAmerica'
    | 'SubSaharan'
    | 'Nordic'
    | 'SoutheastAsia'
    | 'Other';

export interface LocationProfile {
    lat: number;
    lon: number;
    climateZone: ClimateZone;
    culturalRegion: CulturalRegion;
    hemisphere: 'northern' | 'southern';
    capturedAt: number; // Unix timestamp ms
}

export interface BrahmaMuhurtaResult {
    wakeHour: number;
    wakeMin: number;
    sunriseHour: number;
    sunriseMin: number;
    sunsetHour: number;
    sunsetMin: number;
    solarNoonHour: number;
    solarNoonMin: number;
    brahmaMuhurtaDesc: string;  // e.g. "4:36 AM (Sunrise 6:12 AM − 96 min)"
    dinnerDeadlineHour: number; // sunset + 2hr
    dinnerDeadlineMin: number;
    sleepHour: number;          // sunset + 3-4hr
    sleepMin: number;
}

export interface FoodRecommendation {
    vegetarian: string[];
    nonVegAlternative: string[];
    avoid: string[];
    ayurvedicNote: string;
    vegetarianLabel: string; // region-specific framing
}

export interface DinacharyaOverlay {
    [habitId: string]: string; // climate/season note for this habit
}

// ─── 1. GPS Permission & Location ────────────────────────────────────────────

export async function requestLocation(): Promise<{ lat: number; lon: number } | null> {
    try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return null;
        const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
        });
        return { lat: loc.coords.latitude, lon: loc.coords.longitude };
    } catch {
        return null;
    }
}

// ─── 2. Climate Zone Detection ────────────────────────────────────────────────

export function getClimateZone(lat: number, lon: number, month: number): ClimateZone {
    const absLat = Math.abs(lat);

    // Polar
    if (absLat > 60) return 'polar';

    // Tropical (0–23.5°)
    if (absLat <= 23.5) {
        // Check if it's arid (Middle East, Sahara, Rajasthan, SW USA, outback)
        const isArid =
            (lat >= 15 && lat <= 35 && lon >= 30 && lon <= 65) ||  // Middle East
            (lat >= 20 && lat <= 35 && lon >= -15 && lon <= 30) ||  // North Africa
            (lat >= 24 && lat <= 37 && lon >= -120 && lon <= -105) || // SW USA
            (lat >= -35 && lat <= -20 && lon >= 115 && lon <= 135);   // Outback AU
        if (isArid) return 'arid';
        return 'tropical';
    }

    // Polar-adjacent continental (23.5–60°)
    if (absLat > 45 && absLat <= 60) {
        // Nordic/Northern Europe
        if (lat > 45 && lon > -10 && lon < 35) return 'continental';
        // Siberia, central Canaad, Mongolia
        if (lon > 60 && lon < 145 && lat > 50) return 'continental';
        if (lon < -90 && lat > 50) return 'continental';
    }

    // Mediterranean (Southern Europe, North Africa coast, California, parts Chile/SA)
    const isMed =
        (lat >= 28 && lat <= 47 && lon >= -10 && lon <= 40 && month >= 3 && month <= 10) || // Med basin
        (lat >= 32 && lat <= 42 && lon >= -125 && lon <= -115) || // California
        (lat >= -38 && lat <= -28 && lon >= -75 && lon <= -65);   // Central Chile
    if (isMed) return 'mediterranean';

    // Arid (hot deserts in temperate band)
    const isAridTemp =
        (lat >= 28 && lat <= 40 && lon >= 30 && lon <= 65) || // Central Middle East
        (lat >= 28 && lat <= 40 && lon >= -120 && lon <= -105); // Nevada, Arizona
    if (isAridTemp) return 'arid';

    // Humid subtropical (southeast USA, southern China, coastal West Africa, SE Brazil)
    const isHumidSubtropical =
        (lat >= 22 && lat <= 35 && lon >= 100 && lon <= 125) || // Southern China
        (lat >= 25 && lat <= 38 && lon >= -90 && lon <= -70) ||  // SE USA
        (lat >= -30 && lat <= -15 && lon >= -55 && lon <= -35);  // SE Brazil
    if (isHumidSubtropical) return 'humid_subtropical';

    return 'temperate';
}

// ─── 3. Ayurvedic Season (Ritucharya) ────────────────────────────────────────

export function getAyurvedicSeason(lat: number, month: number): RituSeason {
    const isNorthern = lat >= 0;

    // Tropical zone — use monsoon calendar
    if (Math.abs(lat) <= 23.5) {
        if (month >= 3 && month <= 5) return 'Grishma';  // Pre-monsoon / hot
        if (month >= 6 && month <= 9) return 'Varsha';   // Monsoon
        if (month >= 10 && month <= 11) return 'Sharad'; // Post-monsoon
        return 'Hemanta';                                  // Mild winter (Dec-Feb)
    }

    if (isNorthern) {
        if (month === 1 || month === 2) return 'Shishira';
        if (month === 3 || month === 4) return 'Vasanta';
        if (month === 5 || month === 6) return 'Grishma';
        if (month === 7 || month === 8) return 'Varsha';
        if (month === 9 || month === 10) return 'Sharad';
        return 'Hemanta'; // Nov–Dec
    } else {
        // Southern hemisphere — reversed
        if (month === 7 || month === 8) return 'Shishira';
        if (month === 9 || month === 10) return 'Vasanta';
        if (month === 11 || month === 12) return 'Grishma';
        if (month === 1 || month === 2) return 'Varsha';
        if (month === 3 || month === 4) return 'Sharad';
        return 'Hemanta'; // May–Jun
    }
}

// ─── 4. Cultural Region ───────────────────────────────────────────────────────

export function getCulturalRegion(lat: number, lon: number): CulturalRegion {
    // India / South Asia
    if (lat >= 8 && lat <= 37 && lon >= 68 && lon <= 97) return 'India';
    // Nordic
    if (lat >= 55 && lon >= -25 && lon <= 35) return 'Nordic';
    // Western Europe
    if (lat >= 36 && lat <= 71 && lon >= -10 && lon <= 25) return 'WesternEurope';
    // East Asia (China, Japan, Korea)
    if (lat >= 18 && lat <= 53 && lon >= 100 && lon <= 145) return 'EastAsia';
    // Southeast Asia
    if (lat >= -10 && lat <= 25 && lon >= 95 && lon <= 140) return 'SoutheastAsia';
    // Middle East / North Africa
    if (lat >= 15 && lat <= 40 && lon >= 25 && lon <= 65) return 'MiddleEast';
    // Sub-Saharan Africa
    if (lat >= -35 && lat <= 15 && lon >= -20 && lon <= 50) return 'SubSaharan';
    // USA / Canaad
    if (lat >= 24 && lat <= 72 && lon >= -170 && lon <= -52) return 'USA_Canaad';
    // Latin America
    if (lat >= -55 && lat <= 32 && lon >= -120 && lon <= -34) return 'LatinAmerica';

    return 'Other';
}

// ─── 5. Brahma Muhurta Calculation ───────────────────────────────────────────

function decimalToHM(dec: number): { h: number; m: number } {
    const total = Math.round(dec * 60);
    return { h: Math.floor(total / 60) % 24, m: total % 60 };
}

function fmtTime(h: number, m: number): string {
    const p = h >= 12 ? 'PM' : 'AM';
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${h12}:${String(m).padStart(2, '0')} ${p}`;
}

export function getBrahmaMuhurtaResult(lat: number, lon: number): BrahmaMuhurtaResult {
    const solar = getSolarTimes(lat, lon);

    // Brahma Muhurta = sunrise - 96 minutes
    let bmDecimal = solar.sunrise - (96 / 60);

    // Polar latitude correction: if sunrise > 8 AM, apply 7:00 AM ceiling
    const isPolar = Math.abs(lat) > 60;
    if (isPolar && solar.sunrise > 8) {
        bmDecimal = 7.0; // ceiling for extreme winter polar night
    }

    // Clamp: never before 4:30 AM, never after 7:00 AM
    bmDecimal = Math.max(4.5, Math.min(7.0, bmDecimal));

    const bm = decimalToHM(bmDecimal);
    const sr = decimalToHM(solar.sunrise);
    const ss = decimalToHM(solar.sunset);
    const sn = decimalToHM(solar.solarNoon);

    // Dinner deadline = sunset + 2 hours
    const dinnerDecimal = Math.min(solar.sunset + 2, 22); // never past 10PM
    const dinner = decimalToHM(dinnerDecimal);

    // Ideal sleep = sunset + 3.5 hours, clamped 9PM–11PM
    const sleepDecimal = Math.max(21, Math.min(23, solar.sunset + 3.5));
    const sleep = decimalToHM(sleepDecimal);

    return {
        wakeHour: bm.h,
        wakeMin: bm.m,
        sunriseHour: sr.h,
        sunriseMin: sr.m,
        sunsetHour: ss.h,
        sunsetMin: ss.m,
        solarNoonHour: sn.h,
        solarNoonMin: sn.m,
        brahmaMuhurtaDesc: `${fmtTime(bm.h, bm.m)} — Sunrise ${fmtTime(sr.h, sr.m)} · ${isPolar ? 'Polar adjustment applied' : '96 min before sunrise'}`,
        dinnerDeadlineHour: dinner.h,
        dinnerDeadlineMin: dinner.m,
        sleepHour: sleep.h,
        sleepMin: sleep.m,
    };
}

// ─── 6. Season Dosha Risk ─────────────────────────────────────────────────────

export function getSeasonDoshaRisk(season: RituSeason, zone: ClimateZone): string {
    const risks: Record<RituSeason, string> = {
        Shishira: 'Vata-Kapha (cold, dry, heavy)',
        Vasanta: 'Kapha releasing (spring heaviness)',
        Grishma: 'Pitta (summer heat, dehydration)',
        Varsha: 'Vata (rains → instability, weak Agni)',
        Sharad: 'Pitta (post-monsoon heat, Pitta peak)',
        Hemanta: 'Kapha (cold, damp, heaviness)',
    };
    return risks[season] ?? 'Vata';
}

// ─── 7. Climate Zone Labels ───────────────────────────────────────────────────

export const CLIMATE_LABELS: Record<ClimateZone, string> = {
    tropical: 'Tropical · Pitta dominant year-round',
    arid: 'Arid/Desert · Vata-Pitta dominant',
    temperate: 'Temperate · Seasonal dosha rotation',
    continental: 'Continental · Vata dominant',
    polar: 'Subarctic/Polar · Vata-Kapha extreme',
    mediterranean: 'Mediterranean · Pitta-Kapha balanced',
    humid_subtropical: 'Humid Subtropical · Pitta-Kapha dominant',
};

export const SEASON_LABELS: Record<RituSeason, { label: string; emoji: string; note: string }> = {
    Shishira: { label: 'Shishira (Late Winter)', emoji: '❄️', note: 'Warm, nourishing, oily foods. Reduce cold exposure.' },
    Vasanta: { label: 'Vasanta (Spring)', emoji: '🌸', note: 'Light foods to release accumulated Kapha. Move vigorously.' },
    Grishma: { label: 'Grishma (Summer)', emoji: '☀️', note: 'Cooling, sweet, liquid foods. Avoid intense midday sun.' },
    Varsha: { label: 'Varsha (Monsoon)', emoji: '🌧️', note: 'Agni is weak. Light, easily digestible, warm foods only.' },
    Sharad: { label: 'Sharad (Autumn)', emoji: '🍂', note: 'Pitta peak. Cooling, bitter tastes. Ideal for detox.' },
    Hemanta: { label: 'Hemanta (Early Winter)', emoji: '🍃', note: 'Strong Agni. Eat larger warming meals. Abhyanga daily.' },
};

// ─── 8. Food Recommendations by Region ───────────────────────────────────────

export function getFoodRecommendations(
    region: CulturalRegion,
    zone: ClimateZone,
    season: RituSeason,
    prakriti: string,
    meal: 'breakfast' | 'lunch' | 'dinner',
): FoodRecommendation {
    const pk = prakriti.toLowerCase();
    const isVata = pk.includes('vata');
    const isPitta = pk.includes('pitta');
    const isKapha = pk.includes('kapha');

    const vegLabel = region === 'MiddleEast' ? 'Plant-rich option'
        : region === 'USA_Canaad' ? 'Sattvic (light, clear, energising)'
            : region === 'WesternEurope' ? 'Plant-forward'
                : 'Vegetarian (recommended)';

    // Breakfast
    if (meal === 'breakfast') {
        const baseVeg: Record<CulturalRegion, string[]> = {
            India: ['Moong dal khichdi', 'Rice kanji (congee)', 'Steamed idli with sambar', 'Warm oats with ghee and dates'],
            WesternEurope: ['Warm oat porridge with ginger and cinnamon', 'Spelt toast with avocado', 'Warm lentil soup'],
            USA_Canaad: ['Warm oatmeal with cinnamon and honey', 'Scrambled eggs with turmeric', 'Quinoa porridge with ghee'],
            EastAsia: ['Warm rice congee (kayu)', 'Miso soup with tofu', 'Steamed bao with vegetables'],
            MiddleEast: ['Za\'atar flatbread with olive oil', 'Lentil soup', 'Warm hummus with herbs'],
            LatinAmerica: ['Warm corn tortillas with black beans', 'Plantain with ghee', 'Oat atole'],
            SubSaharan: ['Millet porridge with ginger', 'Warm groundnut soup', 'Moringa leaf tea with warm flatbread'],
            Nordic: ['Warm rye porridge with cardamom', 'Root vegetable soup', 'Oat barley with flaxseed'],
            SoutheastAsia: ['Warm rice congee with ginger', 'Vegetable rice soup', 'Coconut milk with steamed greens'],
            Other: ['Warm grain porridge', 'Seasonal cooked vegetables', 'Herbal tea with light flatbread'],
        };
        const nonVeg: Record<CulturalRegion, string[]> = {
            India: ['Boiled egg dosa', 'Chicken rasam (light broth)'],
            WesternEurope: ['Soft-boiled egg with rye bread', 'Smoked salmon (light non-veg)'],
            USA_Canaad: ['Turkey sausage with oats', 'Egg white omelette with turmeric'],
            EastAsia: ['Steamed egg custard', 'Warm chicken congee'],
            MiddleEast: ['Eggs with za\'atar (halal)', 'Labneh with warm bread'],
            LatinAmerica: ['Egg scramble with corn tortilla', 'Chicken tamale (light)'],
            SubSaharan: ['Boiled egg with millet', 'Fish broth with greens'],
            Nordic: ['Soft-boiled egg', 'Smoked fish (Sattvic-adjacent in cold climate)'],
            SoutheastAsia: ['Soft-boiled egg with rice congee', 'Fish soup (Sattvic-adjacent)'],
            Other: ['Soft-boiled egg', 'Light fish broth'],
        };
        const avoid = isKapha
            ? ['Cold cereal', 'Cold smoothies', 'Cold juice', 'Heavy sweets', 'Yoghurt', 'Cheese']
            : isVata
                ? ['Dry crackers', 'Raw salads', 'Cold food', 'Coffee on empty stomach']
                : ['Spicy food', 'Fried items', 'Excess salt', 'Fermented food'];

        return {
            vegetarian: baseVeg[region] ?? baseVeg.Other,
            nonVegAlternative: nonVeg[region] ?? nonVeg.Other,
            avoid,
            ayurvedicNote: `${SEASON_LABELS[season].emoji} ${SEASON_LABELS[season].note} · Kapha time — keep breakfast warm and light.`,
            vegetarianLabel: vegLabel,
        };
    }

    // Lunch
    if (meal === 'lunch') {
        const baseVeg: Record<CulturalRegion, string[]> = {
            India: ['Dal + rice + sabzi + ghee + salad', 'Rajma chawal', 'Sambar rice with papad', 'Lauki (bottle gourd) curry'],
            WesternEurope: ['Lentil stew with root vegetables', 'Chickpea and spinach curry', 'Barley soup with herbs'],
            USA_Canaad: ['Black bean bowl with quinoa', 'Sweet potato curry', 'Lentil soup with avocado'],
            EastAsia: ['Miso tofu rice bowl', 'Vegetable noodle broth', 'Daikon and seaweed salad with warm rice'],
            MiddleEast: ['Lentil with rice (Mujaddara)', 'Chickpea stew with za\'atar', 'Hummus with flatbread and vegetables'],
            LatinAmerica: ['Black beans with rice and plantain', 'Corn and vegetable soup', 'Avocado salad with quinoa'],
            SubSaharan: ['Lentil and groundnut stew with millet', 'Okra with yam', 'Moringa leaf stew with sorghum'],
            Nordic: ['Root vegetable soup with rye bread', 'Pea and barley stew', 'Beet salad with lentils'],
            SoutheastAsia: ['Coconut vegetable curry with rice', 'Tofu and vegetable stir-fry', 'Tom kha soup (coconut-based)'],
            Other: ['Lentil and vegetable stew', 'Grain bowl with seasonal vegetables', 'Bean soup with flatbread'],
        };
        const nonVeg: Record<CulturalRegion, string[]> = {
            India: ['Chicken curry (light gravy)', 'Fish curry with rice'],
            WesternEurope: ['Grilled chicken salad', 'Baked salmon with root vegetables'],
            USA_Canaad: ['Grilled turkey breast with quinoa', 'Salmon with sweet potato'],
            EastAsia: ['Steamed fish with rice', 'Chicken and vegetable broth'],
            MiddleEast: ['Grilled halal chicken with rice', 'Lamb with lentils (light)'],
            LatinAmerica: ['Grilled chicken with rice and beans', 'Fish with plantain'],
            SubSaharan: ['Grilled fish with groundnut stew', 'Chicken with millet'],
            Nordic: ['Baked salmon with root vegetables', 'Poached fish with rye'],
            SoutheastAsia: ['Steamed fish with rice', 'Chicken soup with coconut milk'],
            Other: ['Grilled chicken with grain salad', 'Baked fish with vegetables'],
        };
        return {
            vegetarian: baseVeg[region] ?? baseVeg.Other,
            nonVegAlternative: nonVeg[region] ?? nonVeg.Other,
            avoid: ['Cold drinks during meal', 'Dessert immediately after', 'Raw onion and garlic in excess', zone === 'tropical' ? 'Fried heavy foods' : 'Excessively cold food'],
            ayurvedicNote: `🔥 Pitta peak — Agni is strongest now. This is your largest meal of the day. Eat warm, seated, without screens.`,
            vegetarianLabel: vegLabel,
        };
    }

    // Dinner
    const baseVeg: Record<CulturalRegion, string[]> = {
        India: ['Khichdi with ghee', 'Moong dal soup', 'Vegetable soup + chapati', 'Light dalia'],
        WesternEurope: ['Vegetable soup with rye bread', 'Lentil broth', 'Steamed vegetables with olive oil'],
        USA_Canaad: ['Warm lentil soup', 'Vegetable broth with quinoa', 'Sweet potato and bean soup'],
        EastAsia: ['Warm miso soup with tofu and rice', 'Light vegetable broth', 'Steamed greens with sesame'],
        MiddleEast: ['Lentil soup with lemon', 'Vegetable broth with herbs', 'Warm flatbread with za\'atar'],
        LatinAmerica: ['Black bean soup', 'Corn tortilla with avocado', 'Warm vegetable stew'],
        SubSaharan: ['Light millet porridge', 'Moringa leaf soup', 'Groundnut broth with yam'],
        Nordic: ['Root vegetable soup', 'Pea soup with rye', 'Warm cereal grain with seeds'],
        SoutheastAsia: ['Light rice congee', 'Coconut vegetable soup', 'Steamed greens with rice'],
        Other: ['Light vegetable soup', 'Grain porridge', 'Warm broth with bread'],
    };
    const nonVeg: Record<CulturalRegion, string[]> = {
        India: ['Light chicken broth', 'Egg curry (half portion)'],
        WesternEurope: ['Light chicken soup', 'Small portion of baked fish'],
        USA_Canaad: ['Light turkey soup', 'Small salmon fillet'],
        EastAsia: ['Clear fish broth', 'Steamed chicken with ginger'],
        MiddleEast: ['Light lamb broth', 'Grilled chicken (small, halal)'],
        LatinAmerica: ['Light fish stew', 'Chicken broth with vegetables'],
        SubSaharan: ['Light fish broth', 'Small chicken portion with vegetables'],
        Nordic: ['Light fish soup', 'Poached salmon with vegetables'],
        SoutheastAsia: ['Clear chicken soup', 'Light fish broth with vegetables'],
        Other: ['Light chicken broth', 'Steamed fish with vegetables'],
    };
    return {
        vegetarian: baseVeg[region] ?? baseVeg.Other,
        nonVegAlternative: nonVeg[region] ?? nonVeg.Other,
        avoid: ['Heavy proteins', 'Fried food', 'Raw salads', 'Cold desserts', 'Excess sugar', zone === 'tropical' ? 'Any meal after 8 PM' : 'Heavy meals after 7 PM'],
        ayurvedicNote: `🌙 Kapha evening — Agni is weakest now. Keep dinner at 50% of lunch volume. Eat at least 2 hours before sleep.`,
        vegetarianLabel: vegLabel,
    };
}

// ─── 9. Dinacharya Overlay by Climate + Season ────────────────────────────────

export function getDinacharyaOverlay(
    zone: ClimateZone,
    season: RituSeason,
    prakriti: string,
): DinacharyaOverlay {
    const pk = prakriti.toLowerCase();
    const isVata = pk.includes('vata');
    const isKapha = pk.includes('kapha');

    const overlay: DinacharyaOverlay = {};

    // warm_water — adjust by climate
    if (zone === 'tropical' || zone === 'mediterranean') {
        overlay.warm_water = '🌴 Tropical: plain warm water or with lemon. Skip ginger in hot months.';
    } else if (zone === 'polar' || zone === 'continental') {
        overlay.warm_water = '❄️ Cold climate: add dry ginger + honey to warm water — kindles Agni in cold.';
    } else if (zone === 'arid') {
        overlay.warm_water = '🏜️ Arid climate: add a pinch of rock salt + lemon — replenish electrolytes lost in dry heat.';
    }

    // abhyanga — oil type by climate
    if (zone === 'tropical' || zone === 'humid_subtropical') {
        overlay.abhyanga = `🌴 Hot climate: use coconut oil (cooling Virya). ${isKapha ? 'Prefer dry Garshana brush massage instead.' : '3×/week is enough.'}`;
    } else if (zone === 'polar' || zone === 'continental') {
        overlay.abhyanga = `❄️ Cold climate: sesame oil daily — Vata pacifying, warming. ${isVata ? 'Do not skip — essential for you.' : 'Extra warming in winter months.'}`;
    }

    // meditation — environment note
    if (zone === 'polar') {
        overlay.meditation = '🌄 Polar climate: sit near window for natural light therapy — combats winter darkness at Brahma Muhurta.';
    } else if (zone === 'tropical') {
        overlay.meditation = '🌴 Tropical: meditate before 6 AM — heat builds fast and disturbs concentration after sunrise.';
    }

    // breakfast — seasonal adjustment
    if (season === 'Varsha') {
        overlay.breakfast = `🌧️ Varsha (Monsoon): Agni is weakest now. Eat only warm, lightly spiced food. Avoid raw vegetables, cold food, and curd.`;
    } else if (season === 'Grishma') {
        overlay.breakfast = `☀️ Grishma (Summer): Keep breakfast cool and light. Choose coconut water, sweet fruit, and light grains.`;
    } else if (season === 'Vasanta') {
        overlay.breakfast = `🌸 Vasanta (Spring): Kapha is releasing. Eat lighter than usual — barley, millet, ginger tea. Avoid heavy, sweet, oily food.`;
    } else if (season === 'Hemanta' || season === 'Shishira') {
        overlay.breakfast = `❄️ Hemanta/Shishira (Winter): Agni is strong now. Warm, nourishing, slightly heavier breakfast is beneficial.`;
    }

    // sunlight
    if (zone === 'polar') {
        overlay.sunlight = '🌅 Polar: In winter, use a SAD lamp (10,000 lux) for 20 min — equivalent to outdoor sunlight exposure. Go outside on clear days.';
    } else if (zone === 'tropical' || zone === 'arid') {
        overlay.sunlight = '☀️ Hot climate: Get sunlight before 7:30 AM only. Full midday sun aggravates Pitta — stay in shade 10AM–4PM.';
    }

    // dinner
    if (zone === 'arid') {
        overlay.dinner = '🏜️ Arid climate: Dinner can be slightly heavier than other climates — compensates for daytime Vata-Pitta depletion from dry heat.';
    } else if (zone === 'humid_subtropical') {
        overlay.dinner = '🌡️ Humid subtropical: Agni weakest here. Dinner must be very light and completed by 7 PM — any later risks Ama formation in this climate.';
    }

    return overlay;
}

// ─── 10. Build Full Location Profile ─────────────────────────────────────────

export function buildLocationProfile(lat: number, lon: number): LocationProfile {
    const month = new Date().getMonth() + 1;
    return {
        lat,
        lon,
        climateZone: getClimateZone(lat, lon, month),
        culturalRegion: getCulturalRegion(lat, lon),
        hemisphere: lat >= 0 ? 'northern' : 'southern',
        capturedAt: Date.now(),
    };
}

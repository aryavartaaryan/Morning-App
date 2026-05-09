/**
 * Shared Alarm Audio Core
 *
 * Extracted verbatim from the working alarm-ringing.tsx audio logic.
 * Used by habit-alarm-ringing.tsx (habit alarms + quick alarms) so all
 * alarm types share the exact same battle-tested audio path.
 *
 * DO NOT modify alarm-ringing.tsx — it has its own inline copy which
 * is intentionally kept separate to avoid any regression risk.
 */

import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { getLocalMantraPath } from './mantraDownload';
import { WAKE_SOUNDS } from './missionAlarm';
import { setNativeAlarmVolume } from './nativeAlarm';

/** Holds the active volume-ramp interval so it can be cancelled on stop. */
let _rampInterval: ReturnType<typeof setInterval> | null = null;

/** Cancel any in-progress volume ramp without stopping the sound. */
export function cancelVolumeRamp(): void {
  if (_rampInterval !== null) {
    clearInterval(_rampInterval);
    _rampInterval = null;
  }
}

const BUNDLED_MANTRA_ASSETS: Record<string, any> = {
  bhagya_suktam:        require('../assets/sounds/bhagya-suktam.mp3'),
  shiv_sankalpa_suktam: require('../assets/sounds/shiv-sankalpa-suktam.mp3'),
};

/**
 * Stop and unload the currently playing alarm audio.
 * Safe to call even if no sound is loaded.
 */
export async function stopAlarmAudio(soundRef: { current: Audio.Sound | null }): Promise<void> {
  try {
    if (soundRef.current) {
      await soundRef.current.stopAsync();
      await soundRef.current.unloadAsync();
      soundRef.current = null;
    }
  } catch { /* ignore */ }
}

/**
 * Resolve the mantra asset/URI, configure the audio session, and start
 * looping playback — exactly the same steps as the working morning alarm.
 *
 * @param soundRef   Ref that will hold the active Audio.Sound instance.
 * @param mantraId   ID such as 'gayatri', 'lalitha', 'bhagya_suktam', etc.
 * @param startDucked  If true, start at 6 % volume (for Bodhi speech ducking).
 */
export async function playAlarmAudio(
  soundRef: { current: Audio.Sound | null },
  mantraId: string,
  startDucked = false,
): Promise<void> {
  await stopAlarmAudio(soundRef);
  // Silence native AlarmSoundService MediaPlayer if it happens to be running.
  // For habit/quick alarms the native service is not active, so this is a no-op.
  await setNativeAlarmVolume(0).catch(() => {});

  const wakeSound = WAKE_SOUNDS.find(s => s.id === mantraId) ?? WAKE_SOUNDS[0];
  const bundledAsset = BUNDLED_MANTRA_ASSETS[mantraId];
  const localPath = getLocalMantraPath(mantraId);
  const localInfo = await FileSystem.getInfoAsync(localPath).catch(() => ({ exists: false }));
  const audioSrc: string | null = bundledAsset ? null
    : (localInfo as any).exists ? (localInfo as any).uri
    : (wakeSound.audioUrl ?? null);

  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      shouldDuckAndroid: false,
      interruptionModeIOS: 1,
      interruptionModeAndroid: 1,
    });
    const source = bundledAsset ?? (audioSrc ? { uri: audioSrc } : require('../assets/sounds/mantra_alarm.wav'));
    const { sound } = await Audio.Sound.createAsync(
      source,
      { shouldPlay: true, isLooping: true, volume: startDucked ? 0.06 : 1.0 },
    );
    soundRef.current = sound;
  } catch {
    try {
      const { sound } = await Audio.Sound.createAsync(
        require('../assets/sounds/mantra_alarm.wav'),
        { shouldPlay: true, isLooping: true, volume: startDucked ? 0.06 : 1.0 },
      );
      soundRef.current = sound;
    } catch (e2) { console.warn('[AlarmAudio] Wake audio fallback error:', e2); }
  }
}

/**
 * Gentle-wake variant of playAlarmAudio.
 *
 * Starts the chosen sound at GENTLE_START_VOL (5 %) and increments the
 * volume every STEP_INTERVAL_MS until it reaches 1.0 — exactly like
 * Sleep Cycle / Gentle Alarm.  The ramp is cancelled automatically once
 * full volume is reached, or when stopAlarmAudio() is called.
 *
 * @param soundRef       Ref that will hold the active Audio.Sound instance.
 * @param mantraId       Sound ID from WAKE_SOUNDS.
 * @param rampMinutes    How many minutes to take to go from ~5 % → 100 %.
 *                       Clamped to 1–15. Default: 5.
 */
const GENTLE_START_VOL = 0.05;
const STEP_INTERVAL_MS = 5_000; // update volume every 5 seconds

export async function playGentleAlarmAudio(
  soundRef: { current: Audio.Sound | null },
  mantraId: string,
  rampMinutes = 5,
): Promise<void> {
  cancelVolumeRamp();
  await stopAlarmAudio(soundRef);
  await setNativeAlarmVolume(0).catch(() => {});

  const wakeSound = WAKE_SOUNDS.find(s => s.id === mantraId) ?? WAKE_SOUNDS[0];
  const bundledAsset = wakeSound.bundledAsset ?? (wakeSound.bundledKey ? BUNDLED_MANTRA_ASSETS[wakeSound.bundledKey] : null);
  const localPath = getLocalMantraPath(mantraId);
  const localInfo = await FileSystem.getInfoAsync(localPath).catch(() => ({ exists: false }));
  const audioSrc: string | null = bundledAsset ? null
    : (localInfo as any).exists ? (localInfo as any).uri
    : (wakeSound.audioUrl || null);

  let sound: Audio.Sound | null = null;
  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      shouldDuckAndroid: false,
      interruptionModeIOS: 1,
      interruptionModeAndroid: 1,
    });
    const source = bundledAsset ?? (audioSrc ? { uri: audioSrc } : require('../assets/sounds/mantra_alarm.wav'));
    const created = await Audio.Sound.createAsync(
      source,
      { shouldPlay: true, isLooping: true, volume: GENTLE_START_VOL },
    );
    sound = created.sound;
  } catch {
    try {
      const created = await Audio.Sound.createAsync(
        require('../assets/sounds/mantra_alarm.wav'),
        { shouldPlay: true, isLooping: true, volume: GENTLE_START_VOL },
      );
      sound = created.sound;
    } catch (e2) {
      console.warn('[AlarmAudio] Gentle wake fallback error:', e2);
      return;
    }
  }

  soundRef.current = sound;

  // ── Volume ramp ─────────────────────────────────────────────────────────
  const clampedMinutes = Math.max(1, Math.min(15, rampMinutes));
  const totalSteps = Math.ceil((clampedMinutes * 60 * 1000) / STEP_INTERVAL_MS);
  const volStep = (1.0 - GENTLE_START_VOL) / totalSteps;
  let currentVol = GENTLE_START_VOL;
  let steps = 0;

  _rampInterval = setInterval(async () => {
    if (!soundRef.current) { cancelVolumeRamp(); return; }
    steps += 1;
    currentVol = Math.min(1.0, GENTLE_START_VOL + volStep * steps);
    try {
      await soundRef.current.setVolumeAsync(currentVol);
    } catch { /* sound may have been unloaded */ }
    if (currentVol >= 1.0) {
      cancelVolumeRamp();
    }
  }, STEP_INTERVAL_MS);
}

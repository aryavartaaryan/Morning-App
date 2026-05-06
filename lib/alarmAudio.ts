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

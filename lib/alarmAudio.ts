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

/** Holds the Fusion phase-transition timer. */
let _fusionPhaseTimer: ReturnType<typeof setTimeout> | null = null;
/** Holds the Fusion gentle-ramp interval (independent of phase timer). */
let _fusionRampInterval: ReturnType<typeof setInterval> | null = null;

// ── Global alarm preemption ──────────────────────────────────────────────────
/** Tracks the active alarm screen's soundRef so a new alarm can preempt it. */
let _activeAlarmSoundRef: { current: Audio.Sound | null } | null = null;

/** Register the active alarm screen's soundRef. Call before starting playback. */
export function setActiveAlarmSoundRef(ref: { current: Audio.Sound | null }): void {
  _activeAlarmSoundRef = ref;
}

/**
 * Stop whichever alarm is currently playing globally.
 * Called automatically at the start of every alarm play function so that
 * two alarms never play simultaneously.
 */
export async function preemptActiveAlarm(): Promise<void> {
  cancelVolumeRamp();
  cancelFusion();
  if (_activeAlarmSoundRef) {
    try {
      if (_activeAlarmSoundRef.current) {
        await _activeAlarmSoundRef.current.stopAsync();
        await _activeAlarmSoundRef.current.unloadAsync();
        _activeAlarmSoundRef.current = null;
      }
    } catch { /* ignore */ }
    _activeAlarmSoundRef = null;
  }
}

// ── Preview preemption ───────────────────────────────────────────────────────
/** Registered by alarms.tsx / settings.tsx so alarm screens can stop the preview. */
let _previewStopper: (() => Promise<void>) | null = null;

/**
 * Register (or unregister by passing null) the active settings/alarms tab's
 * stopPreview function so that a firing alarm can silence it immediately.
 */
export function registerPreviewStopper(fn: (() => Promise<void>) | null): void {
  _previewStopper = fn;
}

/** Called by alarm screens to silence any active sound preview. */
export async function stopActivePreview(): Promise<void> {
  if (_previewStopper) {
    await _previewStopper().catch(() => {});
  }
}

/** Cancel any in-progress volume ramp without stopping the sound. */
export function cancelVolumeRamp(): void {
  if (_rampInterval !== null) {
    clearInterval(_rampInterval);
    _rampInterval = null;
  }
}

/** Cancel any active Fusion sequence timers (does NOT stop the sound). */
export function cancelFusion(): void {
  if (_fusionPhaseTimer !== null) { clearTimeout(_fusionPhaseTimer); _fusionPhaseTimer = null; }
  if (_fusionRampInterval !== null) { clearInterval(_fusionRampInterval); _fusionRampInterval = null; }
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
  cancelVolumeRamp();
  cancelFusion();
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
  await preemptActiveAlarm();
  await stopActivePreview();
  setActiveAlarmSoundRef(soundRef);
  await stopAlarmAudio(soundRef);
  // Silence native AlarmSoundService MediaPlayer if it happens to be running.
  // For habit/quick alarms the native service is not active, so this is a no-op.
  await setNativeAlarmVolume(0).catch(() => {});

  const wakeSound = WAKE_SOUNDS.find(s => s.id === mantraId) ?? WAKE_SOUNDS[0];
  const bundledAsset = wakeSound.bundledAsset ?? BUNDLED_MANTRA_ASSETS[mantraId];
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

/** Smoothly fade a Sound's volume from `fromVol` to `toVol` over `durationMs`. */
async function fadeSound(sound: Audio.Sound, fromVol: number, toVol: number, durationMs: number): Promise<void> {
  const STEPS = 16;
  const stepMs = durationMs / STEPS;
  const diff = (toVol - fromVol) / STEPS;
  for (let i = 1; i <= STEPS; i++) {
    await new Promise<void>(r => setTimeout(r, stepMs));
    try { await sound.setVolumeAsync(Math.max(0, Math.min(1, fromVol + diff * i))); } catch { return; }
  }
}

/**
 * Fusion Wake — sequences 5 phases for the ultimate gently-style wake:
 *   Phase 0 · 90 s  : Nature (Breeze & Trees)
 *   Phase 1 · 90 s  : Morning Birds
 *   Phase 2 · 90 s  : Sitar
 *   Phase 3 · 90 s  : Selected Mantra
 *   Phase 4 · ∞     : Bansuri Flute (loops forever)
 *
 * Each phase fades in softly and cross-fades into the next.
 * If `gentle` is true the overall volume ramps from 5 % → 100 % across
 * the entire sequence, matching the Gently-app experience.
 */
export async function playFusionAlarm(
  soundRef: { current: Audio.Sound | null },
  mantraId: string,
  gentle = false,
  rampMinutes = 5,
): Promise<void> {
  await preemptActiveAlarm();
  await stopActivePreview();
  setActiveAlarmSoundRef(soundRef);
  cancelFusion();
  cancelVolumeRamp();

  // Clean up previous sound inline (avoid calling stopAlarmAudio which re-cancels fusion)
  try {
    if (soundRef.current) {
      await soundRef.current.stopAsync();
      await soundRef.current.unloadAsync();
      soundRef.current = null;
    }
  } catch { /* ignore */ }

  await setNativeAlarmVolume(0).catch(() => {});
  await Audio.setAudioModeAsync({
    playsInSilentModeIOS: true, staysActiveInBackground: true,
    shouldDuckAndroid: false, interruptionModeIOS: 1, interruptionModeAndroid: 1,
  });

  // Resolve mantra source for Phase 3
  const mantraWake = WAKE_SOUNDS.find(s => s.id === mantraId && s.id !== 'fusion') ?? WAKE_SOUNDS[0];
  const mantraSource = mantraWake.bundledAsset
    ?? BUNDLED_MANTRA_ASSETS[mantraId]
    ?? BUNDLED_MANTRA_ASSETS[mantraWake.bundledKey ?? '']
    ?? (mantraWake.audioUrl ? { uri: mantraWake.audioUrl } : null)
    ?? require('../assets/sounds/mantra_alarm.wav');

  const phases: Array<{ src: any; label: string }> = [
    { src: require('../assets/sounds/mixkit-breeze-through-the-trees-2427.m4a'), label: 'nature'  },
    { src: require('../assets/sounds/morning-birds-loop.m4a'),                  label: 'birds'   },
    { src: require('../assets/sounds/sitar-morning.m4a'),                        label: 'sitar'   },
    { src: mantraSource,                                                          label: 'mantra'  },
    { src: require('../assets/sounds/morning-flute.m4a'),                        label: 'flute'   },
  ];

  const PHASE_MS   = 90_000; // 90 seconds per phase
  const FADE_MS    = 4_000;  // 4-second cross-fade between phases
  const rampMs     = Math.max(1, Math.min(15, rampMinutes)) * 60_000;
  const gentleStart = Date.now();

  // Shared mutable volume — gentle ramp interval writes this, fade reads it
  let currentTargetVol = gentle ? GENTLE_START_VOL : 1.0;

  const getTargetVol = (): number => {
    if (!gentle) return 1.0;
    const progress = Math.min(1, (Date.now() - gentleStart) / rampMs);
    return GENTLE_START_VOL + (1.0 - GENTLE_START_VOL) * progress;
  };

  const playPhase = async (idx: number): Promise<void> => {
    if (idx >= phases.length) return;
    const isLast = idx === phases.length - 1;

    let sound: Audio.Sound | null = null;
    try {
      const { sound: s } = await Audio.Sound.createAsync(
        phases[idx].src,
        { shouldPlay: true, isLooping: true, volume: 0 },
      );
      sound = s;
      soundRef.current = sound;
    } catch (err) {
      console.warn(`[Fusion] Phase ${idx} (${phases[idx].label}) load error:`, err);
      if (!isLast) {
        _fusionPhaseTimer = setTimeout(() => playPhase(idx + 1), 500);
      }
      return;
    }

    // Fade in to current gentle target
    currentTargetVol = getTargetVol();
    await fadeSound(sound, 0, currentTargetVol, FADE_MS);

    if (!isLast) {
      _fusionPhaseTimer = setTimeout(async () => {
        const dying = soundRef.current;
        // Fade out then unload
        if (dying) {
          await fadeSound(dying, currentTargetVol, 0, FADE_MS);
          try { await dying.stopAsync(); await dying.unloadAsync(); } catch { /* ignore */ }
          if (soundRef.current === dying) soundRef.current = null;
        }
        await playPhase(idx + 1);
      }, PHASE_MS - FADE_MS);
    }
  };

  await playPhase(0);

  // Independent gentle ramp — keeps nudging volume up across all phases
  if (gentle) {
    _fusionRampInterval = setInterval(async () => {
      const vol = getTargetVol();
      currentTargetVol = vol;
      try {
        if (soundRef.current) await soundRef.current.setVolumeAsync(vol);
      } catch { /* ignore */ }
      if (vol >= 1.0) {
        if (_fusionRampInterval !== null) { clearInterval(_fusionRampInterval); _fusionRampInterval = null; }
      }
    }, STEP_INTERVAL_MS);
  }
}

export async function playGentleAlarmAudio(
  soundRef: { current: Audio.Sound | null },
  mantraId: string,
  rampMinutes = 5,
): Promise<void> {
  await preemptActiveAlarm();
  await stopActivePreview();
  setActiveAlarmSoundRef(soundRef);
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

import React, {
  createContext, useContext, useState, useRef,
  useCallback, useEffect, ReactNode,
} from 'react';
import { AppState, Animated } from 'react-native';
import { Audio } from 'expo-av';
import type { MoodKey } from '@/components/MoodSheet';
import { initAudioCache, resolveAudioUri } from './soundAudioCache';

export const MAX_MIX = 4;

// ── Session-level duration cache ────────────────────────────────────────────
// Populated the first time a track's real duration is decoded by expo-av.
// Survives reel open/close within the same app session so subsequent plays
// can show the real timer from frame 1 instead of a placeholder.
const _durationCache = new Map<string, number>();
export const getCachedDuration = (id: string): number | null => _durationCache.get(id) ?? null;

export type PlayableSoundMeta = {
  id: string;
  label: string;
  emoji: string;
  color: string;
  top: string;
  bot: string;
  desc: string;
  cat: string;
  src: any;
  imageUri?: string;
  imageBundled?: any;
};

type SoundPlayerCtx = {
  playingId: string | null;
  isPaused: boolean;
  sessionSecs: number;
  playingDurationSecs: number | null;
  playingMeta: PlayableSoundMeta | null;
  mixedSounds: PlayableSoundMeta[];
  playSound: (meta: PlayableSoundMeta, durationSecs: number, onStop?: () => void, trimLastSecs?: number, shouldLoop?: boolean) => Promise<void>;
  addToMix: (meta: PlayableSoundMeta) => Promise<void>;
  removeFromMix: (id: string) => Promise<void>;
  togglePause: () => Promise<void>;
  stopSound: (triggerCb?: boolean) => Promise<void>;
  changeTimer: (secs: number) => void;
  setLoopConfig: (shouldLoop: boolean, trimMs: number, totalSecs: number) => void;
  meteringAnim: Animated.Value;
  getMeteringLevel: () => number;
  isAudioLoading: boolean;
  audioNetworkError: boolean;
  preBufferSound: (meta: PlayableSoundMeta) => Promise<void>;
  cleanPreBuffer: () => Promise<void>;
  moodPhase: 'pre' | 'post' | 'result' | null;
  preMood: MoodKey | null;
  requestPlay: (meta: PlayableSoundMeta, durationSecs: number) => void;
  confirmMood: (key: MoodKey) => Promise<void>;
  skipMood: () => Promise<void>;
  dismissMoodSheet: () => void;
  showFullPlayer: boolean;
  openFullPlayer: () => void;
  closeFullPlayer: () => void;
  openReelsOrPlayer: () => void;
  registerReelsOpener: (fn: () => void) => void;
  unregisterReelsOpener: () => void;
  getPositionMs: () => number;
  seekTo: (positionMs: number) => Promise<void>;
};

const Ctx = createContext<SoundPlayerCtx | null>(null);

export function SoundPlayerProvider({ children }: { children: ReactNode }) {
  const [playingId, setPlayingId]             = useState<string | null>(null);
  const [isPaused, setIsPaused]               = useState(false);
  const [sessionSecs, setSessionSecs]         = useState(21 * 60);
  const [playingDurationSecs, setPlayingDurSecs] = useState<number | null>(null);
  const [playingMeta, setPlayingMeta]         = useState<PlayableSoundMeta | null>(null);
  const [mixedSounds, setMixedSounds]   = useState<PlayableSoundMeta[]>([]);
  const meteringAnimRef = useRef(new Animated.Value(0));
  const meteringRef = useRef(0);
  const positionMsRef = useRef(0);

  const [moodPhase, setMoodPhase]       = useState<'pre' | 'post' | 'result' | null>(null);
  const [preMood, setPreMood]           = useState<MoodKey | null>(null);
  const [showFullPlayer, setShowFullPlayer] = useState(false);
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [audioNetworkError, setAudioNetworkError] = useState(false);
  const networkErrorRef = useRef(false);
  const reelsOpenerRef = useRef<(() => void) | null>(null);

  const getPositionMs        = useCallback(() => positionMsRef.current, []);
  const openFullPlayer       = useCallback(() => setShowFullPlayer(true),  []);
  const closeFullPlayer      = useCallback(() => setShowFullPlayer(false), []);
  const openReelsOrPlayer    = useCallback(() => {
    if (reelsOpenerRef.current) reelsOpenerRef.current();
    else setShowFullPlayer(true);
  }, []);
  const registerReelsOpener  = useCallback((fn: () => void) => { reelsOpenerRef.current = fn; }, []);
  const unregisterReelsOpener = useCallback(() => { reelsOpenerRef.current = null; }, []);

  // Map of soundId -> Audio.Sound for all simultaneously playing sounds
  const mixRefs         = useRef<Map<string, Audio.Sound>>(new Map());
  // Pre-buffer pool: sounds loaded silently ahead of time so swipe = instant playAsync()
  const preBufferRef    = useRef<Map<string, Audio.Sound>>(new Map());
  const timerRef        = useRef<ReturnType<typeof setInterval> | null>(null);
  const heartbeatRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopCbRef       = useRef<(() => void) | null>(null);
  const stopFnRef       = useRef<(triggerCb?: boolean) => Promise<void>>(async () => {});
  const pendingMetaRef  = useRef<PlayableSoundMeta | null>(null);
  const pendingDurRef   = useRef<number>(21 * 60);
  const isPausedRef      = useRef(false);
  const mixedSoundsRef   = useRef<PlayableSoundMeta[]>([]);
  const heartbeatBusyRef = useRef(false);
  const restartingIdsRef = useRef<Set<string>>(new Set());
  // Epoch guard: incremented on every playSound call so that any in-flight
  // createAsync from a previous call can detect it is stale and self-discard.
  const playEpochRef = useRef(0);
  // Trim: ms to cut from the end of each sound loop (set by reel playback)
  const reelTrimMsRef = useRef(0);
  // Once-play mode: when true, stop instead of looping when track finishes
  const noLoopRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  const clearHeartbeat = useCallback(() => {
    if (heartbeatRef.current) { clearInterval(heartbeatRef.current); heartbeatRef.current = null; }
  }, []);

  // Create and start a single Audio.Sound, storing it in mixRefs.
  // epoch: when provided, the sound is discarded if a newer playSound call
  // has already started (prevents stale createAsync from bleeding audio).
  const loadAndPlay = useCallback(async (meta: PlayableSoundMeta, epoch?: number, trimLastMs: number = 0): Promise<Audio.Sound | null> => {
    try {
      // Resolve remote URI → local cached file if available;
      // otherwise stream from remote and download to cache in background.
      // Stream from remote URL — use cached local file only if one already exists
      // (user-initiated download from a previous session). Never download in background.
      let resolvedSrc = meta.src;
      if (resolvedSrc && typeof resolvedSrc === 'object' && typeof resolvedSrc.uri === 'string') {
        const localUri = resolveAudioUri(meta.id, resolvedSrc.uri);
        if (localUri !== resolvedSrc.uri) {
          // A locally cached file exists from a prior user-initiated download — use it
          resolvedSrc = { uri: localUri };
        }
        // Otherwise: stream directly from remoteUri — no background download
      }
      // ── Pre-buffer hit: instant play — no createAsync latency ───────────────
      let sound: Audio.Sound;
      const preBuffered = preBufferRef.current.get(meta.id);
      if (preBuffered) {
        preBufferRef.current.delete(meta.id);
        try {
          await preBuffered.setStatusAsync({
            isLooping: !noLoopRef.current, shouldPlay: !isPausedRef.current,
            volume: 1.0, progressUpdateIntervalMillis: 500,
          } as any);
          sound = preBuffered;
        } catch {
          try { await preBuffered.unloadAsync(); } catch {}
          const r = await Audio.Sound.createAsync(resolvedSrc, { isLooping: !noLoopRef.current, volume: 1.0, shouldPlay: !isPausedRef.current, progressUpdateIntervalMillis: 500 });
          sound = r.sound;
        }
      } else {
        const r = await Audio.Sound.createAsync(resolvedSrc, { isLooping: !noLoopRef.current, volume: 1.0, shouldPlay: !isPausedRef.current, progressUpdateIntervalMillis: 500 });
        sound = r.sound;
      }
      // Stale-epoch check: if a newer playSound displaced this one, discard.
      if (epoch !== undefined && epoch !== playEpochRef.current) {
        try { sound.setOnPlaybackStatusUpdate(null); } catch {}
        try { await sound.stopAsync(); await sound.unloadAsync(); } catch {}
        return null;
      }
      // Watchdog: expo-av isLooping can silently fail on M4A/certain codecs.
      // If the sound finishes instead of looping, restart it automatically.
      sound.setOnPlaybackStatusUpdate((status) => {
        // ── Outer try/catch is CRITICAL ─────────────────────────────────────────
        // This callback is invoked from native code. Any unhandled synchronous
        // throw (Android MediaPlayer IllegalStateException, metering math, etc.)
        // propagates to native and crashes the entire app. Swallow everything.
        try {
          if (!status.isLoaded) return;
          // Capture actual track duration once (first time it's available from decoder)
          if (status.durationMillis != null) {
            const durSecs = Math.round(status.durationMillis / 1000);
            // Persist to session cache so next play of this track shows real duration instantly
            _durationCache.set(meta.id, durSecs);
            setPlayingDurSecs(prev => prev ?? durSecs);
          }
          if (status.positionMillis != null) positionMsRef.current = status.positionMillis;
          // Audio-reactive metering: normalize dB to 0-1 with exponential smoothing
          if ((status as any).metering != null && !isPausedRef.current) {
            const raw = Math.max(0, Math.min(1, ((status as any).metering + 55) / 55));
            const smoothed = meteringRef.current * 0.38 + raw * 0.62;
            meteringRef.current = smoothed;
            Animated.timing(meteringAnimRef.current, { toValue: smoothed, duration: 80, useNativeDriver: true }).start();
          }
          // Trim: seek to start when within last trimLastMs of the track.
          // Skip in once-play mode — let the track play through fully.
          if (
            trimLastMs > 0 &&
            !isPausedRef.current &&
            !noLoopRef.current &&
            !restartingIdsRef.current.has(meta.id) &&
            mixRefs.current.has(meta.id) &&
            status.durationMillis != null &&
            status.durationMillis > 20000 &&
            status.positionMillis >= status.durationMillis - trimLastMs
          ) {
            restartingIdsRef.current.add(meta.id);
            sound.replayAsync()
              .catch(() => {
                if (!mixRefs.current.has(meta.id)) return;
                return sound.setPositionAsync(0).then(() => sound.playAsync()).catch(() => {});
              })
              .finally(() => { restartingIdsRef.current.delete(meta.id); });
            return;
          }
          // Only restart when the file explicitly finished (isLooping silently failed).
          // Guard with restartingIdsRef to prevent concurrent replayAsync storms
          // (heartbeat + this callback firing at the same loop boundary).
          if (!isPausedRef.current && status.didJustFinish) {
            if (noLoopRef.current) {
              // Once-play mode: stop cleanly when track ends naturally
              setTimeout(() => stopFnRef.current?.(true), 0);
              return;
            }
            if (!restartingIdsRef.current.has(meta.id) && mixRefs.current.has(meta.id)) {
              restartingIdsRef.current.add(meta.id);
              sound.replayAsync()
                .catch(() => {
                  if (!mixRefs.current.has(meta.id)) return;
                  return sound.setPositionAsync(0).then(() => sound.playAsync()).catch(() => {});
                })
                .finally(() => { restartingIdsRef.current.delete(meta.id); });
            }
          }
        } catch (cbErr) {
          console.warn('[SoundPlayer] playback status callback error (non-fatal):', cbErr);
        }
      });
      // Enable metering + ensure frequent updates for trim detection
      sound.setStatusAsync({ isMeteringEnabled: true } as any).catch(() => {});
      if (trimLastMs > 0) {
        sound.setStatusAsync({ progressUpdateIntervalMillis: 200 }).catch(() => {});
      }
      mixRefs.current.set(meta.id, sound);
      return sound;
    } catch (e) {
      const msg = String(e).toLowerCase();
      if (
        msg.includes('network') || msg.includes('unable to resolve') ||
        msg.includes('nsurlsession') || msg.includes('connection') ||
        msg.includes('could not connect') || msg.includes('timeout') ||
        msg.includes('no route to host') || msg.includes('econnrefused') ||
        msg.includes('failed to fetch') || msg.includes('name or service')
      ) {
        networkErrorRef.current = true;
      }
      console.warn('[SoundPlayer] Failed to load sound:', meta.id, e);
      return null;
    }
  }, []);

  const startHeartbeat = useCallback(() => {
    clearHeartbeat();
    heartbeatRef.current = setInterval(async () => {
      if (isPausedRef.current || mixRefs.current.size === 0) return;
      // Don't restart in once-play mode — let the track stop naturally
      if (noLoopRef.current) { heartbeatBusyRef.current = false; return; }
      // Guard: skip if a previous heartbeat tick is still running
      if (heartbeatBusyRef.current) return;
      heartbeatBusyRef.current = true;
      try {
        // First pass: check if ANY sound stopped unexpectedly
        let anyNeedRestart = false;
        for (const snd of mixRefs.current.values()) {
          try {
            const status = await snd.getStatusAsync();
            if (status.isLoaded && !status.isPlaying) { anyNeedRestart = true; break; }
          } catch { anyNeedRestart = true; break; }
        }
        if (!anyNeedRestart) return;
        // Re-activate audio session ONCE (not per-sound) before resuming
        await Audio.setAudioModeAsync({
          staysActiveInBackground: true,
          playsInSilentModeIOS: true,
          shouldDuckAndroid: false,
          interruptionModeIOS: 1,
          interruptionModeAndroid: 1,
        }).catch(() => {});
        // Second pass: restart each stopped sound
        for (const [id, snd] of Array.from(mixRefs.current.entries())) {
          // Skip sounds already being restarted by the didJustFinish callback
          if (restartingIdsRef.current.has(id)) continue;
          try {
            const status = await snd.getStatusAsync();
            // Guard: stopAllRefs() may have run while we awaited getStatusAsync().
            // If this sound was removed from the map, abort — do not reload it into
            // a playSound() session that has already started its own sounds.
            if (!mixRefs.current.has(id)) continue;
            if (!status.isLoaded || status.isPlaying) continue;
            restartingIdsRef.current.add(id);
            // Use replayAsync only when at end-of-file (isLooping silently failed).
            // Use playAsync for mid-play interruptions (audio focus lost, etc.)
            // so we resume from the current position without an audible seek gap.
            const isAtEnd = status.durationMillis != null &&
              status.positionMillis >= (status.durationMillis - 500);
            await (isAtEnd ? snd.replayAsync() : snd.playAsync()).catch(async () => {
              restartingIdsRef.current.delete(id);
              // playAsync/replayAsync failed — reload only if sound still belongs to active mix
              if (!mixRefs.current.has(id)) return;
              const meta = mixedSoundsRef.current.find(s => s.id === id);
              if (meta) {
                const epochSnap = playEpochRef.current;
                try { snd.setOnPlaybackStatusUpdate(null); } catch {}
                try { await snd.unloadAsync(); } catch {}
                mixRefs.current.delete(id);
                // Guard: bail if stopAllRefs+playSound ran while we were cleaning up
                if (epochSnap === playEpochRef.current) {
                  await loadAndPlay(meta, undefined, reelTrimMsRef.current);
                }
              }
              return;
            });
            restartingIdsRef.current.delete(id);
          } catch {
            restartingIdsRef.current.delete(id);
            // getStatusAsync threw — only reload if sound still in active mix
            if (!mixRefs.current.has(id)) continue;
            const meta = mixedSoundsRef.current.find(s => s.id === id);
            if (meta) {
              const epochSnap = playEpochRef.current;
              mixRefs.current.delete(id);
              // Guard: bail if stopAllRefs+playSound ran while we were cleaning up
              if (epochSnap === playEpochRef.current) {
                await loadAndPlay(meta, undefined, reelTrimMsRef.current);
              }
            }
          }
        }
      } finally {
        heartbeatBusyRef.current = false;
      }
    }, 5_000);
  }, [clearHeartbeat, loadAndPlay]);

  // Stop + unload ALL sounds in mix
  // Pre-load a sound silently so swipe → playAsync() (instant) instead of createAsync() (~500ms)
  const preBufferSound = useCallback(async (meta: PlayableSoundMeta): Promise<void> => {
    if (preBufferRef.current.has(meta.id)) return;
    if (mixRefs.current.has(meta.id)) return;
    try {
      let resolvedSrc = meta.src;
      if (resolvedSrc && typeof resolvedSrc === 'object' && typeof resolvedSrc.uri === 'string') {
        const localUri = resolveAudioUri(meta.id, resolvedSrc.uri);
        if (localUri !== resolvedSrc.uri) resolvedSrc = { uri: localUri };
        // Stream directly — no background download
      }
      const { sound } = await Audio.Sound.createAsync(
        resolvedSrc,
        { isLooping: true, volume: 1.0, shouldPlay: false },
      );
      // Only store if slot is still free and not actively playing
      if (!mixRefs.current.has(meta.id) && !preBufferRef.current.has(meta.id)) {
        preBufferRef.current.set(meta.id, sound);
      } else {
        try { sound.unloadAsync(); } catch {}
      }
    } catch { /* silent — pre-buffer failure is non-fatal */ }
  }, []);

  // Unload all pre-buffered sounds (called when reels modal closes)
  const cleanPreBuffer = useCallback(async (): Promise<void> => {
    const entries = Array.from(preBufferRef.current.entries());
    preBufferRef.current.clear();
    await Promise.allSettled(entries.map(async ([, snd]) => {
      try { snd.setOnPlaybackStatusUpdate(null); } catch {}
      try { await snd.unloadAsync(); } catch {}
    }));
  }, []);

  const stopAllRefs = useCallback(async () => {
    const entries = Array.from(mixRefs.current.entries());
    // Clear the map immediately so heartbeat / concurrent calls see an empty set
    // and do not attempt to restart sounds that are already being torn down.
    mixRefs.current.clear();
    restartingIdsRef.current.clear();
    // CRITICAL: null out callbacks synchronously — before any await — so native audio
    // events cannot fire between the restartingIdsRef.current.clear() above and the
    // async Promise.all below. Without this, a didJustFinish event could call
    // replayAsync() on a sound whose stop is already in-flight, crashing the audio engine.
    for (const [, snd] of entries) {
      try { snd.setOnPlaybackStatusUpdate(null); } catch {}
    }
    await Promise.all(entries.map(async ([, snd]) => {
      try { await snd.stopAsync(); await snd.unloadAsync(); } catch {}
    }));
  }, []);

  const stopSound = useCallback(async (triggerCb = true) => {
    clearTimer();
    clearHeartbeat();
    await stopAllRefs();
    setPlayingId(null);
    setPlayingMeta(null);
    setMixedSounds([]);
    setIsPaused(false);
    isPausedRef.current = false;
    reelTrimMsRef.current = 0;
    noLoopRef.current = false;
    setSessionSecs(21 * 60);
    setPlayingDurSecs(null);
    positionMsRef.current = 0;
    meteringRef.current = 0;
    meteringAnimRef.current.setValue(0);
    setAudioNetworkError(false);
    setIsAudioLoading(false);
    if (triggerCb) { stopCbRef.current?.(); stopCbRef.current = null; }
    else { stopCbRef.current = null; }
  }, [clearTimer, clearHeartbeat, stopAllRefs]);

  useEffect(() => { stopFnRef.current = stopSound; }, [stopSound]);
  useEffect(() => { mixedSoundsRef.current = mixedSounds; }, [mixedSounds]);

  // Keep clearHeartbeat stable in stopFnRef's closure
  const clearHeartbeatRef = useRef(clearHeartbeat);
  useEffect(() => { clearHeartbeatRef.current = clearHeartbeat; }, [clearHeartbeat]);

  const startTimer = useCallback((secs: number) => {
    clearTimer();
    timerRef.current = setInterval(() => {
      setSessionSecs(prev => {
        if (prev <= 1) { setTimeout(() => stopFnRef.current(true), 0); return 0; }
        return prev - 1;
      });
    }, 1000);
  }, [clearTimer]);

  // Primary play — Instagram-style instant switchover:
  // 1. UI state updates IMMEDIATELY (playingId, sessionSecs, loading indicator)
  // 2. Old audio stops + new audio loads in parallel — no sequential wait
  // 3. Epoch guard ensures stale async ops self-discard
  const playSound = useCallback(async (
    meta: PlayableSoundMeta,
    durationSecs: number,
    onStop?: () => void,
    trimLastSecs: number = 0,
    shouldLoop: boolean = true,
  ) => {
    noLoopRef.current = !shouldLoop;
    networkErrorRef.current = false;
    // Bump epoch FIRST so any in-flight loadAndPlay from previous call detects it is stale.
    const epoch = ++playEpochRef.current;

    // ── INSTANT UI update — happens synchronously, zero delay ──
    clearTimer();
    stopCbRef.current = onStop ?? null;
    isPausedRef.current = false;
    setIsPaused(false);
    setPlayingId(meta.id);
    setPlayingMeta(meta);
    setMixedSounds([meta]);
    setSessionSecs(durationSecs);
    setPlayingDurSecs(null);     // reset duration so ring shows new track's time immediately
    setIsAudioLoading(true);
    setAudioNetworkError(false);
    reelTrimMsRef.current = trimLastSecs * 1000;

    // ── ASYNC audio work — stop old + load new in parallel ──
    try {
      // Fire stop and load concurrently; epoch guard in loadAndPlay handles the race.
      const stopPromise = stopAllRefs();
      const [, sound] = await Promise.all([stopPromise, loadAndPlay(meta, epoch, trimLastSecs * 1000)]);

      // If another playSound arrived while we were in the async work, bail out.
      if (epoch !== playEpochRef.current) return;

      setIsAudioLoading(false);
      if (!sound) {
        if (networkErrorRef.current) setAudioNetworkError(true);
        setPlayingId(null);
        setPlayingMeta(null);
        setMixedSounds([]);
        stopCbRef.current = null;
        return;
      }
      startTimer(durationSecs);
      startHeartbeat();
    } catch (e) {
      if (epoch === playEpochRef.current) {
        setIsAudioLoading(false);
        setPlayingId(null);
        setPlayingMeta(null);
        setMixedSounds([]);
        stopCbRef.current = null;
      }
      console.warn('[SoundPlayer] playSound error:', e);
    }
  }, [clearTimer, stopAllRefs, loadAndPlay, startTimer, startHeartbeat]);

  // Add a second/third/fourth sound to the active mix (no timer reset)
  const addToMix = useCallback(async (meta: PlayableSoundMeta) => {
    try {
      setMixedSounds(prev => {
        if (prev.length >= MAX_MIX) return prev;
        if (prev.find(s => s.id === meta.id)) return prev;
        return [...prev, meta];
      });
      await loadAndPlay(meta, undefined, reelTrimMsRef.current);
    } catch (e) {
      console.warn('[SoundPlayer] addToMix error:', e);
    }
  }, [loadAndPlay]);

  // Remove one sound from mix; if last sound, stop session
  const removeFromMix = useCallback(async (id: string) => {
    const snd = mixRefs.current.get(id);
    if (snd) { try { snd.setOnPlaybackStatusUpdate(null); } catch {} try { await snd.stopAsync(); await snd.unloadAsync(); } catch {} mixRefs.current.delete(id); }
    setMixedSounds(prev => {
      const next = prev.filter(s => s.id !== id);
      if (next.length === 0) {
        clearTimer();
        setPlayingId(null);
        setPlayingMeta(null);
        stopCbRef.current = null;
        isPausedRef.current = false;
        setIsPaused(false);
        setSessionSecs(21 * 60);
      } else {
        setPlayingId(next[0].id);
        setPlayingMeta(next[0]);
      }
      return next;
    });
  }, [clearTimer]);

  const togglePause = useCallback(async () => {
    const all = Array.from(mixRefs.current.values());
    if (isPausedRef.current) {
      // Mark as playing BEFORE calling playAsync so no race window exists
      isPausedRef.current = false;
      setIsPaused(false);
      await Promise.all(all.map(s => s.playAsync().catch(() => {})));
      startTimer(sessionSecs);
      startHeartbeat();
    } else {
      // Mark as paused BEFORE calling pauseAsync so the heartbeat and status
      // callback cannot see isPausedRef=false while the sound is mid-pause
      // and accidentally call playAsync to fight the pause.
      isPausedRef.current = true;
      setIsPaused(true);
      clearTimer();
      clearHeartbeat();
      await Promise.all(all.map(s => s.pauseAsync().catch(() => {})));
    }
  }, [sessionSecs, startTimer, clearTimer, startHeartbeat, clearHeartbeat]);

  const changeTimer = useCallback((secs: number) => {
    setSessionSecs(secs);
    if (mixRefs.current.size > 0 && !isPausedRef.current) startTimer(secs);
  }, [startTimer]);

  const setLoopConfig = useCallback((shouldLoop: boolean, trimMs: number, totalSecs: number) => {
    noLoopRef.current = !shouldLoop;
    reelTrimMsRef.current = trimMs;
    setSessionSecs(totalSecs);
    if (mixRefs.current.size > 0 && !isPausedRef.current) startTimer(totalSecs);
  }, [startTimer]);

  // Seek all active mix sounds to a given position in milliseconds.
  // Also updates positionMsRef so the UI reflects the new position immediately.
  const seekTo = useCallback(async (positionMs: number): Promise<void> => {
    if (!isFinite(positionMs) || positionMs < 0) return;
    positionMsRef.current = positionMs;
    const sounds = Array.from(mixRefs.current.values());
    await Promise.allSettled(
      sounds.map(async (snd) => {
        try {
          const status = await snd.getStatusAsync();
          if (status.isLoaded) await snd.setPositionAsync(positionMs);
        } catch {}
      })
    );
  }, []);

  const requestPlay = useCallback((meta: PlayableSoundMeta, durationSecs: number) => {
    stopCbRef.current = null;
    pendingMetaRef.current = meta;
    pendingDurRef.current = durationSecs;
    setPreMood(null);
    setMoodPhase('pre');
  }, []);

  const confirmMood = useCallback(async (key: MoodKey) => {
    if (moodPhase === 'pre') {
      setPreMood(key);
      setMoodPhase(null);
      const meta = pendingMetaRef.current;
      const dur  = pendingDurRef.current;
      if (meta) playSound(meta, dur, () => setMoodPhase('post'));
    } else if (moodPhase === 'post') {
      setMoodPhase('result');
    }
  }, [moodPhase, playSound]);

  const skipMood = useCallback(async () => {
    if (moodPhase === 'pre') {
      setMoodPhase(null);
      const meta = pendingMetaRef.current;
      const dur  = pendingDurRef.current;
      if (meta) playSound(meta, dur, () => setMoodPhase('post'));
    } else {
      setMoodPhase(null);
      setPreMood(null);
    }
  }, [moodPhase, playSound]);

  const dismissMoodSheet = useCallback(() => {
    setMoodPhase(null);
    setPreMood(null);
    stopCbRef.current = null;
  }, []);

  useEffect(() => {
    const applyAudioMode = () =>
      Audio.setAudioModeAsync({
        staysActiveInBackground: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false,
        interruptionModeIOS: 1,
        interruptionModeAndroid: 1,
      }).catch(() => {});

    applyAudioMode();
    initAudioCache().catch(() => {});

    // Re-activate audio session and restart interrupted sounds when app comes to foreground
    const appStateSub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        applyAudioMode();
        if (!isPausedRef.current && mixRefs.current.size > 0) {
          Array.from(mixRefs.current.values()).forEach(snd => {
            snd.getStatusAsync()
              .then(status => {
                if (status.isLoaded && !status.isPlaying) snd.playAsync().catch(() => {});
              })
              .catch(() => {});
          });
        }
      }
    });

    return () => {
      appStateSub.remove();
      stopAllRefs().catch(() => {});
      clearTimer();
      clearHeartbeat();
    };
  }, []);

  return (
    <Ctx.Provider value={{
      playingId, isPaused, sessionSecs, playingDurationSecs: playingDurationSecs, playingMeta, mixedSounds,
      playSound, addToMix, removeFromMix, togglePause, stopSound, changeTimer, setLoopConfig, meteringAnim: meteringAnimRef.current, getMeteringLevel: () => meteringRef.current,
      isAudioLoading, audioNetworkError, getPositionMs, seekTo,
      preBufferSound, cleanPreBuffer,
      moodPhase, preMood,
      requestPlay, confirmMood, skipMood, dismissMoodSheet,
      showFullPlayer, openFullPlayer, closeFullPlayer,
      openReelsOrPlayer, registerReelsOpener, unregisterReelsOpener,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function useSoundPlayer(): SoundPlayerCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSoundPlayer must be within SoundPlayerProvider');
  return ctx;
}

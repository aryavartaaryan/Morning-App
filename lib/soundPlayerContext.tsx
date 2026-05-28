import React, {
  createContext, useContext, useState, useRef,
  useCallback, useEffect, ReactNode,
} from 'react';
import { AppState } from 'react-native';
import { Audio } from 'expo-av';
import type { MoodKey } from '@/components/MoodSheet';
import { initAudioCache, resolveAudioUri, downloadAudioToCache } from './soundAudioCache';

export const MAX_MIX = 4;

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
  playingMeta: PlayableSoundMeta | null;
  mixedSounds: PlayableSoundMeta[];
  playSound: (meta: PlayableSoundMeta, durationSecs: number, onStop?: () => void, trimLastSecs?: number) => Promise<void>;
  addToMix: (meta: PlayableSoundMeta) => Promise<void>;
  removeFromMix: (id: string) => Promise<void>;
  togglePause: () => Promise<void>;
  stopSound: (triggerCb?: boolean) => Promise<void>;
  changeTimer: (secs: number) => void;
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
};

const Ctx = createContext<SoundPlayerCtx | null>(null);

export function SoundPlayerProvider({ children }: { children: ReactNode }) {
  const [playingId, setPlayingId]       = useState<string | null>(null);
  const [isPaused, setIsPaused]         = useState(false);
  const [sessionSecs, setSessionSecs]   = useState(21 * 60);
  const [playingMeta, setPlayingMeta]   = useState<PlayableSoundMeta | null>(null);
  const [mixedSounds, setMixedSounds]   = useState<PlayableSoundMeta[]>([]);

  const [moodPhase, setMoodPhase]       = useState<'pre' | 'post' | 'result' | null>(null);
  const [preMood, setPreMood]           = useState<MoodKey | null>(null);
  const [showFullPlayer, setShowFullPlayer] = useState(false);
  const reelsOpenerRef = useRef<(() => void) | null>(null);

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
      let resolvedSrc = meta.src;
      if (resolvedSrc && typeof resolvedSrc === 'object' && typeof resolvedSrc.uri === 'string') {
        const localUri = resolveAudioUri(meta.id, resolvedSrc.uri);
        if (localUri !== resolvedSrc.uri) {
          resolvedSrc = { uri: localUri };
        } else {
          downloadAudioToCache(meta.id, resolvedSrc.uri).catch(() => {});
        }
      }
      const { sound } = await Audio.Sound.createAsync(
        resolvedSrc,
        { isLooping: true, volume: 1.0, shouldPlay: !isPausedRef.current },
      );
      // Stale-epoch check: createAsync is async; if a newer playSound displaced
      // this one while we were awaiting, silently unload and bail.
      if (epoch !== undefined && epoch !== playEpochRef.current) {
        try { sound.setOnPlaybackStatusUpdate(null); } catch {}
        try { await sound.stopAsync(); await sound.unloadAsync(); } catch {}
        return null;
      }
      // Watchdog: expo-av isLooping can silently fail on M4A/certain codecs.
      // If the sound finishes instead of looping, restart it automatically.
      sound.setOnPlaybackStatusUpdate((status) => {
        if (!status.isLoaded) return;
        // Trim: seek to start when within last trimLastMs of the track
        if (
          trimLastMs > 0 &&
          !isPausedRef.current &&
          !restartingIdsRef.current.has(meta.id) &&
          status.durationMillis != null &&
          status.durationMillis > 16000 &&
          status.positionMillis >= status.durationMillis - trimLastMs
        ) {
          restartingIdsRef.current.add(meta.id);
          sound.replayAsync()
            .catch(() => sound.setPositionAsync(0).then(() => sound.playAsync()).catch(() => {}))
            .finally(() => { restartingIdsRef.current.delete(meta.id); });
          return;
        }
        // Only restart when the file explicitly finished (isLooping silently failed).
        // Guard with restartingIdsRef to prevent concurrent replayAsync storms
        // (heartbeat + this callback firing at the same loop boundary).
        if (!isPausedRef.current && status.didJustFinish && !restartingIdsRef.current.has(meta.id)) {
          restartingIdsRef.current.add(meta.id);
          sound.replayAsync()
            .catch(() => sound.setPositionAsync(0).then(() => sound.playAsync()).catch(() => {}))
            .finally(() => { restartingIdsRef.current.delete(meta.id); });
        }
      });
      // Enable periodic position updates so the trim threshold can be detected
      if (trimLastMs > 0) {
        sound.setStatusAsync({ progressUpdateIntervalMillis: 500 }).catch(() => {});
      }
      mixRefs.current.set(meta.id, sound);
      return sound;
    } catch (e) {
      console.warn('[SoundPlayer] Failed to load sound:', meta.id, e);
      return null;
    }
  }, []);

  const startHeartbeat = useCallback(() => {
    clearHeartbeat();
    heartbeatRef.current = setInterval(async () => {
      if (isPausedRef.current || mixRefs.current.size === 0) return;
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
            if (!status.isLoaded || status.isPlaying) continue;
            restartingIdsRef.current.add(id);
            // Use replayAsync only when at end-of-file (isLooping silently failed).
            // Use playAsync for mid-play interruptions (audio focus lost, etc.)
            // so we resume from the current position without an audible seek gap.
            const isAtEnd = status.durationMillis != null &&
              status.positionMillis >= (status.durationMillis - 500);
            await (isAtEnd ? snd.replayAsync() : snd.playAsync()).catch(async () => {
              restartingIdsRef.current.delete(id);
              // playAsync/replayAsync failed — reload the sound object from scratch
              const meta = mixedSoundsRef.current.find(s => s.id === id);
              if (meta) {
                try { snd.setOnPlaybackStatusUpdate(null); } catch {}
                try { await snd.unloadAsync(); } catch {}
                mixRefs.current.delete(id);
                await loadAndPlay(meta, undefined, reelTrimMsRef.current);
              }
              return;
            });
            restartingIdsRef.current.delete(id);
          } catch {
            restartingIdsRef.current.delete(id);
            // getStatusAsync threw — native sound object is broken; reload fresh
            const meta = mixedSoundsRef.current.find(s => s.id === id);
            if (meta) {
              mixRefs.current.delete(id);
              await loadAndPlay(meta, undefined, reelTrimMsRef.current);
            }
          }
        }
      } finally {
        heartbeatBusyRef.current = false;
      }
    }, 5_000);
  }, [clearHeartbeat, loadAndPlay]);

  // Stop + unload ALL sounds in mix
  const stopAllRefs = useCallback(async () => {
    const entries = Array.from(mixRefs.current.entries());
    // Clear the map immediately so heartbeat / concurrent calls see an empty set
    // and do not attempt to restart sounds that are already being torn down.
    mixRefs.current.clear();
    restartingIdsRef.current.clear();
    await Promise.all(entries.map(async ([, snd]) => {
      try { snd.setOnPlaybackStatusUpdate(null); } catch {}
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
    setSessionSecs(21 * 60);
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

  // Primary play — clears mix, starts single sound, sets timer
  const playSound = useCallback(async (
    meta: PlayableSoundMeta,
    durationSecs: number,
    onStop?: () => void,
    trimLastSecs: number = 0,
  ) => {
    // Bump epoch FIRST so any concurrent in-flight loadAndPlay can detect it is stale.
    const epoch = ++playEpochRef.current;
    try {
      clearTimer();
      await stopAllRefs();
      // If another playSound arrived while we were stopping, let it take over.
      if (epoch !== playEpochRef.current) return;
      stopCbRef.current = onStop ?? null;
      isPausedRef.current = false;
      setIsPaused(false);
      setPlayingId(meta.id);
      setPlayingMeta(meta);
      setMixedSounds([meta]);
      setSessionSecs(durationSecs);
      reelTrimMsRef.current = trimLastSecs * 1000;
      const sound = await loadAndPlay(meta, epoch, trimLastSecs * 1000);
      if (!sound) {
        // Either stale (epoch mismatch) or real load failure.
        if (epoch === playEpochRef.current) {
          setPlayingId(null);
          setPlayingMeta(null);
          setMixedSounds([]);
          stopCbRef.current = null;
        }
        return;
      }
      startTimer(durationSecs);
      startHeartbeat();
    } catch (e) {
      console.warn('[SoundPlayer] playSound error:', e);
      if (epoch === playEpochRef.current) {
        setPlayingId(null);
        setPlayingMeta(null);
        setMixedSounds([]);
        stopCbRef.current = null;
      }
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
      playingId, isPaused, sessionSecs, playingMeta, mixedSounds,
      playSound, addToMix, removeFromMix, togglePause, stopSound, changeTimer,
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

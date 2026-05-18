import React, {
  createContext, useContext, useState, useRef,
  useCallback, useEffect, ReactNode,
} from 'react';
import { AppState } from 'react-native';
import { Audio } from 'expo-av';
import type { MoodKey } from '@/components/MoodSheet';

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
  playSound: (meta: PlayableSoundMeta, durationSecs: number, onStop?: () => void) => Promise<void>;
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
  const isPausedRef     = useRef(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  const clearHeartbeat = useCallback(() => {
    if (heartbeatRef.current) { clearInterval(heartbeatRef.current); heartbeatRef.current = null; }
  }, []);

  const startHeartbeat = useCallback(() => {
    clearHeartbeat();
    heartbeatRef.current = setInterval(async () => {
      if (isPausedRef.current || mixRefs.current.size === 0) return;
      // Restart any sound that stopped due to a phone-call / notification / iOS interruption.
      for (const snd of mixRefs.current.values()) {
        try {
          const status = await snd.getStatusAsync();
          if (status.isLoaded && !status.isPlaying) {
            // Re-activate audio session before resuming (handles iOS interruption deactivation)
            await Audio.setAudioModeAsync({
              staysActiveInBackground: true,
              playsInSilentModeIOS: true,
              shouldDuckAndroid: false,
              interruptionModeIOS: 1,
              interruptionModeAndroid: 1,
            }).catch(() => {});
            await snd.playAsync().catch(() => {});
          }
        } catch { /* sound may have been unloaded */ }
      }
    }, 8_000);
  }, [clearHeartbeat]);

  // Stop + unload ALL sounds in mix
  const stopAllRefs = useCallback(async () => {
    const entries = Array.from(mixRefs.current.entries());
    await Promise.all(entries.map(async ([, snd]) => {
      try { await snd.stopAsync(); await snd.unloadAsync(); } catch {}
    }));
    mixRefs.current.clear();
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
    setSessionSecs(21 * 60);
    if (triggerCb) { stopCbRef.current?.(); stopCbRef.current = null; }
    else { stopCbRef.current = null; }
  }, [clearTimer, clearHeartbeat, stopAllRefs]);

  useEffect(() => { stopFnRef.current = stopSound; }, [stopSound]);

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

  // Create and start a single Audio.Sound, storing it in mixRefs
  const loadAndPlay = useCallback(async (meta: PlayableSoundMeta): Promise<Audio.Sound | null> => {
    try {
      const { sound } = await Audio.Sound.createAsync(
        meta.src,
        { isLooping: true, volume: 1.0, shouldPlay: !isPausedRef.current },
      );
      // Watchdog: expo-av isLooping can silently fail on M4A/certain codecs.
      // If the sound finishes instead of looping, restart it automatically.
      sound.setOnPlaybackStatusUpdate((status) => {
        if (!status.isLoaded) return;
        // Only restart when the file explicitly finished (isLooping silently failed).
        // Do NOT restart on every !isPlaying poll — that creates a cascading playAsync
        // storm at loop boundaries that kills the audio engine within 1-2 minutes.
        if (!isPausedRef.current && status.didJustFinish) {
          sound.replayAsync().catch(() => {
            // Fallback: manually seek to start and play
            sound.setPositionAsync(0).then(() => sound.playAsync()).catch(() => {});
          });
        }
      });
      mixRefs.current.set(meta.id, sound);
      return sound;
    } catch (e) {
      console.warn('[SoundPlayer] Failed to load sound:', meta.id, e);
      return null;
    }
  }, []);

  // Primary play — clears mix, starts single sound, sets timer
  const playSound = useCallback(async (
    meta: PlayableSoundMeta,
    durationSecs: number,
    onStop?: () => void,
  ) => {
    try {
      clearTimer();
      await stopAllRefs();
      stopCbRef.current = onStop ?? null;
      isPausedRef.current = false;
      setIsPaused(false);
      setPlayingId(meta.id);
      setPlayingMeta(meta);
      setMixedSounds([meta]);
      setSessionSecs(durationSecs);
      const sound = await loadAndPlay(meta);
      if (!sound) {
        // Audio failed to load — reset state cleanly instead of crashing
        setPlayingId(null);
        setPlayingMeta(null);
        setMixedSounds([]);
        stopCbRef.current = null;
        return;
      }
      startTimer(durationSecs);
      startHeartbeat();
    } catch (e) {
      console.warn('[SoundPlayer] playSound error:', e);
      setPlayingId(null);
      setPlayingMeta(null);
      setMixedSounds([]);
      stopCbRef.current = null;
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
      await loadAndPlay(meta);
    } catch (e) {
      console.warn('[SoundPlayer] addToMix error:', e);
    }
  }, [loadAndPlay]);

  // Remove one sound from mix; if last sound, stop session
  const removeFromMix = useCallback(async (id: string) => {
    const snd = mixRefs.current.get(id);
    if (snd) { try { await snd.stopAsync(); await snd.unloadAsync(); } catch {} mixRefs.current.delete(id); }
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

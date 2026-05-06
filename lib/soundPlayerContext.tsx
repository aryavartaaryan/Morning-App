import React, {
  createContext, useContext, useState, useRef,
  useCallback, useEffect, ReactNode,
} from 'react';
import { Audio } from 'expo-av';
import type { MoodKey } from '@/components/MoodSheet';

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
};

type SoundPlayerCtx = {
  playingId: string | null;
  isPaused: boolean;
  sessionSecs: number;
  playingMeta: PlayableSoundMeta | null;
  playSound: (meta: PlayableSoundMeta, durationSecs: number, onStop?: () => void) => Promise<void>;
  togglePause: () => Promise<void>;
  stopSound: (triggerCb?: boolean) => Promise<void>;
  changeTimer: (secs: number) => void;
  moodPhase: 'pre' | 'post' | 'result' | null;
  preMood: MoodKey | null;
  requestPlay: (meta: PlayableSoundMeta, durationSecs: number) => void;
  confirmMood: (key: MoodKey) => Promise<void>;
  skipMood: () => Promise<void>;
  dismissMoodSheet: () => void;
};

const Ctx = createContext<SoundPlayerCtx | null>(null);

export function SoundPlayerProvider({ children }: { children: ReactNode }) {
  const [playingId, setPlayingId]       = useState<string | null>(null);
  const [isPaused, setIsPaused]         = useState(false);
  const [sessionSecs, setSessionSecs]   = useState(21 * 60);
  const [playingMeta, setPlayingMeta]   = useState<PlayableSoundMeta | null>(null);

  const [moodPhase, setMoodPhase]   = useState<'pre' | 'post' | 'result' | null>(null);
  const [preMood, setPreMood]       = useState<MoodKey | null>(null);

  const soundRef        = useRef<Audio.Sound | null>(null);
  const timerRef        = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopCbRef       = useRef<(() => void) | null>(null);
  const stopFnRef       = useRef<(triggerCb?: boolean) => Promise<void>>(async () => {});
  const pendingMetaRef  = useRef<PlayableSoundMeta | null>(null);
  const pendingDurRef   = useRef<number>(21 * 60);

  const clearTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  const stopSound = useCallback(async (triggerCb = true) => {
    clearTimer();
    try { await soundRef.current?.stopAsync(); await soundRef.current?.unloadAsync(); } catch {}
    soundRef.current = null;
    setPlayingId(null);
    setPlayingMeta(null);
    setIsPaused(false);
    setSessionSecs(21 * 60);
    if (triggerCb) {
      stopCbRef.current?.();
      stopCbRef.current = null;
    } else {
      stopCbRef.current = null;
    }
  }, [clearTimer]);

  useEffect(() => { stopFnRef.current = stopSound; }, [stopSound]);

  const startTimer = useCallback((secs: number) => {
    clearTimer();
    timerRef.current = setInterval(() => {
      setSessionSecs(prev => {
        if (prev <= 1) { setTimeout(() => stopFnRef.current(true), 0); return 0; }
        return prev - 1;
      });
    }, 1000);
  }, [clearTimer]);

  const playSound = useCallback(async (
    meta: PlayableSoundMeta,
    durationSecs: number,
    onStop?: () => void,
  ) => {
    try { await soundRef.current?.stopAsync(); await soundRef.current?.unloadAsync(); } catch {}
    soundRef.current = null;
    clearTimer();
    stopCbRef.current = onStop ?? null;
    setPlayingId(meta.id);
    setPlayingMeta(meta);
    setIsPaused(false);
    setSessionSecs(durationSecs);
    const { sound } = await Audio.Sound.createAsync(
      meta.src,
      { isLooping: true, volume: 1.0, shouldPlay: true },
    );
    soundRef.current = sound;
    startTimer(durationSecs);
  }, [clearTimer, startTimer]);

  const togglePause = useCallback(async () => {
    if (!soundRef.current) return;
    if (isPaused) {
      await soundRef.current.playAsync().catch(() => {});
      setIsPaused(false);
      startTimer(sessionSecs);
    } else {
      await soundRef.current.pauseAsync().catch(() => {});
      setIsPaused(true);
      clearTimer();
    }
  }, [isPaused, sessionSecs, startTimer, clearTimer]);

  const changeTimer = useCallback((secs: number) => {
    setSessionSecs(secs);
    if (playingId && !isPaused) startTimer(secs);
  }, [playingId, isPaused, startTimer]);

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
      if (meta) await playSound(meta, dur, () => setMoodPhase('post'));
    } else if (moodPhase === 'post') {
      setMoodPhase(preMood ? 'result' : null);
    }
  }, [moodPhase, preMood, playSound]);

  const skipMood = useCallback(async () => {
    if (moodPhase === 'pre') {
      setMoodPhase(null);
      const meta = pendingMetaRef.current;
      const dur  = pendingDurRef.current;
      if (meta) await playSound(meta, dur, () => setMoodPhase('post'));
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
    Audio.setAudioModeAsync({
      staysActiveInBackground: true,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: false,
      playThroughEarpieceAndroid: false,
    }).catch(() => {});
    return () => {
      soundRef.current?.unloadAsync().catch(() => {});
      clearTimer();
    };
  }, []);

  return (
    <Ctx.Provider value={{
      playingId, isPaused, sessionSecs, playingMeta,
      playSound, togglePause, stopSound, changeTimer,
      moodPhase, preMood,
      requestPlay, confirmMood, skipMood, dismissMoodSheet,
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

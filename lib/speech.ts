import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
// @ts-ignore
import * as FileSystem from 'expo-file-system/legacy';
import { GoogleGenAI, Modality } from '@google/genai';

const GEMINI_KEY = 'AIzaSyANg_oPfwORFiYwvWCs53hO2NSiw96xA8k';
const BODHI_TTS_MODEL = 'gemini-2.5-flash-native-audio-preview-12-2025';
const OUTPUT_SAMPLE_RATE = 24000;
const BODHI_SYSTEM = `You are Bodhi — a wise, warm Ayurvedic AI companion. You are narrating an onboarding experience: questions appear on screen and you read them aloud to the user so they can answer them.

Your ONLY job right now is to READ the text you receive — warmly, naturally, like a caring guide speaking directly to the person in front of you.

CRITICAL RULES:
- The questions are FOR the user, not for you. "What is your date of birth?" means ask THE USER, not answer it yourself.
- NEVER answer any question. NEVER say "I think", "My...", or respond as if the question is directed at you.
- NEVER add any words beyond what is given. No greetings, no commentary.
- In Hindi always use आप (आपका/आपकी) — never तुम or तू.
- Just narrate the exact text, directed warmly at the listener.`;
const ai = new GoogleGenAI({ apiKey: GEMINI_KEY });

function buildWavBase64(chunks: string[]): string {
  let totalLen = 0;
  const decoded = chunks.map(b64 => {
    const s = atob(b64);
    const u = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
    totalLen += u.length;
    return u;
  });
  const pcm = new Uint8Array(totalLen);
  let off = 0;
  for (const chunk of decoded) { pcm.set(chunk, off); off += chunk.length; }
  const wavBuf = new ArrayBuffer(44 + totalLen);
  const v = new DataView(wavBuf);
  const wav = new Uint8Array(wavBuf);
  const w = (s: string, o: number) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w('RIFF', 0); v.setUint32(4, 36 + totalLen, true);
  w('WAVE', 8); w('fmt ', 12);
  v.setUint32(16, 16, true); v.setUint16(20, 1, true);
  v.setUint16(22, 1, true); v.setUint32(24, OUTPUT_SAMPLE_RATE, true);
  v.setUint32(28, OUTPUT_SAMPLE_RATE * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  w('data', 36); v.setUint32(40, totalLen, true);
  wav.set(pcm, 44);
  let out = '';
  for (let i = 0; i < wav.length; i++) out += String.fromCharCode(wav[i]);
  return btoa(out);
}

let activeSound: Audio.Sound | null = null;
let liveSessionRef: { close: () => void } | null = null;
let speakGen = 0;

export function stopBodhi(): void {
  speakGen++;
  if (liveSessionRef) { try { liveSessionRef.close(); } catch {} liveSessionRef = null; }
  if (activeSound) {
    activeSound.stopAsync().catch(() => {});
    activeSound.unloadAsync().catch(() => {});
    activeSound = null;
  }
  try { Speech.stop(); } catch {}
}

async function tryLiveConnect(ai: GoogleGenAI, text: string, myGen: number, pcmOut: string[]): Promise<void> {
  pcmOut.length = 0;
  let turnDone = false;
  let res!: () => void; let rej!: (e: Error) => void;
  const done = new Promise<void>((r, j) => { res = r; rej = j; });

  const session = await ai.live.connect({
    model: BODHI_TTS_MODEL,
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Aoede' } } },
      systemInstruction: BODHI_SYSTEM,
    },
    callbacks: {
      onopen: () => {},
      onmessage: (msg: unknown) => {
        if (myGen !== speakGen) { res(); return; }
        const m = msg as { serverContent?: { modelTurn?: { parts?: Array<{ inlineData?: { data?: string } }> }; turnComplete?: boolean } };
        for (const p of (m?.serverContent?.modelTurn?.parts ?? [])) {
          if (p?.inlineData?.data) pcmOut.push(p.inlineData.data);
        }
        if (m?.serverContent?.turnComplete) { turnDone = true; res(); }
      },
      onerror: (e: unknown) => { rej(new Error('Live API error')); },
      onclose: () => {
        if (myGen !== speakGen || turnDone || pcmOut.length > 0) res();
        else rej(new Error('Live closed early'));
      },
    },
  });

  if (myGen !== speakGen) { try { session.close(); } catch {} return; }
  liveSessionRef = session;
  session.sendClientContent({ turns: [{ role: 'user', parts: [{ text: text.slice(0, 500) }] }], turnComplete: true });
  await done;
  liveSessionRef = null;
}

export async function speakBodhi(text: string): Promise<void> {
  if (!text?.trim()) return;
  const myGen = ++speakGen;

  let hadPrev = false;
  if (liveSessionRef) { try { liveSessionRef.close(); } catch {} liveSessionRef = null; hadPrev = true; }
  if (activeSound) {
    await activeSound.stopAsync().catch(() => {});
    await activeSound.unloadAsync().catch(() => {});
    activeSound = null;
  }
  if (myGen !== speakGen) return;
  // Let the server process the previous session close before opening a new one
  if (hadPrev) { await new Promise(r => setTimeout(r, 150)); }
  if (myGen !== speakGen) return;

  try {
    const pcmChunks: string[] = [];

    try {
      await tryLiveConnect(ai, text, myGen, pcmChunks);
    } catch (e) {
      if (myGen !== speakGen) return;
      const msg = e instanceof Error ? e.message : '';
      if (msg.includes('closed') || msg.includes('setup') || msg.includes('early')) {
        console.warn('[speakBodhi] retry after:', msg);
        await new Promise(r => setTimeout(r, 300));
        if (myGen !== speakGen) return;
        await tryLiveConnect(ai, text, myGen, pcmChunks);
      } else { throw e; }
    }

    if (myGen !== speakGen || !pcmChunks.length) return;

    const wavB64 = buildWavBase64(pcmChunks);
    const uri = (FileSystem.documentDirectory ?? '') + 'bodhi_speech.wav';
    await FileSystem.writeAsStringAsync(uri, wavB64, { encoding: FileSystem.EncodingType.Base64 });
    if (myGen !== speakGen) return;

    try { await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: true, shouldDuckAndroid: true }); } catch {}
    const { sound } = await Audio.Sound.createAsync({ uri }, { shouldPlay: true });
    if (myGen !== speakGen) { sound.unloadAsync(); return; }
    activeSound = sound;
    sound.setOnPlaybackStatusUpdate(s => {
      if ('didJustFinish' in s && s.didJustFinish) { sound.unloadAsync(); activeSound = null; }
    });
  } catch (err) {
    if (myGen !== speakGen) return;
    console.error('[speakBodhi]', err);
    try {
      if (await Speech.isSpeakingAsync()) Speech.stop();
      Speech.speak(text.slice(0, 500), { language: 'en-IN', pitch: 1.05, rate: 0.88 });
    } catch {}
  }
}

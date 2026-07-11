/**
 * walkHistory.ts
 * 
 * Stores completed walk sessions locally (AsyncStorage).
 * Keeps last 60 sessions (well beyond 30 days).
 * Used to show walk history in the Step Report.
 */

import { store } from '@/lib/storage';
import { stepsToDistanceKm } from '@/lib/dailyStepTracker';
import type { WalkMode } from '@/lib/walkStore';

const WALK_HISTORY_KEY = 'naad_walk_history_v1';
const MAX_SESSIONS = 60;

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface WalkSession {
  id: string;               // unique id
  date: string;             // YYYY-MM-DD
  startMs: number;          // epoch ms — used for display time
  endMs: number;
  durationMs: number;       // active walk time (excluding pauses)
  type: 'morning' | 'evening';
  walkMode: WalkMode;
  shatapavalli: boolean;
  steps: number;
  gpsDistanceKm: number;    // GPS-based (outdoor only)
  stepDistanceKm: number;   // step-based (Apple Health model, always available)
  calories: number;         // approx: steps × 0.04 kcal
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function generateId(): string {
  return `walk_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function fmtTime(ms: number): string {
  const d = new Date(ms);
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h < 12 ? 'AM' : 'PM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;
}

function fmtDate(dateStr: string): string {
  const [y, mo, d] = dateStr.split('-').map(Number);
  const date = new Date(y, mo - 1, d);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${days[date.getDay()]}, ${d} ${months[mo - 1]}`;
}

function fmtDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export { fmtTime, fmtDate, fmtDuration };

// ─── Persistence ───────────────────────────────────────────────────────────────

export async function getWalkHistory(): Promise<WalkSession[]> {
  try {
    const data = await store.getJSON<WalkSession[]>(WALK_HISTORY_KEY);
    return data ?? [];
  } catch {
    return [];
  }
}

export async function saveWalkSession(session: Omit<WalkSession, 'id'>): Promise<void> {
  try {
    const history = await getWalkHistory();
    const newSession: WalkSession = { id: generateId(), ...session };
    // Prepend newest first, keep last MAX_SESSIONS
    const updated = [newSession, ...history].slice(0, MAX_SESSIONS);
    await store.setJSON(WALK_HISTORY_KEY, updated);
  } catch (e) {
    console.warn('[WalkHistory] Failed to save session:', e);
  }
}

// ─── Stats helpers ─────────────────────────────────────────────────────────────

export interface WalkHistoryStats {
  totalSessions: number;
  totalSteps: number;
  totalGpsKm: number;
  totalStepKm: number;
  totalDurationMs: number;
  avgStepsPerSession: number;
  avgDistanceKm: number;
  longestWalkMs: number;
  mostStepsSession: WalkSession | null;
}

export function calcWalkHistoryStats(sessions: WalkSession[]): WalkHistoryStats {
  if (!sessions.length) {
    return {
      totalSessions: 0, totalSteps: 0, totalGpsKm: 0, totalStepKm: 0,
      totalDurationMs: 0, avgStepsPerSession: 0, avgDistanceKm: 0,
      longestWalkMs: 0, mostStepsSession: null,
    };
  }
  const totalSessions = sessions.length;
  const totalSteps = sessions.reduce((s, w) => s + w.steps, 0);
  const totalGpsKm = parseFloat(sessions.reduce((s, w) => s + w.gpsDistanceKm, 0).toFixed(2));
  const totalStepKm = parseFloat(sessions.reduce((s, w) => s + w.stepDistanceKm, 0).toFixed(2));
  const totalDurationMs = sessions.reduce((s, w) => s + w.durationMs, 0);
  const avgStepsPerSession = Math.round(totalSteps / totalSessions);
  const avgDistanceKm = parseFloat((totalStepKm / totalSessions).toFixed(2));
  const longestWalkMs = Math.max(...sessions.map(w => w.durationMs));
  const mostStepsSession = sessions.reduce((best, w) => w.steps > (best?.steps ?? 0) ? w : best, sessions[0]);

  return {
    totalSessions, totalSteps, totalGpsKm, totalStepKm,
    totalDurationMs, avgStepsPerSession, avgDistanceKm,
    longestWalkMs, mostStepsSession,
  };
}

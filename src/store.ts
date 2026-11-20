import { useEffect, useState } from 'react';

export interface CardState {
  due: number; // epoch ms
  interval: number; // days
  ease: number;
  reps: number;
  lapses: number;
  last: number;
}

export type Grade = 0 | 1 | 2 | 3; // 다시, 어려움, 알맞음, 쉬움
export type FrontMode = 'term' | 'definition' | 'mixed';

export interface Settings {
  newPerDay: number;
  front: FrontMode;
}

interface Persist {
  cards: Record<string, CardState>;
  stars: string[];
  settings: Settings;
  newLog: { day: string; count: number };
}

const KEY = 'game-terms-v1';
const DAY = 86400000;

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function read(): Persist {
  const base: Persist = { cards: {}, stars: [], settings: { newPerDay: 15, front: 'mixed' }, newLog: { day: today(), count: 0 } };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw);
      return { ...base, ...p, settings: { ...base.settings, ...(p.settings || {}) } };
    }
  } catch {}
  return base;
}

let state: Persist = read();
const listeners = new Set<() => void>();

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {}
  listeners.forEach((l) => l());
}

export function useStore(): Persist {
  const [, set] = useState(0);
  useEffect(() => {
    const l = () => set((n) => n + 1);
    listeners.add(l);
    return () => void listeners.delete(l);
  }, []);
  return state;
}

export function getState() {
  return state;
}

export function newToday(): number {
  return state.newLog.day === today() ? state.newLog.count : 0;
}

export function newRemaining(): number {
  return Math.max(0, state.settings.newPerDay - newToday());
}

export function isDue(id: string, now = Date.now()) {
  const c = state.cards[id];
  return !!c && c.due <= now;
}

/** Preview of the next interval for each grade, for button labels. */
export function previewInterval(id: string, g: Grade): number {
  return next(state.cards[id], g, Date.now()).interval;
}

function next(c: CardState | undefined, g: Grade, now: number): CardState {
  const prev: CardState = c ?? { due: now, interval: 0, ease: 2.5, reps: 0, lapses: 0, last: now };
  let { interval, ease, reps, lapses } = prev;
  if (g === 0) {
    lapses += c ? 1 : 0;
    reps = 0;
    ease = Math.max(1.3, ease - 0.2);
    interval = 0; // again in ~10 minutes
  } else {
    if (reps === 0) interval = g === 1 ? 0.5 : g === 2 ? 1 : 3;
    else if (reps === 1) interval = g === 1 ? Math.max(1, interval * 1.2) : g === 2 ? 3 : 6;
    else interval = interval * (g === 1 ? 1.2 : g === 2 ? ease : ease * 1.3);
    ease = Math.max(1.3, ease + (g === 1 ? -0.15 : g === 3 ? 0.15 : 0));
    reps += 1;
  }
  const due = interval === 0 ? now + 10 * 60000 : now + interval * DAY;
  return { due, interval, ease, reps, lapses, last: now };
}

export function grade(id: string, g: Grade) {
  const isNew = !state.cards[id];
  state = { ...state, cards: { ...state.cards, [id]: next(state.cards[id], g, Date.now()) } };
  if (isNew) {
    const d = today();
    state.newLog = { day: d, count: (state.newLog.day === d ? state.newLog.count : 0) + 1 };
  }
  save();
}

export function toggleStar(id: string) {
  const s = new Set(state.stars);
  s.has(id) ? s.delete(id) : s.add(id);
  state = { ...state, stars: [...s] };
  save();
}

export function updateSettings(p: Partial<Settings>) {
  state = { ...state, settings: { ...state.settings, ...p } };
  save();
}

export function resetProgress() {
  state = { ...state, cards: {}, newLog: { day: today(), count: 0 } };
  save();
}

export function fmtInterval(days: number): string {
  if (days === 0) return '10분';
  if (days < 1) return `${Math.round(days * 24)}시간`;
  if (days < 30) return `${Math.round(days)}일`;
  if (days < 365) return `${Math.round(days / 30)}개월`;
  return `${(days / 365).toFixed(1)}년`;
}

export function copyText(text: string) {
  const w = window as any;
  if (w.Android?.copy) return w.Android.copy(text);
  if (navigator.clipboard) navigator.clipboard.writeText(text).catch(() => {});
}

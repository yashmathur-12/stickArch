/** Thin, failure-tolerant wrapper around localStorage (private mode, quota, etc.). */

const PREFIX = 'stickarch:';

export function loadNumber(key: string, fallback = 0): number {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (raw === null) return fallback;
    const value = Number(raw);
    return Number.isFinite(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

export function saveNumber(key: string, value: number): void {
  try {
    window.localStorage.setItem(PREFIX + key, String(value));
  } catch {
    /* storage unavailable: progress is simply not persisted */
  }
}

export const StorageKeys = {
  highScore: 'highScore',
} as const;

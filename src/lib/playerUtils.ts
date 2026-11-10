export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const pad = (n: number) => String(n).padStart(2, '0');

export const formatTime = (sec: number) => {
  if (!Number.isFinite(sec) || sec < 0) return '0:00';
  return `${Math.floor(sec / 60)}:${pad(Math.floor(sec % 60))}`;
};

export function pickNext(from: number, length: number, shuffle: boolean): number {
  if (shuffle && length > 1) {
    let n = from;
    while (n === from) n = Math.floor(Math.random() * length);
    return n;
  }
  return (from + 1) % length;
}

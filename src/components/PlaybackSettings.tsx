import { useEffect } from 'react';
import { Gauge, Timer, X } from 'lucide-react';
import { formatTime } from '@/lib/playerUtils';

const SLEEP_OPTIONS = [15, 30, 45, 60];

type PlaybackSettingsProps = {
  open: boolean;
  onClose: () => void;
  playbackRate: number;
  onRateChange: (rate: number) => void;
  sleepUntil: number | null;
  now: number;
  onSleepChange: (minutes: number | null) => void;
};

export default function PlaybackSettings({
  open,
  onClose,
  playbackRate,
  onRateChange,
  sleepUntil,
  now,
  onSleepChange,
}: PlaybackSettingsProps) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  const sleepRemainingSec = sleepUntil === null ? 0 : Math.max(0, (sleepUntil - now) / 1000);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="playback-settings-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-t-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl sm:rounded-3xl"
      >
        <div className="mb-6 flex items-center justify-between">
          <h2 id="playback-settings-title" className="text-base font-semibold">
            Tempo & Timer
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            <X size={18} />
          </button>
        </div>

        <section>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm font-semibold">
              <Gauge size={16} className="text-emerald-400" />
              Tempo
            </span>
            <span className="font-mono text-sm tabular-nums text-emerald-300">{playbackRate.toFixed(2)}x</span>
          </div>
          <input
            type="range"
            min={0.5}
            max={2}
            step={0.05}
            value={playbackRate}
            onChange={(e) => onRateChange(Number(e.target.value))}
            aria-label="Tempo putar"
            className="mt-4 w-full accent-emerald-400"
          />
          <div className="mt-2 flex items-center justify-between text-xs text-zinc-400">
            <span className="font-mono">0.5x</span>
            <button
              type="button"
              onClick={() => onRateChange(1)}
              disabled={playbackRate === 1}
              className="rounded-full px-3 py-1 transition hover:bg-zinc-800 hover:text-emerald-300 disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            >
              Normal
            </button>
            <span className="font-mono">2x</span>
          </div>
        </section>

        <section className="mt-8 border-t border-zinc-800 pt-6">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm font-semibold">
              <Timer size={16} className="text-emerald-400" />
              Sleep timer
            </span>
            {sleepUntil !== null && (
              <span className="font-mono text-sm tabular-nums text-emerald-300">Sisa {formatTime(sleepRemainingSec)}</span>
            )}
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-5">
            <button
              type="button"
              onClick={() => onSleepChange(null)}
              className="rounded-xl border border-zinc-700 px-2 py-2.5 text-sm text-zinc-200 transition hover:border-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 active:scale-95"
            >
              Mati
            </button>
            {SLEEP_OPTIONS.map((minutes) => (
              <button
                key={minutes}
                type="button"
                onClick={() => onSleepChange(minutes)}
                className="rounded-xl border border-zinc-700 px-2 py-2.5 text-sm text-zinc-200 transition hover:border-emerald-400/60 hover:text-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 active:scale-95"
              >
                {minutes} menit
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

import { useRef } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import { Volume2 } from 'lucide-react';
import { clamp } from '@/lib/playerUtils';

export type Source = 'mp3' | 'radio';

const SOURCE_OPTIONS: { id: Source; label: string }[] = [
  { id: 'mp3', label: 'MP3' },
  { id: 'radio', label: 'RADIO' },
];

export function SourceToggle({ value, onChange }: { value: Source; onChange: (source: Source) => void }) {
  return (
    <div role="group" aria-label="Sumber audio" className="flex h-10 shrink-0 items-center gap-1 rounded-xl border border-zinc-800 bg-zinc-900 p-1">
      {SOURCE_OPTIONS.map((option) => {
        const active = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.id)}
            className={`h-8 rounded-lg px-3 text-xs font-bold tracking-wider transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
              active ? 'bg-emerald-400 text-emerald-950' : 'text-zinc-400 hover:text-zinc-100'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function VolumeKnob({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const drag = useRef<{ startY: number; startValue: number } | null>(null);
  const angle = -135 + value * 270;
  const percent = Math.round(value * 100);

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { startY: e.clientY, startValue: value };
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    onChange(clamp(drag.current.startValue + (drag.current.startY - e.clientY) / 150, 0, 1));
  };

  const endDrag = () => {
    drag.current = null;
  };

  const handleKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Home') return onChange(0);
    if (e.key === 'End') return onChange(1);
    const delta = e.key === 'ArrowUp' || e.key === 'ArrowRight' ? 0.05 : e.key === 'ArrowDown' || e.key === 'ArrowLeft' ? -0.05 : 0;
    if (delta === 0) return;
    e.preventDefault();
    onChange(clamp(value + delta, 0, 1));
  };

  return (
    <div className="flex shrink-0 flex-col items-center gap-1.5">
      <div
        role="slider"
        tabIndex={0}
        aria-label="Volume"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={`${percent} persen`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onWheel={(e) => onChange(clamp(value - e.deltaY / 800, 0, 1))}
        onKeyDown={handleKeyDown}
        className="relative h-14 w-14 cursor-grab touch-none select-none rounded-full border border-zinc-600 bg-gradient-to-b from-zinc-700 to-zinc-900 shadow-[0_6px_14px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.12)] outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-emerald-400 active:cursor-grabbing"
      >
        <div className="absolute inset-0 transition-transform duration-150 ease-out" style={{ transform: `rotate(${angle}deg)` }}>
          <span className="absolute left-1/2 top-1.5 h-4 w-1 -translate-x-1/2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
        </div>
      </div>
      <span className="flex items-center gap-1 font-mono text-xs text-zinc-400">
        <Volume2 size={12} />
        {percent}
      </span>
    </div>
  );
}

export function TransportButton({
  label,
  onClick,
  disabled,
  children,
  variant = 'default',
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
  children: ReactNode;
  variant?: 'default' | 'primary';
}) {
  const base =
    'flex items-center justify-center rounded-full transition duration-150 active:scale-95 disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400';
  const style =
    variant === 'primary'
      ? 'h-14 w-14 bg-emerald-400 text-emerald-950 shadow-[0_0_24px_rgba(52,211,153,0.35)] hover:bg-emerald-300'
      : 'h-10 w-10 text-zinc-200 hover:bg-zinc-800 hover:text-emerald-300';
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} disabled={disabled} className={`${base} ${style}`}>
      {children}
    </button>
  );
}

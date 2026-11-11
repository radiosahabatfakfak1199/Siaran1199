import { useState } from 'react';

const BAR_COUNT = 12;

type BarTiming = { duration: number; delay: number };

function createBarTimings(): BarTiming[] {
  return Array.from({ length: BAR_COUNT }, () => ({
    duration: 0.35 + Math.random() * 0.6,
    delay: -Math.random() * 1,
  }));
}

export default function VuMeter({ active }: { active: boolean }) {
  const [timings] = useState(createBarTimings);

  return (
    <div className="flex h-[110px] items-center gap-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="flex h-full flex-1 items-end gap-1 rounded-xl bg-zinc-950 p-3 ring-1 ring-inset ring-zinc-800">
        {timings.map((timing, i) => (
          <div key={i} className="flex h-full flex-1 items-end">
            <div
              className="h-full w-full origin-bottom rounded-[3px] border border-emerald-950/80 bg-gradient-to-t from-emerald-700 via-emerald-500 to-emerald-300 shadow-[inset_0_1px_0_rgba(255,255,255,.35),inset_0_-3px_4px_rgba(0,0,0,.35)]"
              style={
                active
                  ? { animation: `vu-bar ${timing.duration}s ease-in-out ${timing.delay}s infinite alternate` }
                  : { transform: 'scaleY(0.12)', transition: 'transform 300ms ease-out' }
              }
            />
          </div>
        ))}
      </div>
      <div className="flex shrink-0 flex-col items-center gap-2">
        <span
          aria-hidden="true"
          className={`h-7 w-7 rounded-full border transition-all duration-300 ${
            active
              ? 'border-red-300 bg-red-500 shadow-[0_0_14px_4px_rgba(239,68,68,0.7)]'
              : 'border-zinc-700 bg-zinc-800 shadow-inner'
          }`}
        />
        <span
          className={`font-mono text-[10px] font-bold tracking-[0.2em] transition-colors duration-300 ${
            active ? 'text-red-400' : 'text-zinc-500'
          }`}
        >
          ON AIR
        </span>
      </div>
    </div>
  );
}

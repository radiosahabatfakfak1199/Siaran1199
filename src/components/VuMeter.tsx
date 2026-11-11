import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import type { Source } from '@/components/PlayerControls';

const BAR_COUNT = 12;
const MIN_LEVEL = 0.08;
const RISE = 0.5;
const FALL = 0.05;
const SIM_RETARGET_MS = 140;
const SIM_MIN_TARGET = 0.25;

type VuMeterProps = {
  active: boolean;
  source: Source;
  analyserRef: RefObject<AnalyserNode | null>;
};

export default function VuMeter({ active, source, analyserRef }: VuMeterProps) {
  const barRefs = useRef<(HTMLDivElement | null)[]>([]);
  const liveRef = useRef({ active, source });

  useEffect(() => {
    liveRef.current = { active, source };
  }, [active, source]);

  useEffect(() => {
    const levels = Array.from({ length: BAR_COUNT }, () => MIN_LEVEL);
    const simTargets = Array.from({ length: BAR_COUNT }, () => MIN_LEVEL);
    const simNextAt = Array.from({ length: BAR_COUNT }, () => 0);
    let frequencyData = new Uint8Array(0);
    let frameId = 0;

    const computeTargets = (time: number, targets: number[]) => {
      const { active: isActive, source: currentSource } = liveRef.current;
      if (!isActive) {
        targets.fill(MIN_LEVEL);
        return;
      }

      if (currentSource === 'radio') {
        for (let i = 0; i < BAR_COUNT; i++) {
          if (time >= simNextAt[i]) {
            simTargets[i] = SIM_MIN_TARGET + Math.random() * (1 - SIM_MIN_TARGET);
            simNextAt[i] = time + SIM_RETARGET_MS * (0.5 + Math.random());
          }
          targets[i] = simTargets[i];
        }
        return;
      }

      const analyser = analyserRef.current;
      if (!analyser) {
        targets.fill(MIN_LEVEL);
        return;
      }
      if (frequencyData.length !== analyser.frequencyBinCount) {
        frequencyData = new Uint8Array(analyser.frequencyBinCount);
      }
      analyser.getByteFrequencyData(frequencyData);
      const bins = frequencyData.length;
      for (let i = 0; i < BAR_COUNT; i++) {
        const start = Math.floor((i * bins) / BAR_COUNT);
        const end = Math.max(start + 1, Math.floor(((i + 1) * bins) / BAR_COUNT));
        let sum = 0;
        for (let b = start; b < end; b++) sum += frequencyData[b];
        const average = sum / (end - start) / 255;
        targets[i] = MIN_LEVEL + average * (1 - MIN_LEVEL);
      }
    };

    const targets = Array.from({ length: BAR_COUNT }, () => MIN_LEVEL);

    const tick = (time: number) => {
      computeTargets(time, targets);
      for (let i = 0; i < BAR_COUNT; i++) {
        const target = targets[i];
        levels[i] += (target - levels[i]) * (target > levels[i] ? RISE : FALL);
        const bar = barRefs.current[i];
        if (bar) bar.style.transform = `scaleY(${levels[i].toFixed(3)})`;
      }
      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [analyserRef]);

  return (
    <div className="flex h-[110px] items-center gap-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="flex h-full flex-1 items-end gap-1 rounded-xl bg-zinc-950 p-3 ring-1 ring-inset ring-zinc-800">
        {Array.from({ length: BAR_COUNT }, (_, i) => (
          <div key={i} className="flex h-full flex-1 items-end">
            <div
              ref={(el) => {
                barRefs.current[i] = el;
              }}
              className="h-full w-full origin-bottom rounded-[3px] border border-emerald-950/80 bg-gradient-to-t from-emerald-700 via-emerald-500 to-emerald-300 shadow-[inset_0_1px_0_rgba(255,255,255,.35),inset_0_-3px_4px_rgba(0,0,0,.35)]"
              style={{ transform: `scaleY(${MIN_LEVEL})` }}
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

import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  FastForward,
  Music,
  Pause,
  Play,
  Radio,
  Repeat,
  Rewind,
  Shuffle,
  SkipBack,
  SkipForward,
  SlidersHorizontal,
  Star,
  Trash2,
  Upload,
} from 'lucide-react';
import PlaybackSettings from '@/components/PlaybackSettings';
import { TransportButton, VolumeKnob } from '@/components/PlayerControls';
import { clamp, formatTime, pad, pickNext } from '@/lib/playerUtils';
import { clearStoredTracks, loadStoredTracks, saveStoredTrack, setStoredStarred } from '@/lib/trackStore';

type Track = {
  id: string;
  title: string;
  url: string;
  starred: boolean;
};

type Mode = 'loop' | 'shuffle';

const MODE_INFO: Record<Mode, { label: string; Icon: LucideIcon }> = {
  loop: { label: 'Ulang', Icon: Repeat },
  shuffle: { label: 'Acak', Icon: Shuffle },
};

const SEEK_STEP = 10;
const SEEK_KEY_STEP = 5;
const RESTART_THRESHOLD = 3;
const STORAGE_ERROR = 'Daftar lagu tidak bisa disimpan di perangkat ini.';
const PLAY_ERROR = 'Lagu ini tidak bisa diputar. Coba file lain.';

export default function RadioPlayer() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [ready, setReady] = useState(false);
  const [index, setIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [mode, setMode] = useState<Mode>('loop');
  const [error, setError] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sleepUntil, setSleepUntil] = useState<number | null>(null);
  const [now, setNow] = useState(0);

  const audioRef = useRef<HTMLAudioElement>(null);
  const wantPlayRef = useRef(false);
  const dialDragRef = useRef(false);

  const track = index >= 0 ? tracks[index] : undefined;
  const url = track?.url;
  const modeInfo = MODE_INFO[mode];
  const progress = duration > 0 ? clamp(current / duration, 0, 1) : 0;
  const remaining = Math.max(0, duration - current);
  const sleepRemainingSec = sleepUntil === null ? 0 : Math.max(0, (sleepUntil - now) / 1000);

  useEffect(() => {
    let cancelled = false;
    loadStoredTracks()
      .then((records) => {
        const loaded = records.map((r) => ({
          id: r.id,
          title: r.title,
          url: URL.createObjectURL(r.blob),
          starred: r.starred,
        }));
        if (cancelled) {
          loaded.forEach((t) => URL.revokeObjectURL(t.url));
          return;
        }
        setTracks(loaded);
        setIndex(loaded.length > 0 ? 0 : -1);
        setReady(true);
      })
      .catch(() => {
        if (cancelled) return;
        setError(STORAGE_ERROR);
        setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = playbackRate;
  }, [playbackRate, url]);

  useEffect(() => {
    setCurrent(0);
    setDuration(0);
    if (wantPlayRef.current && url) startPlayback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  useEffect(() => {
    if (sleepUntil === null) return;
    const id = window.setInterval(() => {
      const t = Date.now();
      if (t >= sleepUntil) {
        pausePlayback();
        setSleepUntil(null);
      } else {
        setNow(t);
      }
    }, 1000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sleepUntil]);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    const session = navigator.mediaSession;
    session.metadata = track ? new MediaMetadata({ title: track.title, artist: 'Radio Lokal', album: 'Radio Lokal' }) : null;
    session.playbackState = track ? (isPlaying ? 'playing' : 'paused') : 'none';

    const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
      [
        'play',
        () => {
          if (track) startPlayback();
        },
      ],
      ['pause', pausePlayback],
      ['previoustrack', playPrevious],
      ['nexttrack', playNext],
      ['seekbackward', () => seekBy(-SEEK_STEP)],
      ['seekforward', () => seekBy(SEEK_STEP)],
      [
        'seekto',
        (details) => {
          if (details.seekTime !== undefined) seekTo(details.seekTime);
        },
      ],
    ];
    handlers.forEach(([action, handler]) => {
      try {
        session.setActionHandler(action, handler);
      } catch {
        // Aksi ini tidak didukung browser; tombol lain tetap berfungsi.
      }
    });

    if (track && Number.isFinite(duration) && duration > 0) {
      try {
        session.setPositionState({ duration, position: clamp(current, 0, duration), playbackRate });
      } catch {
        // Posisi tidak bisa diatur saat audio belum siap.
      }
    }
  });

  const startPlayback = () => {
    const audio = audioRef.current;
    if (!audio) return;
    wantPlayRef.current = true;
    audio.play().catch((err: unknown) => {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      wantPlayRef.current = false;
      setIsPlaying(false);
      setError(PLAY_ERROR);
    });
  };

  const pausePlayback = () => {
    wantPlayRef.current = false;
    audioRef.current?.pause();
  };

  const togglePlay = () => {
    if (isPlaying) pausePlayback();
    else if (track) startPlayback();
  };

  const selectTrack = (i: number) => {
    if (i === index) {
      if (audioRef.current) audioRef.current.currentTime = 0;
      startPlayback();
      return;
    }
    setError('');
    wantPlayRef.current = true;
    setIndex(i);
  };

  const handleChipClick = (i: number) => {
    if (i === index) togglePlay();
    else selectTrack(i);
  };

  const seekTo = (seconds: number) => {
    const audio = audioRef.current;
    if (!audio || !track) return;
    const max = Number.isFinite(audio.duration) ? audio.duration : 0;
    audio.currentTime = clamp(seconds, 0, max);
    setCurrent(audio.currentTime);
  };

  const seekBy = (delta: number) => seekTo((audioRef.current?.currentTime ?? 0) + delta);

  const playPrevious = () => {
    const audio = audioRef.current;
    if (!audio || !track) return;
    if (audio.currentTime > RESTART_THRESHOLD || index <= 0) {
      audio.currentTime = 0;
      return;
    }
    selectTrack(index - 1);
  };

  const playNext = () => {
    if (!track) return;
    selectTrack(pickNext(index, tracks.length, mode === 'shuffle'));
  };

  const handleEnded = () => {
    if (!track) return;
    selectTrack(pickNext(index, tracks.length, mode === 'shuffle'));
  };

  const seekFromPointer = (element: HTMLElement, clientX: number) => {
    const rect = element.getBoundingClientRect();
    seekTo(clamp((clientX - rect.left) / rect.width, 0, 1) * duration);
  };

  const handleFiles = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).filter(
      (file) => file.type.startsWith('audio/') || /\.mp3$/i.test(file.name),
    );
    e.target.value = '';
    if (files.length === 0) return;

    const base = tracks.length;
    const added = await Promise.all(
      files.map(async (file, i) => {
        const id = crypto.randomUUID();
        const title = file.name.replace(/\.mp3$/i, '');
        try {
          await saveStoredTrack({ id, title, blob: file, starred: false, addedAt: Date.now() + i });
        } catch {
          setError(STORAGE_ERROR);
        }
        return { id, title, url: URL.createObjectURL(file), starred: false };
      }),
    );
    setTracks((prev) => [...prev, ...added]);
    setIndex((prev) => (prev === -1 ? base : prev));
  };

  const clearAll = async () => {
    if (!window.confirm('Hapus semua lagu dari daftar?')) return;
    pausePlayback();
    tracks.forEach((t) => URL.revokeObjectURL(t.url));
    setTracks([]);
    setIndex(-1);
    setError('');
    try {
      await clearStoredTracks();
    } catch {
      setError(STORAGE_ERROR);
    }
  };

  const toggleStar = () => {
    if (!track) return;
    const starred = !track.starred;
    setTracks((prev) => prev.map((t) => (t.id === track.id ? { ...t, starred } : t)));
    setStoredStarred(track.id, starred).catch(() => setError(STORAGE_ERROR));
  };

  const cycleMode = () => {
    setMode((m) => (m === 'loop' ? 'shuffle' : 'loop'));
  };

  const setSleepTimer = (minutes: number | null) => {
    setNow(Date.now());
    setSleepUntil(minutes === null ? null : Date.now() + minutes * 60000);
  };

  const trackNumber = track ? pad(index + 1) : '--';
  const title = track?.title ?? 'Unggah lagu MP3 untuk mulai';
  const remainingLabel = duration > 0 ? `-${formatTime(remaining)}` : '--:--';

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-4 bg-zinc-950 px-4 py-6 text-zinc-100 sm:py-10">
      <header className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-400 ring-1 ring-emerald-400/30">
            <Radio size={20} />
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-semibold leading-tight">Radio Lokal</h1>
            <p className="truncate text-xs text-zinc-400">Pemutar MP3 dari perangkat kamu</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            aria-label="Tempo dan timer"
            title="Tempo dan timer"
            className="flex h-10 items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-zinc-400 transition hover:border-emerald-400/50 hover:text-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            <SlidersHorizontal size={16} />
            {sleepUntil !== null && (
              <span className="font-mono text-xs tabular-nums text-emerald-300">{formatTime(sleepRemainingSec)}</span>
            )}
          </button>
          {tracks.length > 0 && (
            <button
              type="button"
              onClick={clearAll}
              aria-label="Hapus semua lagu"
              title="Hapus semua lagu"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-400 transition hover:border-red-400/50 hover:text-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            >
              <Trash2 size={16} />
            </button>
          )}
          <label className="flex h-10 cursor-pointer items-center gap-2 rounded-xl bg-zinc-100 px-4 text-sm font-semibold text-zinc-900 transition hover:bg-white focus-within:ring-2 focus-within:ring-emerald-400 active:scale-95">
            <Upload size={16} />
            Unggah
            <input type="file" accept="audio/mpeg,audio/mp3,.mp3" multiple onChange={handleFiles} className="sr-only" />
          </label>
        </div>
      </header>

      <div
        className="rounded-2xl p-5 text-emerald-950"
        style={{
          backgroundImage: 'linear-gradient(135deg, #3fe0a2, #1fa971)',
          boxShadow:
            'inset 0 2px 0 rgba(255,255,255,.35), inset 0 -10px 24px rgba(0,0,0,.35), inset 0 0 40px rgba(0,0,0,.25), 0 12px 28px rgba(0,0,0,.6)',
        }}
      >
        <div className="flex items-stretch gap-4">
          <div className="flex items-end gap-1.5 self-center">
            <span className="text-5xl font-black leading-none tracking-tight tabular-nums">11.99</span>
            <span className="text-sm font-bold leading-none tracking-tight">FM</span>
          </div>
          <div className="flex min-w-0 flex-1 flex-col justify-between gap-3">
            <div className="overflow-hidden">
              <div className={`inline-flex whitespace-nowrap text-lg font-bold ${track ? 'animate-marquee motion-reduce:animate-none' : ''}`}>
                <span className="pr-12">{title}</span>
                {track && (
                  <span className="pr-12" aria-hidden="true">
                    {title}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-baseline justify-between font-mono text-sm font-semibold">
              <span>SISA</span>
              <span className="text-2xl font-bold tabular-nums">{remainingLabel}</span>
            </div>
            <div className="flex items-baseline justify-between font-mono text-sm font-semibold">
              <span className="text-[10px] font-bold tracking-[0.25em]">LAGU</span>
              <span className="text-2xl font-bold tabular-nums">{trackNumber}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
        <div
          role="slider"
          tabIndex={0}
          aria-label="Posisi lagu"
          aria-valuemin={0}
          aria-valuemax={Math.round(duration)}
          aria-valuenow={Math.round(current)}
          aria-valuetext={`${formatTime(current)} dari ${formatTime(duration)}`}
          onPointerDown={(e) => {
            if (!track) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            dialDragRef.current = true;
            seekFromPointer(e.currentTarget, e.clientX);
          }}
          onPointerMove={(e) => {
            if (dialDragRef.current) seekFromPointer(e.currentTarget, e.clientX);
          }}
          onPointerUp={() => {
            dialDragRef.current = false;
          }}
          onPointerCancel={() => {
            dialDragRef.current = false;
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft') seekBy(-SEEK_KEY_STEP);
            if (e.key === 'ArrowRight') seekBy(SEEK_KEY_STEP);
          }}
          className="relative h-14 cursor-pointer touch-none select-none overflow-hidden rounded-xl bg-zinc-950 ring-1 ring-zinc-800 outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
        >
          <div
            className="absolute inset-0 opacity-70"
            style={{
              backgroundImage:
                'repeating-linear-gradient(90deg, rgba(161,161,170,0.6) 0 2px, transparent 2px 40px), repeating-linear-gradient(90deg, rgba(113,113,122,0.7) 0 1px, transparent 1px 8px)',
              backgroundSize: '100% 100%, 100% 40%',
              backgroundPosition: 'top, bottom',
              backgroundRepeat: 'repeat, repeat-x',
            }}
          />
          <div className="absolute inset-y-0 left-0 bg-emerald-400/15" style={{ width: `${progress * 100}%` }} />
          <div
            className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.9)]"
            style={{ left: `${progress * 100}%` }}
          />
        </div>

        <div className="mt-3 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={toggleStar}
            disabled={!track}
            aria-label={track?.starred ? 'Hapus bintang' : 'Beri bintang'}
            aria-pressed={track?.starred ?? false}
            className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-800 hover:text-amber-300 active:scale-90 disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            <Star size={20} className={track?.starred ? 'fill-amber-300 text-amber-300' : ''} />
          </button>
          <span className="font-mono text-sm tabular-nums text-zinc-100">
            {formatTime(current)} <span className="text-zinc-500">/ {formatTime(duration)}</span>
          </span>
          <button
            type="button"
            onClick={cycleMode}
            aria-label={`Mode putar: ${modeInfo.label}`}
            title={`Mode putar: ${modeInfo.label}`}
            className="flex h-10 items-center gap-2 rounded-full border border-zinc-700 px-3 text-xs font-semibold uppercase tracking-wider text-zinc-200 transition hover:border-emerald-400/60 hover:text-emerald-300 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            <modeInfo.Icon size={14} />
            {modeInfo.label}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
        {!ready ? (
          <div className="flex items-center gap-3 rounded-xl border border-dashed border-zinc-700 p-4 text-sm text-zinc-400">
            <Music size={18} className="shrink-0" />
            Memuat daftar lagu...
          </div>
        ) : tracks.length === 0 ? (
          <div className="flex items-center gap-3 rounded-xl border border-dashed border-zinc-700 p-4 text-sm text-zinc-400">
            <Music size={18} className="shrink-0" />
            Belum ada lagu. Tekan Unggah untuk memilih file MP3 dari perangkat kamu.
          </div>
        ) : (
          <div className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {tracks.map((t, i) => {
              const active = i === index;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleChipClick(i)}
                  aria-pressed={active}
                  className={`flex shrink-0 snap-start items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                    active
                      ? 'border-emerald-400 bg-emerald-400 font-semibold text-emerald-950'
                      : 'border-zinc-700 bg-zinc-800 text-zinc-200 hover:border-zinc-500'
                  }`}
                >
                  <span className="font-mono text-xs tabular-nums opacity-80">{pad(i + 1)}</span>
                  <span className="max-w-[9rem] truncate">{t.title}</span>
                  {t.starred && <Star size={12} className="shrink-0 fill-amber-300 text-amber-300" />}
                </button>
              );
            })}
          </div>
        )}

        {error && (
          <p role="alert" className="text-sm text-amber-300">
            {error}
          </p>
        )}

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <TransportButton label="Sebelumnya" onClick={playPrevious} disabled={!track}>
              <SkipBack size={20} />
            </TransportButton>
            <TransportButton label="Mundur 10 detik" onClick={() => seekBy(-SEEK_STEP)} disabled={!track}>
              <Rewind size={20} />
            </TransportButton>
            <TransportButton label={isPlaying ? 'Jeda' : 'Putar'} onClick={togglePlay} disabled={!track} variant="primary">
              {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="translate-x-0.5" />}
            </TransportButton>
            <TransportButton label="Maju 10 detik" onClick={() => seekBy(SEEK_STEP)} disabled={!track}>
              <FastForward size={20} />
            </TransportButton>
            <TransportButton label="Berikutnya" onClick={playNext} disabled={!track}>
              <SkipForward size={20} />
            </TransportButton>
          </div>
          <VolumeKnob value={volume} onChange={setVolume} />
        </div>
      </div>

      <PlaybackSettings
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        playbackRate={playbackRate}
        onRateChange={setPlaybackRate}
        sleepUntil={sleepUntil}
        now={now}
        onSleepChange={setSleepTimer}
      />

      <audio
        ref={audioRef}
        src={url}
        preload="metadata"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onDurationChange={(e) => setDuration(e.currentTarget.duration)}
        onEnded={handleEnded}
        onError={() => {
          if (!track) return;
          wantPlayRef.current = false;
          setIsPlaying(false);
          setError(PLAY_ERROR);
        }}
      />
    </div>
  );
}

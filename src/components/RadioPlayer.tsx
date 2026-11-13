import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  FastForward,
  Pause,
  Play,
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
import PlaylistPanel from '@/components/PlaylistPanel';
import VuMeter from '@/components/VuMeter';
import { SourceToggle, TransportButton, VolumeKnob } from '@/components/PlayerControls';
import type { Source } from '@/components/PlayerControls';
import { STATIONS } from '@/data/stations';
import { clamp, formatTime, pad } from '@/lib/playerUtils';
import { nextPosition, readDuration, readPlaylists, savePlaylists } from '@/lib/playlists';
import type { Playlist, Position, Song } from '@/lib/playlists';
import { clearStoredTracks, deleteStoredTracks, loadStoredTracks, saveStoredTrack } from '@/lib/trackStore';

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
const STATION_ERROR = 'Stasiun tidak bisa diputar';

const firstPosition = (list: Playlist[]): Position | null => {
  const first = list.find((p) => p.songs.length > 0);
  return first ? { playlistId: first.id, song: 0 } : null;
};

export default function RadioPlayer() {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [ready, setReady] = useState(false);
  const [position, setPosition] = useState<Position | null>(null);
  const [source, setSource] = useState<Source>('mp3');
  const [stationIndex, setStationIndex] = useState(0);
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

  const mp3Ref = useRef<HTMLAudioElement>(null);
  const radioRef = useRef<HTMLAudioElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const wantPlayRef = useRef(false);
  const dialDragRef = useRef(false);

  const isRadio = source === 'radio';
  const station = STATIONS[stationIndex];
  const activePlaylist = playlists.find((p) => p.id === position?.playlistId);
  const songIndex = position?.song ?? -1;
  const track: Song | undefined = activePlaylist?.songs[songIndex];
  const trackUrl = track ? urls[track.id] : undefined;
  const activeUrl = isRadio ? station.url : trackUrl;
  const canSeek = !isRadio && !!track;
  const modeInfo = MODE_INFO[mode];
  const progress = isRadio ? 1 : duration > 0 ? clamp(current / duration, 0, 1) : 0;
  const remaining = Math.max(0, duration - current);
  const sleepRemainingSec = sleepUntil === null ? 0 : Math.max(0, (sleepUntil - now) / 1000);
  const title = isRadio ? station.nama : (track?.name ?? 'Unggah lagu MP3 untuk mulai');

  useEffect(() => {
    let cancelled = false;
    const stored = readPlaylists();
    loadStoredTracks()
      .then((records) => {
        const blobs = new Map(records.map((r) => [r.id, r.blob]));
        const objectUrls: Record<string, string> = {};
        const kept: Playlist[] = [];
        for (const playlist of stored) {
          const songs: Song[] = [];
          for (const song of playlist.songs) {
            const blob = blobs.get(song.id);
            if (!blob) continue;
            objectUrls[song.id] = URL.createObjectURL(blob);
            songs.push(song);
          }
          if (songs.length > 0) kept.push({ ...playlist, songs });
        }
        if (cancelled) {
          Object.values(objectUrls).forEach((u) => URL.revokeObjectURL(u));
          return;
        }
        setPlaylists(kept);
        setUrls(objectUrls);
        setPosition(firstPosition(kept));
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
    if (ready && !savePlaylists(playlists)) setError(STORAGE_ERROR);
  }, [playlists, ready]);

  useEffect(() => {
    if (mp3Ref.current) mp3Ref.current.volume = volume;
    if (radioRef.current) radioRef.current.volume = volume;
  }, [volume]);

  useEffect(
    () => () => {
      audioContextRef.current?.close();
    },
    [],
  );

  useEffect(() => {
    if (mp3Ref.current) mp3Ref.current.playbackRate = playbackRate;
  }, [playbackRate, activeUrl]);

  useEffect(() => {
    setCurrent(0);
    setDuration(0);
    if (wantPlayRef.current && activeUrl) startPlayback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeUrl]);

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
  }, [sleepUntil]);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    const session = navigator.mediaSession;
    session.metadata = activeUrl
      ? new MediaMetadata({ title, artist: 'Sahabat Radio', album: 'Sahabat Radio' })
      : null;
    session.playbackState = activeUrl ? (isPlaying ? 'playing' : 'paused') : 'none';

    const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
      [
        'play',
        () => {
          if (activeUrl) startPlayback();
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

    if (canSeek && Number.isFinite(duration) && duration > 0) {
      try {
        session.setPositionState({ duration, position: clamp(current, 0, duration), playbackRate });
      } catch {
        // Posisi tidak bisa diatur saat audio belum siap.
      }
    }
  });

  const prepareAnalyser = () => {
    const audio = mp3Ref.current;
    if (!audio) return;
    let context = audioContextRef.current;
    if (!context) {
      context = new AudioContext();
      const analyser = context.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.8;
      context.createMediaElementSource(audio).connect(analyser);
      analyser.connect(context.destination);
      audioContextRef.current = context;
      analyserRef.current = analyser;
    }
    void context.resume();
  };

  const startPlayback = () => {
    const audio = isRadio ? radioRef.current : mp3Ref.current;
    if (!audio) return;
    if (!isRadio) prepareAnalyser();
    wantPlayRef.current = true;
    audio.play().catch((err: unknown) => {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      wantPlayRef.current = false;
      setIsPlaying(false);
      setError(isRadio ? STATION_ERROR : PLAY_ERROR);
    });
  };

  const pausePlayback = () => {
    wantPlayRef.current = false;
    mp3Ref.current?.pause();
    radioRef.current?.pause();
  };

  const togglePlay = () => {
    if (isPlaying) pausePlayback();
    else if (activeUrl) startPlayback();
  };

  const switchSource = (next: Source) => {
    if (next === source) return;
    pausePlayback();
    setError('');
    setSource(next);
  };

  const selectPosition = (next: Position) => {
    setError('');
    wantPlayRef.current = true;
    if (isRadio) {
      radioRef.current?.pause();
      setSource('mp3');
    }
    setPosition(next);
  };

  const playPosition = (next: Position) => {
    if (position && next.playlistId === position.playlistId && next.song === position.song && !isRadio) {
      if (mp3Ref.current) mp3Ref.current.currentTime = 0;
      startPlayback();
      return;
    }
    selectPosition(next);
  };

  const handleSongTap = (next: Position) => {
    if (position && next.playlistId === position.playlistId && next.song === position.song && !isRadio) {
      togglePlay();
      return;
    }
    selectPosition(next);
  };

  const handlePlaylistPlay = (playlistId: string) => {
    if (position?.playlistId === playlistId && !isRadio) {
      togglePlay();
      return;
    }
    selectPosition({ playlistId, song: 0 });
  };

  const handleStationTap = (i: number) => {
    if (i === stationIndex) {
      togglePlay();
      return;
    }
    setError('');
    wantPlayRef.current = true;
    setStationIndex(i);
  };

  const stepStation = (delta: number) => {
    if (STATIONS.length < 2) return;
    setError('');
    wantPlayRef.current = true;
    setStationIndex((stationIndex + delta + STATIONS.length) % STATIONS.length);
  };

  const seekTo = (seconds: number) => {
    const audio = mp3Ref.current;
    if (!audio || !canSeek) return;
    const max = Number.isFinite(audio.duration) ? audio.duration : 0;
    audio.currentTime = clamp(seconds, 0, max);
    setCurrent(audio.currentTime);
  };

  const seekBy = (delta: number) => seekTo((mp3Ref.current?.currentTime ?? 0) + delta);

  const playPrevious = () => {
    if (isRadio) {
      stepStation(-1);
      return;
    }
    const audio = mp3Ref.current;
    if (!audio || !position || !track) return;
    if (audio.currentTime > RESTART_THRESHOLD || position.song <= 0) {
      audio.currentTime = 0;
      return;
    }
    selectPosition({ playlistId: position.playlistId, song: position.song - 1 });
  };

  const advance = () => {
    if (!position) return;
    const next = nextPosition(playlists, position, mode === 'shuffle');
    if (next) playPosition(next);
    else pausePlayback();
  };

  const playNext = () => {
    if (isRadio) {
      stepStation(1);
      return;
    }
    advance();
  };

  const handleEnded = () => {
    if (isRadio) return;
    advance();
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

    const createdAt = Date.now();
    const saved = await Promise.all(
      files.map(async (file) => {
        const id = crypto.randomUUID();
        try {
          await saveStoredTrack({ id, blob: file, addedAt: createdAt });
        } catch {
          return null;
        }
        const duration = await readDuration(file);
        const song: Song = { id, name: file.name.replace(/\.mp3$/i, ''), duration, starred: false };
        return { song, url: URL.createObjectURL(file) };
      }),
    );

    const songs: Song[] = [];
    const newUrls: Record<string, string> = {};
    let failed = false;
    for (const item of saved) {
      if (!item) {
        failed = true;
        continue;
      }
      songs.push(item.song);
      newUrls[item.song.id] = item.url;
    }
    if (failed) setError(STORAGE_ERROR);
    if (songs.length === 0) return;

    const playlist: Playlist = { id: crypto.randomUUID(), name: '', createdAt, songs };
    setUrls((prev) => ({ ...prev, ...newUrls }));
    setPlaylists((prev) => [...prev, { ...playlist, name: `Playlist ${prev.length + 1}` }]);
    setPosition((prev) => prev ?? { playlistId: playlist.id, song: 0 });
  };

  const deletePlaylist = (playlistId: string) => {
    const target = playlists.find((p) => p.id === playlistId);
    if (!target || !window.confirm(`Hapus ${target.name}?`)) return;
    const remaining = playlists.filter((p) => p.id !== playlistId);
    if (position?.playlistId === playlistId) {
      pausePlayback();
      setPosition(firstPosition(remaining));
    }
    setUrls((prev) => {
      const next = { ...prev };
      target.songs.forEach((s) => {
        if (next[s.id]) URL.revokeObjectURL(next[s.id]);
        delete next[s.id];
      });
      return next;
    });
    setPlaylists(remaining);
    deleteStoredTracks(target.songs.map((s) => s.id)).catch(() => setError(STORAGE_ERROR));
  };

  const renamePlaylist = (playlistId: string, name: string) => {
    setPlaylists((prev) => prev.map((p) => (p.id === playlistId ? { ...p, name } : p)));
  };

  const clearAll = async () => {
    if (!window.confirm('Hapus semua playlist dan lagu?')) return;
    pausePlayback();
    Object.values(urls).forEach((u) => URL.revokeObjectURL(u));
    setUrls({});
    setPlaylists([]);
    setPosition(null);
    setError('');
    try {
      await clearStoredTracks();
    } catch {
      setError(STORAGE_ERROR);
    }
  };

  const toggleStar = () => {
    if (!track || !position || isRadio) return;
    const { playlistId } = position;
    const trackId = track.id;
    setPlaylists((prev) =>
      prev.map((p) =>
        p.id !== playlistId
          ? p
          : { ...p, songs: p.songs.map((s) => (s.id === trackId ? { ...s, starred: !s.starred } : s)) },
      ),
    );
  };

  const cycleMode = () => {
    setMode((m) => (m === 'loop' ? 'shuffle' : 'loop'));
  };

  const setSleepTimer = (minutes: number | null) => {
    setNow(Date.now());
    setSleepUntil(minutes === null ? null : Date.now() + minutes * 60000);
  };

  const handleAudioError = () => {
    if (!activeUrl) return;
    wantPlayRef.current = false;
    setIsPlaying(false);
    setError(isRadio ? STATION_ERROR : PLAY_ERROR);
  };

  const trackNumber = track ? pad(songIndex + 1) : '--';
  const remainingLabel = duration > 0 ? `-${formatTime(remaining)}` : '--:--';

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-4 bg-zinc-950 px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-[calc(1.5rem+env(safe-area-inset-top))] text-zinc-100 sm:pb-[calc(2.5rem+env(safe-area-inset-bottom))] sm:pt-[calc(2.5rem+env(safe-area-inset-top))]">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <img
            src="/radio-logo-transparan.png"
            alt="Logo Sahabat Radio"
            width={48}
            height={48}
            className="h-12 w-12 shrink-0 object-contain"
          />
          <div className="min-w-0">
            <h1 className="text-base font-semibold leading-tight">Sahabat Radio</h1>
            <p className="truncate text-xs text-zinc-400">Kala Suara dari Timur</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <SourceToggle value={source} onChange={switchSource} />
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
          {!isRadio && playlists.length > 0 && (
            <button
              type="button"
              onClick={clearAll}
              aria-label="Hapus semua playlist"
              title="Hapus semua playlist"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-400 transition hover:border-red-400/50 hover:text-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            >
              <Trash2 size={16} />
            </button>
          )}
          {!isRadio && (
            <label className="flex h-10 cursor-pointer items-center gap-2 rounded-xl bg-zinc-100 px-4 text-sm font-semibold text-zinc-900 transition hover:bg-white focus-within:ring-2 focus-within:ring-emerald-400 active:scale-95">
              <Upload size={16} />
              Unggah
              <input type="file" accept="audio/mpeg,audio/mp3,.mp3" multiple onChange={handleFiles} className="sr-only" />
            </label>
          )}
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
            <span className="text-5xl font-black leading-none tracking-tight tabular-nums">
              {isRadio ? station.frekuensi.toFixed(1) : '11.99'}
            </span>
            <span className="text-sm font-bold leading-none tracking-tight">FM</span>
          </div>
          <div className="flex min-w-0 flex-1 flex-col justify-between gap-3">
            <div className="overflow-hidden">
              <div className={`inline-flex whitespace-nowrap text-lg font-bold ${activeUrl ? 'animate-marquee motion-reduce:animate-none' : ''}`}>
                <span className="pr-12">{title}</span>
                {activeUrl && (
                  <span className="pr-12" aria-hidden="true">
                    {title}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-baseline justify-between font-mono text-sm font-semibold">
              <span>{isRadio ? 'LIVE' : 'SISA'}</span>
              <span className="text-2xl font-bold tabular-nums">{isRadio ? '' : remainingLabel}</span>
            </div>
            <div className="flex items-baseline justify-between font-mono text-sm font-semibold">
              <span className="text-[10px] font-bold tracking-[0.25em]">{isRadio ? 'STASIUN' : 'LAGU'}</span>
              <span className="text-2xl font-bold tabular-nums">{isRadio ? pad(stationIndex + 1) : trackNumber}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
        <div
          role="slider"
          tabIndex={canSeek ? 0 : -1}
          aria-label="Posisi lagu"
          aria-disabled={!canSeek}
          aria-valuemin={0}
          aria-valuemax={Math.round(duration)}
          aria-valuenow={Math.round(current)}
          aria-valuetext={`${formatTime(current)} dari ${formatTime(duration)}`}
          onPointerDown={(e) => {
            if (!canSeek) return;
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
          className={`relative h-14 touch-none select-none overflow-hidden rounded-xl bg-zinc-950 ring-1 ring-zinc-800 outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${canSeek ? 'cursor-pointer' : 'cursor-default'}`}
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
            disabled={!track || isRadio}
            aria-label={track?.starred ? 'Hapus bintang' : 'Beri bintang'}
            aria-pressed={track?.starred ?? false}
            className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-800 hover:text-amber-300 active:scale-90 disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            <Star size={20} className={track?.starred && !isRadio ? 'fill-amber-300 text-amber-300' : ''} />
          </button>
          <span className="font-mono text-sm tabular-nums text-zinc-100">
            {isRadio ? (
              <span className="text-zinc-500">Siaran langsung</span>
            ) : (
              <>
                {formatTime(current)} <span className="text-zinc-500">/ {formatTime(duration)}</span>
              </>
            )}
          </span>
          <button
            type="button"
            onClick={cycleMode}
            disabled={isRadio}
            aria-label={`Mode putar: ${modeInfo.label}`}
            title={`Mode putar: ${modeInfo.label}`}
            className="flex h-10 items-center gap-2 rounded-full border border-zinc-700 px-3 text-xs font-semibold uppercase tracking-wider text-zinc-200 transition hover:border-emerald-400/60 hover:text-emerald-300 active:scale-95 disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            <modeInfo.Icon size={14} />
            {modeInfo.label}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
        {isRadio && (
          <div className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {STATIONS.map((s, i) => (
              <button
                key={s.url}
                type="button"
                onClick={() => handleStationTap(i)}
                aria-pressed={i === stationIndex}
                className={`flex shrink-0 snap-start items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                  i === stationIndex
                    ? 'border-emerald-400 bg-emerald-400 font-semibold text-emerald-950'
                    : 'border-zinc-700 bg-zinc-800 text-zinc-200 hover:border-zinc-500'
                }`}
              >
                <span className="font-mono text-xs tabular-nums opacity-80">{pad(i + 1)}</span>
                <span className="max-w-[9rem] truncate">{s.nama}</span>
              </button>
            ))}
          </div>
        )}

        {error && (
          <p role="alert" className="text-sm text-amber-300">
            {error}
          </p>
        )}

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <TransportButton
              label="Sebelumnya"
              onClick={playPrevious}
              disabled={isRadio ? STATIONS.length < 2 : !track}
            >
              <SkipBack size={20} />
            </TransportButton>
            <TransportButton label="Mundur 10 detik" onClick={() => seekBy(-SEEK_STEP)} disabled={!canSeek}>
              <Rewind size={20} />
            </TransportButton>
            <TransportButton
              label={isPlaying ? 'Jeda' : 'Putar'}
              onClick={togglePlay}
              disabled={!activeUrl}
              variant="primary"
            >
              {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="translate-x-0.5" />}
            </TransportButton>
            <TransportButton label="Maju 10 detik" onClick={() => seekBy(SEEK_STEP)} disabled={!canSeek}>
              <FastForward size={20} />
            </TransportButton>
            <TransportButton
              label="Berikutnya"
              onClick={playNext}
              disabled={isRadio ? STATIONS.length < 2 : !track}
            >
              <SkipForward size={20} />
            </TransportButton>
          </div>
          <VolumeKnob value={volume} onChange={setVolume} />
        </div>
      </div>

      <VuMeter active={isPlaying} source={source} analyserRef={analyserRef} />

      {!isRadio && (
        <PlaylistPanel
          ready={ready}
          playlists={playlists}
          position={position}
          isPlaying={isPlaying}
          onPlayPlaylist={handlePlaylistPlay}
          onPlaySong={(playlistId, song) => handleSongTap({ playlistId, song })}
          onDeletePlaylist={deletePlaylist}
          onRenamePlaylist={renamePlaylist}
        />
      )}

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
        ref={mp3Ref}
        src={trackUrl}
        preload="metadata"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onDurationChange={(e) => setDuration(e.currentTarget.duration)}
        onEnded={handleEnded}
        onError={handleAudioError}
      />
      <audio
        ref={radioRef}
        src={station.url}
        preload="none"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onError={handleAudioError}
      />
    </div>
  );
}

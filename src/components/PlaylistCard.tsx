import { useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { ChevronDown, Pause, Pencil, Play, Star, Trash2 } from 'lucide-react';
import { formatTime, pad } from '@/lib/playerUtils';
import { formatUploadDate } from '@/lib/playlists';
import type { Playlist } from '@/lib/playlists';

type PlaylistCardProps = {
  playlist: Playlist;
  isActive: boolean;
  activeSong: number;
  isPlaying: boolean;
  expanded: boolean;
  onToggle: () => void;
  onPlay: () => void;
  onPlaySong: (song: number) => void;
  onDelete: () => void;
  onRename: (name: string) => void;
};

export default function PlaylistCard({
  playlist,
  isActive,
  activeSong,
  isPlaying,
  expanded,
  onToggle,
  onPlay,
  onPlaySong,
  onDelete,
  onRename,
}: PlaylistCardProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const editDoneRef = useRef(true);
  const playing = isActive && isPlaying;

  const startEdit = () => {
    editDoneRef.current = false;
    setDraft(playlist.name);
    setEditing(true);
  };

  const finishEdit = (save: boolean) => {
    if (editDoneRef.current) return;
    editDoneRef.current = true;
    setEditing(false);
    const next = draft.trim();
    if (save && next && next !== playlist.name) onRename(next);
  };

  const handleEditKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') finishEdit(true);
    if (e.key === 'Escape') finishEdit(false);
  };

  return (
    <article
      className={`rounded-xl border p-3 transition-colors ${
        isActive ? 'border-emerald-400/50 bg-zinc-950' : 'border-zinc-800 bg-zinc-950/60'
      }`}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-label={expanded ? 'Tutup daftar lagu' : 'Buka daftar lagu'}
          className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
        >
          <ChevronDown size={18} className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
        </button>

        <div className="min-w-0 flex-1 py-1">
          {editing ? (
            <input
              autoFocus
              value={draft}
              maxLength={60}
              aria-label="Nama playlist"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleEditKey}
              onBlur={() => finishEdit(true)}
              className="w-full rounded-md border border-emerald-400 bg-zinc-900 px-2 py-1 text-sm font-semibold text-zinc-100 outline-none"
            />
          ) : (
            <p className="break-words text-sm leading-snug">
              <span className="font-semibold text-zinc-100">{playlist.name}</span>
              <span className="text-zinc-400">
                {' '}
                - {playlist.songs.length} Lagu - {formatUploadDate(playlist.createdAt)}
              </span>
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={onPlay}
          aria-label={playing ? 'Jeda playlist' : 'Putar playlist'}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-400 text-emerald-950 transition hover:bg-emerald-300 active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
        >
          {playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="translate-x-px" />}
        </button>
      </div>

      {!editing && (
        <div className="mt-2 flex justify-end gap-1">
          <button
            type="button"
            onClick={startEdit}
            className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            <Pencil size={14} />
            Ubah nama
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-zinc-400 transition hover:bg-zinc-800 hover:text-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            <Trash2 size={14} />
            Hapus
          </button>
        </div>
      )}

      {expanded && (
        <ol className="mt-2 flex flex-col border-t border-zinc-800 pt-1">
          {playlist.songs.map((song, i) => {
            const active = i === activeSong;
            return (
              <li key={song.id}>
                <button
                  type="button"
                  onClick={() => onPlaySong(i)}
                  aria-current={active}
                  className={`flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left transition hover:bg-zinc-800/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                    active ? 'text-emerald-300' : 'text-zinc-200'
                  }`}
                >
                  <span className="w-6 shrink-0 font-mono text-xs tabular-nums text-zinc-500">{pad(i + 1)}</span>
                  <span className={`min-w-0 flex-1 truncate text-sm ${active ? 'font-semibold' : ''}`}>{song.name}</span>
                  {song.starred && <Star size={12} className="shrink-0 fill-amber-300 text-amber-300" />}
                  <span className="shrink-0 font-mono text-xs tabular-nums text-zinc-400">{formatTime(song.duration)}</span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </article>
  );
}

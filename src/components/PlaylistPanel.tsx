import { useState } from 'react';
import { Music } from 'lucide-react';
import PlaylistCard from '@/components/PlaylistCard';
import type { Playlist, Position } from '@/lib/playlists';

type PlaylistPanelProps = {
  ready: boolean;
  playlists: Playlist[];
  position: Position | null;
  isPlaying: boolean;
  onPlayPlaylist: (playlistId: string) => void;
  onPlaySong: (playlistId: string, song: number) => void;
  onDeletePlaylist: (playlistId: string) => void;
  onRenamePlaylist: (playlistId: string, name: string) => void;
};

export default function PlaylistPanel({
  ready,
  playlists,
  position,
  isPlaying,
  onPlayPlaylist,
  onPlaySong,
  onDeletePlaylist,
  onRenamePlaylist,
}: PlaylistPanelProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <section aria-label="Daftar playlist" className="flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
      <h2 className="text-xs font-bold uppercase tracking-[0.25em] text-zinc-400">Playlist</h2>

      {!ready && (
        <div className="flex items-center gap-3 rounded-xl border border-dashed border-zinc-700 p-4 text-sm text-zinc-400">
          <Music size={18} className="shrink-0" />
          Memuat playlist...
        </div>
      )}

      {ready && playlists.length === 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-dashed border-zinc-700 p-4 text-sm text-zinc-400">
          <Music size={18} className="shrink-0" />
          Belum ada playlist. Tekan Unggah untuk membuat playlist dari file MP3 kamu.
        </div>
      )}

      {ready &&
        playlists.map((playlist) => {
          const isActive = position?.playlistId === playlist.id;
          return (
            <PlaylistCard
              key={playlist.id}
              playlist={playlist}
              isActive={isActive}
              activeSong={isActive && position ? position.song : -1}
              isPlaying={isPlaying}
              expanded={expandedId === playlist.id}
              onToggle={() => setExpandedId((prev) => (prev === playlist.id ? null : playlist.id))}
              onPlay={() => onPlayPlaylist(playlist.id)}
              onPlaySong={(song) => onPlaySong(playlist.id, song)}
              onDelete={() => onDeletePlaylist(playlist.id)}
              onRename={(name) => onRenamePlaylist(playlist.id, name)}
            />
          );
        })}
    </section>
  );
}

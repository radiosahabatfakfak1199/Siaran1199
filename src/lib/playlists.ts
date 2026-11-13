import { pickNext } from '@/lib/playerUtils';

export type Song = {
  id: string;
  name: string;
  duration: number;
  starred: boolean;
};

export type Playlist = {
  id: string;
  name: string;
  createdAt: number;
  songs: Song[];
};

export type Position = {
  playlistId: string;
  song: number;
};

const STORAGE_KEY = 'sahabat-radio-playlists';

export function readPlaylists(): Playlist[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(parsed) ? (parsed as Playlist[]) : [];
  } catch {
    return [];
  }
}

export function savePlaylists(playlists: Playlist[]): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(playlists));
    return true;
  } catch {
    return false;
  }
}

export function readDuration(blob: Blob): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const audio = new Audio();
    const finish = (seconds: number) => {
      URL.revokeObjectURL(url);
      resolve(seconds);
    };
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => finish(Number.isFinite(audio.duration) ? audio.duration : 0);
    audio.onerror = () => finish(0);
    audio.src = url;
  });
}

export function nextPosition(playlists: Playlist[], position: Position, shuffle: boolean): Position | null {
  const current = playlists.findIndex((p) => p.id === position.playlistId);
  const songs = playlists[current]?.songs ?? [];
  if (songs.length === 0) return null;
  if (shuffle) return { playlistId: position.playlistId, song: pickNext(position.song, songs.length, true) };
  if (position.song + 1 < songs.length) return { playlistId: position.playlistId, song: position.song + 1 };
  for (let next = current + 1; next < playlists.length; next++) {
    if (playlists[next].songs.length > 0) return { playlistId: playlists[next].id, song: 0 };
  }
  return null;
}

export const formatUploadDate = (timestamp: number) =>
  new Date(timestamp).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

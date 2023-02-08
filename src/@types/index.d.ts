declare namespace PlaylistExporter {
  interface PersistedPlaylist {
    // The ID of the playlist as defined by Subsonic API
    // id: string;
    // The format that the playlist was downloaded - defined by user
    format: formats;
    // The bitrate that the songs in the playlist are restricted to - defined by user
    bitrate?: number;
    songs: PersistedSong[];
  }

  interface PersistedSong {
    id: string;
    path: string;
  }

  type formats = 'raw' | 'mp3' | 'opus';
}

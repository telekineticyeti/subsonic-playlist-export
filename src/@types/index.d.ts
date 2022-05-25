declare namespace Exporter {
  interface PersistedPlaylist {
    id: string;
    songs: PersistedSong[];
  }

  interface PersistedSong {
    id: string;
    path: string;
  }
}

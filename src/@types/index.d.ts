declare namespace PlaylistExporter {
  interface PersistedPlaylist {
    // The format that the playlist was downloaded - defined by user
    format: SongFormats;
    // The bitrate that the songs in the playlist are restricted to - defined by user
    bitrate?: number;
    songs: PersistedSong[];
  }

  // Only the following properties are required for matching persist to Subsonic Playlist
  // and syncing the differences.
  interface PersistedSong {
    id: string;
    path: string;
  }

  type SongFormats = 'raw' | 'mp3' | 'opus';

  type PlaylistFormats = 'm3u' | 'm3u8';

  interface IParseArgs {
    host?: string;
    user?: string;
    password?: string;
    envFile?: string;
    cache?: boolean;
    format?: string;
    help?: boolean;
    list?: boolean;
    maxBitrate?: number;
    outputPath?: string;
    playlistFormat?: string;
    playlistId?: string[];
    playlistOnly?: boolean;
    absolutePaths?: boolean;
    appName?: string;
    appVersion?: string;
    verbose?: boolean;
    zuneCompatibility?: boolean;
  }

  // Extends the IParseArgs interface, but removes the optional flag on specific properties
  // on which the arguements parser provides a default value.
  interface IPlaylistExportConfig extends Omit<IParseArgs, 'format playlistFormat maxBitRate outputPath'> {
    format: SongFormats;
    playlistFormat: PlaylistFormats;
    maxBitrate: number;
    outputPath: string;
    absolute: boolean;
  }
}

declare namespace Subsonic {
  export interface response {
    'subsonic-response': {
      $: {
        status: StatusTypes;
        version: string;
        xmlns: string;
      };
      error?: {};
      albumList2?: [
        {
          album: getAlbumList[];
        },
      ];
      getAlbum?: [
        {
          $: getAlbumEntity;
          song: getSongList[];
        },
      ];
      playlists?: [
        {
          playlist?: playlistList[];
        },
      ];
      playlist?: [
        {
          $: playlist;
          entry: getSongList[];
        },
      ];
      searchResult3?: [
        {
          artist?: getArtistList[];
          album?: getAlbumList[];
          song?: getSongList[];
        },
      ];
      artist?: [
        {
          $: getArtistEntity;
          album?: getAlbumList[];
        },
      ];
      artistInfo2?: [
        {
          biography?: string;
          musicBrainzId?: string;
          lastFmUrl?: string;
          smallImageUrl?: string;
          mediumImageUrl?: string;
          largeImageUrl?: string;
        },
      ];
      album?: {};
    };
  }

  export interface error {
    code: string;
    message: string;
  }

  export interface artist {
    id: string;
    name: string;
    coverArt: string;
    albumCount: string;
  }

  export interface playlist {
    id: string;
    name: string;
    comment: string;
    owner: string;
    public: string;
    songCount: string;
    duration: string;
    created: string;
    changed: string;
    coverArt: string;
  }

  export interface playlistList {
    $: playlist;
  }

  export interface song {
    album: string;
    albumId?: string;
    artistId?: string;
    artist: string;
    discNumber?: string;
    bitRate: string;
    contentType: string;
    coverArt?: string;
    created: string;
    duration: string;
    genre?: string;
    id: string;
    isDir: string;
    isVideo: string;
    parent: string;
    path: string;
    playCount?: string;
    size: string;
    starred?: string;
    suffix: string;
    title: string;
    track?: string;
    transcodedContentType?: string;
    transcodedSuffix?: string;
    type?: string;
    year?: string;
  }

  // http://www.subsonic.org/pages/api.jsp#getAlbumList2
  export interface albumListEntity {
    artist: string;
    artistId: string;
    coverArt: string;
    created: string;
    duration: string;
    genre?: string;
    id: string;
    name: string;
    songCount: string;
    year?: string;
  }

  // http://www.subsonic.org/pages/api.jsp#getAlbum
  export interface getAlbumEntity {
    artist: string;
    artistId: string;
    coverArt: string;
    created: string;
    duration: string;
    genre?: string;
    id: string;
    name: string;
    songCount: string;
  }

  // http://www.subsonic.org/pages/api.jsp#getArtistInfo2
  // http://www.subsonic.org/pages/api.jsp#getArtist
  export interface getArtistEntity {
    id: string;
    name: string;
    coverArt: string;
    albumCount: string;
  }

  export interface getArtistList {
    $: artist;
  }

  export interface getSongList {
    $: song;
  }

  export interface getAlbumList {
    $: albumListEntity;
  }

  export interface getAlbum {
    $: getAlbumEntity;
  }

  export interface getArtist {
    $: getArtistEntity;
  }

  export type StatusTypes = 'ok' | 'error';
}

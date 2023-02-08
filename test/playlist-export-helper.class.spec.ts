import PersistClass from '../src/persist.class';
import {PlaylistExportTask} from '../src/playlist-export-helper.class';
import config from '../src/config';
import fse from 'fs-extra';

jest.mock('../src/persist.class');
jest.mock('fs-extra');

const mockedPersistHelper = <jest.Mock<PersistClass>>PersistClass;

const mockApi: any = {};

let exporter: PlaylistExportTask;

describe('PlaylistExportTask()', () => {
  beforeEach(() => {
    const mockPlaylist: any = {
      playlist: {
        id: '123456',
        name: 'My Mock Playlist',
        created: '2023-01-23T23:04:15Z',
        changed: '2023-02-05T00:59:42Z',
        songCount: '3',
        duration: '339',
      },
      songs: [
        {id: 'song1', path: 'music/artist01/album/song1.mp3'},
        {id: 'song2', path: 'music/_compilations/song2.flac'},
        {id: 'song3', path: 'music/artist01/album 2/song3.opus'},
      ],
    };
    exporter = new PlaylistExportTask(mockPlaylist, mockApi);
    mockedPersistHelper.mockClear();
  });

  describe('writePlaylistFile()', () => {
    it(`should write m3u8 playlist by default.`, () => {
      exporter.writePlaylistFile();
      expect(fse.writeFile).toHaveBeenCalledWith(
        'exported-playlists/My Mock Playlist.m3u8',
        `# Exported from subsonic My Mock Playlist (123456)\n# Created: 2023-01-23T23:04:15Z, Updated: 2023-02-05T00:59:42Z\nmusic/artist01/album/song1.mp3\nmusic/_compilations/song2.flac\nmusic/artist01/album 2/song3.opus\n`,
        {encoding: 'utf8'},
      );
    });

    it(`should write m3u playlist if 'config.playlistFormat' is set to 'm3u'.`, () => {
      config.playlistFormat = 'm3u';
      exporter.writePlaylistFile();
      expect(fse.writeFile).toHaveBeenCalledWith(
        'exported-playlists/My Mock Playlist.m3u',
        `# Exported from subsonic My Mock Playlist (123456)\n# Created: 2023-01-23T23:04:15Z, Updated: 2023-02-05T00:59:42Z\nmusic/artist01/album/song1.mp3\nmusic/_compilations/song2.flac\nmusic/artist01/album 2/song3.opus\n`,
        {},
      );
    });
  });

  describe('purgeRemovedTracks()', () => {
    // TODO
  });

  describe('updatePersist()', () => {
    // TODO
  });

  describe('exportSongs()', () => {
    // TODO
  });

  describe('export()', () => {
    // TODO
  });

  describe('setSongExports()', () => {
    beforeEach(() => {
      config.maxBitrate = undefined;
      config.format = 'raw';
    });

    it(`should retain original path if format is not defined.`, () => {
      config.format = undefined;

      (exporter as any).setSongExports(exporter.playlist.songs);

      expect((exporter as any).songsToExport).toEqual([
        {id: 'song1', path: 'music/artist01/album/song1.mp3'},
        {id: 'song2', path: 'music/_compilations/song2.flac'},
        {id: 'song3', path: 'music/artist01/album 2/song3.opus'},
      ]);
    });

    it(`should alter path to *.mp3 if format is defined as 'mp3'.`, () => {
      config.format = 'mp3';

      (exporter as any).setSongExports(exporter.playlist.songs);

      expect((exporter as any).songsToExport).toEqual([
        {id: 'song1', path: 'music/artist01/album/song1.mp3'},
        {id: 'song2', path: 'music/_compilations/song2.mp3'},
        {id: 'song3', path: 'music/artist01/album 2/song3.mp3'},
      ]);
    });

    it(`should alter path to *.opus if format is defined as 'opus'.`, () => {
      config.format = 'opus';

      (exporter as any).setSongExports(exporter.playlist.songs);

      expect((exporter as any).songsToExport).toEqual([
        {id: 'song1', path: 'music/artist01/album/song1.opus'},
        {id: 'song2', path: 'music/_compilations/song2.opus'},
        {id: 'song3', path: 'music/artist01/album 2/song3.opus'},
      ]);
    });
  });

  describe('resolveSongs()', () => {
    beforeEach(() => {
      (exporter as any).playlist = {
        playlist: {},
        songs: [
          {id: 'song1', path: ''},
          {id: 'song2', path: ''},
          {id: 'song3', path: ''},
        ],
      };
      config.maxBitrate = undefined;
      config.format = 'raw';
    });

    it(`should remove songs if user config format differs from persisted format`, () => {
      jest.spyOn(exporter as any, 'clearAllPersistedSongs');
      jest.spyOn(exporter as any, 'setSongExports');
      exporter.persistedData = {
        format: 'raw',
        songs: [
          {id: 'song1', path: ''},
          {id: 'song2', path: ''},
          {id: 'song3', path: ''},
        ],
      };

      config.format = 'mp3';

      exporter.resolveSongs();

      expect(exporter.songsToRemove).toEqual([
        {id: 'song1', path: ''},
        {id: 'song2', path: ''},
        {id: 'song3', path: ''},
      ]);
      expect((exporter as any).clearAllPersistedSongs).toHaveBeenCalled();
      expect((exporter as any).setSongExports).toHaveBeenCalledWith([
        {id: 'song1', path: ''},
        {id: 'song2', path: ''},
        {id: 'song3', path: ''},
      ]);
    });

    it(`should remove songs if user config maxBitrate differs from persisted bitrate`, () => {
      jest.spyOn(exporter as any, 'clearAllPersistedSongs');
      jest.spyOn(exporter as any, 'setSongExports');

      exporter.persistedData = {
        format: 'mp3',
        bitrate: 128,
        songs: [
          {id: 'song1', path: ''},
          {id: 'song2', path: ''},
          {id: 'song3', path: ''},
        ],
      };

      config.maxBitrate = 190;
      config.format = 'mp3';

      exporter.resolveSongs();

      expect(exporter.songsToRemove).toEqual([
        {id: 'song1', path: ''},
        {id: 'song2', path: ''},
        {id: 'song3', path: ''},
      ]);
      expect((exporter as any).clearAllPersistedSongs).toHaveBeenCalled();
      expect((exporter as any).setSongExports).toHaveBeenCalledWith([
        {id: 'song1', path: ''},
        {id: 'song2', path: ''},
        {id: 'song3', path: ''},
      ]);
    });

    it(`should not remove songs if user config maxBitrate matches persisted bitrate`, () => {
      jest.spyOn(exporter as any, 'clearAllPersistedSongs');
      jest.spyOn(exporter as any, 'setSongExports');

      exporter.persistedData = {
        format: 'mp3',
        bitrate: 190,
        songs: [
          {id: 'song1', path: ''},
          {id: 'song2', path: ''},
          {id: 'song3', path: ''},
        ],
      };

      config.maxBitrate = 190;
      config.format = 'mp3';

      exporter.resolveSongs();

      expect(exporter.songsToRemove).toEqual([]);
      expect((exporter as any).clearAllPersistedSongs).not.toHaveBeenCalled();
      expect((exporter as any).setSongExports).toHaveBeenCalledWith([]);
    });

    it(`should not remove songs if user config format matches persisted format`, () => {
      jest.spyOn(exporter as any, 'clearAllPersistedSongs');
      jest.spyOn(exporter as any, 'setSongExports');

      exporter.persistedData = {
        format: 'mp3',
        songs: [
          {id: 'song1', path: ''},
          {id: 'song2', path: ''},
          {id: 'song3', path: ''},
        ],
      };

      config.format = 'mp3';

      exporter.resolveSongs();

      expect(exporter.songsToRemove).toEqual([]);
      expect((exporter as any).clearAllPersistedSongs).not.toHaveBeenCalled();
      expect((exporter as any).setSongExports).toHaveBeenCalledWith([]);
    });

    it(`should remove songs no longer in the remote playlist, and add new songs in the remote playlist`, () => {
      jest.spyOn(exporter as any, 'clearAllPersistedSongs');
      jest.spyOn(exporter as any, 'setSongExports');
      (exporter as any).playlist.songs = [
        {id: 'song1', path: ''},
        {id: 'song2', path: ''},
        {id: 'song3', path: ''},
        {id: 'song5', path: ''},
      ];
      exporter.persistedData = {
        format: 'mp3',
        songs: [
          {id: 'song1', path: ''},
          {id: 'song2', path: ''},
          {id: 'song3', path: ''},
          {id: 'song4', path: ''},
        ],
      };

      config.format = 'mp3';

      exporter.resolveSongs();

      expect((exporter as any).clearAllPersistedSongs).not.toHaveBeenCalled();
      expect((exporter as any).setSongExports).toHaveBeenCalledWith([{id: 'song5', path: ''}]);
      expect(exporter.songsToRemove).toEqual([{id: 'song4', path: ''}]);
      expect(exporter.songsToExport).toEqual([{id: 'song5', path: ''}]);
    });
  });
});

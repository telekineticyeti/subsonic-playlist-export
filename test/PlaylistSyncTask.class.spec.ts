import PersistClass from '../src/persist.class';
import {PlaylistSyncTask} from '../src/playlist-sync';
import config from '../src/config';
import fse from 'fs-extra';

jest.mock('../src/persist.class');
jest.mock('fs-extra');

const mockedPersistHelper = <jest.Mock<PersistClass>>PersistClass;

const mockApi: any = {};

let exporter: PlaylistSyncTask;

describe('PlaylistSyncTask()', () => {
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
    exporter = new PlaylistSyncTask(mockPlaylist, mockApi);
    mockedPersistHelper.mockClear();
  });

  describe('writePlaylist()', () => {
    it(`should write m3u8 playlist by default.`, () => {
      jest
        .spyOn(exporter as any, 'createPlaylistString')
        .mockReturnValueOnce('# Mock Playlist String');

      exporter.writePlaylist();

      expect((exporter as any).createPlaylistString).toHaveBeenCalled();
      expect(fse.writeFile).toHaveBeenCalledWith(
        'exported-playlists/My Mock Playlist.m3u8',
        `# Mock Playlist String`,
        {encoding: 'utf8'},
      );
    });

    it(`should write m3u playlist if 'config.playlistFormat' is set to 'm3u'.`, () => {
      jest
        .spyOn(exporter as any, 'createPlaylistString')
        .mockReturnValueOnce('# Mock Playlist String');

      config.playlistFormat = 'm3u';

      exporter.writePlaylist();

      expect((exporter as any).createPlaylistString).toHaveBeenCalled();
      expect(fse.writeFile).toHaveBeenCalledWith(
        'exported-playlists/My Mock Playlist.m3u',
        '# Mock Playlist String',
        {},
      );
    });
  });

  describe('createPlaylistString()', () => {
    it(`should create playlist string`, () => {
      jest
        .spyOn(exporter as any, 'setPathFormat')
        .mockReturnValueOnce('music/artist01/album/song1.mp3')
        .mockReturnValueOnce('music/_compilations/song2.flac')
        .mockReturnValueOnce('music/artist01/album 2/song3.opus');

      config.user = 'tim';
      config.host = 'https://mySubsonic.music';

      const result = (exporter as any).createPlaylistString();

      expect(result).toEqual(
        '# Playlist Sync: tim@https://mySubsonic.music - My Mock Playlist [123456]\n' +
          '# Created: 2023-01-23T23:04:15Z\n' +
          '# Updated: 2023-02-05T00:59:42Z\n' +
          '# Sync Options: [format=raw] [maxBitrate=0]\n' +
          'music/artist01/album/song1.mp3\n' +
          'music/_compilations/song2.flac\n' +
          'music/artist01/album 2/song3.opus\n',
      );
    });
  });

  describe('exportSongs()', () => {
    // TODO
  });

  describe('export()', () => {
    // TODO
  });

  xdescribe('purgeRemovedTracks()', () => {
    it(`should remove songs files specified in songsToRemove property, 
        and recursively remove empty path to songs until the defined
        'config.outputPath' is reached.`, () => {
      expect.assertions(1);
      exporter.songsToRemove = [
        {id: 'song1', path: 'music/artist01/album/song1.flac'},
        {id: 'song2', path: 'music/artist01/album2/song2.mp3'},
        {id: 'song3', path: 'music/_compilations/soundtrack/song3.flac'},
      ];

      // Tricky to mock as we need to return vals from fse.remove and fse.readdir to
      // emulate recursion.

      (exporter as any).purgeRemovedTracks();

      expect(fse.remove).toHaveBeenNthCalledWith(
        1,
        'exported-playlists/music/artist01/album/song1.flac',
      );
      expect(fse.remove).toHaveBeenNthCalledWith(
        2,
        'exported-playlists/music/artist01/album/song1.flac',
      );
      // expect(fse.remove).toHaveBeenNthCalledWith(
      //   3,
      //   'exported-playlists/music/artist01/album/song1.flac',
      // );
      // expect(fse.remove).toHaveBeenNthCalledWith(
      //   4,
      //   'exported-playlists/music/artist01/album/song1.flac',
      // );
      // expect(fse.remove).toHaveBeenNthCalledWith(
      //   5,
      //   'exported-playlists/music/artist01/album/song1.flac',
      // );
      // expect(fse.remove).toHaveBeenNthCalledWith(
      //   6,
      //   'exported-playlists/music/artist01/album/song1.flac',
      // );
    });
  });

  describe('updatePersist()', () => {
    // TODO
  });

  describe('setPathFormat()', () => {
    it(`should not modify the given path`, () => {
      const result = (exporter as any).setPathFormat('music/artist01/album/song1.mp3');
      expect(result).toEqual('music/artist01/album/song1.mp3');
    });

    it(`should not modify given path if adjustPathResolution is set and 'config.absolute=true'`, () => {
      config.absolute = true;
      const result = (exporter as any).setPathFormat('music/artist01/album/song1.mp3', true);
      expect(result).toEqual('music/artist01/album/song1.mp3');
    });

    it(`should modify given path if adjustPathResolution is set and 'config.absolute=false'`, () => {
      config.absolute = false;
      const result = (exporter as any).setPathFormat('music/artist01/album/song1.mp3', true);
      expect(result).toEqual('.music/artist01/album/song1.mp3');
    });

    it(`should not modify the path extension if format is defined as raw`, () => {
      config.format = 'raw';
      const result = (exporter as any).setPathFormat('music/artist01/album/song1.flac');
      expect(result).toEqual('music/artist01/album/song1.flac');
    });

    it(`should modify the path extension if format is defined as mp3`, () => {
      config.format = 'mp3';
      const result = (exporter as any).setPathFormat('music/artist01/album/song1.flac');
      expect(result).toEqual('music/artist01/album/song1.mp3');
    });

    it(`should modify the path extension if format is defined as opus`, () => {
      config.format = 'opus';
      const result = (exporter as any).setPathFormat('music/artist01/album/song1.flac');
      expect(result).toEqual('music/artist01/album/song1.opus');
    });

    it(`should modify the path extension if format is defined as opus
      and 'adjustPathResolution=true' and 'config.absolute="false"'`, () => {
      config.format = 'opus';
      config.absolute = false;
      const result = (exporter as any).setPathFormat('music/artist01/album/song1.flac', true);
      expect(result).toEqual('.music/artist01/album/song1.opus');
    });

    it(`should modify the path extension if format is defined as opus
      and 'adjustPathResolution=true' and 'config.absolute="true"'`, () => {
      config.format = 'opus';
      config.absolute = true;
      const result = (exporter as any).setPathFormat('music/artist01/album/song1.flac', true);
      expect(result).toEqual('music/artist01/album/song1.opus');
    });
  });

  describe('clearAllPersistedSongs()', () => {
    it(`should do nothing if persistance is empty`, () => {
      (exporter as any).clearAllPersistedSongs();
      expect((exporter as any).songsToRemove).toEqual([]);
    });

    it(`should set 'songsToRemove' property if persistance is defined.`, () => {
      exporter.persistedData = {
        format: 'raw',
        songs: [
          {id: 'song1', path: 'music/artist01/album/song1.flac'},
          {id: 'song2', path: 'music/artist01/album/song2.flac'},
          {id: 'song3', path: 'music/artist01/album/song3.flac'},
        ],
      };

      (exporter as any).clearAllPersistedSongs();

      expect((exporter as any).songsToRemove).toEqual([
        {id: 'song1', path: 'music/artist01/album/song1.flac'},
        {id: 'song2', path: 'music/artist01/album/song2.flac'},
        {id: 'song3', path: 'music/artist01/album/song3.flac'},
      ]);
    });
  });

  describe('setSongExports()', () => {
    beforeEach(() => {
      config.maxBitrate = 0;
      config.format = 'raw';
    });

    it(`should retain original path if format is not defined.`, () => {
      config.format = 'raw';

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
      config.maxBitrate = 0;
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

      (exporter as any).resolveSongs();

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

      (exporter as any).resolveSongs();

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

      (exporter as any).resolveSongs();

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

      (exporter as any).resolveSongs();

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

      (exporter as any).resolveSongs();

      expect((exporter as any).clearAllPersistedSongs).not.toHaveBeenCalled();
      expect((exporter as any).setSongExports).toHaveBeenCalledWith([{id: 'song5', path: ''}]);
      expect(exporter.songsToRemove).toEqual([{id: 'song4', path: ''}]);
      expect(exporter.songsToExport).toEqual([{id: 'song5', path: ''}]);
    });
  });
});

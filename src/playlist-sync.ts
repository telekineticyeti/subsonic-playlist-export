import {Subsonic} from 'subsonic-api-wrapper';
import * as fse from 'fs-extra';
import * as path from 'path';
import * as cliProgress from 'cli-progress';
import colors from 'ansi-colors';
import SubsonicApiWrapper from 'subsonic-api-wrapper';
import PersistClass from './persist.class';
import config, {progresBarConfig} from './config';
import util from 'util';

const persistHelper = new PersistClass();

const log = (message: any) => {
  if (config.verbose) {
    console.log(util.inspect(message));
  }
};

/**
 *
 */
export class TaskRunner {
  constructor(private api: SubsonicApiWrapper) {}
  private tasks: PlaylistSyncTask[] = [];

  public addTask(playlist: Subsonic.PlaylistDetails) {
    const task = new PlaylistSyncTask(playlist, this.api);
    this.tasks.push(task);
    return this;
  }

  public async start() {
    const report: string[] = [];

    await Promise.all(
      this.tasks.map(async task => {
        await task.ready;
        if (config.playlistOnly) {
          await task.writePlaylist();
          report.push(`${[task.playlist.playlist.name]} Playlist exported.`);
        } else {
          const {skipped, total, exported, removed} = await task.export();
          report.push(
            `${[
              task.playlist.playlist.name,
            ]} Playlist exported. [${exported} of ${total} tracks exported (${skipped} skipped, ${removed} removed)])`,
          );
        }
      }),
    );

    log(report);
  }
}

/**
 * New instances of this class are spawned by the `TaskRunner` class.
 * A sync task is required for each playlist to be exported.
 */
export class PlaylistSyncTask {
  public totalTracks: number;
  public ready: Promise<void>;
  public persistedData?: PlaylistExporter.PersistedPlaylist;
  public songsToRemove: PlaylistExporter.PersistedSong[] = [];
  public songsToExport: Subsonic.Song[] = [];
  public songsToSkip: Subsonic.Song[] = [];
  public progressBar = new cliProgress.SingleBar(progresBarConfig);

  constructor(public playlist: Subsonic.PlaylistDetails, private api: SubsonicApiWrapper) {
    this.ready = new Promise(async (resolve, reject) => {
      try {
        this.persistedData = await persistHelper.get<PlaylistExporter.PersistedPlaylist>(
          playlist.playlist.id,
        );
        this.resolveSongs();
        resolve();
      } catch (error) {
        console.error(error);
        reject();
      }
    });

    this.totalTracks = this.playlist.songs.length;
  }

  /***
   * Start the export chain for this task, syncing songs and playlist, as well as
   * persist and removed song cleanup.
   */
  public async export() {
    await this.purgeRemovedTracks();
    await this.exportSongs();
    await this.writePlaylist();
    await this.updatePersist();

    return {
      exported: this.songsToExport.length,
      skipped: this.songsToSkip.length,
      total: this.totalTracks,
      removed: this.songsToRemove.length,
    };
  }

  /**
   * Export/sync songs from the playlist to the local file system.
   */
  private async exportSongs() {
    if (!config.verbose) {
      this.progressBar.start(this.songsToExport.length, 0, {
        track: '...',
        skipped: this.songsToSkip.length,
        name: this.playlist.playlist.name,
      });
    }
    let totalSize = 0;

    await Promise.all(
      this.songsToExport.map(async song => {
        try {
          const destination = this.setPathFormat(path.join(config.outputPath, song.path));
          const trackName = song.path.replace(/^.*[\\\/]/, '');
          const albumPath = path.join(
            config.outputPath,
            song.path.substring(0, song.path.lastIndexOf('/')),
          );
          let songSizeInMb = 0;

          // Export the song from the API endpoint
          await fse.ensureDir(albumPath);

          const requestOptions: Subsonic.StreamOptions = {
            maxBitRate: config.maxBitrate,
          };

          requestOptions.format = config.format;

          return await this.api
            .stream(song.id, requestOptions)
            .then(async res => {
              songSizeInMb = Math.round((parseInt(res.length!) / (1024 * 1024)) * 100) / 100;
              await fse.writeFile(destination, res.buffer);
            })
            .then(() => {
              this.progressBar.increment({track: trackName, size: songSizeInMb});
              totalSize = totalSize + songSizeInMb;
            });
        } catch (error: any) {
          throw new Error(error);
        }
      }),
    );

    log(`Export Operation complete, downloaded ${totalSize} Mb.`);
    this.progressBar.update({track: 'Total', size: totalSize});
    this.progressBar.stop();
    return;
  }

  /**
   * Write the playlist file for the exported song list.
   */
  public async writePlaylist() {
    let playlistString = this.createPlaylistString();
    const playlistExtension = config.playlistFormat === 'm3u8' ? 'm3u8' : 'm3u';
    const filename = `${this.playlist.playlist.name}.${playlistExtension}`;

    try {
      const opts: fse.WriteFileOptions = {};
      if (playlistExtension === 'm3u8') {
        Object.assign(opts, {encoding: 'utf8'});
      }
      await fse.writeFile(path.join(config.outputPath, filename), playlistString, opts);
      return;
    } catch (error: any) {
      throw new Error('Playlist file export failed.');
    }
  }

  private createPlaylistString(): string {
    let playlistString = '';
    playlistString += `# Playlist Sync: ${config.user}@${config.host} - ${this.playlist.playlist.name} [${this.playlist.playlist.id}]\n`;
    playlistString += `# Created: ${this.playlist.playlist.created}\n`;
    playlistString += `# Updated: ${this.playlist.playlist.changed}\n`;
    playlistString += `# Sync Options: [format=${config.format}] [maxBitrate=${config.maxBitrate}]\n`;

    this.playlist.songs.forEach(
      song => (playlistString += `${this.setPathFormat(song.path, true)}\n`),
    );

    return playlistString;
  }

  /**
   * Removes tracks that are no longer present in the exported playlist - i.e. removed from Subsonic.
   * After a song is removed, the directory it resided in is removed if empty.
   */
  private async purgeRemovedTracks() {
    if (!this.songsToRemove.length) return;

    const recursivePathRemoval = async (pathToTraverse: string) => {
      try {
        log(`Attempting path removal of ${pathToTraverse}`);

        const songPathSubstr = pathToTraverse.substring(0, pathToTraverse.lastIndexOf('/'));
        const fullPath = path.join(config.outputPath, songPathSubstr);
        const fullPathIsEmpty = (await fse.readdir(fullPath)).length <= 0;

        if (fullPathIsEmpty) {
          await fse.remove(fullPath);
          const newPathToTraverse = pathToTraverse.substring(0, pathToTraverse.lastIndexOf('/'));
          if (newPathToTraverse.length <= 0) return;
          await recursivePathRemoval(newPathToTraverse);
        }
      } catch (error) {
        console.error(`Attempted removal of ${pathToTraverse}, but removal failed.`);
      }
    };

    for (const song of this.songsToRemove) {
      // Removes the song file.
      await fse.remove(path.join(config.outputPath, song.path));
      // Traverses the path to the song, removing the folder if empty,
      // cleaning up empty album and artist folders.
      await recursivePathRemoval(song.path);
    }
  }

  /**
   * Update persist object with songs exported in this session.
   * This persist is used as a reference of which songs to export/remove when
   * the remote Subsonic playlist changes.
   */
  private async updatePersist() {
    try {
      return await persistHelper.upsertOnDiff<PlaylistExporter.PersistedPlaylist>(
        this.playlist.playlist.id, // The playlist id === the persist key.
        {
          format: config.format ? (config.format as PlaylistExporter.SongFormats) : 'raw',
          bitrate: config.maxBitrate ? config.maxBitrate : undefined,
          songs: this.playlist.songs.map(song => ({
            id: song.id,
            path: this.setPathFormat(song.path),
          })),
        },
      );
    } catch (error: any) {
      throw new Error('Persist update failed.');
    }
  }

  /**
   * Update the provided path format with that specified in config.format
   * Or with provided format.
   * @param path string
   */
  private setPathFormat(originPath: string, adjustPathResolution = false): string {
    const pathRegex = /\.[^/.]+$/;

    if (adjustPathResolution) {
      originPath = `${config.absolute ? originPath : `.${originPath}`}`;
    }

    if (config.format !== 'raw') {
      if (config.format === 'mp3') {
        originPath = originPath.replace(pathRegex, '.mp3');
      } else if (config.format === 'opus') {
        originPath = originPath.replace(pathRegex, '.opus');
      }
    }
    return originPath;
  }

  private clearAllPersistedSongs() {
    if (!this.persistedData) return;
    this.songsToRemove = [...this.songsToRemove, ...this.persistedData.songs];
  }

  /**
   * Populate the `songsToExport` property, adjusting the path to match the
   * configured format.
   */
  private setSongExports(songs: Subsonic.Song[]) {
    songs = songs.map(song => ({...song, path: this.setPathFormat(song.path)}));
    this.songsToExport = songs;
  }

  /**
   * Updates `songsToExport` and `songsToRemove` properties with songs that must be exported/removed,
   * and what format that those songs shnould be in.
   */
  private resolveSongs() {
    let songsToExport: Subsonic.Song[] = [];
    // List of that existed before, but are now missing from the playlist.
    // These songs will be removed from local filesystem as well as persist.
    let songsToRemove: PlaylistExporter.PersistedSong[] = [];

    // If this play list has been exported before, we check the persisted maxBitrate and song format
    // Against user provided configuration values (if present).
    // If the values differ, then the playlist is re-exported to support the newly defined transcode.
    // If the values are identical, then playlist is checked for newly added or removed files.
    if (this.persistedData) {
      const bitRateNotDefined = !this.persistedData.bitrate && !config.maxBitrate;

      // The maxBitrate was changed by the user.
      // Remove all existing tracks and re-export.
      // TODO if config.bitrate is undefined and persistance is defined, should we just used the persisted?
      if (!bitRateNotDefined && config.maxBitrate !== this.persistedData.bitrate) {
        log(
          `Persisted maxBitrate [${this.persistedData.bitrate}] does not match user-defined maxBitrate [${config.maxBitrate}]. Re-exporting playlist files.`,
        );

        this.clearAllPersistedSongs();
        this.setSongExports(this.playlist.songs);
        this.songsToExport = this.playlist.songs;
        return;
      }

      // The user defined a specific format for song transcoding.
      // Remove all existing tracks and re-export.
      if (config.format !== this.persistedData.format) {
        log(
          `Persisted format [${this.persistedData.format}] does not match user-defined format [${config.format}]. Re-exporting playlist files.`,
        );

        this.clearAllPersistedSongs();
        this.setSongExports(this.playlist.songs);
        this.songsToExport = this.playlist.songs;
        return;
      }

      const songsPartitioned = this.playlist.songs.reduce(
        ([newSongs, oldSongs], song) => {
          return !this.persistedData!.songs.map(s => s.id).includes(song.id)
            ? [[...newSongs, song], oldSongs]
            : [newSongs, [...oldSongs, song]];
        },
        [[] as Subsonic.Song[], []],
      );

      const [newSongs, oldSongs] = songsPartitioned;

      songsToExport = newSongs;
      songsToRemove = this.persistedData.songs.filter(song => {
        return !this.playlist.songs.map(s => s.id).includes(song.id);
      });
      this.songsToSkip = oldSongs;
    } else {
      // When no persist is present, it is assumed the playlist is being exported for the first time.
      // All songs are exported.
      songsToExport = this.playlist.songs;
    }
    this.setSongExports(songsToExport);
    this.songsToRemove = songsToRemove;
  }
}

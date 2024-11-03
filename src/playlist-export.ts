import {Subsonic} from 'subsonic-api-wrapper';
import * as fse from 'fs-extra';
import * as path from 'path';
import * as cliProgress from 'cli-progress';
import SubsonicApiWrapper from 'subsonic-api-wrapper';
import PersistClass from './persist.class';
import config, {progresBarConfig} from './config';
import util from 'util';
import ffmpeg from 'fluent-ffmpeg';
import {PassThrough} from 'stream';
import {tmpdir} from 'os';

const persistHelper = new PersistClass();

const log = (message: any) => {
  if (config.verbose) {
    console.log(util.inspect(message));
  }
};

/**
 * Manages and executes playlist synchronization tasks.
 * Uses the `SubsonicApiWrapper` to export playlists based on configuration settings.
 */
export class TaskRunner {
  constructor(private api: SubsonicApiWrapper) {}

  private tasks: PlaylistSyncTask[] = [];

  /**
   * Adds a playlist sync task.
   * @param playlist - Details of the playlist to sync.
   * @returns The TaskRunner instance for chaining.
   */
  public addTask(playlist: Subsonic.PlaylistDetails) {
    const task = new PlaylistSyncTask(playlist, this.api);
    this.tasks.push(task);
    return this;
  }

  /**
   * Executes all added tasks based on configuration.
   * Logs a report of each playlist export.
   */
  public async start() {
    const report: string[] = [];

    await Promise.all(
      this.tasks.map(async task => {
        await task.ready;
        if (config.playlistOnly) {
          await task.writePlaylist();
          report.push(`${[task.playlist.playlist.name]} Playlist exported.`);
        } else {
          const {skipped, total, exported, removed, failed} = await task.export();
          report.push(
            `${[
              task.playlist.playlist.name,
            ]} Playlist exported. [${exported} of ${total} tracks exported (${skipped} skipped, ${removed} removed, ${failed} failed.)])`,
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
  private songsToRemove: PlaylistExporter.PersistedSong[] = [];
  private songsToExport: Subsonic.Song[] = [];
  private songsToSkip: Subsonic.Song[] = [];
  private failedSongs: Subsonic.Song[] = [];
  public progressBar = new cliProgress.SingleBar(progresBarConfig);

  constructor(public playlist: Subsonic.PlaylistDetails, private api: SubsonicApiWrapper) {
    this.ready = new Promise(async (resolve, reject) => {
      try {
        this.persistedData = await persistHelper.get<PlaylistExporter.PersistedPlaylist>(playlist.playlist.id);
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
      exported: this.songsToExport.length - this.failedSongs.length,
      skipped: this.songsToSkip.length,
      total: this.totalTracks,
      removed: this.songsToRemove.length,
      failed: this.failedSongs.length,
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
        failed: this.failedSongs.length,
        name: this.playlist.playlist.name,
      });
    }
    let totalExportSize = 0;
    const artFiles: string[] = [];

    // Fetch the song from endpoint, process it and save it.
    for (const song of this.songsToExport) {
      const trackName = song.path.replace(/^.*[\\\/]/, '');
      try {
        const songOutputDestination = this.resolveSongPaths(song).songPath;
        const albumPath = path.dirname(songOutputDestination);
        const requestOptions: Subsonic.StreamOptions = {maxBitRate: config.maxBitrate, format: config.format};
        const subSonicReponse = await this.api.stream(song.id, requestOptions);
        const songSizeInMb = Math.round((parseInt(subSonicReponse.length!) / (1024 * 1024)) * 100) / 100;
        const audioStream = this.bufferToStream(subSonicReponse.buffer);

        await fse.ensureDir(albumPath);

        if (!(await fse.pathExists(albumPath))) {
          throw new Error(`Path ${albumPath} no longer available.`);
        }

        // Fetch song artwork.
        const artId = song.albumId || song.id;
        let tempArtFilePath = path.join(tmpdir(), `album_art_${artId}.jpg`);

        if (!(await fse.pathExists(tempArtFilePath))) {
          const albumArt = await this.api.getCoverArt(song.albumId || song.id, 500);
          tempArtFilePath = path.join(tmpdir(), `album_art_${artId}.${albumArt.ext}`);
          await fse.writeFile(tempArtFilePath, albumArt.buffer);
          artFiles.push(tempArtFilePath);
        }

        if (config.format === 'mp3') {
          // ID3 tag post-processing
          await new Promise<void>((resolve, reject) => {
            const command = ffmpeg(audioStream)
              .input(tempArtFilePath)
              .inputOptions('-f', 'image2')
              .addOption('-map_metadata', '0')
              .addOption('-map', '0:a')
              .addOption('-map', '1')
              .addOption('-codec:a', 'copy')
              .addOption('-codec:v', 'mjpeg')
              .addOption('-metadata:s:v', 'title=Album cover')
              .addOption('-metadata:s:v', 'comment=Cover (front)');

            if (config.zuneCompatibility) {
              command.addOption('-id3v2_version', '3').addOption('-write_id3v1', '1');
            }

            command
              .save(songOutputDestination)
              .on('end', () => {
                this.progressBar.increment({track: trackName, size: songSizeInMb});
                totalExportSize = parseFloat((totalExportSize + songSizeInMb).toFixed(1));
                resolve();
              })
              .on('error', err => {
                fse.remove(songOutputDestination);
                reject(err);
              });
          });
        } else {
          await fse.writeFile(songOutputDestination, subSonicReponse.buffer);
        }
      } catch (error) {
        this.progressBar.increment({track: `${trackName} FAILED`});
        this.failedSongs.push(song);
      }
    }

    log(`Export Operation complete, downloaded ${totalExportSize} Mb.`);
    this.progressBar.update({track: 'Total', size: totalExportSize});
    this.progressBar.stop();
    artFiles.forEach(file => fse.remove(file));
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
      console.error('Playlist file export failed.');
    }
  }

  private createPlaylistString(): string {
    let playlistString = '';
    playlistString += `# Playlist Sync: ${config.user}@${config.host} - ${this.playlist.playlist.name} [${this.playlist.playlist.id}]\n`;
    playlistString += `# Created: ${this.playlist.playlist.created}\n`;
    playlistString += `# Updated: ${this.playlist.playlist.changed}\n`;
    playlistString += `# Sync Options: [format=${config.format}] [maxBitrate=${config.maxBitrate}]\n`;

    this.playlist.songs.forEach(song => {
      // Do not add failed songs to the playlist file.
      if (this.failedSongs.some(s => s.id === song.id)) return;
      return (playlistString += `${this.resolveSongPaths(song).playlistPath}\n`);
    });

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
        const fullPath = path.join(songPathSubstr);
        const fullPathIsEmpty = (await fse.readdir(fullPath)).length <= 0;

        if (fullPathIsEmpty) {
          await fse.remove(fullPath);
          const newPathToTraverse = pathToTraverse.substring(0, pathToTraverse.lastIndexOf('/'));
          if (newPathToTraverse.length <= 0) return;
          await recursivePathRemoval(newPathToTraverse);
        }
      } catch (error) {
        console.error(`Attempted removal of ${pathToTraverse}, but removal failed.`, error);
      }
    };

    for (const song of this.songsToRemove) {
      // Removes the song file.
      await fse.remove(song.path);
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
      const songs = this.playlist.songs
        .filter(song => !this.songsToRemove.includes(song))
        .map(song => ({id: song.id, path: this.resolveSongPaths(song).songPath}));

      return await persistHelper.upsertOnDiff<PlaylistExporter.PersistedPlaylist>(
        this.playlist.playlist.id, // The playlist id === the persist key.
        {
          format: config.format ? (config.format as PlaylistExporter.SongFormats) : 'raw',
          bitrate: config.maxBitrate ? config.maxBitrate : undefined,
          songs,
        },
      );
    } catch (error: any) {
      throw new Error('Persist update failed.');
    }
  }

  /**
   * Resolves both the output path and playlist path
   * for a song based on the given configuration settings.
   *
   * songPath is the full path to the song file, including the configured export folder.
   * playlistPath is the path to the song relative to where the playlist is outputted.
   */
  private resolveSongPaths(song: Subsonic.Song): {songPath: string; playlistPath: string} {
    let songPath = path.join(config.outputPath, song.path);
    let playlistPath = config.absolutePaths ? song.path : path.join('./', song.path);

    let extension = path.extname(songPath).slice(1);
    const dir = path.dirname(songPath);
    const baseName = path.basename(songPath, path.extname(songPath));

    if (config.format !== 'raw') {
      extension = config.format;
    }

    songPath = path.join(dir, `${baseName}.${extension}`);
    const playlistPathAlteredExt = path.join(path.dirname(song.path), `${baseName}.${extension}`);
    playlistPath = config.absolutePaths ? playlistPathAlteredExt : path.join('./', playlistPathAlteredExt);

    if (config.zuneCompatibility) {
      songPath = path.join(config.outputPath, `${song.id}.${extension}`);
      playlistPath = `${song.id}.${extension}`;
    }

    return {songPath, playlistPath};
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
    songs = songs.map(song => ({...song, path: this.resolveSongPaths(song).playlistPath}));
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
      // TODO if config.bitrate is undefined and persistance is defined, just use persist?
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

  private bufferToStream(buffer: Buffer): PassThrough {
    const stream = new PassThrough();
    stream.end(buffer);
    return stream;
  }
}

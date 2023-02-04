import {Subsonic} from 'subsonic-api-wrapper';
import * as fse from 'fs-extra';
import * as path from 'path';
import * as cliProgress from 'cli-progress';
import * as colors from 'ansi-colors';
import SubsonicApiWrapper from 'subsonic-api-wrapper';
import PersistClass from './persist.class';
import config from './config';

const persistHelper = new PersistClass();

/**
 *
 */
export class TaskRunner {
  constructor(private api: SubsonicApiWrapper) {}
  private tasks: ExportTask[] = [];

  public addTask(playlist: Subsonic.PlaylistDetails) {
    const task = new ExportTask(playlist, this.api, config.outputPath!);
    this.tasks.push(task);
    return this;
  }

  public async start() {
    const report: string[] = [];

    await Promise.all(
      this.tasks.map(async task => {
        await task.ready;
        const {skipped, total, exported} = await task.export();
        report.push(
          `${[
            task.playlist.playlist.name,
          ]} Playlist exported. [${exported} of ${total} tracks exported (${skipped} skipped)])`,
        );
      }),
    );

    console.log(report);
  }
}

/**
 * New instances of this class are spawned by `TaskRunner` class.
 * An export task is created for each playlist to be exported.
 */
export class ExportTask {
  public exportedTracks = 0;
  public skippedTracks = 0;
  public totalTracks: number;
  public ready: Promise<void>;
  public songsToRemove: {id: string; path: string}[] = [];
  private persistedSongs?: Exporter.PersistedSong[];
  private songsToExport: Subsonic.Song[] = [];
  private progressBar = this.createProgressBar(this.playlist.playlist.name);
  private silent = true;

  constructor(
    public playlist: Subsonic.PlaylistDetails,
    private api: SubsonicApiWrapper,
    private outputPath: string,
  ) {
    this.ready = new Promise(async (resolve, reject) => {
      try {
        const persist = await persistHelper.get<Exporter.PersistedSong[]>(playlist.playlist.id);
        this.persistedSongs = persist;
        this.resolveSongs();
        resolve();
      } catch (error) {
        reject();
      }
    });

    this.totalTracks = this.playlist.songs.length;
    this.setupPlaylist();
  }

  private setupPlaylist() {
    if (config.format === 'mp3') {
      this.playlist.songs = this.playlist.songs.map(song => {
        const path = song.path.replace(/\.[^/.]+$/, '.mp3');
        return {...song, path};
      });
    } else if (config.format === 'opus') {
      this.playlist.songs = this.playlist.songs.map(song => {
        const path = song.path.replace(/\.[^/.]+$/, '.opus');
        return {...song, path};
      });
    }
  }

  public async export() {
    await this.exportSongs();
    await this.exportPlaylist();
    await this.updatePersist();

    return {exported: this.exportedTracks, skipped: this.skippedTracks, total: this.totalTracks};
  }

  /**]
   *
   */
  private async exportSongs() {
    if (!this.silent) {
      this.progressBar.start(this.songsToExport.length, 0, {track: '...', skipped: 0});
    }

    // let totalSize = 0;

    await Promise.all(
      this.songsToExport.map(async song => {
        try {
          const destination = path.join(this.outputPath, song.path);
          const trackName = song.path.replace(/^.*[\\\/]/, '');
          const albumPath = path.join(
            this.outputPath,
            song.path.substring(0, song.path.lastIndexOf('/')),
          );
          let songSizeInMb = 0;

          if (fse.existsSync(destination)) {
            // Skip the file transfer if the destination file already exists.
            this.skippedTracks++;
            if (!this.silent) {
              this.progressBar?.increment({track: trackName});
              this.progressBar?.update({skipped: this.skippedTracks});
            }
            return;
          } else {
            // Export the song from the API endpoint
            await fse.ensureDir(albumPath);
            return await this.api
              .stream(song.id)
              .then(async res => {
                songSizeInMb = res.length ? parseInt(res.length!) : 0 / (1024 * 1024);

                // Workout actual dest here, make sure playlist output path is correct.
                await fse.writeFile(destination, res.buffer);
                // console.log(song.title, res.type);
              })
              .then(() => {
                if (!this.silent) {
                  this.exportedTracks++;
                  this.progressBar.increment({track: trackName});
                  // totalSize = totalSize + songSizeInMb;
                }
              });
          }
        } catch (error: any) {
          throw new Error(error);
        }
      }),
    );

    if (!this.silent) {
      this.progressBar.update({track: `Completed`});
      // this.progressBar.update({track: `Completed - ${Math.round(totalSize)} Mb.`});
      this.progressBar.stop();
    }
    return;
  }

  /**
   *
   */
  public async exportPlaylist() {
    const filename = `${this.playlist.playlist.name}.m3u8`; // TODO: Configurable format
    let m3uString = `# Exported from subsonic ${this.playlist.playlist.name} (${this.playlist.playlist.id})\n`;
    m3uString += `# Created: ${this.playlist.playlist.created}, Updated: ${this.playlist.playlist.changed}\n`;
    try {
      this.playlist.songs.forEach(song => {
        m3uString += `${song.path}\n`;
      });
      fse.writeFile(path.join(config.outputPath!, filename), m3uString);
      return;
    } catch (error: any) {
      throw new Error('Playlist file export failed.');
    }
  }

  /**
   *
   */
  private async updatePersist() {
    try {
      return await persistHelper.upsertOnDiff<ISongPersist[]>(
        this.playlist.playlist.id,
        this.playlist.songs.map(song => ({
          id: song.id,
          path: song.path,
          format: 'mp3',
        })),
      );
    } catch (error: any) {
      throw new Error('Persist update failed.');
    }
  }

  private createProgressBar(name: string) {
    return new cliProgress.SingleBar({
      format: `Processing '${name}' | ${colors.cyan(
        '{bar}',
      )} | {value}/{total} Songs ({skipped} skipped) || {track}`,
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      hideCursor: true,
    });
  }

  private resolveSongs() {
    // List of new songs that will be copied to destination directory
    let songsToExport = this.playlist.songs;
    // List of songs missing from the playlist that will be removed from the destination directory
    let songsToRemove: Exporter.PersistedSong[] = [];

    if (this.persistedSongs?.length) {
      songsToExport = songsToExport.filter(
        song => !this.persistedSongs!.map(s => s.id).includes(song.id),
      );
      songsToRemove = this.persistedSongs.filter(
        song => !this.playlist.songs.map(s => s.id).includes(song.id),
      );
    }

    this.songsToRemove = songsToRemove;
    this.songsToExport = songsToExport;

    return;
  }
}

interface ISongPersist {
  id: string;
  path: string;
  format: 'mp3' | 'flac' | 'opus' | 'ogg' | 'm4a';
}

// if (r.type) {
//   switch (r.type) {
//     case 'audio/mpeg':
//       ext = 'mp3';
//       break;
//     case 'audio/flac':
//       ext = 'flac';
//       break;
//     case 'audio/ogg':
//       ext = 'opus';
//       break;
//     case 'audio/mp4':
//       ext = 'm4a';
//       break;
//     default:
//       ext = 'mp3';
//       break;
//   }
interface SongToProcess {
  path: string;
  id: string;
  remove: boolean;
  export: boolean;
}

import {Subsonic} from 'subsonic-api-wrapper';
import * as fs from 'fs-extra';
import * as path from 'path';
import {Observable, of} from 'rxjs';
import * as cliProgress from 'cli-progress';
import * as colors from 'ansi-colors';
import SubsonicApiWrapper from 'subsonic-api-wrapper';
import PersistClass from './persist.class';

const persistHelper = new PersistClass();

export default class PlaylistExportHelperClass {
  public resolveSongsToProcess(
    playlistSongs: Subsonic.Song[],
    songsInPersist?: Exporter.PersistedSong[],
  ): Observable<{
    songsToAdd: Subsonic.Song[];
    songsToRemove: {
      id: string;
      path: string;
    }[];
  }> {
    // List of new songs that will be copied to destination directory
    let songsToAdd = playlistSongs;
    // List of songs missing from the playlist that will be removed from the destination directory
    let songsToRemove: Exporter.PersistedSong[] = [];

    if (songsInPersist) {
      songsToAdd = songsToAdd.filter(song => !songsInPersist.map(s => s.id).includes(song.id));
      songsToRemove = songsInPersist.filter(
        song => !playlistSongs.map(s => s.id).includes(song.id),
      );
    }

    return of({songsToAdd, songsToRemove});
  }

  public createProgressBar(name: string) {
    return new cliProgress.SingleBar({
      format: `Processing '${name}' | ${colors.cyan(
        '{bar}',
      )} | {value}/{total} Songs ({skipped} skipped) || {track}`,
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      hideCursor: true,
    });
  }

  // public async createDownloadTasks(): {

  // }

  public async downloadSongs(
    songs: Exporter.PersistedSong[],
    playlist: Subsonic.PlaylistDetails,
    destinationPath: string,
    api: SubsonicApiWrapper,
  ) {
    // const

    const progressBar = this.createProgressBar(playlist.playlist.name);
    progressBar.start(songs.length, 0, {track: '...', skipped: 0});

    let totalSize = 0;
    let skipped = 0;

    await Promise.all(
      songs.map(async song => {
        try {
          const destination = path.join(destinationPath, song.path);
          const trackName = song.path.replace(/^.*[\\\/]/, '');
          const albumPath = path.join(
            destinationPath,
            song.path.substring(0, song.path.lastIndexOf('/')),
          );
          let songSizeInMb = 0;

          if (fs.existsSync(destination)) {
            // Skip the file transfer if the destination file already exists.
            skipped++;
            progressBar.increment({track: trackName});
            progressBar.update({skipped});
            return;
          } else {
            // Export the song from the API endpoint
            await fs.ensureDir(albumPath);
            return await api
              .stream(song.id)
              .then(async res => {
                songSizeInMb = res.length ? parseInt(res.length!) : 0 / (1024 * 1024);
                await fs.writeFile(destination, res.buffer);
              })
              .then(() => {
                progressBar.increment({track: trackName});
                totalSize = totalSize + songSizeInMb;
              });
          }
        } catch (error: any) {
          throw new Error(error);
        }
      }),
    );

    progressBar.update({track: `Completed - ${Math.round(totalSize)} Mb.`});
    progressBar.stop();
    return {success: progressBar.getTotal()};
  }

  public async moveSongsToDestination(
    songs: Exporter.PersistedSong[],
    playlist: Subsonic.PlaylistDetails,
    sourcePath: string,
    destinationPath: string,
  ): Promise<{success: number}> {
    let totalSize = 0;
    let skipped = 0;
    const progressBar = new cliProgress.SingleBar({
      format: `Processing '${playlist.playlist.name}' | ${colors.cyan(
        '{bar}',
      )} | {value}/{total} Songs ({skipped} skipped) || {track}`,
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      hideCursor: true,
    });

    progressBar.start(songs.length, 0, {track: '...', skipped: 0});

    await Promise.all(
      songs.map(async song => {
        try {
          const source = path.join(sourcePath, song.path);
          const destination = path.join(destinationPath, song.path);
          const trackName = song.path.replace(/^.*[\\\/]/, '');
          const albumPath = path.join(
            destinationPath,
            song.path.substring(0, song.path.lastIndexOf('/')),
          );
          const sizeInBytes = fs.statSync(source).size;
          const sizeInMb = sizeInBytes / (1024 * 1024);

          // Skip the file transfer if the destination file already exists.
          if (fs.existsSync(destination)) {
            skipped++;
            progressBar.increment({track: trackName});
            progressBar.update({skipped});
            return;
            // Copy the file to the destination folder.
          } else {
            await fs.ensureDir(albumPath);
            return await fs.copyFile(source, destination).then(() => {
              progressBar.increment({track: trackName});
              totalSize = totalSize + sizeInMb;
            });
          }
        } catch (error: any) {
          throw new Error(error);
        }
      }),
    );

    progressBar.update({track: `Completed - ${Math.round(totalSize)} Mb.`});
    progressBar.stop();
    return {success: progressBar.getTotal()};
  }

  public async writem3uPlaylist(
    playlist: Subsonic.PlaylistDetails,
    destinationPath: string,
  ): Promise<any> {
    const filename = `${playlist.playlist.name}.m3u8`;
    let m3uString = `# Exported from subsonic ${playlist.playlist.name} (${playlist.playlist.id})\n`;
    m3uString += `# Created: ${playlist.playlist.created}, Updated: ${playlist.playlist.changed}\n`;

    try {
      playlist.songs.forEach(song => {
        m3uString += `${song.path}\n`;
      });
      fs.writeFile(path.join(destinationPath, filename), m3uString);
    } catch (error: any) {
      throw new Error(error);
    }
  }

  public niceDate(dateStr: string): string {
    return new Date(dateStr).toISOString().replace(/T/, ' ').replace(/\..+/, '');
  }

  public log(message: string, type: 'info' | 'warning' | 'error' = 'info'): void {
    switch (type) {
      case 'info':
        console.log(`\x1b[36m${message}\x1b[0m`);
        break;
      case 'error':
        console.error(`\x1b[31m${message}\x1b[0m`);
        break;
      case 'warning':
        console.log(`\x1b[33m${message}\x1b[0m`);
        break;
      default:
        console.log(message);
        break;
    }
  }
}

//
//
//
//
//

export class TaskRunner {
  constructor(private api: SubsonicApiWrapper, private outputPath: string) {}
  private tasks: DownloadTask[] = [];

  public addTask(playlist: Subsonic.PlaylistDetails) {
    const task = new DownloadTask(playlist, this.api, this.outputPath);
    this.tasks.push(task);
    console.log(task.playlist.playlist.name, 'added!');
    return this;
  }

  public start() {
    return Promise.all(
      this.tasks.map(async task => {
        await task.ready;
        await task.export();
        console.log(task.playlist.playlist.name, 'got past it dawg');
      }),
    );
  }
}

//
//
//
//
//

export class DownloadTask {
  public skippedTracks = 0;
  public totalTracks: number;
  public ready: Promise<void>;
  private persistedSongs?: Exporter.PersistedSong[];
  private songsToExport: Subsonic.Song[] = [];
  public songsToRemove: {id: string; path: string}[] = [];

  constructor(
    public playlist: Subsonic.PlaylistDetails,
    private api: SubsonicApiWrapper,
    private outputPath: string,
  ) {
    this.totalTracks = playlist.songs.length;

    this.ready = new Promise(async (resolve, reject) => {
      try {
        const persist = await persistHelper.get<Exporter.PersistedSong[]>(playlist.playlist.id);
        this.persistedSongs = persist;
        const resolved = this.resolveSongs();
        this.songsToExport = resolved.songsToAdd;
        this.songsToRemove = resolved.songsToRemove;
        resolve();
      } catch (error) {
        console.error(error);
        reject();
      }
    });
  }

  public async export() {
    const progressBar = this.createProgressBar(this.playlist.playlist.name);
    progressBar.start(this.songsToExport.length, 0, {track: '...', skipped: 0});

    let totalSize = 0;
    let skipped = 0;

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

          if (fs.existsSync(destination)) {
            // Skip the file transfer if the destination file already exists.
            skipped++;
            progressBar.increment({track: trackName});
            progressBar.update({skipped});
            return;
          } else {
            // Export the song from the API endpoint
            await fs.ensureDir(albumPath);
            return await this.api
              .stream(song.id)
              .then(async res => {
                songSizeInMb = res.length ? parseInt(res.length!) : 0 / (1024 * 1024);
                await fs.writeFile(destination, res.buffer);
              })
              .then(() => {
                progressBar.increment({track: trackName});
                totalSize = totalSize + songSizeInMb;
              });
          }
        } catch (error: any) {
          throw new Error(error);
        }
      }),
    );

    progressBar.update({track: `Completed - ${Math.round(totalSize)} Mb.`});
    progressBar.stop();
    return {success: progressBar.getTotal()};
  }

  public writePlaylist() {
    // const filename = `${playlist.playlist.name}.m3u8`;
    // let m3uString = `# Exported from subsonic ${playlist.playlist.name} (${playlist.playlist.id})\n`;
    // m3uString += `# Created: ${playlist.playlist.created}, Updated: ${playlist.playlist.changed}\n`;
    // try {
    //   playlist.songs.forEach(song => {
    //     m3uString += `${song.path}\n`;
    //   });
    //   fs.writeFile(path.join(destinationPath, filename), m3uString);
    // } catch (error: any) {
    //   throw new Error(error);
    // }
  }

  // TODO add write m3u

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

  private resolveSongs(): {
    songsToAdd: Subsonic.Song[];
    songsToRemove: {
      id: string;
      path: string;
    }[];
  } {
    // List of new songs that will be copied to destination directory
    let songsToAdd = this.playlist.songs;
    // List of songs missing from the playlist that will be removed from the destination directory
    let songsToRemove: Exporter.PersistedSong[] = [];

    if (this.persistedSongs?.length) {
      songsToAdd = songsToAdd.filter(
        song => !this.persistedSongs!.map(s => s.id).includes(song.id),
      );
      songsToRemove = this.persistedSongs.filter(
        song => !this.playlist.songs.map(s => s.id).includes(song.id),
      );
    }

    return {songsToAdd, songsToRemove};
  }
}

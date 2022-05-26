import {PlaylistDetails, Song} from './subsonic-api.class';
import * as fs from 'fs-extra';
import * as path from 'path';
import {Observable, of} from 'rxjs';
import * as cliProgress from 'cli-progress';
import * as colors from 'ansi-colors';

export default class ExportHelperClass {
  public resolveSongsToProcess(
    playlistSongs: Song[],
    songsInPersist?: Exporter.PersistedSong[],
  ): Observable<{
    songsToAdd: Song[];
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

  public async moveSongsToDestination(
    songs: Exporter.PersistedSong[],
    playlist: PlaylistDetails,
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

  public async writem3uPlaylist(playlist: PlaylistDetails, destinationPath: string): Promise<any> {
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

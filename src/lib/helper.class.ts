import {Song} from './subsonic-api.class';
import * as fs from 'fs-extra';
import * as path from 'path';

export default class ExportHelperClass {
  public resolveSongsToProcess(
    playlistSongs: Song[],
    songsInPersist?: Exporter.PersistedSong[],
  ): {
    songsToAdd: Song[];
    songsToRemove: {
      id: string;
      path: string;
    }[];
  } {
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

    return {songsToAdd, songsToRemove};
  }

  public async moveSongsToDestination(
    songs: Exporter.PersistedSong[],
    sourchPath: string,
    destinationPath: string,
  ): Promise<any> {
    return Promise.all(
      songs.map(async song => {
        try {
          const albumPath = path.join(
            './music',
            song.path.substring(0, song.path.lastIndexOf('/')),
          );

          await fs.ensureDir(albumPath);
          return await fs.copyFile(
            path.join(sourchPath, song.path),
            path.join(destinationPath, song.path),
          );
        } catch (error) {
          console.error(error);
        }
      }),
    );
  }

  public niceDate(dateStr: string): string {
    return new Date(dateStr).toISOString().replace(/T/, ' ').replace(/\..+/, '');
  }
}

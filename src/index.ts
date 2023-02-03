// #!/usr/bin/env node

import {BehaviorSubject, catchError, delay, forkJoin, mergeMap, of, skip, Subject} from 'rxjs';
import PersistClass from './persist.class';
import PlaylistExportHelperClass, {TaskRunner} from './playlist-export-helper.class';
import SubsonicApiWrapper from 'subsonic-api-wrapper';
import config from './config';

if (!config.host || !config.user || !config.password) {
  throw new Error(`Incomplete host configuration. Please check that 'host', 'user' and 'password'
  are defined, either as environment variables or CLI arguements. See readme for more details.`);
}

const persistHelper = new PersistClass();
const plExportHelper = new PlaylistExportHelperClass();
const subsonicApi = new SubsonicApiWrapper({
  server: config.host,
  username: config.user,
  password: config.password,
  appName: config.appName,
  appVersion: config.appVersion,
});

const availablePlaylists$: BehaviorSubject<string[]> = new BehaviorSubject([] as string[]);
let processPlaylists$: Subject<string> = new Subject();

processPlaylists$.pipe(delay(200)).subscribe(id => {
  forkJoin({
    playlist: subsonicApi.getPlaylist(id),
    persist: persistHelper.get<Exporter.PersistedSong[]>(id),
  })
    .pipe(
      // Resolve lists of new songs to move
      mergeMap(({playlist, persist}) =>
        forkJoin({
          playlist: of(playlist),
          persist: of(persist),
          resolvedSongs: plExportHelper.resolveSongsToProcess(playlist.songs, persist),
        }),
      ),
      // Copy songs to destination folder.
      mergeMap(({playlist, resolvedSongs}) =>
        forkJoin({
          playlist: of(playlist),
          moveSongs: plExportHelper.downloadSongs(
            resolvedSongs.songsToAdd,
            playlist,
            './music',
            subsonicApi,
          ),
        }).pipe(
          catchError(e => {
            plExportHelper.log(
              'Moving songs to destination folder failed. Please check your source/destination settings.',
              'warning',
            );
            throw new Error(e);
          }),
        ),
      ),
      // Write the playlist file
      mergeMap(({playlist}) =>
        forkJoin({
          playlist: of(playlist),
          createm3u: plExportHelper.writem3uPlaylist(playlist, './music'),
        }).pipe(
          catchError(e => {
            plExportHelper.log(
              'Write playlist failed. Please check your source/destination settings.',
              'warning',
            );
            throw new Error(e);
          }),
        ),
      ),
      // Update persistance
      mergeMap(({playlist}) =>
        forkJoin({
          updatePersist: persistHelper.upsertOnDiff(
            playlist.playlist.id,
            playlist.songs.map(song => ({
              id: song.id,
              path: song.path,
            })),
          ),
        }),
      ),
    )
    .subscribe(() => processNext(id));
});

const processNext = (id: string): void => {
  const reaminingIdsToProcess = availablePlaylists$.value.filter(val => val !== id);
  if (reaminingIdsToProcess.length) {
    availablePlaylists$.next(reaminingIdsToProcess);
  }
};

availablePlaylists$.pipe(skip(1)).subscribe(ids => processPlaylists$.next(ids[0]));

(async () => {
  console.log(config);
  if (config.playlistId) {
    // exportPlaylists(config.playlistId);

    const taskRunner = new TaskRunner(subsonicApi, config.outputPath!);
    const allPlaylists = await subsonicApi.getPlaylists();
    // TODO: Warn on missing playlist IDs.
    const availablePlaylists = allPlaylists.filter(playlist =>
      config.playlistId?.includes(playlist.id),
    );

    for (const playlist of availablePlaylists) {
      const playListFull = await subsonicApi.getPlaylist(playlist.id);
      taskRunner.addTask(playListFull);
    }
    taskRunner.start();
  }

  // List playlists
  if (config.list) {
    listPlaylists();
  }
})();

async function exportPlaylists(playlistIds: string[]) {
  try {
    const allPlaylists = await subsonicApi.getPlaylists();
    const availablePlaylists = allPlaylists
      .map(list => list.id)
      .filter(list => playlistIds.includes(list));

    availablePlaylists$.next(availablePlaylists);
  } catch (error) {
    console.error(error);
  }
}

async function listPlaylists(): Promise<void> {
  try {
    const playlists = await subsonicApi.getPlaylists();

    const playlistsReduced = playlists
      .map(pl => ({name: pl.name, id: pl.id}))
      .reduce((pl, {id, ...x}) => {
        (pl as any)[id] = x;
        return pl;
      }, {});

    return console.table(playlistsReduced);
  } catch (error) {
    console.error(error);
  }
}

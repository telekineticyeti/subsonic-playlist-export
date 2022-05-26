import {
  BehaviorSubject,
  catchError,
  delay,
  forkJoin,
  map,
  mergeMap,
  of,
  skip,
  Subject,
  take,
  tap,
} from 'rxjs';
import config from './lib/config';
import SubsonicApi from './lib/subsonic-api.class';
import PersistClass from './lib/persist.class';
import ExportHelperClass from './lib/helper.class';

const persistHelper = new PersistClass();
const exportHelper = new ExportHelperClass();
const subsonic = new SubsonicApi({
  server: config.host.address,
  username: config.host.username,
  password: config.host.password,
  appName: config.appName,
  appVersion: config.appVersion,
});

const availablePlaylists$: BehaviorSubject<string[]> = new BehaviorSubject([] as string[]);
let processPlaylists$: Subject<string> = new Subject();

processPlaylists$.pipe(delay(200)).subscribe(id => {
  forkJoin({
    playlist: subsonic.getPlaylist(id),
    persist: persistHelper.get<Exporter.PersistedSong[]>(id),
  })
    .pipe(
      // Resolve lists of new songs to move
      mergeMap(({playlist, persist}) =>
        forkJoin({
          playlist: of(playlist),
          persist: of(persist),
          resolvedSongs: exportHelper.resolveSongsToProcess(playlist.songs, persist),
        }),
      ),
      // Copy songs to destination folder.
      mergeMap(({playlist, resolvedSongs}) =>
        forkJoin({
          playlist: of(playlist),
          moveSongs: exportHelper.moveSongsToDestination(
            resolvedSongs.songsToAdd,
            playlist,
            config.sourcePath,
            config.destinationPath,
          ),
        }).pipe(
          catchError(e => {
            exportHelper.log(
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
          createm3u: exportHelper.writem3uPlaylist(playlist, config.destinationPath),
        }).pipe(
          catchError(e => {
            exportHelper.log(
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

subsonic
  .getPlaylists()
  .pipe(
    take(1),
    map(playlists => playlists.map(pl => pl.id).filter(pl => config.playlistIds.includes(pl))),
  )
  .subscribe(r => availablePlaylists$.next(r));

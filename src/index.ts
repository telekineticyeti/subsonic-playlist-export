import {BehaviorSubject, delay, forkJoin, map, mergeMap, skip, Subject, take, tap} from 'rxjs';
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
      tap(({playlist}) =>
        console.log(
          `[ Processing Playlist #${id} ] ${playlist.playlist.name}  ... ${
            playlist.songs.length
          } tracks, last modified ${exportHelper.niceDate(playlist.playlist.changed)}`,
        ),
      ),
      map(({playlist, persist}) => exportHelper.resolveSongsToProcess(playlist.songs, persist)),
      mergeMap(({songsToAdd}) => {
        return exportHelper.moveSongsToDestination(
          songsToAdd,
          config.sourcePath,
          config.destinationPath,
        );
      }),
      map(() => 'done'),
    )

    .subscribe(_r => console.log(_r));

  // subsonic
  //   .getPlaylist(id)
  //   .pipe(
  //     take(1),
  //     map(pl => {
  //       persistHelper.upsertOnDiff(
  //         pl.playlist.id,
  //         pl.songs.map(song => ({
  //           id: song.id,
  //           path: song.path,
  //         })),
  //       );
  //     }),
  //   )
  //   .subscribe(playlistCount => {
  //     console.log('song count:', playlistCount);
  //     const reaminingIdsToProcess = availablePlaylists$.value.filter(val => val !== id);
  //     if (reaminingIdsToProcess.length) {
  //       availablePlaylists$.next(reaminingIdsToProcess);
  //     }
  //   });
});

availablePlaylists$.pipe(skip(1)).subscribe(ids => {
  console.log('Subject updated', ids);
  processPlaylists$.next(ids[0]);
});

subsonic
  .getPlaylists()
  .pipe(
    take(1),
    map(playlists => playlists.map(pl => pl.id).filter(pl => config.playlistIds.includes(pl))),
  )
  .subscribe(r => {
    console.log('Playlists resolved', r);
    availablePlaylists$.next(r);
  });

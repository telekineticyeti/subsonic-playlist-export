#! /usr/bin/env node

import {TaskRunner} from './playlist-export';
import SubsonicApiWrapper from 'subsonic-api-wrapper';
import config from './config';

if (!config.host || !config.user || !config.password) {
  throw new Error(`Incomplete host configuration. Please check that 'host', 'user' and 'password'
  are defined, either as environment variables or CLI arguements. See readme for more details.`);
}

const subsonicApi = new SubsonicApiWrapper({
  server: config.host,
  username: config.user,
  password: config.password,
  appName: config.appName,
  appVersion: config.appVersion,
});

(async () => {
  if (config.playlistId) {
    const taskRunner = new TaskRunner(subsonicApi);
    const allPlaylists = await subsonicApi.getPlaylists();
    // TODO: Warn on missing playlist IDs.
    const availablePlaylists = allPlaylists.filter(playlist => config.playlistId?.includes(playlist.id));

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

async function listPlaylists(): Promise<void> {
  try {
    const playlists = await subsonicApi.getPlaylists();

    const playlistsReduced = playlists
      .map(playlist => ({name: playlist.name, id: playlist.id}))
      .reduce((playlist, {id, ...x}) => {
        (playlist as any)[id] = x;
        return playlist;
      }, {});

    console.table(playlistsReduced);
  } catch (error) {
    console.error(error);
  }
}

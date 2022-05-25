import {config as dotenv} from 'dotenv';
dotenv();

if (
  !process.env.subsonic_server_host ||
  !process.env.subsonic_server_user ||
  !process.env.subsonic_server_password
) {
  throw new Error('Incomplete configuration');
}

if (!process.env.playlistIds) {
  throw new Error('Incomplete configuration - Please specify playlist IDs to export.');
}

if (!process.env.sourcePath) {
  throw new Error(
    'Incomplete configuration - Please specify a sourcePath (path to your music library).',
  );
}

if (!process.env.destinationPath) {
  throw new Error(
    'Incomplete configuration - Please specify a destinationPath (Path that will contain your playlists and music).',
  );
}

const playlistIds = process.env.playlistIds
  .split(',')
  .filter(id => !isNaN(parseInt(id.trim())))
  .map(id => id.trim());

const appName = process.env.appName || 'SubsonicPlaylistExporterForNode';

const appVersion = process.env.appVersion || '1';

const config = {
  host: {
    address: process.env.subsonic_server_host,
    username: process.env.subsonic_server_user,
    password: process.env.subsonic_server_password,
  },
  playlistIds,
  appName,
  appVersion,
  sourcePath: process.env.sourcePath,
  destinationPath: process.env.destinationPath,
};

export default config;

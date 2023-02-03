import {parse} from 'ts-command-line-args';
import {config as dotenv} from 'dotenv';

const host = process.env.subsonic_server_host || undefined;
const user = process.env.subsonic_server_user || undefined;
const password = process.env.subsonic_server_password || undefined;
const appVersion = process.env.npm_package_version || '1';

interface IPlaylistExportArguements {
  host?: string;
  user?: string;
  password?: string;
  envFile?: string;
  cache?: boolean;
  format?: string;
  help?: boolean;
  list?: boolean;
  maxBitrate?: number;
  outputPath?: string;
  playlistFormat?: string;
  playlistId?: string[];
  playlistOnly?: boolean;
  appName?: string;
  appVersion?: string;
}

const config = parse<IPlaylistExportArguements>(
  {
    host: {
      type: String,
      optional: true,
      defaultValue: host,
      group: 'credentials',
      description: `The host address of the Subsonic server to export playlists from.`,
    },
    user: {
      type: String,
      optional: true,
      defaultValue: user || undefined,
      group: 'credentials',
      description: `The username to use for the target host.`,
    },
    password: {
      type: String,
      optional: true,
      defaultValue: password || undefined,
      group: 'credentials',
      description: `The password to use for the target host.`,
    },
    envFile: {
      type: String,
      optional: true,
      alias: 'e',
      group: 'credentials',
      description: `Path to the environment variable to use for host/user credentials.`,
    },
    playlistId: {
      type: String,
      optional: true,
      multiple: true,
      alias: 'p',
      defaultOption: true,
      description: `target playlist ID to export`,
    },

    outputPath: {
      type: String,
      optional: true,
      alias: 'o',
      defaultValue: './exported-playlists',
      description: `The path to export playlist and song files. Default value: './exported-playlists'`,
    },
    maxBitrate: {
      type: Number,
      optional: true,
      defaultValue: 0,
      description: `The maximum bitrate for exported, transcoded song files. Only applies to 'opus' and 'mp3' formats. Set to 0 for no bitrate limit. Default value: '0'`,
    },
    format: {
      type: String,
      optional: true,
      defaultValue: 'mp3',
      description: `The format for exported music files. Set to 'opus' or 'mp3' to export a transcoded music file. Use in conjunction with '--maxBitRate'.
                    Set to 'raw' to export a non-transcoded origin file. If set to raw, then '--maxBitRate' value is ignored. Default value: 'mp3'`,
    },
    cache: {
      type: Boolean,
      defaultValue: true,
      optional: true,
      description: `When enabled, a record of downloaded song ids is stored, making subsequent executions of this command faster. 
                    When disabled, cached ids are ignored and all song files are fetched directly from the server. Default value: 'true'`,
    },
    playlistFormat: {
      type: String,
      optional: true,
      defaultValue: 'm3u8',
      description: `Set to 'm3u' or 'm3u8'. Default value: 'm3u8'`,
    },
    playlistOnly: {
      type: Boolean,
      optional: true,
      defaultValue: false,
      description: `If set, this will export the playlist file only and no music tracks. Default value: 'false'`,
    },
    list: {
      type: Boolean,
      optional: true,
      alias: 'l',
      description: 'Display a list of playlists and their respective IDs',
    },
    appName: {
      type: String,
      optional: true,
      defaultValue: process.env.subsonic_server_appName || 'SubsonicPlaylistExporterForNode',
      description: `Some Subsonic APIs allow per-client configuration of song paths and transcoding. Set this value to use a custom app name. Default value: 'SubsonicPlaylistExporterForNode'`,
    },
    appVersion: {
      type: String,
      optional: true,
      defaultValue: appVersion,
      description: `Can be used in conjunction with appNam. Default value: package.json version.`,
    },
    help: {type: Boolean, optional: true, alias: 'h', description: 'Prints this usage guide'},
  },
  {
    helpArg: 'help',
  },
);

if (config.envFile) {
  const env = dotenv({path: config.envFile, override: true, debug: true});

  config.host = env.parsed?.subsonic_server_host || config.host;
  config.user = env.parsed?.subsonic_server_user || config.user;
  config.password = env.parsed?.subsonic_server_password || config.password;
}

export default config;

import {parse} from 'ts-command-line-args';
import {config as dotenv} from 'dotenv';
import ansiColors from 'ansi-colors';

const host = process.env.subsonic_server_host || undefined;
const user = process.env.subsonic_server_user || undefined;
const password = process.env.subsonic_server_password || undefined;
const appVersion = process.env.npm_package_version || '1';

const config = parse<PlaylistExporter.IParseArgs>(
  {
    host: {
      type: String,
      optional: true,
      defaultValue: host,
      group: 'credentials',
      description: 'The host address of the Subsonic server to export playlists from.',
    },
    user: {
      type: String,
      optional: true,
      defaultValue: user || undefined,
      group: 'credentials',
      description: 'The username to use for the target host.',
    },
    password: {
      type: String,
      optional: true,
      defaultValue: password || undefined,
      group: 'credentials',
      description: 'The password to use for the target host.',
    },
    envFile: {
      type: String,
      optional: true,
      alias: 'e',
      group: 'credentials',
      description:
        'If you want to use an environment file to pass credentials/configuration varables, ' +
        'specify the path to the file here.',
    },
    playlistId: {
      type: String,
      optional: true,
      multiple: true,
      alias: 'p',
      defaultOption: true,
      description: 'target playlist ID to export',
    },
    outputPath: {
      type: String,
      optional: true,
      alias: 'o',
      defaultValue: './exported-playlists',
      description:
        'The path to output synchonised playlists and song files.\n' +
        `${ansiColors.dim('Default: ./exported-playlists')}`,
    },
    maxBitrate: {
      type: Number,
      optional: true,
      defaultValue: 0,
      description:
        'The maximum bitrate for exported, transcoded song files. Only applies to `opus` ' +
        'and `mp3` formats. Set to 0 for no bitrate limit. If format is not set and maxBitRate ' +
        'is > 0, then format is automatically set to `mp3`.\n' +
        `${ansiColors.dim('Default: 0')}`,
    },
    format: {
      type: String,
      optional: true,
      defaultValue: 'raw',
      description:
        'The format for exported music files. Set to `opus` or `mp3` to export a ' +
        'transcoded music file. Use in conjunction with `--maxBitRate`. Set to `raw` to ' +
        ' export a non-transcoded origin file. If format is explicitly set to raw, then ' +
        '`--maxBitRate` value is ignored.\n' +
        `${ansiColors.dim('Default: raw')}`,
    },
    cache: {
      type: Boolean,
      defaultValue: true,
      optional: true,
      description:
        'When enabled, a record of downloaded song ids is stored, making subsequent ' +
        'executions of this command faster. When disabled, cached ids are ignored and all song ' +
        'files are fetched directly from the server.\n' +
        `${ansiColors.dim('Default: true')}`,
    },
    playlistFormat: {
      type: String,
      optional: true,
      defaultValue: 'm3u8',
      description:
        'Set to `m3u` or `m3u8`. Default value: `m3u8`\n' + `${ansiColors.dim('Default: m3u8')}`,
    },
    playlistOnly: {
      type: Boolean,
      optional: true,
      defaultValue: false,
      description:
        'If set, this will export the playlist file only and no music tracks.\n' +
        `${ansiColors.dim('Default: false')}`,
    },
    absolute: {
      type: Boolean,
      alias: 'a',
      optional: true,
      defaultValue: false,
      description:
        "By default, exported song paths are relative (prepended with a '.'). " +
        'Set `--absolute` to enable absolute paths.\n' +
        `${ansiColors.dim('Default: false')}`,
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
      defaultValue: process.env.subsonic_server_appName || 'NodePlaylistSync',
      description:
        'Some Subsonic APIs allow per-client configuration of song paths and ' +
        'transcoding. Set this value to use a custom app name.\n' +
        `${ansiColors.dim('Default: NodePlaylistSync')}`,
    },
    appVersion: {
      type: String,
      optional: true,
      defaultValue: appVersion,
      description:
        `Can be used in conjunction with \`--appName\` to customise API call.\n` +
        `${ansiColors.dim(`Default: package.json version. (${appVersion})`)}`,
    },
    verbose: {
      type: Boolean,
      optional: true,
      alias: 'v',
      defaultValue: false,
      description:
        'Enables more detailed information about the program function.\n' +
        `${ansiColors.dim('Default: false')}`,
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
  config.outputPath = env.parsed?.outputPath || config.outputPath;
}

// IF the user has specified a maximum bitrate but no format, then 'mp3' format is
// automatically set for them.
if (config.maxBitrate && config.maxBitrate > 0) {
  if (!config.format || config.format === 'raw') {
    config.format = 'mp3';
  }
}

export const progresBarConfig = {
  format: `Exporting '{name}' | ${ansiColors.cyanBright(
    '{bar}',
  )} | {value}/{total} Songs Exported ({skipped} skipped) | {track} [{size}Mb]`,
  barCompleteChar: '\u2588',
  barIncompleteChar: '\u2591',
  hideCursor: true,
};

export default config as PlaylistExporter.IPlaylistExportConfig;

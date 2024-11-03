
# Subsonic Playlist Export

**A CLI tool to export playlists and songs from Subsonic-compatible servers, with automatic updates on subsequent runs.**

## Features

- Export playlists and song files from Subsonic API-compatible music servers.
- Support for server-side transcoding, dependent on host (tested mostly with Navidrome).
- Remote playlist changes are synced to local exports - old songs are removed, new ones added.
- Zune-compatible mode for exporting tracks with Zune software compatible metadata and paths (id3 v2.3 with album art)
- Playlist only export (no songs downloaded) for backing up playlists that can be re-imported to your server later.
- MP3 transcoded exports have metadata updated to include album-art (transcoded files from Navidrome do not have this)
- Exported tracks are not duplicated - multiple exported playlists that reference the same track will point to a single file.
- Progress bar feedback

## Requirements

- Node.js (if running natively)
- Docker (for containerized usage - Experimental)

## What this app can be used for:

- Backing up or archiving your remote playlists
- Mirroring your remote playlists to other platforms .e.g:
  - Importing your playlists into android for playback in any player
  - Importing your playlists onto a Zune player
- Sharing your remote playlists with others

## What this app can not do:

- Sync local playlists or playlists changes back to a remote server

# Installation

## Running Locally

1. **Clone the Repository and install dependencies**
   
   ```bash
   git clone https://github.com/telekineticyeti/subsonic-playlist-sync.git
   cd subsonic-playlist-sync
   npm install
   ```

2. **Install as CLI tool**

   ```bash
   npm install -g .
   ```

3. **(Optional) Setup environment variables file**

   Create a file to hold your Subsonic compatible server's credentials e.g: `.playlist-export-env`, with the following:

   ```env
   subsonic_server_host=http://yourserver.com
   subsonic_server_user=your_user
   subsonic_server_password=your_password
   # Additionally, you can define the default output path for songs and playlists.
   outputPath=./exported-music
   ```

4. **Run the application:**

   ```bash
   # With env file
   playlist-export -e .playlist-export-env --list

   # Without env file
   playlist-export --host http://yourserver.com --user your_user --password your_password --list
   ```

## Running with Docker

1. **Build the Image**
   
   ```bash
   docker build -t subsonic-playlist-export .
   ```

2. **Install as CLI tool (Optional) Setup environment variables file**

   Create a file to hold your Subsonic compatible server's credentials e.g: `.playlist-export-env`, with the following:

   ```env
   subsonic_server_host=http://yourserver.com
   subsonic_server_user=your_user
   subsonic_server_password=your_password
   # Additionally, you can define the default output path for songs and playlists.
   outputPath=./exported-music
   ```

   Alternatively, you can edit the dockerfile directly and embed your credentials as environment variables as part of the
   image.

   **Please note that this is generally not advised, and presents security risks if you plan on pushing the image to a docker repo.**

   ```dockerfile
   ENV outputPath=/exported-music
   ENV subsonic_server_host=http://yourserver.com
   ...
   ```

3. **Run the application:**

   ```bash
   # With env file
   docker run --rm --env-file ~/path-to-your/.env subsonic-playlist-export --list

   playlist-export -e .playlist-export-env --list

   # Without env file
   playlist-export --host http://yourserver.com --user your_user --password your_password --list
   ```

# Usage

## Command Line Options

| Option                | Alias | Type    | Description                                                                                                                                                  |
|-----------------------|-------|---------|--------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `--host`              |       | String  | The host address of the Subsonic server to export playlists from.                                                                                            |
| `--user`              |       | String  | The username to use for the target host.                                                                                                                     |
| `--password`          |       | String  | The password to use for the target host.                                                                                                                     |
| `--envFile`           | `-e`  | String  | Specify the path to an environment file to pass credentials/configuration variables.                                                                         |
| `--playlistId`        | `-p`  | String  | Target playlist ID(s) to export.                                                                                                                             |
| `--outputPath`        | `-o`  | String  | The path to output synchronized playlists and song files. Default: `./exported-playlists`                                                                    |
| `--maxBitrate`        |       | Number  | The maximum bitrate for exported, transcoded song files. Default: `0` (no limit). Use with `--format`.                                                       |
| `--format`            |       | String  | The format for exported music files (`opus`, `mp3`, or `raw`). Default: `raw`                                                                                |
| `--cache`             |       | Boolean | Enable or disable caching of downloaded song IDs. Default: `true`                                                                                            |
| `--playlistFormat`    |       | String  | Specify playlist format (`m3u` or `m3u8`). Default: `m3u8`                                                                                                   |
| `--playlistOnly`      |       | Boolean | Export the playlist file only, without music tracks. Default: `false`                                                                                        |
| `--absolutePaths`     | `-a`  | Boolean | 'Determines wether song paths in the playlist should be absolute or relative, in relation to the playlist location. If you are using this tool to backup playlists and not songs, this would typically be absolute. Default: `false`                                                                                                              |
| `--list`              | `-l`  | Boolean | Display a list of playlists and their respective IDs                                                                                                         |
| `--appName`           |       | String  | Custom app name for API calls. Default: `NodePlaylistSync`                                                                                                   |
| `--appVersion`        |       | String  | Custom app version for API calls. Default: package.json version                                                                                              |
| `--verbose`           | `-v`  | Boolean | Enable verbose logging for more detailed information. Default: `false`                                                                                       |
| `--zuneCompatibility` | `-z`  | Boolean | Force Zune-compatible output for paths and tags. Tracks use unique IDs as filenames, without artist/album subdirectories, and replace ID3v2.4 with ID3v2.3 tags. Default: `false` |
| `--help`              | `-h`  | Boolean | Prints this usage guide                                                                                                                                      |

## Example Usage

See the [usage guide](usage.md) for examples of how to use this tool, and what to expect from it.


## Zune Compatibility Mode

This tool can export playlists and tracks compatible with Zune software and players. When enabled, exported tracks use ID3v2.3 metadata, ensuring better support for album art display.

Additionally, track filenames are based on their unique song IDs from Subsonic and are saved directly in the specified export folder, rather than the default `artist -> album -> # - title` format. This improves compatibility for tracks with album, artist, or song names containing [non-Roman characters](https://en.wikipedia.org/wiki/Zune#Availability_outside_the_U.S.). Note that metadata tags are not altered.

For more details on how this app handles Zune compatible outputs, check out the [example in the usage guide](usage.md#export-playlists-and-songs-in-zune-compatible-mode).
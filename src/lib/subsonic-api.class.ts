import {catchError, from, map, Observable, switchMap, throwError} from 'rxjs';
import {convertableToString, ParserOptions, parseString} from 'xml2js';
import * as crypto from 'crypto';
import fetch from 'node-fetch';

export default class SubsonicApi {
  constructor(
    private credentials: {
      server: string;
      username: string;
      password: string;
      appName?: string;
      appVersion?: string;
    },
  ) {
    this.appName = this.credentials.appName || 'genericApp';
    this.appVersion = this.credentials.appVersion || '1';
  }
  private appName: string;
  private appVersion: string;

  public getPlaylists(): Observable<Playlist[]> {
    return this.callApi('getPlaylists').pipe(
      map(res => {
        if (!res['subsonic-response'].playlists) return [];
        const payload = res['subsonic-response'].playlists[0];
        const playlists: Playlist[] = payload.playlist!.map(playlist => playlist.$);
        return playlists;
      }),
    );
  }

  public getPlaylist(id: string): Observable<PlaylistDetails> {
    return this.callApi('getPlaylist', [{id}]).pipe(
      map(res => {
        if (!res['subsonic-response'].playlist) throw new Error(`Playlist ID ${id} not found`);
        const payload = res['subsonic-response'].playlist[0];
        const playlist: PlaylistDetails = {
          playlist: payload.$,
          songs: payload.entry ? payload.entry.map(s => s.$) : [],
        };
        return playlist;
      }),
    );
  }

  /**
   * Performs a GET call on the specified API endpoint
   * @param endpoint Target endpoint
   * @param params list of optional parameters for this endpoint
   * @returns Observable of parsed XML to JSON object
   */
  public callApi(
    endpoint: string,
    params?: {
      [key: string]: string;
    }[],
  ): Observable<Subsonic.response> {
    const url = this.constructEndpointUrl(endpoint, params);
    console.log(`[ QUERY ]`, url);
    return from(fetch(url)).pipe(
      switchMap(response => response.text()),
      switchMap(body => this.asyncXmlParse<Subsonic.response>(body, {explicitArray: true})),
      catchError(error => this.errorHandler(error)),
    );
  }

  /**
   * Asynchronous version of xml2js `parseString()` method, to make it simler to integrate
   * into observable streams.
   * @param input  XML string input
   * @param options xml2js options
   * @returns Promise of xml2js result
   */
  private asyncXmlParse<T>(input: convertableToString, options: ParserOptions): Promise<T> {
    return new Promise((resolve, reject) => {
      parseString(input, options, (error, result: T) => {
        if (error) return reject(error);
        return resolve(result);
      });
    });
  }

  /**
   * Observable stream error handler for API calls. Handle generic error events or error
   * codes passed from fetch response.
   */
  private errorHandler(error: any) {
    return throwError(() => {
      // return error.error instanceof ErrorEvent
      //   ? error.error.message
      //   : `Error code ${error.status}: ${error.message}`;
      return error;
    });
  }

  /**
   * Creates endpoint url string, including authentication and client parameters,
   * in addition to arguement provided parameters
   * @param endpoint The target endpoint, example `getPlaylists`
   * @param params Array of key-value pair parameters
   * @returns URL string
   */
  private constructEndpointUrl(
    endpoint: string,
    params?: {
      [key: string]: string;
    }[],
  ): URL['href'] {
    const url = new URL(`${this.credentials.server}/rest/${endpoint}${this.apiAuthStr()}`);

    if (params) {
      params.forEach(p => Object.entries(p).forEach(o => url.searchParams.append(o[0], o[1])));
    }

    return url.href;
  }

  /**
   * Constructs authentication parameters to append to enpoint URLs.
   * Password is salted, hashed and passed as parameter.
   */
  private apiAuthStr(): string {
    const salt = this.createSaltStr(6);
    const hash = crypto
      .createHash('md5')
      .update(this.credentials.password + salt)
      .digest('hex');

    return `?u=${this.credentials.username}&t=${hash}&s=${salt}&c=${this.appName}&v=${this.appVersion}`;
  }

  /**
   * Randomised string of characters for use as a salt
   */
  private createSaltStr(length: number = 6): string {
    let result = '';
    const characterSet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const characterSetLength = characterSet.length;
    for (let i = 0; i < length; i++) {
      result += characterSet.charAt(Math.floor(Math.random() * characterSetLength));
    }
    return result;
  }
}

export interface Playlist {
  changed: string;
  comment: string;
  coverArt: string;
  created: string;
  duration: string;
  id: string;
  owner: string;
  name: string;
  public: string;
  songCount: string;
}

export interface Song {
  album: string;
  albumId?: string;
  artistId?: string;
  artist: string;
  discNumber?: string;
  bitRate: string;
  contentType: string;
  coverArt?: string;
  created: string;
  duration: string;
  genre?: string;
  id: string;
  isDir: string;
  isVideo: string;
  parent: string;
  path: string;
  playCount?: string;
  size: string;
  starred?: string;
  suffix: string;
  title: string;
  track?: string;
  transcodedContentType?: string;
  transcodedSuffix?: string;
  type?: string;
  year?: string;
  selected?: boolean;
  previousClicked?: boolean;
}

export interface Album {
  artist: string;
  artistId: string;
  coverArt?: string;
  created: string;
  duration: string;
  genre?: string;
  id: string;
  name: string;
  songCount: string;
}

export interface PlaylistDetails {
  playlist: Playlist;
  songs: Song[];
}

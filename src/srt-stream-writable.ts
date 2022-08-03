import { Writable } from 'stream';
import SRT from './srt.js';
import { default as _debug } from "debug";
import { SRTCallerState } from './srt-stream-types.js';
import { SRTFileDescriptor } from './srt-api-types.js';
const debug = _debug('srt-write-stream');

export default class SRTWriteStream extends Writable implements SRTCallerState {
  public srt: SRT
  public get address () { return this._address; }
  public get port () { return this._port; }
  public get fd () { return this._fd; }
  public get socket () { return this._socket; }
  private _fd: null|SRTFileDescriptor = null
  private _socket: number = 0;
  constructor(
    private _address: string,
    private _port: number,
    // @ts-ignore
    opts?: unknown,
  ) {
    super({defaultEncoding: 'binary'});
    this.srt = new SRT();
    this._socket = this.srt.createSocket();
  }

  connect(callback: {(state: SRTCallerState): void}) {
    this.srt.connect(this._socket, this.address, this.port);
    this._fd = this._socket;
    if (this._fd) {
      callback(this);
    }
  }

  close() {
    this.srt.close(this._socket);
    this._fd = null;
  }

  stats (clear: Parameters<SRT['stats']>[1]) {
    if (this._fd === null) {
      throw new Error('stats() called but stream was not initialized');
    }

    return this.srt.stats(this._fd, clear);
  }

  _write(
    chunk: Parameters<SRT['write']>[1],
    // @ts-ignore
    encoding: 'binary',
    callback: {(err?: Error): void},
  ): void {
    debug(`Writing chunk ${chunk.length}`);
    if (this._fd) {
      this.srt.write(this._fd, chunk);
      callback();
    } else {
      callback(new Error("Socket was closed"));
    }
  }

  _destroy(/*err, callback*/) {
    this.close();
  }
}

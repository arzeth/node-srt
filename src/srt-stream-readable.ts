import { Readable } from 'stream';
import SRT from './srt.js';
//const debug = import('debug')('srt-read-stream');
import { default as _debug } from 'debug';
import { SRTFileDescriptor } from './srt-api-types.js';
import { SRTCallerState } from './srt-stream-types.js';
import { SRTEpollOpt, SRTSockStatus } from './srt-api-enums.js';
const debug = _debug('srt-read-stream');

const CONNECTION_ACCEPT_POLLING_INTERVAL_MS = 50;
const READ_WAIT_INTERVAL_MS = 50;

const EPOLLUWAIT_TIMEOUT_MS = 1000;
const SOCKET_LISTEN_BACKLOG = 10;

/**
 * Example:
 *
 * const dest = fs.createWritableStream('./output');
 *
 * const srt = new SRTReadStream('0.0.0.0', 1234);
 * srt.listen(readStream => {
 *   readStream.pipe(dest);
 * })
 *
 */
export default class SRTReadStream extends Readable {
  public srt: SRT;
  public get address () { return this._address; }
  public get port () { return this._port; }
  public get fd () { return this._fd; }
  public get socket () { return this._socket; }
  private _fd: null|SRTFileDescriptor = null;
  private _socket: number = 0;
  private _eventPollInterval: ReturnType<typeof setInterval>|null = null;
  private _readTimer: ReturnType<typeof setTimeout>|null = null;
  // Q: opts not used ?
  // Q: not better if port (mandatory) is before, and address is optional (default to "0.0.0.0")?
  constructor(
    private _address: string,
    private _port: number,
    // @ts-ignore
    opts?: unknown,
  ) {
    super();
    this.srt = new SRT();
    this._socket = this.srt.createSocket();
    this._fd = null;
  }

  /**
   *
   * @param {Function} onData Passes this stream instance as first arg to callback
   */
  listen (onData: {(state: SRTCallerState): void}) {

    if (this._fd !== null) {
      throw new Error('listen() called but stream file-descriptor already initialized');
    }

    this.srt.bind(this.socket, this.address, this.port);
    this.srt.listen(this.socket, SOCKET_LISTEN_BACKLOG);

    const epid = this.srt.epollCreate();
    this.srt.epollAddUsock(epid, this.socket, SRTEpollOpt.SRT_EPOLL_IN | SRTEpollOpt.SRT_EPOLL_ERR);

    const interval = this._eventPollInterval = setInterval(() => {
      const events = this.srt.epollUWait(epid, EPOLLUWAIT_TIMEOUT_MS);
      events.forEach(event => {
        const status = this.srt.getSockState(event.socket);
        if (status === SRTSockStatus.SRTS_BROKEN || status === SRTSockStatus.SRTS_NONEXIST || status === SRTSockStatus.SRTS_CLOSED) {
          debug("Client disconnected with socket:", event.socket);
          this.srt.close(event.socket);
          this.push(null);
          this.emit('end');
        } else if (event.socket === this.socket) {
          const fhandle = this.srt.accept(this.socket);
          debug("Accepted client connection with file-descriptor:", fhandle);
          this.srt.epollAddUsock(epid, fhandle, SRTEpollOpt.SRT_EPOLL_IN | SRTEpollOpt.SRT_EPOLL_ERR);
          this.emit('readable');
        } else {
          debug("Got data from connection on fd:", event.socket);
          this._fd = event.socket;
          clearInterval(interval);
          onData(this);
          this.emit('readable');
        }
      });
    }, CONNECTION_ACCEPT_POLLING_INTERVAL_MS);
  }

  /**
   *
   * @param {Function} onConnect
   */
  connect(onConnect: {(state: SRTCallerState): void}) {

    if (this._fd !== null) {
      throw new Error('connect() called but stream file-descriptor already initialized');
    }

    this.srt.connect(this.socket, this.address, this.port);
    this._fd = this.socket;
    if (this._fd) {
      onConnect(this);
    }
  }

  close() {
    this.destroy();
  }

  stats (clear: Parameters<SRT['stats']>[1]) {
    if (this._fd === null) {
      throw new Error('stats() called but stream was not initialized');
    }

    return this.srt.stats(this._fd, clear);
  }

  _scheduleNextRead(requestedBytes: number, timeoutMs: number) {
    this._readTimer = setTimeout(this._readSocketAndPush.bind(this, requestedBytes), timeoutMs);
  }

  _clearScheduledRead(): void {
    clearTimeout(this._readTimer!);
    this._readTimer = null;
  }

  _readSocketAndPush(bytes: number): void {
    this._clearScheduledRead();
    if (this._fd === null) {
      this._scheduleNextRead(bytes, READ_WAIT_INTERVAL_MS);
      return;
    }
    let remainingBytes = bytes;
    while(true) {
      //const buffer = this.srt.read(this._fd, bytes);
      let buffer
      try {
        buffer = this.srt.read(this._fd, bytes);
      } catch (e) {
        console.log(JSON.stringify(e))
        console.error(e)
        console.error('error.name=%O', (e as any).name)
        this.close();
        break;
      }
      if (buffer === null) { // connection likely died
        debug("Socket read call returned 'null'");
        this.close();
        break;
      }
      // we expect a Buffer object here, but
      // -1 is the SRT_ERROR value that would get returned
      // if there is no data to read yet/anymore
      if (buffer === -1) {
        this._scheduleNextRead(remainingBytes, READ_WAIT_INTERVAL_MS);
        break;
      }
      //debug(`Read ${buffer.length} bytes from fd`);

      // @see https://nodejs.org/api/stream.html#stream_readable_push_chunk_encoding
      if (this.push(buffer)) {
        remainingBytes -= buffer.length;
        if (remainingBytes <= 0) {
          // 0 as a timer value acts as setImmediate task (next tick ideally)
          break;
        }
      } else {
        debug("Readable.push returned 'false' at remaining bytes:", remainingBytes);
        break;
      }
    }
  }

  /**
   * @see https://nodejs.org/api/stream.html#stream_readable_read_size_1
   * @param {number} bytes
   */
  _read(bytes: number): void {
    debug('Readable._read(): requested bytes:', bytes);
    this._readSocketAndPush(bytes);
  }

  /**
   * @see https://nodejs.org/api/stream.html#stream_readable_destroy_err_callback
   */
  _destroy(
    err: Error,
    callback: {(err: Error): void},
  ) {
    // guard from closing multiple times
    if (this._fd === null) return;
    clearInterval(this._eventPollInterval!);
    this.srt.close(this.socket);
    this._fd = null;
    this._clearScheduledRead();
    callback?.(err);
  }
}

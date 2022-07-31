import { EventEmitter } from "events";
import { SRTEpollResult, SRTReadReturn } from "./srt-api-types";
import { AsyncSRT } from "./async-api";
import { AsyncReaderWriter } from "./async-reader-writer";
import { SRTEpollOpt, SRTResult, SRTSockStatus } from "./srt-api-enums";
import { SRTSocketAsync } from "./srt-socket-async";

//const debug = require('debug')('srt-server');
import { default as _debug } from "debug";
const debug = _debug('srt-server');

const DEBUG = false;

const EPOLL_PERIOD_MS_DEFAULT = 0;

const EPOLLUWAIT_TIMEOUT_MS = 0;

const SOCKET_LISTEN_BACKLOG_SIZE = 0xFFFF;

/**
 * @emits data
 * @emits closing
 * @emits closed
 */
export class SRTServerConnection extends EventEmitter {

  private _gotFirstData = false;

  constructor(private _asyncSrt: AsyncSRT, private _fd: number) {
    super();
  }

  /**
   * @returns {number}
   */
  get fd() {
    return this._fd;
  }

  /**
   * Will be false until *after* emit of first `data` event.
   * After that will be true.
   */
  get gotFirstData() {
    return this._gotFirstData;
  }

  /**
   * Use AsyncReaderWriter as the recommended way
   * for performing r/w ops on connections.
   * @returns {AsyncReaderWriter}
   */
  getReaderWriter() {
    return new AsyncReaderWriter(this._asyncSrt, this.fd);
  }

  /**
   * Lower-level access to async-handle read method of the client-owned socket.
   * For performing massive read-ops without worrying, rather see `getReaderWriter`.
   * @param {number} bytes
   * @returns {Promise<SRTReadReturn>}
   */
  async read(bytes: number): Promise<SRTReadReturn> {
    return await this._asyncSrt.read(this.fd, bytes);
  }

  /**
   *
   * Pass a packet buffer to write to the connection.
   *
   * The size of the buffer must not exceed the SRT payload MTU
   * (usually 1316 bytes).
   *
   * Otherwise the call will resolve to SRT_ERROR.
   *
   * A system-specific socket-message error message may show in logs as enabled
   * where the error is thrown (on the binding call to the native SRT API),
   * and in the async API internals as it gets propagated back from the task-runner).
   *
   * Note that any underlying data buffer passed in
   * will be *neutered* by our worker thread and
   * therefore become unusable (i.e go to detached state, `byteLengh === 0`)
   * for the calling thread of this method.
   * When consuming from a larger piece of data,
   * chunks written will need to be slice copies of the source buffer.
   *
   * @param {Buffer | Uint8Array} chunk
   */
  async write(chunk: Buffer|Uint8Array) {
    return await this._asyncSrt.write(this.fd, chunk);
  }

  /**
   * `close` method can only get called once with any effect.
   * It will cause the internal async handle ref to be null-set.
   * This will immediatly have `isClosed()` eval to `true`,
   * causing subsequent calls to this method to be no-op, and result to null.
   *
   * The fd-closing op being async, it emits "closing" before
   * and "closed" after any success (or not).
   *
   * Any errors in the async task can be caught using promise-catch.
   *
   * The closing operation having finally succeeded can be checked
   * upon the valid of the `fd` prop (will be null after succeeded close).
   * In case any initial failure needs to be retried, we can do this
   * manually with this fd-getter, and any async handles close method.
   *
   * This method detaches all event-emitter listeners.
   *
   */
  async close(): Promise<SRTResult | null> {
    if (this.isClosed()) return null;
    const asyncSrt = this._asyncSrt;
    this._asyncSrt = null;
    this.emit('closing');
    const result = await (asyncSrt.close(this.fd) as Promise<SRTResult | null>);
    this.emit('closed', result);
    this.removeAllListeners();
    return result;
  }

  isClosed() {
    return ! this._asyncSrt;
  }

  onData() {
    this.emit('data');
    if (!this.gotFirstData) {
      this._gotFirstData = true;
    }
  }
}

/**
 * @emits created
 * @emits opened
 * @emits connection
 * @emits disconnection
 * @emits disposed
 */
export class SRTServer extends SRTSocketAsync {

  _epid: number | null = null;
  _pollEventsTimer: ReturnType<typeof setTimeout> | null = null;
  _connectionMap: {[fd: number]: SRTServerConnection} = {};

  /**
   * Needs to be set before calling `open` (any changes after it
   * wont be considered i.e are effectless).
   * @public
   * @member {number}
   */
  backlogSize: number = SOCKET_LISTEN_BACKLOG_SIZE;

  /**
   *
   * @param port listening port number
   * @param address local interface, optional, default: '0.0.0.0'
   * @param epollPeriodMs optional, default: EPOLL_PERIOD_MS_DEFAULT
   */
  static create(port: number, address: string, epollPeriodMs?: number): Promise<SRTServer> {
    return new SRTServer(port, address, epollPeriodMs).create() as Promise<SRTServer>;
  }

  /**
   *
   * @param port listening port number
   * @param address local interface, optional, default: '0.0.0.0'
   * @param epollPeriodMs optional, default: EPOLL_PERIOD_MS_DEFAULT
   */
  constructor(port: number, address: string, readonly epollPeriodMs = EPOLL_PERIOD_MS_DEFAULT) {
    super(port, address);
  }

  /**
   * @returns {Promise<void>}
   */
  dispose() {
    this._clearTimers();
    return super.dispose();
  }

  create() {
    return super.create();
  }

  open() {
    return super.open();
  }

  getConnectionByHandle(fd: number) {
    return this._connectionMap[fd] || null;
  }

  /**
   * @returns {Array<SRTServerConnection>}
   */
  getAllConnections() {
    return Array.from(Object.values(this._connectionMap));
  }

  /**
   *
   * @return {Promise<SRTServer>}
   */
  protected async _open() {
    let result;
    result = await this.asyncSrt.bind(this.socket!, this.address, this.port);
    if (result === SRTResult.SRT_ERROR) {
      throw new Error('SRT.bind() failed');
    }
    result = await this.asyncSrt.listen(this.socket!, SOCKET_LISTEN_BACKLOG_SIZE);
    if (result === SRTResult.SRT_ERROR) {
      const err = `SRT.listen() failed on ${this.address}:${this.port}`;
      throw new Error(err);
    }
    result = await this.asyncSrt.epollCreate();
    if (result === SRTResult.SRT_ERROR) {
      throw new Error('SRT.epollCreate() failed');
    }
    this._epid = result!;

    this.emit('opened');

    // we should await the epoll subscribe result before continuing
    // since it is useless to poll events otherwise
    // and we should also yield from the stack at this point
    // since the `opened` event handlers above may do whatever
    await this.asyncSrt.epollAddUsock(this._epid!, this.socket!, SRTEpollOpt.SRT_EPOLL_IN | SRTEpollOpt.SRT_EPOLL_ERR);

    this._pollEvents();

    return this;
  }

  private async _handleEvent(event: SRTEpollResult) {
    const status = await this.asyncSrt.getSockState(event.socket);

    // our local listener socket
    if (event.socket === this.socket) {

      if (status === SRTSockStatus.SRTS_LISTENING) {
        const fd = await this.asyncSrt.accept(this.socket) as number;
        await this.asyncSrt.epollAddUsock(this._epid!, fd, SRTEpollOpt.SRT_EPOLL_IN | SRTEpollOpt.SRT_EPOLL_ERR);
        debug("Accepted client connection with file-descriptor:", fd);
        // create new client connection handle
        // and emit accept event
        const connection = new SRTServerConnection(this.asyncSrt, fd);
        connection.on('closing', () => {
          // remove handle
          delete this._connectionMap[fd];
        });
        this._connectionMap[fd] = connection;
        this.emit('connection', connection);
      }

    // a client socket / fd
    // check if broken or closed
    } else if (status === SRTSockStatus.SRTS_BROKEN
      || status === SRTSockStatus.SRTS_NONEXIST
      || status === SRTSockStatus.SRTS_CLOSED) {
      const fd = event.socket;
      debug("Client disconnected on fd:", fd);
      if (this._connectionMap[fd]) {
        await this._connectionMap[fd].close();
        this.emit('disconnection', fd);
      }
    // not broken, just new data
    } else {
      const fd = event.socket;
      DEBUG && debug("Got data from connection on fd:", fd);
      const connection = this.getConnectionByHandle(fd);
      if (!connection) {
        throw new Error(`SRTEpollEvent: fd ${fd} not in connections map"`);
      }
      connection.onData();
    }
  }

  /**
   * @private
   */
  private async _pollEvents() {
    // needed for async-disposal, guard from AsyncSRT instance wiped
    if (!this.asyncSrt || !this._epid) {
      this._clearTimers();
      return;
    }

    const events = await this.asyncSrt.epollUWait(this._epid!, EPOLLUWAIT_TIMEOUT_MS) as SRTEpollResult[];
    events.forEach((event) => {
      this._handleEvent(event);
    });

    // clearing in case we get called multiple times
    // when already timer scheduled
    // will be no-op if timer-id invalid or old
    clearTimeout(this._pollEventsTimer!);
    this._pollEventsTimer = setTimeout(this._pollEvents.bind(this), this.epollPeriodMs);
  }

  private _clearTimers() {
    if (this._pollEventsTimer !== null) {
      clearTimeout(this._pollEventsTimer);
      this._pollEventsTimer = null;
    }
  }
}


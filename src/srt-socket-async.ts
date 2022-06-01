import { EventEmitter } from "events";
import { SRTSockOptValue } from "./srt-api-types";
import { AsyncSRT } from "./async-api";
import { SRTSockOpt, SRTResult } from "./srt-api-enums";

/**
 * An abstraction of SRT socket ownership concerns.
 * To be used as a base class for either client/server-side implementations.
 *
 * Usage/Lifecycle: constructor -> create -> setSocketFlags (opt) -> open -> dispose
 *
 * @emits created
 * @emits disposed
 */
export abstract class SRTSocketAsync extends EventEmitter {

  readonly asyncSrt: AsyncSRT = new AsyncSRT();

  private _socket: number | null = null;

  /**
   * @param port local port
   * @param address local interface, optional, default: '0.0.0.0'
   */
  constructor(readonly port: number, readonly address: string = '0.0.0.0') {
    super();

    if (!Number.isInteger(port) || port <= 0 || port > 65535)
      throw new Error('Need a valid port number but got: ' + port);
  }

  get socket() { return this._socket; }

  /**
   * Call this before `open`.
   * Call `setSocketFlags` after this.
   */
  async create(): Promise<SRTSocketAsync> {
    if (this.socket !== null) {
      throw new Error('Can not call createSocket() twice, with socket already existing');
    }
    this._socket = await this.asyncSrt.createSocket() as number;
    this.emit('created');
    return this;
  }

  /**
   * Closes the socket and disposes of the internal async handle (in this order).
   *
   * This method will throw on any failure of underlying socket-closing
   * or async-handle disposal op. It can be retried i.e called again as needed.
   * It will result in no-op if called redundantly.
   *
   * The socket-closing succeeded state can be checked on
   * with this socket-getter `null` value.
   *
   * Error-handling is therefore expected to be performed
   * using Promise-catch or await-try-catch.
   *
   * This method detaches all event-emitter listeners.
   *
   */
  async dispose(): Promise<void> {
    if (this.socket !== null) {
      await this.asyncSrt.close(this.socket);
      await this.asyncSrt.dispose();
      this._socket = null;
    }
    this.emit('disposed');
    this.removeAllListeners();
  }

  async setSocketFlags(opts: SRTSockOpt[], values: SRTSockOptValue[]): Promise<SRTResult[]> {
    if (this.socket === null) {
      throw new Error('There is no socket, call create() first');
    }
    if (opts.length !== values.length)
      throw new Error('opts and values must have same length');
    const promises = opts.map((opt, index) => {
      return this.asyncSrt.setSockOpt(this.socket, opt, values[index]);
    }) as Promise<SRTResult>[];
    return Promise.all(promises);
  }

  /**
   * Call this after `create`.
   * Call `setSocketFlags` before calling this.
   *
   * Sub-class implementors should override `_open` method,
   * to init specific socket usage (call/listen for remote connection).
   */
  open(): Promise<SRTSocketAsync> {
    if (this.socket === null) {
      throw new Error('No socket created, did you call create() before?');
    }
    return this._open();
  }

  /**
   * Will safely get called from open method when socket existing.
   */
  protected abstract _open(): Promise<SRTSocketAsync>;
}


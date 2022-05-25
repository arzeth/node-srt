const debug = require('debug')('srt-async');

import { performance as Perf } from "perf_hooks";

import { SRTEpollResult, SRTFileDescriptor, SRTReadReturn, SRTSockOptValue, SRTStats } from "../types/srt-api";
import { SRTLoggingLevel, SRTResult, SRTSockOpt, SRTSockStatus } from "./srt-api-enums";

const { traceCallToString, extractTransferListFromParams } = require('./async-helpers');
const { createAsyncWorker } = require('./async-worker-provider');

const DEFAULT_PROMISE_TIMEOUT_MS = 3000;

const DEBUG = true;

let idGen = 0;

export type AsyncSRTWorkerPost = {
  method: string
  args: any[]
  timestamp: number
}

export type AsyncSRTWorkerMessage = {
  result: SRTResult
  timestamp: number
  err: Error
  call: {
    method: string
    args: any[]
  }
}

export type AsyncSRTReturnValue =
  null
  | number
  | Buffer
  | SRTResult
  | SRTFileDescriptor
  | SRTReadReturn
  | SRTSockOptValue
  | SRTSockStatus
  | SRTEpollResult[]
  | SRTStats;

export type AsyncSRTPromise = Promise<AsyncSRTReturnValue>;

export type AsyncSRTCallback = (ret: AsyncSRTReturnValue) => void;

export class AsyncSRT {

  /**
   * @static
   * @type {number} Promise-timeout in millis
   */
  static TimeoutMs = DEFAULT_PROMISE_TIMEOUT_MS;

  private _worker: Worker;
  private _workCbQueue: AsyncSRTCallback[] = [];
  private _error: Error = null;
  private _id: number = ++idGen;;

  /**
   * // TODO: type worker-factory
   * @param {Function} workerFactory (Optional) A function returning the new Worker instance needed to construct this object. This is useful for app-side bundling purposes (see webpack "worker-loader"). The provider MUST return a new instance of a worker. Several Async API instances CAN NOT share the same Worker thread instance. By default, the worker will be created by a provider which will resolve the Worker path at runtime to load it (`async-worker.js`) from the actual source module (see `async-worker-provider.js`). Any other loader used with a bundler will be able to inject its own providing mechanism, which will allow the Worker to be loaded at runtime as part of bundled assets.
   */
  constructor(workerFactory = createAsyncWorker) {

    DEBUG && debug('Creating task-runner worker instance');

    this._worker = workerFactory();
    this._worker.addEventListener('message', this._onWorkerMessage.bind(this));
  }

  get id(): number {
    return this._id;
  }

  /**
   * Retrieve the Error for any failure result.
   *
   * Generally, to handle errors, the resulting return value needs to be checked,
   * in most cases for being SRT_ERROR. Not by using any type of exception-catch.
   *
   * Meaning, also the promise will not get rejected for "normal" SRT failures,
   * i.e try-catch-await will not throw on these methods (only if there is
   * an unexpected error, but usually the async-API methods here don't need
   * to expect errors thrown in normal ops and typical error handling).
   *
   * For example, typically the return value of the API call will be SRT_ERROR (-1).
   * But we will not throw the exception on the API call (since the call returns
   * with this error value).
   *
   * Instead, the error gets retrieved into this storage for each
   * AsyncSRT instance, and can get retrieved on the user-side for any call
   * that returned an error code. Very much like SRT does internally and
   * on the native API.
   */
  getError(): Error {
    return this._error;
  }

  isDisposed(): boolean {
    return !this._worker;
  }

  /**
   * @returns {Promise<number>} Resolves to exit code of Worker (only NodeJS)
   * @see https://nodejs.org/docs/latest-v14.x/api/worker_threads.html#worker_threads_worker_terminate
   */
  dispose(): Promise<number> {
    const worker = this._worker;
    this._worker = null;
    if (this._workCbQueue.length !== 0) {
      DEBUG && console.warn(`AsyncSRT: flushing callback-queue with ${this._workCbQueue.length} remaining jobs awaiting.`);
      this._workCbQueue.length = 0;
    }
    // NodeJS workers terminate method return such Promise, as opposed to Web spec.
    return (worker.terminate() as unknown) as Promise<number>;
  }

  private _onWorkerMessage(data: AsyncSRTWorkerMessage): void {
    // not sure if there can still be message event
    // after calling terminate
    // but let's guard from that state anyway.
    if (this.isDisposed()) return;

    // const resolveTime = perf.now();
    const callback = this._workCbQueue.shift();

    if (data.err) {
      DEBUG && console.error('AsyncSRT: Error from task-runner:', data.err.message,
        '\n  Binding call:', traceCallToString(data.call.method, data.call.args),
        //'\n  Stacktrace:', data.err.stack
      );
      this._error = data.err;
    }

    const {timestamp, result} = data;
    callback(result);
  }

  private _postAsyncWork(method: string, args: any[], callback: AsyncSRTCallback) {
    // we check here again because this gets called from
    // a promise-executor (potentially in different tick than promise-creation).
    if (this.isDisposed())
      return Promise.reject(new Error("AsyncSRT._postAsyncWork: has already been dispose()'d"));

    const timestamp = Perf.now();

    DEBUG && debug(this._id, 'Posting call:', traceCallToString(method, args));

    const msgData: AsyncSRTWorkerPost = {method, args, /*workId,*/ timestamp};
    const transferList: Transferable[] = extractTransferListFromParams(args);

    this._workCbQueue.push(callback);
    this._worker.postMessage(msgData, transferList);
  }

  private _createAsyncWorkPromise(method: string,
    args: any[] = [],
    callback: AsyncSRTCallback = null,
    useTimeout: boolean = false,
    timeoutMs: number = AsyncSRT.TimeoutMs): AsyncSRTPromise {

    if (this.isDisposed()) {
      const err = new Error("AsyncSRT_createAsyncWorkPromise: has already been dispose()'d");
      console.error(err);
      return Promise.reject(err);
    }

    if (args.some(v => v === undefined)) {
      throw new Error(`AsyncSRT: Undefined value in argument list: ${traceCallToString(method, args)}.
        Probably missing some non-optional parameters when method called.`);
    }

    return new Promise((resolve, reject) => {
      let timeout;
      let rejected = false;
      const onResult = (result) => {
        // Q: signal somehow to app that timed-out call has had result after all? (only in case of using Promise..?)
        if (rejected) {
          // The reject thing only makes sense for Promise,
          // and users can manage this aspect themselves when using plain callbacks.
          if (callback) callback(result);
          return;
        } else if (useTimeout) clearTimeout(timeout);
        resolve(result);
        if (callback) callback(result); // NOTE: the order doesn't matter for us,
        //      but intuitively the promise result should probably be resolved first.
      };
      if (useTimeout) {
        timeout = setTimeout(() => {
          reject(new Error(`Timeout exceeded (${timeoutMs} ms) while awaiting method result: ${traceCallToString(method, args)}`));
          rejected = true;
        }, timeoutMs);
      }
      this._postAsyncWork(method, args, onResult);
    });
  }

  /**
   * @param {boolean} sender default: false. only needed to specify if local/remote SRT ver < 1.3 or no other HSv5 support
   */
  createSocket(sender: boolean = false, callback?: AsyncSRTCallback) {
    return this._createAsyncWorkPromise("createSocket", [sender], callback);
  }

  bind(socket: number, address, port: number, callback?: AsyncSRTCallback) {
    return this._createAsyncWorkPromise("bind", [socket, address, port], callback);
  }

  listen(socket: number, backlog: number, callback?: AsyncSRTCallback) {
    return this._createAsyncWorkPromise("listen", [socket, backlog], callback);
  }

  connect(socket: number, host: string, port: number, callback?: AsyncSRTCallback) {
    return this._createAsyncWorkPromise("connect", [socket, host, port], callback);
  }

  accept(socket: number, callback?: AsyncSRTCallback, useTimeout = false, timeoutMs = AsyncSRT.TimeoutMs) {
    return this._createAsyncWorkPromise("accept", [socket], callback, useTimeout, timeoutMs);
  }

  close(socket: number, callback?: AsyncSRTCallback) {
    return this._createAsyncWorkPromise("close", [socket], callback);
  }

  read(socket: number, chunkSize: number, callback?: AsyncSRTCallback) {
    return this._createAsyncWorkPromise("read", [socket, chunkSize], callback);
  }

  /**
   *
   * Pass a packet buffer to write to the socket.
   *
   * The size of the buffer must not exceed the SRT payload MTU
   * (usually 1316 bytes).(Otherwise the call will resolve to SRT_ERROR.)
   *
   * When consuming from a larger piece of data,
   * chunks written will therefore need to be slice copies of the source buffer
   *
   * A (somewhat OS-specific) message/socket-error may show in logs as enabled
   * where the error is thrown: on the binding call to the native SRT APIs,
   * and in the async API internals as it gets propagated back from the task-runner.
   *
   * Note that any underlying data buffer passed in
   * will be *neutered* by our worker thread and
   * therefore become unusable (i.e go to detached state, `byteLengh === 0`)
   * for the calling thread of this method.
   *
   * For a usage example, see client/server examples in tests.
   *
   * @param {number} socket Socket identifier to write to
   * @param {Buffer | Uint8Array} chunk The underlying `buffer` (ArrayBufferLike) will get "neutered" by creating the async task. Pass in or use a copy respectively if concurrent data usage is intended.
   */
  write(socket: number, chunk: Buffer | Uint8Array, callback?: AsyncSRTCallback) {
    const byteLength = chunk.byteLength;
    DEBUG && debug(`Writing ${byteLength} bytes to socket:`, socket);
    return this._createAsyncWorkPromise("write", [socket, chunk], callback)
      .then((result) => {
        if (result !== SRTResult.SRT_ERROR) {
          return byteLength;
        }
      });
  }

  setSockOpt(socket: number, option: SRTSockOpt, value: SRTSockOptValue, callback?: AsyncSRTCallback) {
    return this._createAsyncWorkPromise("setSockOpt", [socket, option, value], callback);
  }

  getSockOpt(socket: number, option: SRTSockOpt, callback?: AsyncSRTCallback) {
    return this._createAsyncWorkPromise("getSockOpt", [socket, option], callback);
  }

  getSockState(socket: number, callback?: AsyncSRTCallback) {
    return this._createAsyncWorkPromise("getSockState", [socket], callback);
  }

  epollCreate(callback?: AsyncSRTCallback) {
    return this._createAsyncWorkPromise("epollCreate", [], callback);
  }

  epollAddUsock(epid: number, socket: number, events: number, callback?: AsyncSRTCallback) {
    return this._createAsyncWorkPromise("epollAddUsock", [epid, socket, events], callback);
  }

  epollUWait(epid: number, msTimeOut: number, callback?: AsyncSRTCallback) {
    return this._createAsyncWorkPromise("epollUWait", [epid, msTimeOut], callback);
  }

  setLogLevel(logLevel: number | SRTLoggingLevel, callback?: AsyncSRTCallback) {
    return this._createAsyncWorkPromise("setLogLevel", [logLevel], callback);
  }

  /**
   *
   * @param {number} socket
   * @param {boolean} clear
   * @returns {Promise<SRTStats>}
   */
  stats(socket: number, clear: boolean, callback?: AsyncSRTCallback): Promise<SRTStats> {
    return this._createAsyncWorkPromise("stats", [socket, clear], callback) as Promise<SRTStats>;
  }
}






import { default as _debug } from "debug";
const debug = _debug('srt-async');
//const debug = (await import('debug'))('srt-async');

import { performance as Perf } from "perf_hooks";

import { SRTEpollResult, SRTFileDescriptor, SRTReadReturn, SRTSockOptValue, SRTStats } from "./srt-api-types.js";
import { SRTLoggingLevel, SRTResult, SRTSockOpt, SRTSockOptDetalizedR, SRTSockOptDetalizedRBoolean, SRTSockOptDetalizedRNumber, SRTSockOptDetalizedRString, SRTSockOptDetalizedW, SRTSockOptDetalizedWBoolean, SRTSockOptDetalizedWNumber, SRTSockOptDetalizedWString, SRTSockStatus } from "./srt-api-enums.js";

import { traceCallToString, extractTransferListFromParams } from './async-helpers.js';
import { createAsyncWorker } from './async-worker-provider.js';
import { waitForCondition } from "./tools.js";

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

export type AsyncSRTCallback = (ret: AsyncSRTReturnValue) => any;

export class AsyncSRT {

  /**
   * @static
   * @type {number} Promise-timeout in millis
   */
  static TimeoutMs = DEFAULT_PROMISE_TIMEOUT_MS;

  private _worker: null|ReturnType<typeof createAsyncWorker>;// there are different `Worker`s: browser one and Node.js one
  private _workCbQueue: AsyncSRTCallback[] = [];
  private _error: null | Error = null;
  private _id: number = ++idGen;

  /**
   * // TODO: type worker-factory
   * @param {Function} workerFactory (Optional) A function returning the new Worker instance needed to construct this object. This is useful for app-side bundling purposes (see webpack "worker-loader"). The provider MUST return a new instance of a worker. Several Async API instances CAN NOT share the same Worker thread instance. By default, the worker will be created by a provider which will resolve the Worker path at runtime to load it (`async-worker.js`) from the actual source module (see `async-worker-provider.js`). Any other loader used with a bundler will be able to inject its own providing mechanism, which will allow the Worker to be loaded at runtime as part of bundled assets.
   */
  constructor(workerFactory = createAsyncWorker) {

    DEBUG && debug('Creating task-runner worker instance');

    // @ts-ignore
    this._worker = workerFactory();
    ;(this._worker as any).on('message', this._onWorkerMessage.bind(this));
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
  getError(): AsyncSRT['_error'] {
    return this._error;
  }

  isDisposed(): boolean {
    return !this._worker;
  }

  private _startedToDispose = false;
  public get startedToDispose () { return this._startedToDispose; }
  private workerTerminatedWithErrorCode: number|undefined = void 0;
  /**
   * @returns {Promise<number>} Resolves to exit code of Worker (only NodeJS)
   * @see https://nodejs.org/docs/latest-v14.x/api/worker_threads.html#worker_threads_worker_terminate
   */
  async dispose(): Promise<number> {
    if (this._startedToDispose) {
      console.warn('async-api.ts:: dispose:: was already called');
      return (
        void 0 === this.workerTerminatedWithErrorCode
          ? NaN
          : this.workerTerminatedWithErrorCode
      );
    }
    DEBUG && debug(this._id, 'dispose');
    this._startedToDispose = true;
    // the order is on purpose to avoid races
    // because not sure whether {getting a property} & {comparing it with 0} is a single atomic operation.
    if (0 < this._createAsyncWorkPromiseLockLevel)
    {
      await waitForCondition(() => {
        console.log('_createAsyncWorkPromiseLockLevel = %O', this._createAsyncWorkPromiseLockLevel);
        return this._createAsyncWorkPromiseLockLevel <= 0;
      });
    }
    const worker = this._worker;
    this._worker = null;
    if (this._workCbQueue.length !== 0) {
      DEBUG && console.warn(`AsyncSRT: flushing callback-queue with ${this._workCbQueue.length} remaining jobs awaiting.`);
      this._workCbQueue.length = 0;
    }
    if (worker) DEBUG && debug(this._id, 'dispose:: terminating a Worker');
    else DEBUG && console.warn(this._id, 'dispose:: no Worker found');
    return this.workerTerminatedWithErrorCode = worker ? await worker.terminate() : 0;
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

    if (callback)
    {
      const {timestamp, result} = data;
      callback(result);
    }
  }

  private _postAsyncWork(method: string, args: any[], callback: AsyncSRTCallback): void {
    // we check here again because this gets called from
    // a promise-executor (potentially in different tick than promise-creation).
    if (this.isDisposed()) {
      const err = new Error("AsyncSRT._postAsyncWork: has already been dispose()'d");
      throw err;
      //return Promise.reject(err);
    }

    const timestamp = Perf.now();

    DEBUG && debug(this._id, 'Posting call:', traceCallToString(method, args));

    const msgData: AsyncSRTWorkerPost = {method, args, /*workId,*/ timestamp};
    const transferList = extractTransferListFromParams(args);

    this._workCbQueue.push(callback);
    this._worker?.postMessage(msgData, transferList);
  }

  private _createAsyncWorkPromiseLockLevel = 0;
  private _createAsyncWorkPromise(method: string,
    args: any[] = [],
    callback?: AsyncSRTCallback,
    useTimeout = false,
    timeoutMs: number = AsyncSRT.TimeoutMs): AsyncSRTPromise {

    if (this.isDisposed()) {
      const err = new Error("AsyncSRT_createAsyncWorkPromise: has already been dispose()'d");
      console.error(err);
      return Promise.reject(err);
    }
    if (this.startedToDispose)
    {
      DEBUG && console.warn(
        '_createAsyncWorkPromise(%O, %O) was called; but startedToDispose=true',
        method, args,
      );
      // @ts-ignore
      return; // fixme: or Promise.reject? or Promise.resolve(null)?
    }
    this._createAsyncWorkPromiseLockLevel++;

    if (args.some(v => v === undefined)) {
      this._createAsyncWorkPromiseLockLevel--;
      throw new Error(`AsyncSRT: Undefined value in argument list: ${traceCallToString(method, args)}.
        Probably missing some non-optional parameters when method called.`);
    }

    return new Promise((resolve, reject) => {
      let timeout: ReturnType<typeof setTimeout> | null = null;
      let rejected = false;
      const onResult = (
        result: ReturnType<Parameters<AsyncSRT['_postAsyncWork']>[2]>
      ) => {
        // Q: signal somehow to app that timed-out call has had result after all? (only in case of using Promise..?)
        if (rejected) {
          // The reject thing only makes sense for Promise,
          // and users can manage this aspect themselves when using plain callbacks.
          try {
            callback?.(result);
          } catch (e) {
            console.error(e);
          }
          return;
        } else if (useTimeout) clearTimeout(timeout!);

        resolve(result);
        // NOTE: the order doesn't matter for us,
        // but intuitively the promise result should probably be resolved first.
        try {
          callback?.(result);
        } catch (e) {
          console.error(e);
        }
        this._createAsyncWorkPromiseLockLevel--;
        //if (this._createAsyncWorkPromiseLockLevel < 0) this._createAsyncWorkPromiseLockLevel = 0;
      };
      if (useTimeout) {
        timeout = setTimeout(() => {
          reject(new Error(`Timeout exceeded (${timeoutMs} ms) while awaiting method result: ${traceCallToString(method, args)}`));
          this._createAsyncWorkPromiseLockLevel--;
          //if (this._createAsyncWorkPromiseLockLevel < 0) this._createAsyncWorkPromiseLockLevel = 0;
          rejected = true;
        }, timeoutMs);
      }
      this._postAsyncWork(method, args, onResult);
    });
  }

  /**
   * @param {boolean} sender default: false. only needed to specify if local/remote SRT ver < 1.3 or no other HSv5 support
   */
  createSocket(sender = false, callback?: AsyncSRTCallback): Promise<number> {
    return this._createAsyncWorkPromise("createSocket", [sender], callback) as Promise<number>;
  }

  bind(socket: number, address: string, port: number, callback?: AsyncSRTCallback) {
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

  read(socket: number, chunkSize: number, callback?: AsyncSRTCallback): Promise<SRTReadReturn> {
    return this._createAsyncWorkPromise("read", [socket, chunkSize], callback) as Promise<SRTReadReturn>;
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
   * @return {number} `chunk.byteLength` calculated before sending any request
   */
  async write(socket: number, chunk: Buffer | Uint8Array, callback?: AsyncSRTCallback): Promise<number> {
    const byteLength = chunk.byteLength;
    DEBUG && debug(`Writing ${byteLength} bytes to socket:`, socket);
    const ret = await this._createAsyncWorkPromise("write", [socket, chunk], callback);
    if (ret === SRTResult.SRT_ERROR) {
      throw new Error('AsyncSRT:: write:: Got SRT_ERROR while trying to write');
    }
    return byteLength;
  }

  setSockFlag (socket: number, option: SRTSockOptDetalizedWNumber['opt'],  value: number,   callback?: AsyncSRTCallback):  Promise<SRTResult>;
  setSockFlag (socket: number, option: SRTSockOptDetalizedWString['opt'],  value: string,   callback?: AsyncSRTCallback):  Promise<SRTResult>;
  setSockFlag (socket: number, option: SRTSockOptDetalizedWBoolean['opt'], value: boolean,  callback?: AsyncSRTCallback):  Promise<SRTResult>;
  setSockFlag (socket: number, option: SRTSockOptDetalizedW['opt'], value: SRTSockOptValue, callback?: AsyncSRTCallback): Promise<SRTResult> {
    if (option === SRTSockOpt.SRTO_PASSPHRASE) {
      if (!(
        typeof value === 'string'
        &&
        (
          value === ''
          ||
          (value.length >= 10 && value.length <= 79)
        )
      )) {
        throw new Error(
          'AsyncSRT:: setSockFlag(option=SRTSockOpt.SRTO_PASSPHRASE, value=`' + value + '`):: \
Invalid value, \
it should be a \
string of length 0 (to disable encryption) \
or \
a string of length [10..79]'
        );
      }
    }
    return this._createAsyncWorkPromise("setSockFlag", [socket, option, value], callback) as Promise<SRTResult>;
  }
  setSockOpt(...args: Parameters<AsyncSRT['setSockFlag']>) {
    return this.setSockFlag(...args);
  }

  // those which have R in https://github.com/Haivision/srt/blob/master/docs/API/API-socket-options.md#list-of-options?
  getSockFlag (socket: number, option: SRTSockOptDetalizedRNumber['opt'],    callback?: AsyncSRTCallback): Promise<SRTResult|number>;
  getSockFlag (socket: number, option: SRTSockOptDetalizedRString['opt'],    callback?: AsyncSRTCallback): Promise<SRTResult|string>;
  getSockFlag (socket: number, option: SRTSockOptDetalizedRBoolean['opt'],   callback?: AsyncSRTCallback): Promise<SRTResult|boolean>;
  // those which don't have R but still work in https://github.com/Haivision/srt/blob/master/docs/API/API-socket-options.md#list-of-options?
  getSockFlag (
    socket: number,
    option: SRTSockOptDetalizedR['opt'],
    callback?: AsyncSRTCallback,
  ) {
    return this._createAsyncWorkPromise("getSockFlag", [socket, option], callback);
  }
  getSockOpt(...args: Parameters<AsyncSRT['getSockFlag']>) {
    return this.getSockFlag(...args);
  }

  getSockState(socket: number, callback?: AsyncSRTCallback) {
    return this._createAsyncWorkPromise("getSockState", [socket], callback) as Promise<SRTSockStatus>;
  }

  epollCreate(callback?: AsyncSRTCallback) {
    return this._createAsyncWorkPromise("epollCreate", [], callback) as Promise<SRTResult>;
  }

  epollAddUsock(epid: number, socket: number, events: number, callback?: AsyncSRTCallback) {
    return this._createAsyncWorkPromise("epollAddUsock", [epid, socket, events], callback) as Promise<SRTResult/*|SRT_EINVPOLLID*/>;
  }

  epollUWait(epid: number, msTimeOut: number, callback?: AsyncSRTCallback) {
    return this._createAsyncWorkPromise("epollUWait", [epid, msTimeOut], callback) as Promise<SRTEpollResult[]>;
  }

  setLogLevel(logLevel: number | SRTLoggingLevel, callback?: AsyncSRTCallback) {
    return this._createAsyncWorkPromise("setLogLevel", [logLevel], callback) as Promise<SRTResult>;
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






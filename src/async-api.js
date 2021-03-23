const { performance } = require("perf_hooks");

const debug = require('debug')('srt-async');

const { traceCallToString, extractTransferListFromParams } = require('./async-helpers');
const { createAsyncWorker } = require('./async-worker-provider');
const { SRT } = require('./srt');

const DEFAULT_PROMISE_TIMEOUT_MS = 3000;

const DEBUG = false;

/*
const WORK_ID_GEN_MOD = 0xFFF;
*/

class AsyncSRT {

  /**
   * @static
   * @type {number} Promise-timeout in millis
   */
  static TimeoutMs = DEFAULT_PROMISE_TIMEOUT_MS;

  /**
   *
   * @param {Function} workerFactory (Optional) A function returning the new Worker instance needed to construct this object. This is useful for app-side bundling purposes (see webpack "worker-loader"). The provider MUST return a new instance of a worker. Several Async API instances CAN NOT share the same Worker thread instance. By default, the worker will be created by a provider which will resolve the Worker path at runtime to load it (`async-worker.js`) from the actual source module (see `async-worker-provider.js`). Any other loader used with a bundler will be able to inject its own providing mechanism, which will allow the Worker to be loaded at runtime as part of bundled assets.
   */
  constructor(workerFactory = createAsyncWorker) {

    DEBUG && debug('Creating task-runner worker instance');

    this._worker = workerFactory();
    this._worker.on('message', this._onWorkerMessage.bind(this));
    /*
    this._workIdGen = 0;
    this._workCbMap = new Map();
    */
    this._workCbQueue = [];
  }

  /**
   * @returns {Promise<number>} Resolves to exit code of Worker
   */
  dispose() {
    const worker = this._worker;
    this._worker = null;
    if (this._workCbQueue.length !== 0) {
      console.warn(`AsyncSRT: flushing callback-queue with ${this._workCbQueue.length} remaining jobs awaiting.`);
      this._workCbQueue.length = 0;
    }
    return worker.terminate();
  }

  /**
   * @private
   * @param {object} data
   */
  _onWorkerMessage(data) {
    // not sure if there can still be message event
    // after calling terminate
    // but let's guard from that state anyway.
    if (this._worker === null) return;

    const resolveTime = performance.now();
    const callback = this._workCbQueue.shift();

    if (data.err) {
      console.error('AsyncSRT: Error from task-runner:', data.err.message,
        '\n  Binding call:', traceCallToString(data.call.method, data.call.args),
        //'\n  Stacktrace:', data.err.stack
        );
      return;
    }

    const {timestamp, result, workId} = data;
    callback(result);
  }

  /**
   * @private
   * @param {string} method
   * @param {Array<any>} args
   * @param {Function} callback
   */
  _postAsyncWork(method, args, callback) {
    const timestamp = performance.now();

    // not really needed atm,
    // only if the worker spawns async jobs itself internally
    // and thus the queuing order of jobs would not be preserved
    // across here and the worker side.
    /*
    if (this._workCbMap.size >= WORK_ID_GEN_MOD - 1) {
      throw new Error('Can`t post more async work: Too many awaited callbacks unanswered in queue');
    }
    const workId = this._workIdGen;
    this._workIdGen = (this._workIdGen + 1) % WORK_ID_GEN_MOD;
    this._workCbMap.set(workId, callback);
    */

    DEBUG && debug('Sending call:', traceCallToString(method, args));

    const transferList = extractTransferListFromParams(args);

    this._workCbQueue.push(callback);
    this._worker.postMessage({method, args, /*workId,*/ timestamp}, transferList);
  }

  /**
   * @private
   * @param {string} method
   * @param {Array<any>} args optional
   * @param {Function} callback optional
   * @param {boolean} useTimeout
   * @param {number} timeoutMs
   */
  _createAsyncWorkPromise(method,
    args = [],
    callback = null,
    useTimeout = false,
    timeoutMs = AsyncSRT.TimeoutMs) {

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
   *
   * @param {boolean} sender default: `false`. only needed to specify if local/remote SRT ver < 1.3 or no other HSv5 support
   */
  createSocket(sender = false, callback) {
    return this._createAsyncWorkPromise("createSocket", [sender], callback);
  }

  /**
   *
   * @param {number} socket
   * @param {string} address
   * @param {number} port
   */
  bind(socket, address, port, callback) {
    return this._createAsyncWorkPromise("bind", [socket, address, port], callback);
  }

  /**
   *
   * @param {number} socket
   * @param {number} backlog
   */
  listen(socket, backlog, callback) {
    return this._createAsyncWorkPromise("listen", [socket, backlog], callback);
  }

  /**
   *
   * @param {number} socket
   * @param {string} host
   * @param {number} port
   */
  connect(socket, host, port, callback) {
    return this._createAsyncWorkPromise("connect", [socket, host, port], callback);
  }

  /**
   *
   * @param {number} socket
   */
  accept(socket, callback, useTimeout = false, timeoutMs = AsyncSRT.TimeoutMs) {
    return this._createAsyncWorkPromise("accept", [socket], callback, useTimeout, timeoutMs);
  }

  /**
   *
   * @param {number} socket
   */
  close(socket, callback) {
    return this._createAsyncWorkPromise("close", [socket], callback);
  }

  /**
   *
   * @param {number} socket
   * @param {number} chunkSize
   * @returns {Promise<Buffer | SRTResult.SRT_ERROR | null>}
   */
  read(socket, chunkSize, callback) {
    return this._createAsyncWorkPromise("read", [socket, chunkSize], callback);
  }

  /**
   *
   * Pass message/buffer data to write to the socket
   * (depending on `SRTO_MESSAGEAPI` socket-flag enabled).
   *
   * When socket is in MessageAPI mode: (!)
   * The size of the buffer must not exceed the SRT payload MTU
   * (usually 1316 bytes). (Otherwise the call will resolve to SRT_ERROR.)
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
  write(socket, chunk, callback) {
    const byteLength = chunk.byteLength;
    DEBUG && debug(`write ${byteLength} to socket:`, socket)
    return this._createAsyncWorkPromise("write", [socket, chunk], callback)
      .then((result) => {
        if (result !== SRT.ERROR) {
          return byteLength;
        }
      });
  }

  /**
   *
   * @param {number} socket
   * @param {number} option
   * @param {number} value
   */
  setSockOpt(socket, option, value, callback) {
    return this._createAsyncWorkPromise("setSockOpt", [socket, option, value], callback);
  }

  /**
   *
   * @param {number} socket
   * @param {number} option
   */
  getSockOpt(socket, option, callback) {
    return this._createAsyncWorkPromise("getSockOpt", [socket, option], callback);
  }

  /**
   *
   * @param {number} socket
   */
  getSockState(socket, callback) {
    return this._createAsyncWorkPromise("getSockState", [socket], callback);
  }

  /**
   * @returns {number} epid
   */
  epollCreate(callback) {
    return this._createAsyncWorkPromise("epollCreate", [], callback);
  }

  /**
   *
   * @param {number} epid
   * @param {number} socket
   * @param {number} events
   */
  epollAddUsock(epid, socket, events, callback) {
    return this._createAsyncWorkPromise("epollAddUsock", [epid, socket, events], callback);
  }

  /**
   *
   * @param {number} epid
   * @param {number} msTimeOut
   */
  epollUWait(epid, msTimeOut, callback) {
    return this._createAsyncWorkPromise("epollUWait", [epid, msTimeOut], callback);
  }

  /**
   *
   * @param {number | SRTLoggingLevel} logLevel
   * @returns {Promise<SRTResult>}
   */
  setLogLevel(logLevel, callback) {
    return this._createAsyncWorkPromise("setLogLevel", [logLevel], callback);
  }

  /**
   *
   * @param {number} socket
   * @param {boolean} clear
   * @returns {Promise<SRTStats>}
   */
   stats(socket, clear, callback) {
    return this._createAsyncWorkPromise("stats", [socket, clear], callback);
  }
}

module.exports = {AsyncSRT};







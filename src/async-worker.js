import {
  isMainThread, parentPort
} from 'worker_threads';


import { default as _debug } from "debug";
const debug = _debug('srt-async-worker');
//const debug = (await import('debug'))('srt-async-worker');

import SRT from './srt.js';

import { argsToString, traceCallToString, extractTransferListFromParams } from './async-helpers.js';

const DEBUG = false;
const DRY_RUN = false;

if (isMainThread) {
  throw new Error("Worker module can not load on main thread");
}

try {
  run();
} catch(err) {
  console.error('AsyncSRT task-runner internal exception:', err);
}

function run() {

  DEBUG && debug('AsyncSRT: Launching task-runner');

  const srtNapiObjw = new SRT();

  DEBUG && debug('AsyncSRT: SRT native object-wrap created');

  parentPort.on('close', () => {
    DEBUG && debug('AsyncSRT: Closing task-runner');
  });

  parentPort.on('message', (data) => {

    if (!data.method) {
      throw new Error('Worker message needs `method` property');
    }

    if (data.args.some((arg) => arg === undefined)) {
      const err = new Error(
        `Ignoring call: Can't have any arguments be undefined: ${argsToString(data.args)}`);
      parentPort.postMessage(err);
      return;
    }

    DEBUG && debug('Received call:', traceCallToString(data.method, data.args));

    let result = 0;
    if (!DRY_RUN) {
      try {
        result = srtNapiObjw[data.method].apply(srtNapiObjw, data.args);
      } catch(err) {
        DEBUG && console.error(
          `Exception thrown by native binding call "${traceCallToString(data.method, data.args)}":`,
            err);
        parentPort.postMessage({err, call: data, result: SRT.ERROR});
        return;
      }
    }

    const transferList = extractTransferListFromParams([result]);

    parentPort.postMessage({
      // workId: data.workId,
      timestamp: data.timestamp,
      result
    }, transferList);

  });
}

import SRT from './src/srt';

import SRTReadStream from './src/srt-stream-readable';
import SRTWriteStream from './src/srt-stream-writable';

import { setSRTLoggingLevel } from './src/logging';

import {
  createAsyncWorker as createSRTAsyncWorker,
  getAsyncWorkerPath as getSRTAsyncWorkerPath,
} from './src/async-worker-provider';

const isSRTInstalled = () => {
  return !! SRT;
};

export {
  SRT,
  SRTReadStream,
  SRTWriteStream,
  setSRTLoggingLevel,
  isSRTInstalled,
  createSRTAsyncWorker,
  getSRTAsyncWorkerPath,
};

export * from "./src/srt-api-enums";
export * from "./src/srt-api-types";

export * from "./src/async-api-events";

export enum SRTSocketMode {
  CALLER = 'caller',
  LISTENER = 'listener'
}

export { AsyncSRT } from './src/async-api';
export { AsyncReaderWriter } from './src/async-reader-writer';
export { SRTClientConnection } from './src/srt-client';
export { SRTServer, SRTServerConnection } from './src/srt-server';






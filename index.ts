import SRT from './src/srt.js';

import SRTReadStream from './src/srt-stream-readable.js';
import SRTWriteStream from './src/srt-stream-writable.js';

import { setSRTLoggingLevel } from './src/logging.js';

import {
  createAsyncWorker as createSRTAsyncWorker,
  getAsyncWorkerPath as getSRTAsyncWorkerPath,
} from './src/async-worker-provider.js';

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

export * from "./src/srt-api-enums.js";
export * from "./src/srt-api-types.js";

export * from "./src/async-api-events.js";

export enum SRTSocketMode {
  CALLER = 'caller',
  LISTENER = 'listener'
}

export { AsyncSRT } from './src/async-api.js';
export { AsyncReaderWriter } from './src/async-reader-writer.js';
export { SRTClientConnection } from './src/srt-client.js';
export { SRTServer, SRTServerConnection } from './src/srt-server.js';






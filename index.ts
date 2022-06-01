const { SRT } = require ('./src/srt');

const { SRTReadStream } = require('./src/srt-stream-readable');
const { SRTWriteStream } = require('./src/srt-stream-writable');

const { setSRTLoggingLevel } = require('./src/logging');

const {
  createAsyncWorker: createSRTAsyncWorker,
  getAsyncWorkerPath: getSRTAsyncWorkerPath
} = require('./src/async-worker-provider');

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






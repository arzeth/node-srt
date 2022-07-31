import { Worker } from 'worker_threads';
import { resolve } from 'path';
import __dirname from './__dirname';

const ASYNC_WORKER_PATH = './async-worker.js';

const getAsyncWorkerPath = () => resolve(__dirname, ASYNC_WORKER_PATH);

let _createAsyncWorker = () => {
  return new Worker(getAsyncWorkerPath());
};

const createAsyncWorker = () => {
  return _createAsyncWorker();
};

createAsyncWorker.overrideModuleScopeImpl = (func) => {
  _createAsyncWorker = func;
};

export {
  createAsyncWorker,
  getAsyncWorkerPath,
};

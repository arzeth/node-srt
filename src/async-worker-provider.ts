import { Worker } from 'worker_threads';
import path from 'path';
import __dirname from './__dirname.js';

const ASYNC_WORKER_PATH = './async-worker.js';

const getAsyncWorkerPath = () => path.resolve(__dirname, ASYNC_WORKER_PATH);

const createAsyncWorker = () => {
  return new Worker(getAsyncWorkerPath());
};

export {
  createAsyncWorker,
  getAsyncWorkerPath,
};

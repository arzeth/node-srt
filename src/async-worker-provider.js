const { Worker } = require('worker_threads');
const { resolve } = require('path');

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

module.exports = {
  createAsyncWorker,
  getAsyncWorkerPath
};

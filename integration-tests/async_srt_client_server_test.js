const { SRT, AsyncSRT, SRTServer } = require('../index');

const {
  writeChunksWithYieldingLoop,
  writeChunksWithExplicitScheduling
} = require('../src/async-write-modes');

const {sliceBufferToChunks, copyChunksIntoBuffer, generateRandomBytes, cloneChunks} = require('../src/tools');

const { performance } = require("perf_hooks");

const now = performance.now;

jest && jest.setTimeout(3000);

// new SRT().setLogLevel(7);

describe("AsyncSRT to SRTServer one-way transmission", () => {
  it("should transmit data written (yielding-loop)", async done => {
    transmitClientToServerLoopback(9000, done, false);
  });

  it("should transmit data written (explicit-scheduling)", async done => {
    transmitClientToServerLoopback(8000, done, true);
  });
});

const serverAddr = '127.0.0.1';

const chunkMaxSize = 1024;
const numChunks = 8092;

const readerBufSize = 1024 * 1024;

const writesPerTick = 32; // increasing this beyond certain levels leading to > 100Mbit/s thruput has libSRT drop packets internally

async function transmitClientToServerLoopback(serverPort, done, useExplicitScheduling) {

  const log = console.log.bind(console, `serverPort: ${serverPort} > `);

  const txSourceData = generateRandomBytes(numChunks * chunkMaxSize);
  const txShouldSendBytes = Math.min(numChunks * chunkMaxSize, txSourceData.byteLength);
  const txChunks = sliceBufferToChunks(txSourceData, chunkMaxSize, txShouldSendBytes);

  // we need two instances of task-runners here,
  // because otherwise awaiting server accept
  // result would deadlock
  // client connection tasks
  const srtServer = new SRTServer(serverPort);

  srtServer.on('connection', (connection) => {
    onConnectionAtServer(connection);
  });

  const srtHandle = new AsyncSRT();

  const [clientSideSocket] = await Promise.all([
    srtHandle.createSocket(), // we could also use the server-runner here.
    srtServer.create().then(s => s.open())
  ]);

  log('Got socket handles (client/server):', clientSideSocket, '/', srtServer.socket);

  writeToConnection();

  let writeStartTime;
  let writeDoneTime;

  let txBytesCount = 0;

  async function writeToConnection() {

    let result = await srtHandle.connect(clientSideSocket,
      serverAddr, serverPort);

    if (result === SRT.ERROR) {
      throw new Error('client connect failed');
    }

    log('Client-connect() result:', result);

    writeStartTime = now();

    if (useExplicitScheduling) {
      writeChunksWithExplicitScheduling(srtHandle,
        clientSideSocket, cloneChunks(txChunks), onWrite, writesPerTick);
    } else {
      writeChunksWithYieldingLoop(srtHandle,
        clientSideSocket, cloneChunks(txChunks), onWrite, writesPerTick);
    }

    function onWrite(bytesSent, chunkIdx) {
      if (bytesSent == 0) throw new Error('onWrite bytesSent = 0');
      if (chunkIdx >=  txChunks.length) throw new Error('onWrite chunkIdx out-of-range');

      txBytesCount += bytesSent;
      if(txBytesCount >= txShouldSendBytes) {
        if (txBytesCount > txShouldSendBytes) {
          throw new Error(`bytesSentCount ${txBytesCount} > bytesShouldSendTotal ${txShouldSendBytes}`);
        }

        log('Done writing', txBytesCount,
          'took millis:', now() - writeStartTime,
          bytesSent, chunkIdx);

        writeDoneTime = now();
      }
    }
  }

  function onConnectionAtServer(connection) {
    log('Got new connection at server:', connection.fd);

    let rxBytes = 0;
    let firstRxTime;

    const serverConnectionAcceptTime = now();

    connection.on('data', async () => {
      if (!connection.gotFirstData) {
        onDataFromConnection();
      }
    });

    const reader = connection.getReaderWriter();

    async function onDataFromConnection() {

      const rxChunks = await reader.readChunks(
        txShouldSendBytes,
        readerBufSize,
        (readBuf) => {
          if (!firstRxTime) {
            firstRxTime = now();
          }
          rxBytes += readBuf.byteLength;
        // log('Read buffer of size:', readBuf.byteLength, bytesRecv, '/', bytesSentCount, '/', bytesShouldSendTotal, bytesSentCount - bytesRecv)
        }, (errRes) => {
          log('Error reading, got result:', errRes);
        });

      const readDoneTime = now();
      const readTimeDiffMs = readDoneTime - serverConnectionAcceptTime;
      const readBandwidthEstimKbps = (8 * (txShouldSendBytes / readTimeDiffMs));

      log('Done reading stream, took millis:', readTimeDiffMs,
        'for kbytes:~', (txBytesCount / 1000), 'of', (txShouldSendBytes / 1000));

      log('Estimated read-bandwidth (kb/s):', readBandwidthEstimKbps.toFixed(3));
      log('First-byte-write-to-read latency millis:', firstRxTime - writeStartTime);
      log('End-to-end transfer latency millis:', readDoneTime - writeStartTime);
      log('Client-side writing took millis:', writeDoneTime - writeStartTime);

      expect(txBytesCount).toEqual(txShouldSendBytes);

      const rxDestData = copyChunksIntoBuffer(rxChunks);

      expect(rxDestData.byteLength).toEqual(txSourceData.byteLength);
      expect(rxDestData.byteLength).toEqual(txBytesCount);

      expect(rxChunks.length).toEqual(txChunks.length);

      for (let i = 0; i < rxChunks.length; i++) {
        expect(txChunks[i]).toEqual(rxChunks[i]);
      }

      //asyncSrtClient.dispose();
      //asyncSrtServer.dispose();

      done();
    }

  }

}


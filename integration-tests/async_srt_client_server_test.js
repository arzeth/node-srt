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

async function transmitClientToServerLoopback(localServerPort, done, useExplicitScheduling) {

  const log = console.log.bind(console, `localServerPort: ${localServerPort} > `);

  const localServerBindIface = '127.0.0.1';

  const readerBufSize = 1024 * 1024;

  const chunkMaxSize = 1024;
  const numChunks = 8 * 1024;

  const txSourceData = generateRandomBytes(numChunks * chunkMaxSize);

  const txShouldSendBytes = Math.min(numChunks * chunkMaxSize, txSourceData.byteLength);

  const clientWritesPerTick = 32; // increasing this beyond certain levels leading to > 100Mbit/s thruput has libSRT drop packets internally

  const packetDataSlicingStartTime = now();
  const txChunks = sliceBufferToChunks(txSourceData, chunkMaxSize, txShouldSendBytes);
  const packetDataSlicingTimeD = now() - packetDataSlicingStartTime;

  log('Pre-slicing packet data took millis:', packetDataSlicingTimeD);

  // we need two instances of task-runners here,
  // because otherwise awaiting server accept
  // result would deadlock
  // client connection tasks
  const asyncSrtServer = new SRTServer(localServerPort);

  asyncSrtServer.on('connection', (connection) => {
    onClientConnected(connection);
  });

  const asyncSrtClient = new AsyncSRT();

  const [clientSideSocket] = await Promise.all([
    asyncSrtClient.createSocket(), // we could also use the server-runner here.
    asyncSrtServer.create().then(s => s.open())
  ]);

  log('Got socket handles (client/server):', clientSideSocket, '/', asyncSrtServer.socket);

  clientWriteToConnection();

  let clientWriteStartTime;
  let clientWriteDoneTime;
  let clientTxBytes = 0;

  async function clientWriteToConnection() {

    let result = await asyncSrtClient.connect(clientSideSocket,
      localServerBindIface, localServerPort);

    if (result === SRT.ERROR) {
      throw new Error('client connect failed');
    }

    log('Client-connect() result:', result);

    clientWriteStartTime = now();

    if (useExplicitScheduling) {
      writeChunksWithExplicitScheduling(asyncSrtClient,
        clientSideSocket, cloneChunks(txChunks), onWrite, clientWritesPerTick);
    } else {
      writeChunksWithYieldingLoop(asyncSrtClient,
        clientSideSocket, cloneChunks(txChunks), onWrite, clientWritesPerTick);
    }

    function onWrite(bytesSent, chunkIdx) {
      if (bytesSent == 0) throw new Error('onWrite bytesSent = 0');
      if (chunkIdx >=  txChunks.length) throw new Error('onWrite chunkIdx out-of-range');

      clientTxBytes += bytesSent;
      if(clientTxBytes >= txShouldSendBytes) {
        if (clientTxBytes > txShouldSendBytes) {
          throw new Error(`bytesSentCount ${clientTxBytes} > bytesShouldSendTotal ${txShouldSendBytes}`);
        }

        log('Done writing', clientTxBytes,
          'took millis:', now() - clientWriteStartTime,
          bytesSent, chunkIdx);

        clientWriteDoneTime = now();
      }
    }
  }

  function onClientConnected(connection) {
    log('Got new connection:', connection.fd);

    let rxBytes = 0;
    let firstRxTime;

    const serverConnectionAcceptTime = now();

    connection.on('data', async () => {
      if (!connection.gotFirstData) {
        onClientData();
      }
    });

    const reader = connection.getReaderWriter();

    async function onClientData() {

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
        'for kbytes:~', (clientTxBytes / 1000), 'of', (txShouldSendBytes / 1000));

      log('Estimated read-bandwidth (kb/s):', readBandwidthEstimKbps.toFixed(3));
      log('First-byte-write-to-read latency millis:', firstRxTime - clientWriteStartTime);
      log('End-to-end transfer latency millis:', readDoneTime - clientWriteStartTime);
      log('Client-side writing took millis:', clientWriteDoneTime - clientWriteStartTime);

      expect(clientTxBytes).toEqual(txShouldSendBytes);

      const rxDestData = copyChunksIntoBuffer(rxChunks);

      expect(rxDestData.byteLength).toEqual(txSourceData.byteLength);
      expect(rxDestData.byteLength).toEqual(clientTxBytes);

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


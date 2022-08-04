import crypto from 'crypto';
import { performance } from 'perf_hooks';

import { SRT, AsyncSRT, SRTServer } from '../build/index.js';

import {
  writeChunksWithYieldingLoop,
  writeChunksWithExplicitScheduling
} from '../build/src/async-write-modes.js';

import {sliceBufferToChunks, copyChunksIntoBuffer, cloneChunks} from '../build/src/tools.js';


const now = performance.now;

import.meta.jest?.setTimeout(20000);

// new SRT().setLogLevel(7);


const serverAddr = '127.0.0.1';

const chunkMaxSize = 1024;
const numChunks = 8192;

const readerBufSize = 1024 * 1024;

const writesPerTick = 32; // increasing this beyond certain levels leading to > 100Mbit/s thruput has libSRT drop packets internally

async function transmitClientToServerLoopback(serverPort, done, useExplicitScheduling) {

  const log = console.log.bind(console, `serverPort: ${serverPort} > `);

  const preparingBeforeStartingSrtStartedOn = now();

  const txSourceData = new Uint8Array(crypto.randomBytes(numChunks * chunkMaxSize));
  log('generateRandomBytes took millis', now() - preparingBeforeStartingSrtStartedOn);
  const txShouldSendBytes = Math.min(numChunks * chunkMaxSize, txSourceData.byteLength);
  const txChunks = sliceBufferToChunks(txSourceData, chunkMaxSize, txShouldSendBytes);

  log('preparingBeforeStartingSrt took millis', now() - preparingBeforeStartingSrtStartedOn);

  // we need two instances of task-runners here,
  // because otherwise awaiting server accept
  // result would deadlock
  // client connection tasks
  const creatingSrtStartedOn = now();
  const srtServer = new SRTServer(serverPort);

  const srtHandle = new AsyncSRT();
  const [clientSideSocket] = await Promise.all([
    srtHandle.createSocket(), // we could also use the server-runner here.
    srtServer.create().then(s => s.open())
  ]);

  log('creating new SRTServer, new AsyncSRT, and sockets took millis:', now() - creatingSrtStartedOn);


  let writeStartTime;
  let writeDoneTime;

  let txBytesCount = 0;

  srtServer.on('connection', function onConnectionAtServer (connection) {
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

      expect(txBytesCount).toStrictEqual(txShouldSendBytes);
      

      //log('copying 1 begins');
      const copyChunksIntoBufferStartedOn = now();
      const rxDestData = copyChunksIntoBuffer(rxChunks);
      log('copyChunksIntoBuffer took millis', now() - copyChunksIntoBufferStartedOn);
      //log('copying 1 done');

      expect(rxDestData.byteLength).toStrictEqual(txSourceData.byteLength);
      expect(rxDestData.byteLength).toStrictEqual(txBytesCount);

      expect(rxChunks.length).toStrictEqual(txChunks.length);

      //log(`Started to validate ${rxChunks.length} received chunks`); // very long to wait

      const bufferComparingStartedOn = now();
      for (let i = 0; i < rxChunks.length; i++) {
        // commented because it takes ~5 minutes for .toStrictEqual to compare all of them
        //expect(txChunks[i]).toStrictEqual(rxChunks[i]);
        expect(Buffer.compare(txChunks[i], rxChunks[i])).toStrictEqual(0);
      }
      log('validating buffers (it was done by this test itself) took millis:', now() - bufferComparingStartedOn);
      //expect(txChunks).toStrictEqual(rxChunks);
      //log('Completed validating them.');

      {
        const disposingStartedOn = now();
        //log('closing');
        //log(`${connection.fd} ${clientSideSocket}`)
        //await srtHandle.close(connection.fd);
        //await connection.close();
        //log('closing 2');
        //await srtHandle.close(clientSideSocket);
        await srtHandle.dispose();
        //log('closing 3');
        
        //log('closing 4');
        //await srtServer.close();
        //log('closing 5');
        await srtServer.dispose();
        //log('closing 6');
        //await srtHandle.dispose();
        log('disposing took millis:', now() - disposingStartedOn);
        log('total test:', now() - creatingSrtStartedOn, 'or', now() - preparingBeforeStartingSrtStartedOn);
      }

      done();

    }

  });


  log('Got socket handles (client/server):', clientSideSocket, '/', srtServer.socket);


  ;(async function writeToConnection() {

    let result = await srtHandle.connect(clientSideSocket,
      serverAddr, serverPort);

    if (result === SRT.ERROR) {
      throw new Error('client connect failed');
    }

    log('Client-connect() result:', result);

    const onWrite = (bytesSent, chunkIdx) => {
      if (bytesSent == 0) throw new Error('onWrite bytesSent = 0');
      if (chunkIdx >= txChunks.length) throw new Error('onWrite chunkIdx out-of-range');

      txBytesCount += bytesSent;
      if (txBytesCount >= txShouldSendBytes) {
        if (txBytesCount > txShouldSendBytes) {
          throw new Error(`bytesSentCount ${txBytesCount} > bytesShouldSendTotal ${txShouldSendBytes}`);
        }

        log(`\
Done writing ${txBytesCount} bytes, \
took ${now() - writeStartTime}ms, \
bytesSent=${bytesSent}, \
chunkIdx=${chunkIdx}.\
`);

        writeDoneTime = now();
      }
    };

    writeStartTime = now();
    const fn = useExplicitScheduling ? writeChunksWithExplicitScheduling : writeChunksWithYieldingLoop;
    fn(srtHandle, clientSideSocket, cloneChunks(txChunks), onWrite, writesPerTick);
  })();
}

describe("AsyncSRT to SRTServer one-way transmission", () => {
  it("should transmit data written (yielding-loop)", (done) => {
    transmitClientToServerLoopback(9000, done, false);
  });

  it("should transmit data written (explicit-scheduling)", (done) => {
    transmitClientToServerLoopback(8000, done, true);
  });
});

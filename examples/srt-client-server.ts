#!/usr/bin/env ts-node

import { SRT, SRTClientConnection, SRTServer } from '../';
import { SRTResult } from '../src/srt-api-enums';
import { SRTServerConnection } from '../types/srt-server';

new SRT().setLogLevel(7);

let char = 0;

let recvBytes = 0
let sentBytes = 0;

new Promise<void>(async (resolve, reject) => {

  const srtServer: SRTServer = new SRTServer(8002, '127.0.0.1');
  srtServer.on('connection', onConnectionServer);
  await srtServer.create()
  await srtServer.open();

  const srtClient = new SRTClientConnection(8002, '127.0.0.1');
  await srtClient.create();
  await srtClient.open();

  async function onConnectionServer(connection: SRTServerConnection) {
    console.log('server-connection fd:', connection.fd);

    while(true) {

      const pkt = new Uint8Array(1000);
      sentBytes += pkt.byteLength;
      const res = await connection.write(pkt);
      if (res === SRTResult.SRT_ERROR) {
        throw new Error('Server write failed: ' + srtServer.asyncSrt.getError()?.message);
      }
      console.log('server sent bytes:', sentBytes);

      srtClient.read(16 * 1024)
        .then(onReadClient)
        .catch(err => { throw new Error(err)});
    }
  }

  function onReadClient(result: Uint8Array | SRTResult.SRT_ERROR) {
    if (result instanceof Uint8Array) {
      recvBytes += result.byteLength;
      console.log('client read bytes:', recvBytes, result.byteLength)
      console.log('client-server diff:', sentBytes - recvBytes);
    } else {
      console.log('client read error')
    }
  }

});

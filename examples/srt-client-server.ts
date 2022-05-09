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

  srtServer.on('connection', async (connection: SRTServerConnection) => {
    console.log('server-connection fd:', connection.fd);

    while(true) {

      const pkt = new Uint8Array(1000);
      sentBytes += pkt.byteLength;
      const res = await connection.write(pkt);
      if (res !== SRTResult.SRT_OK) {
        throw new Error();
      }
      console.log('server sent bytes:', sentBytes);

      const result = await srtClient.read(16 * 1024);
      if (result instanceof Uint8Array) {
        recvBytes += result.byteLength;
        console.log('client read bytes:', recvBytes, result.byteLength)
      } else {
        console.log('client read error:', result)
      }

    }

  });

  await srtServer.create()
  await srtServer.open();

  const srtClient = new SRTClientConnection(8002, '127.0.0.1');

  await srtClient.create();
  await srtClient.open();

});

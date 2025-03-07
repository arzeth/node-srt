import { SRT, SRTClientConnection, SRTServer } from '../index.js';
import { SRTServerConnection } from '../src/srt-server.js';

// @ts-ignore
import.meta.jest?.setTimeout(10000);

new SRT().setLogLevel(7);

describe('SRTClientConnection', () => {

  it('should connect to SRTServer instance', async () => {

    const char = 0;

    return new Promise<void>(async (resolve) => {
      const srtServer: SRTServer = new SRTServer(8002, '127.0.0.1');

      srtServer.on('connection', async (connection: SRTServerConnection) => {
        console.log('server-connection fd:', connection.fd);

        await connection.write(new Uint8Array(1000));
        srtClient.read(16 * 1024).then(async (result) => {
          console.log('client result:', result);
          //await srtClient.dispose();
          //await srtServer.dispose();

          resolve();
        });
      });

      await srtServer.create();
      await srtServer.open();

      const srtClient = new SRTClientConnection(8002, '127.0.0.1');

      await srtClient.create();
      await srtClient.open();

    });
  });
});


import { SRTClientConnection, SRTServer } from '../';
import { SRTServerConnection } from '../types/srt-server';

jest.setTimeout(2000);

describe('SRTClientConnection', () => {

  it('should connect to SRTServer instance', async () => {

    let char = 0;

    return new Promise<void>(async (resolve, reject) => {
      const srtServer: SRTServer = new SRTServer(8002, '127.0.0.1');

      srtServer.on('connection', async (connection: SRTServerConnection) => {
        console.log('server-connection fd:', connection.fd);
        await connection.write(new Uint8Array(1000
          ));
        const result = await srtClient.read(16 * 1024);
        console.log('client result:', result)
      });

      await srtServer.create()
      await srtServer.open();

      const srtClient = new SRTClientConnection(8002, '127.0.0.1');

      await srtClient.create();
      await srtClient.open();

    });
  });
});

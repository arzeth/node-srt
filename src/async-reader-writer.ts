import { AsyncSRT } from './async-api.js';
import { readChunks, READ_BUF_SIZE } from './async-read-modes.js';
import { writeChunksWithYieldingLoop } from './async-write-modes.js';
import { sliceBufferToChunks } from './tools.js';

export const DEFAULT_MTU_SIZE = 1316; // (for writes) should be the maximum on all IP networks cases
export const DEFAULT_WRITES_PER_TICK = 128; // tbi
export const DEFAULT_READ_BUFFER = READ_BUF_SIZE; // typical stream buffer size read in Node-JS internals

export class AsyncReaderWriter {

  constructor(private _asyncSrt: AsyncSRT, private _fd: number) {}

  async writeChunks(
    buffer: Uint8Array | Buffer,
    writesPerTick: Parameters<typeof writeChunksWithYieldingLoop>[4] = DEFAULT_WRITES_PER_TICK,
    mtuSize: number = DEFAULT_MTU_SIZE,
    onWrite: Parameters<typeof writeChunksWithYieldingLoop>[3] = null,
  ): Promise<void> {

    const chunks = sliceBufferToChunks(buffer, mtuSize,
      buffer.byteLength, 0);

    return writeChunksWithYieldingLoop(this._asyncSrt, this._fd, chunks,
      onWrite, writesPerTick);
  }

  /**
   * Will read at least a number of bytes from SRT socket in async loop.
   *
   * Returns Promise on array of buffers.
   *
   * The amount read (sum of bytes of array of buffers returned)
   * may differ (exceed min bytes) by less than one MTU size.
   *
   */
  async readChunks(
    minBytesRead: Parameters<typeof readChunks>[2] = DEFAULT_MTU_SIZE,
    readBufSize: Parameters<typeof readChunks>[3] = DEFAULT_READ_BUFFER,
    onRead: Parameters<typeof readChunks>[4] = null,
    onError: Parameters<typeof readChunks>[5] = null,
  ): Promise<Uint8Array[]> {
    return readChunks(this._asyncSrt, this._fd, minBytesRead, readBufSize, onRead, onError);
  }
}

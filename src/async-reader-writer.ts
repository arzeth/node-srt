import { AsyncSRT } from "./async-api";
import { readChunks, READ_BUF_SIZE } from "./async-read-modes";
import { writeChunksWithYieldingLoop } from "./async-write-modes";
import { sliceBufferToChunks } from "./tools";

export const DEFAULT_MTU_SIZE = 1316; // (for writes) should be the maximum on all IP networks cases
export const DEFAULT_WRITES_PER_TICK = 128; // tbi
export const DEFAULT_READ_BUFFER = READ_BUF_SIZE; // typical stream buffer size read in Node-JS internals

export class AsyncReaderWriter {

  constructor(private _asyncSrt: AsyncSRT, private _fd: number) {}

  async writeChunks(buffer: Uint8Array | Buffer,
    writesPerTick: number = DEFAULT_WRITES_PER_TICK,
    mtuSize: number = DEFAULT_MTU_SIZE,
    onWrite: Function = null): Promise<void> {

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
  async readChunks(minBytesRead: number = DEFAULT_MTU_SIZE,
    readBufSize: number = DEFAULT_READ_BUFFER,
    onRead: Function = null,
    onError: Function = null): Promise<Uint8Array[]> {
    return readChunks(this._asyncSrt, this._fd, minBytesRead, readBufSize, onRead, onError);
  }
}

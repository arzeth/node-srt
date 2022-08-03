import { AsyncSRT } from './async-api.js';
import { SRTResult } from './srt-api-enums.js';

const READ_BUF_SIZE = 16 * 1024;

/**
 * Will read at least max number of bytes from SRT socket in async loop.
 *
 * Returns Promise of array of buffers.
 *
 * @param {AsyncSRT} asyncSrt
 * @param {number} socketFd
 * @param {number} minBytesRead
 * @param {number} readBufSize
 * @param {null|Function} onRead
 * @param {null|Function} onError
 * @returns {Promise<Uint8Array[]>}
 */
async function readChunks (
  asyncSrt: AsyncSRT,
  socketFd: number,
  minBytesRead: number,
  readBufSize = READ_BUF_SIZE,
  onRead: null|{(readChunk: Uint8Array): void} = null,
  onError: null|{(err: SRTResult.SRT_ERROR|null): void} = null,
): Promise<Uint8Array[]> {
  let bytesRead = 0;
  const chunks: Uint8Array[] = [];
  let anyFailures = false;
  while (bytesRead < minBytesRead) {
    const readReturn = await asyncSrt.read(socketFd, readBufSize);
    if (readReturn instanceof Uint8Array) {
      const readBuf = readReturn;
      bytesRead += readBuf.byteLength;
      onRead?.(readBuf);
      chunks.push(readBuf);
    } else if (anyFailures) {
      // evade an infinite loop
      return chunks
    } else if (readReturn === SRTResult.SRT_ERROR || readReturn === null) {
      onError?.(readReturn);
    } else {
      throw new Error(`Got unexpected read-result: ${readReturn}`)
    }
  }
  return chunks;
}

export {
  READ_BUF_SIZE,
  readChunks,
};

const { SRT } = require('./srt');

const READ_BUF_SIZE = 16 * 1024;

/**
 * Will read at least max number of bytes from SRT socket in async loop.
 *
 * Returns Promise of array of buffers.
 *
 * @param {AsyncSRT} asyncSrt
 * @param {number} socketFd
 * @param {number} minBytesRead
 * @param {Function} onRead
 * @param {Function} onError
 * @returns {Promise<Uint8Array[]>}
 */
async function readChunks(asyncSrt, socketFd, minBytesRead, readBufSize = READ_BUF_SIZE,
  onRead = null, onError = null) {
  let bytesRead = 0;
  const chunks = [];
  let anyFailures = false;
  while (bytesRead < minBytesRead) {
    const readReturn = await asyncSrt.read(socketFd, readBufSize);
    if (readReturn instanceof Uint8Array) {
      const readBuf = readReturn;
      bytesRead += readBuf.byteLength;
      if (onRead) {
        onRead(readBuf);
      }
      chunks.push(readBuf);
    } else if (anyFailures) {
      // evade an infinite loop
      return chunks
    } else if (readReturn === SRT.ERROR || readReturn === null) {
      if (onError) {
        onError(readReturn);
      }
    } else {
      throw new Error(`Got unexpected read-result: ${readReturn}`)
    }
  }
  return chunks;
}

module.exports = {
  READ_BUF_SIZE,
  readChunks
}

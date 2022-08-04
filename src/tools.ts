/**
 *
 * @param {Buffer | Uint8Array} srcData
 * @param {number} chunkMaxSize
 * @param {number} byteLength
 * @param {number} initialOffset
 * @returns {Array<Uint8Array>}
 */
export function sliceBufferToChunks(
  srcData: Buffer | Uint8Array,
  chunkMaxSize: number,
  byteLength: number = srcData.byteLength,
  initialOffset = 0,
): Array<Uint8Array> {

  const chunks = [];
  let relativeOffset = 0;
  for (let offset = initialOffset; relativeOffset < byteLength; offset += chunkMaxSize) {
    relativeOffset = offset - initialOffset;
    const size = Math.min(chunkMaxSize, byteLength - relativeOffset);
    if (size === 0) break; // relativeOffset === byteLength
    const chunkBuf
          = Uint8Array.prototype
            .slice.call(srcData, offset, offset + size);
    chunks.push(chunkBuf);
  }
  return chunks;
}

/**
 *
 * @param {Array<Uint8Array>} chunks Input chunks
 * @returns {number}
 */
export function getChunksTotalByteLength(chunks: Array<Uint8Array>): number {
  return chunks.reduce((sumBytes, chunk) => (sumBytes + chunk.byteLength), 0);
}

/**
 * @param {Array<Uint8Array>} chunks Input chunks
 * @returns {Array<Uint8Array>} cloned data buffers
 */
export function cloneChunks(chunks: Array<Uint8Array>): Array<Uint8Array> {
  return chunks.map(buf => new Uint8Array(buf));
}

/**
 *
 * @param {Array<Uint8Array>} chunks Input chunks
 * @param {Buffer} targetBuffer Optional, must have sufficient size
 * @returns {Buffer} Passed buffer or newly allocated
 */
export function copyChunksIntoBuffer(chunks: Array<Uint8Array>, targetBuffer?: Buffer) {
  if (!targetBuffer) {
    const totalSize = getChunksTotalByteLength(chunks);
    targetBuffer = Buffer.alloc(totalSize);
  }
  let offset = 0;
  for (let i = 0; i < chunks.length; i++) {
    if (offset >= targetBuffer.length) {
      throw new Error('Target buffer to merge chunks in is too small');
    }
    Buffer.from(chunks[i]).copy(targetBuffer, offset);
    offset += chunks[i].byteLength;
  }
  return targetBuffer;
}

// The following function is under MIT-0 (The MIT No Attribution License), author: Arzet Ro <arzeth0@gmail.com>
export function isSafeFloat (n: any): boolean {
  return typeof n === 'number' && n >= Number.MIN_SAFE_INTEGER && n <= Number.MAX_SAFE_INTEGER;
}

// The following function is under MIT-0 (The MIT No Attribution License), author: Arzet Ro <arzeth0@gmail.com>
export async function wait (msecs: number): Promise<void> {
  return new Promise(resolve => {
    if (msecs >= Number.MAX_SAFE_INTEGER) {
      console.error('wait(%d):: too big number, won\'t wait', msecs);
      resolve();
      return;
    }
    msecs = isSafeFloat(msecs) ? +msecs : 0;
    setTimeout(resolve, msecs);
  });
}


export type PromiseOrNotPromise<T> = T|Promise<T>;
export const CMDFLOW_DIE = Symbol('CMDFLOW_DIE');
// The following function is under MIT-0 (The MIT No Attribution License), author: Arzet Ro <arzeth0@gmail.com>
/**
 * 
 * Also returns the number of attempts used up (counting from 1).
 * This number is negative if `condition` returns the `CMDFLOW_DIE` symbol.
 * This number is 0 if `timeoutOn` is the past.
 * The first time `condition` runs immediately, i.e. without waiting `ifFalseThenSleepForMs`.
 * If you specify `ifFalseThenSleepForMs`=10, but `condition` hangs forever, then `waitForCondition` will also hang forever.
 */
export async function waitForCondition (
  opts: {
    condition: {(): boolean|typeof CMDFLOW_DIE|Promise<boolean|typeof CMDFLOW_DIE>},
    ifFalseThenSleepForMs: number,
    maxAttempts?: number,
    timeoutIn?: number,
    timeoutOn?: number,
    /*logMsg?: string|{(n: number): void},
    logMsgChannel?: 'log'|'warn'|'error',
    logFail?: string|{(n: number): void},
    logFailChannel?: 'log'|'warn'|'error',*/
  },
): Promise<number>
export async function waitForCondition (
  condition: {(): boolean|Promise<boolean>},
  ifFalseThenSleepForMs_?: number,
): Promise<number>
export async function waitForCondition (
  opts: {
    condition: {
      (attemptNumber: number)
      : PromiseOrNotPromise<boolean|typeof CMDFLOW_DIE>
    },
    ifFalseThenSleepForMs: number,
    maxAttempts?: number,
    timeoutIn?: number,
    timeoutOn?: number,
  }|{(): PromiseOrNotPromise<boolean>},
  ifFalseThenSleepForMs_?: number,
): Promise<number>
{
  if (typeof opts === 'function') return waitForCondition({
    condition: opts,
    ifFalseThenSleepForMs: ifFalseThenSleepForMs_!,
  });
  // user could change the opts, so copy values
  const {condition, ifFalseThenSleepForMs} = opts;
  const maxAttempts = (opts.maxAttempts! > 0 ? opts.maxAttempts! : Infinity);
  const timeoutIn = (opts.timeoutIn! > 0 ? opts.timeoutIn! : Infinity);
  const timeoutOn = (opts.timeoutOn! > 0 ? opts.timeoutOn! : Infinity);
  // PCs can suspend,
  // that's why here's no "timeoutOn = min(timeoutOn, Date.now() + timeoutIn)"
  let i = 1;
  let resolved = false;
  const executedTimeOnStart: number = performance.now();
  return new Promise(async (resolve) => {
    if (typeof timeoutOn === 'number' && Date.now() > timeoutOn)
    {
      return resolve(0);
    }
    const timeout = (
      timeoutIn === Infinity && timeoutOn === Infinity
        ? null
        : setTimeout(() => {
          resolved = true;
          resolve(-i);
        }, Math.min(Date.now() + timeoutIn, timeoutOn))
    );
    for (; i <= maxAttempts; i++) {
      if (resolved === true) return;
      const ret = await condition(i);
      if ((resolved as boolean) === true) return;
      if (ret === true) {
        clearTimeout(timeout!);
        return resolve(i);
      }
      if (ret === CMDFLOW_DIE || i === maxAttempts) {
        clearTimeout(timeout!);
        return resolve(-i);
      }
      if (
        (typeof timeoutOn === 'number' && Date.now() > timeoutOn)
        ||
        (typeof timeoutIn === 'number' && performance.now() > executedTimeOnStart + timeoutIn)
      )
      {
        clearTimeout(timeout!);
        return resolve(-i);
      }
      await wait(ifFalseThenSleepForMs || 5);
      if (
        (typeof timeoutOn === 'number' && Date.now() > timeoutOn)
        ||
        (typeof timeoutIn === 'number' && performance.now() > executedTimeOnStart + timeoutIn)
      )
      {
        clearTimeout(timeout!);
        return resolve(-i);
      }
    }
    clearTimeout(timeout!);
    return resolve(-maxAttempts);
  });
}

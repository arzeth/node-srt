import { AsyncReaderWriter } from "./async-reader-writer";
import { SRTResult } from "./srt-api-enums";
import { SRTSocketAsync } from "./srt-socket-async";

export class SRTClientConnection extends SRTSocketAsync {

  static create(port: number, address: string): Promise<SRTClientConnection> {
    return new SRTClientConnection(port, address).create() as Promise<SRTClientConnection>;
  }

  constructor(port: number, address: string) {
    super(port, address);
  }

  /**
   * Use AsyncReaderWriter as the recommended way
   * for performing r/w ops on connections.
   */
  getReaderWriter(): AsyncReaderWriter {
    return new AsyncReaderWriter(this.asyncSrt, this.socket);
  }

  /**
   * Lower-level access to async-handle read method of the client-owned socket.
   * For performing massive read-ops without worrying, rather see `getReaderWriter`.
   */
  async read(bytes: number) {
    if (!this.socket) return Promise.resolve(null);
    return await (this.asyncSrt.read(this.socket, bytes) as Promise<Buffer | SRTResult.SRT_ERROR | null>);
  }

  /**
   * Pass a packet buffer to write to the connection.
   *
   * The size of the buffer must not exceed the SRT payload MTU
   * (usually 1316 bytes).
   *
   * Otherwise the call will resolve to SRT_ERROR.
   *
   * A system-specific socket-message error message may show in logs as enabled
   * where the error is thrown (on the binding call to the native SRT API),
   * and in the async API internals as it gets propagated back from the task-runner).
   *
   * Note that any underlying data buffer passed in
   * will be *neutered* by our worker thread and
   * therefore become unusable (i.e go to detached state, `byteLengh === 0`)
   * for the calling thread of this method.
   * When consuming from a larger piece of data,
   * chunks written will need to be slice copies of the source buffer.
   *
   */
  async write(chunk: Buffer | Uint8Array) {
    if (!this.socket) return Promise.reject();
    return await this.asyncSrt.write(this.socket, chunk);
  }

  /**
   * Call this after `create`.
   * Call `setSocketFlags` before calling this.
   */
  protected async _open(): Promise<SRTClientConnection> {
    const result = await this.asyncSrt.connect(this.socket, this.address, this.port);
    if (result === SRTResult.SRT_ERROR) {
      throw new Error('SRT.connect() failed');
    }
    return this;
  }
}

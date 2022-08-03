/// <reference types="node" />

import { Writable, Readable } from "stream";

import { SRTFileDescriptor } from "../src/srt-api-types.js";
import { SRT } from "./srt.js";

interface SRTConnectionState {
  readonly srt: SRT;
  readonly socket: number;
  readonly address: string;
  readonly port: number;
}
interface SRTCallerState extends SRTConnectionState {
  readonly fd: SRTFileDescriptor | null;
  connect(callback: (state: SRTCallerState) => void): void;
  close(): void;
}

export interface SRTListenerState extends SRTConnectionState {
  listen(callback: (state: SRTListenerState) => void): void;
}

export class SRTReadStream extends Readable implements SRTCallerState, SRTListenerState {

  readonly srt: SRT;
  readonly fd: SRTFileDescriptor | null;
  readonly socket: number;
  readonly address: string;
  readonly port: number;
  readonly readTimer: number | null;

  constructor(address: string, port: number, opts?: unknown);

  connect(callback: (state: SRTCallerState) => void): void;
  close(): void;

  listen(callback: (state: SRTListenerState) => void): void;
}

export class SRTWriteStream extends Writable implements SRTCallerState {

  readonly srt: SRT;
  readonly socket: number;
  readonly address: string;
  readonly port: number;
  readonly fd: SRTFileDescriptor | null;

  constructor(address: string, port: number, opts?: unknown);

  connect(callback: (state: SRTCallerState) => void): void;
  close(): void;
}

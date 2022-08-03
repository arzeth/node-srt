import { SRTFileDescriptor } from "../src/srt-api-types.js";
import SRT from './srt.js';

export interface SRTConnectionState {
	readonly srt: SRT;
	readonly socket: number;
	readonly address: string;
	readonly port: number;
 }
 export interface SRTCallerState extends SRTConnectionState {
	readonly fd: SRTFileDescriptor | null;
	connect(callback: (state: SRTCallerState) => void): void;
	close(): void;
 }
 
import { SRTLoggingLevel } from "./src/srt-api-enums";

export * from "./index-enums";

export * from "./types/srt-api";
export * from "./types/srt-api-async";
export * from "./types/srt-server";
export * from "./types/srt-stream";

export function setSRTLoggingLevel(level: SRTLoggingLevel);

export type WorkerProviderFunc = () => Worker;
export type WorkerFactory = WorkerProviderFunc & {
  overrideModuleScopeImpl(customFunc: WorkerProviderFunc)
};

export const createSRTAsyncWorker: WorkerFactory;

export function getSRTAsyncWorkerPath(): string;

export function isSRTInstalled(): boolean;

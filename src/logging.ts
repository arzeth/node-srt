import { SRTLoggingLevel } from './srt-api-enums.js';
import SRT from './srt.js';

let srt: null|SRT = null;

/**
 *
 * @param {number | SRTLoggingLevel} level
 */
function setSRTLoggingLevel(level: number | SRTLoggingLevel): void {
  srt ||= new SRT();
  srt.setLogLevel(level);
}

export {
  setSRTLoggingLevel,
};

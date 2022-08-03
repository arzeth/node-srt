import SRT from './srt.js';

let srt = null;

/**
 *
 * @param {number | SRTLoggingLevel} level
 */
function setSRTLoggingLevel(level) {
  if (!srt) {
    srt = new SRT();
  }
  srt.setLogLevel(level);
}

export {
  setSRTLoggingLevel,
};

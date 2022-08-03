import fs from "fs";
import url from "url";
import path from "path";
import __dirname from './__dirname.js';


// NOTE: Very useful in combination with PKG executable bundler,
// see https://github.com/vercel/pkg#config
const dynLibPathDebug = path.join(__dirname, '../Debug/srt.node');
const dynLibPathRelease = path.join(__dirname, '../Release/srt.node');
const haveDebug = fs.existsSync(dynLibPathDebug);
const haveRelease = fs.existsSync(dynLibPathRelease);
function requireDebug() { return import('../Debug/srt.node'); }
function requireRelease() { return import('../Release/srt.node'); }

export default (await (async () => {
if (haveDebug) {
  return requireDebug();
} else if (haveRelease) {
  return requireRelease();
} else {
  // The whole above approach would be nice but doesn't work in a compiled module
  // where these paths have no more meaning and the exists result would always be false.
  // Therefore, ultimately we attempt our way through this try-catch fall-thru anyway.
  // The compiler will have replaced the require arg by a path that works within
  // its own module-loader, and thus it will eventually work (or not), as the above flags
  // still may be false either way.
  try {
    return requireDebug();
  } catch(err) {
    try {
      return requireRelease();
    } catch(err) {
      return {default: {SRT: null}};
    }
  }
}
})()).default.SRT;


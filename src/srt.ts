import fs from "fs";
import path from "path";
import __dirname from './__dirname.js';
import { SRT as SRTClass } from '../types/srt.js';
import { SRTResult, SRTSockOpt } from "./srt-api-enums.js";
import { SRTFileDescriptor, SRTReadReturn, SRTSockOptValue } from "./srt-api-types.js";


// NOTE: Very useful in combination with PKG executable bundler,
// see https://github.com/vercel/pkg#config
const dynLibPathDebug = path.join(__dirname, '../Debug/srt.node');
const dynLibPathRelease = path.join(__dirname, '../Release/srt.node');
const dynLibPathBuildDebug = path.join(__dirname, '../build/Debug/srt.node'); // ts-node
const dynLibPathBuildRelease = path.join(__dirname, '../build/Release/srt.node'); // ts-node
const haveDebug = fs.existsSync(dynLibPathDebug);
const haveRelease = fs.existsSync(dynLibPathRelease);
const haveBuildDebug = fs.existsSync(dynLibPathBuildDebug);
const haveBuildRelease = fs.existsSync(dynLibPathBuildRelease);
// @ts-ignore
function requireDebug() { return import('../Debug/srt.node'); }
// @ts-ignore
function requireRelease() { return import('../Release/srt.node'); }
// @ts-ignore
function requireBuildDebug() { return import('../build/Debug/srt.node'); }
// @ts-ignore
function requireBuildRelease() { return import('../build/Release/srt.node'); }



// a class that extends a class with nothing is because TypeScript is not very smart
export default class SRT extends (
  (await (async () => {
    if (haveDebug) {
      return requireDebug();
    } else if (haveRelease) {
      return requireRelease();
    } else if (haveBuildDebug) {
      return requireBuildDebug();
    } else if (haveBuildRelease) {
      return requireBuildRelease();
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
          throw new Error(
            'Couldn\'t find or run `srt.node` in ../build/{Debug/Release}/ or ../{Debug/Release}/'
          )
          //return {default: {SRT: null}};
        }
      }
    }
  })()).default.SRT as typeof SRTClass
) {}
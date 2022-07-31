import fs from 'fs';
import { SRTReadStream } from '../build/index.js';
const dest = fs.createWriteStream('/dev/null');

describe("SRTReadStream", () => {
  it('can be constructed without throwing an exception', () => {
    new SRTReadStream();
  });
});

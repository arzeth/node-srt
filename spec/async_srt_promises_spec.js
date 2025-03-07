import { SRT, AsyncSRT } from '../build/index.js';

describe("Async SRT API with promises", () => {
  it("can create an SRT socket", done => {
    const asyncSrt = new AsyncSRT();
    asyncSrt.createSocket(false)
      .then(socket => {
        expect(socket).not.toEqual(SRT.ERROR);
        done();
      }).catch(done.fail);
  });

  it("can create an SRT socket for sending data", done => {
    const asyncSrt = new AsyncSRT();
    asyncSrt.createSocket(true)
      .then(socket => {
        expect(socket).not.toEqual(SRT.ERROR);
        done();
      }).catch(done.fail);
  });
});

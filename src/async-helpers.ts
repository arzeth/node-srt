function isBufferOrTypedArray(elem: any): boolean {
  return elem && elem.buffer
    && elem.buffer instanceof ArrayBuffer;
}

// used only by `argsToString`:
function argsItemToString(elem: any): typeof elem|string {
  if (isBufferOrTypedArray(elem)) {
    return `${elem.constructor.name}<bytes=${elem.byteLength}>`;
  } else {
    return elem;
  }
}

function argsToString(args: Array<any>) {
  const list = args
    .map(argsItemToString).join(', ');
  return `[${list}]`;
}





function traceCallToString(method: string, args: Array<any>) {
  return  `SRT.${method}(...${argsToString(args)});`;
}

/**
 * @see https://nodejs.org/api/worker_threads.html#worker_threads_worker_threads
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Transferable
 * @param {any[]} args Used parameter list to extract Transferrables from
 * @returns {ArrayBuffer[]} List of transferrable objects owned by items of a parameter list
 */
function extractTransferListFromParams(args: Array<any>): Array<ArrayBuffer> {
  const transferList = args.reduce((accu, item, _index) => {
    if (isBufferOrTypedArray(item)) {
      accu.push(item.buffer);
    }
    return accu;
  }, []);
  return transferList;
}

export {
  argsToString,
  traceCallToString,
  isBufferOrTypedArray,
  extractTransferListFromParams,
};

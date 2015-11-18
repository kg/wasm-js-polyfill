///<reference path="../decoder.ts"/>

type CallRecord = [string, Array<any>];

class MockHandlerProxyHandler {
  log : Array<CallRecord>;

  constructor (log: Array<CallRecord>) {
    this.log = log;
  }

  get (state, propertyName : string, receiver) {
    return (...args) => {
      this.log.push([propertyName, args]);
    };
  }
};

declare class Proxy {
  constructor (state: any, handler: any);
}

function makeMockHandler (log) : V8NativeDecoder.IDecodeHandler {
  var handler = new MockHandlerProxyHandler(log);
  var result = new Proxy({}, handler);
  return <V8NativeDecoder.IDecodeHandler>result;
};

function makeReader (bytes: Array<byte>) {
  var buf = new Uint8Array(bytes);
  return new Stream.ValueReader(buf);
}
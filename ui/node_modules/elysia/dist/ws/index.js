"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: !0 });
}, __copyProps = (to, from, except, desc) => {
  if (from && typeof from == "object" || typeof from == "function")
    for (let key of __getOwnPropNames(from))
      !__hasOwnProp.call(to, key) && key !== except && __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: !0 }), mod);
var ws_exports = {};
__export(ws_exports, {
  ElysiaWS: () => ElysiaWS,
  createHandleWSResponse: () => createHandleWSResponse,
  createWSMessageParser: () => createWSMessageParser,
  websocket: () => websocket
});
module.exports = __toCommonJS(ws_exports);
var import_utils = require('../utils.js'), import_error = require('../error.js');
const websocket = {
  open(ws) {
    ws.data.open?.(ws);
  },
  message(ws, message) {
    ws.data.message?.(ws, message);
  },
  drain(ws) {
    ws.data.drain?.(ws);
  },
  close(ws, code, reason) {
    ws.data.close?.(ws, code, reason);
  },
  ping(ws) {
    ws.data.ping?.(ws);
  },
  pong(ws) {
    ws.data.pong?.(ws);
  }
};
class ElysiaWS {
  constructor(raw, data, body = void 0) {
    this.raw = raw;
    this.data = data;
    this.body = body;
    this.validator = raw.data?.validator, this.sendText = raw.sendText.bind(raw), this.sendBinary = raw.sendBinary.bind(raw), this.close = raw.close.bind(raw), this.terminate = raw.terminate.bind(raw), this.publishText = raw.publishText.bind(raw), this.publishBinary = raw.publishBinary.bind(raw), this.subscribe = raw.subscribe.bind(raw), this.unsubscribe = raw.unsubscribe.bind(raw), this.isSubscribed = raw.isSubscribed.bind(raw), this.cork = raw.cork.bind(raw), this.remoteAddress = raw.remoteAddress, this.binaryType = raw.binaryType, this.data = raw.data, this.subscriptions = raw.subscriptions, this.send = this.send.bind(this), this.ping = this.ping.bind(this), this.pong = this.pong.bind(this), this.publish = this.publish.bind(this);
  }
  /**
   * Sends a message to the client.
   *
   * @param data The data to send.
   * @param compress Should the data be compressed? If the client does not support compression, this is ignored.
   * @example
   * ws.send("Hello!");
   * ws.send("Compress this.", true);
   * ws.send(new Uint8Array([1, 2, 3, 4]));
   */
  send(data, compress) {
    return Buffer.isBuffer(data) ? this.raw.send(data, compress) : this.validator?.Check(data) === !1 ? this.raw.send(
      new import_error.ValidationError("message", this.validator, data).message
    ) : (typeof data == "object" && (data = JSON.stringify(data)), this.raw.send(data, compress));
  }
  /**
   * Sends a ping.
   *
   * @param data The data to send
   */
  ping(data) {
    return Buffer.isBuffer(data) ? this.raw.ping(data) : this.validator?.Check(data) === !1 ? this.raw.send(
      new import_error.ValidationError("message", this.validator, data).message
    ) : (typeof data == "object" && (data = JSON.stringify(data)), this.raw.ping(data));
  }
  /**
   * Sends a pong.
   *
   * @param data The data to send
   */
  pong(data) {
    return Buffer.isBuffer(data) ? this.raw.pong(data) : this.validator?.Check(data) === !1 ? this.raw.send(
      new import_error.ValidationError("message", this.validator, data).message
    ) : (typeof data == "object" && (data = JSON.stringify(data)), this.raw.pong(data));
  }
  /**
   * Sends a message to subscribers of the topic.
   *
   * @param topic The topic name.
   * @param data The data to send.
   * @param compress Should the data be compressed? If the client does not support compression, this is ignored.
   * @example
   * ws.publish("chat", "Hello!");
   * ws.publish("chat", "Compress this.", true);
   * ws.publish("chat", new Uint8Array([1, 2, 3, 4]));
   */
  publish(topic, data, compress) {
    return Buffer.isBuffer(data) ? this.raw.publish(
      topic,
      data,
      compress
    ) : this.validator?.Check(data) === !1 ? this.raw.send(
      new import_error.ValidationError("message", this.validator, data).message
    ) : (typeof data == "object" && (data = JSON.stringify(data)), this.raw.publish(topic, data, compress));
  }
  get readyState() {
    return this.raw.readyState;
  }
  get id() {
    return this.data.id;
  }
}
const createWSMessageParser = (parse) => {
  const parsers = typeof parse == "function" ? [parse] : parse;
  return async function(ws, message) {
    if (typeof message == "string") {
      const start = message?.charCodeAt(0);
      if (start === 34 || start === 47 || start === 91 || start === 123)
        try {
          message = JSON.parse(message);
        } catch {
        }
      else (0, import_utils.isNumericString)(message) ? message = +message : message === "true" ? message = !0 : message === "false" ? message = !1 : message === "null" && (message = null);
    }
    if (parsers)
      for (let i = 0; i < parsers.length; i++) {
        let temp = parsers[i](ws, message);
        if (temp instanceof Promise && (temp = await temp), temp !== void 0) return temp;
      }
    return message;
  };
}, createHandleWSResponse = (responseValidator) => {
  const handleWSResponse = (ws, data) => {
    if (data instanceof Promise)
      return data.then((data2) => handleWSResponse(ws, data2));
    if (Buffer.isBuffer(data)) return ws.send(data.toString());
    if (data === void 0) return;
    const validateResponse = responseValidator ? (
      // @ts-ignore
      responseValidator.provider === "standard" ? (data2) => (
        // @ts-ignore
        responseValidator.schema["~standard"].validate(data2).issues
      ) : (data2) => responseValidator.Check(data2) === !1
    ) : void 0, send = (datum) => {
      if (validateResponse && validateResponse(datum) === !1)
        return ws.send(
          new import_error.ValidationError("message", responseValidator, datum).message
        );
      if (typeof datum == "object") return ws.send(JSON.stringify(datum));
      ws.send(datum);
    };
    if (typeof data?.next != "function")
      return void send(data);
    const init = data.next();
    if (init instanceof Promise)
      return (async () => {
        const first = await init;
        if (validateResponse && validateResponse(first))
          return ws.send(
            new import_error.ValidationError(
              "message",
              responseValidator,
              first
            ).message
          );
        if (send(first.value), !first.done)
          for await (const datum of data) send(datum);
      })();
    if (send(init.value), !init.done) for (const datum of data) send(datum);
  };
  return handleWSResponse;
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ElysiaWS,
  createHandleWSResponse,
  createWSMessageParser,
  websocket
});

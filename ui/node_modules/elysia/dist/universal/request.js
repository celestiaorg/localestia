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
var request_exports = {};
__export(request_exports, {
  ElysiaRequest: () => ElysiaRequest
});
module.exports = __toCommonJS(request_exports);
class ElysiaRequest {
  constructor(input, init) {
    this.input = input;
    this.init = init;
    this.cache = "default";
    this.credentials = "omit";
    this.destination = "";
    this.integrity = "";
    this.method = "GET";
    this.mode = "no-cors";
    this.redirect = "manual";
    this.referrerPolicy = "";
    this.keepalive = !1;
    this.duplex = "half";
    this.bodyUsed = !1;
    if (typeof input == "string") this.url = input;
    else if (input instanceof URL) this.url = input.href;
    else if (input instanceof Request) this.url = input.url;
    else throw new TypeError("Invalid url");
    init && (init.method && (this.method = init.method), init.keepalive && (this.keepalive = init.keepalive), init.redirect && (this.redirect = init.redirect), init.integrity && (this.integrity = init.integrity), init.signal && (this._signal = init.signal), init.credentials && (this.credentials = init.credentials), init.mode && (this.mode = init.mode), init.referrerPolicy && (this.referrerPolicy = init.referrerPolicy), init.duplex && (this.duplex = init.duplex));
  }
  get headers() {
    if (this._headers) return this._headers;
    if (!this.init?.headers) return this._headers = new Headers();
    const headers = this.init.headers;
    return Array.isArray(headers) ? this._headers = new Headers(headers) : headers instanceof Headers ? this._headers = headers : headers ? this._headers = new Headers(headers) : this._headers = new Headers();
  }
  get signal() {
    return this._signal ? this._signal : this._signal = new AbortController().signal;
  }
  get body() {
    if (this.method === "GET" || this.method === "HEAD" || !this.init?.body)
      return null;
    const body = this.init.body;
    return body instanceof ReadableStream ? body : body instanceof ArrayBuffer ? new ReadableStream({
      start(controller) {
        controller.enqueue(body), controller.close();
      }
    }) : body instanceof Blob ? body.stream() : typeof body == "string" ? new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(body)), controller.close();
      }
    }) : body instanceof URLSearchParams || body instanceof FormData ? new ReadableStream({
      start(controller) {
        controller.enqueue(
          new TextEncoder().encode(body.toString())
        ), controller.close();
      }
    }) : body instanceof DataView ? new ReadableStream({
      start(controller) {
        controller.enqueue(body.buffer), controller.close();
      }
    }) : Symbol.iterator in body ? new ReadableStream({
      start(controller) {
        for (const chunk of body) controller.enqueue(chunk);
        controller.close();
      }
    }) : Symbol.asyncIterator in body ? new ReadableStream({
      async start(controller) {
        for await (const chunk of body) controller.enqueue(chunk);
        controller.close();
      }
    }) : null;
  }
  async arrayBuffer() {
    if (this.init?.body instanceof ArrayBuffer) return this.init.body;
    if (!this.body) return new ArrayBuffer(0);
    const chunks = [];
    for await (const chunk of this.body) chunks.push(chunk);
    return Buffer.concat(chunks);
  }
  async blob() {
    if (this.init?.body instanceof Blob) return this.init.body;
    const buffer = await this.arrayBuffer();
    return new Blob([buffer]);
  }
  async formData() {
    if (this.init?.body instanceof FormData) return this.init.body;
    throw new Error("Unable to parse body as FormData");
  }
  async json() {
    return this.init?.body instanceof ReadableStream ? JSON.parse(await readableStreamToString(this.init.body)) : typeof this.init?.body == "string" ? JSON.parse(this.init.body) : this.init?.body instanceof ArrayBuffer ? JSON.parse(Buffer.from(this.init.body).toString()) : JSON.parse(Buffer.from(await this.arrayBuffer()).toString());
  }
  async text() {
    if (this.init?.body instanceof ReadableStream)
      return readableStreamToString(this.init.body);
    if (typeof this.init?.body == "string") return this.init.body;
    if (this.init?.body instanceof ArrayBuffer)
      return Buffer.from(this.init.body).toString();
    const buffer = await this.arrayBuffer();
    return Buffer.from(buffer).toString();
  }
  // @ts-ignore
  clone() {
    return new ElysiaRequest(this.input, this.init);
  }
}
async function readableStreamToString(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.from(Buffer.concat(chunks)).toString();
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ElysiaRequest
});

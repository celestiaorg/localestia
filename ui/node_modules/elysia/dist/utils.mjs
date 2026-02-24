import { ElysiaFile } from "./universal/file.mjs";
import { isBun, isCloudflareWorker } from "./universal/utils.mjs";
const replaceUrlPath = (url, pathname) => {
  const pathStartIndex = url.indexOf("/", 11), queryIndex = url.indexOf("?", pathStartIndex);
  return queryIndex === -1 ? `${url.slice(0, pathStartIndex)}${pathname.charCodeAt(0) === 47 ? "" : "/"}${pathname}` : `${url.slice(0, pathStartIndex)}${pathname.charCodeAt(0) === 47 ? "" : "/"}${pathname}${url.slice(queryIndex)}`;
}, isClass = (v) => typeof v == "function" && /^\s*class\s+/.test(v.toString()) || // Handle Object.create(null)
v.toString && // Handle import * as Sentry from '@sentry/bun'
// This also handle [object Date], [object Array]
// and FFI value like [object Prisma]
v.toString().startsWith("[object ") && v.toString() !== "[object Object]" || // If object prototype is not pure, then probably a class-like object
isNotEmpty(Object.getPrototypeOf(v)), isObject = (item) => item && typeof item == "object" && !Array.isArray(item), mergeDeep = (target, source, options) => {
  const skipKeys = options?.skipKeys, override = options?.override ?? !0, mergeArray = options?.mergeArray ?? !1, seen = options?.seen ?? /* @__PURE__ */ new WeakSet();
  if (!isObject(target) || !isObject(source) || seen.has(source)) return target;
  seen.add(source);
  for (const [key, value] of Object.entries(source))
    if (!(skipKeys?.includes(key) || ["__proto__", "constructor", "prototype"].includes(key))) {
      if (mergeArray && Array.isArray(value)) {
        target[key] = Array.isArray(
          target[key]
        ) ? [...target[key], ...value] : target[key] = value;
        continue;
      }
      if (!isObject(value) || !(key in target) || isClass(value)) {
        if ((override || !(key in target)) && !Object.isFrozen(target))
          try {
            target[key] = value;
          } catch {
          }
        continue;
      }
      if (!Object.isFrozen(target[key]))
        try {
          target[key] = mergeDeep(
            target[key],
            value,
            { skipKeys, override, mergeArray, seen }
          );
        } catch {
        }
    }
  return seen.delete(source), target;
}, mergeCookie = (a, b) => {
  const v = mergeDeep(Object.assign({}, a), b, {
    skipKeys: ["properties"],
    mergeArray: !1
  });
  return v.properties && delete v.properties, v;
}, mergeObjectArray = (a, b) => {
  if (!b) return a;
  const array = [], checksums = [];
  if (a) {
    Array.isArray(a) || (a = [a]);
    for (const item of a)
      array.push(item), item.checksum && checksums.push(item.checksum);
  }
  if (b) {
    Array.isArray(b) || (b = [b]);
    for (const item of b)
      checksums.includes(item.checksum) || array.push(item);
  }
  return array;
}, primitiveHooks = [
  "start",
  "request",
  "parse",
  "transform",
  "resolve",
  "beforeHandle",
  "afterHandle",
  "mapResponse",
  "afterResponse",
  "trace",
  "error",
  "stop",
  "body",
  "headers",
  "params",
  "query",
  "response",
  "type",
  "detail"
], primitiveHookMap = primitiveHooks.reduce(
  (acc, x) => (acc[x] = !0, acc),
  {}
), isRecordNumber = (x) => typeof x == "object" && Object.keys(x).every((x2) => !isNaN(+x2)), mergeResponse = (a, b) => isRecordNumber(a) && isRecordNumber(b) ? Object.assign({}, a, b) : a && !isRecordNumber(a) && isRecordNumber(b) ? Object.assign({ 200: a }, b) : b ?? a, mergeSchemaValidator = (a, b) => !a && !b ? {
  body: void 0,
  headers: void 0,
  params: void 0,
  query: void 0,
  cookie: void 0,
  response: void 0
} : {
  body: b?.body ?? a?.body,
  headers: b?.headers ?? a?.headers,
  params: b?.params ?? a?.params,
  query: b?.query ?? a?.query,
  cookie: b?.cookie ?? a?.cookie,
  // @ts-ignore ? This order is correct - SaltyAom
  response: mergeResponse(
    // @ts-ignore
    a?.response,
    // @ts-ignore
    b?.response
  )
}, mergeHook = (a, b) => {
  if (!b) return a ?? {};
  if (!a) return b ?? {};
  if (!Object.values(b).find((x) => x != null))
    return { ...a };
  const hook = {
    ...a,
    ...b,
    // Merge local hook first
    // @ts-ignore
    body: b.body ?? a.body,
    // @ts-ignore
    headers: b.headers ?? a.headers,
    // @ts-ignore
    params: b.params ?? a.params,
    // @ts-ignore
    query: b.query ?? a.query,
    // @ts-ignore
    cookie: b.cookie ?? a.cookie,
    // ? This order is correct - SaltyAom
    response: mergeResponse(
      // @ts-ignore
      a.response,
      // @ts-ignore
      b.response
    ),
    type: a.type || b.type,
    detail: mergeDeep(
      // @ts-ignore
      b.detail ?? {},
      // @ts-ignore
      a.detail ?? {}
    ),
    parse: mergeObjectArray(a.parse, b.parse),
    transform: mergeObjectArray(a.transform, b.transform),
    beforeHandle: mergeObjectArray(
      mergeObjectArray(
        // @ts-ignore
        fnToContainer(a.resolve, "resolve"),
        a.beforeHandle
      ),
      mergeObjectArray(
        fnToContainer(b.resolve, "resolve"),
        b.beforeHandle
      )
    ),
    afterHandle: mergeObjectArray(a.afterHandle, b.afterHandle),
    mapResponse: mergeObjectArray(a.mapResponse, b.mapResponse),
    afterResponse: mergeObjectArray(
      a.afterResponse,
      b.afterResponse
    ),
    trace: mergeObjectArray(a.trace, b.trace),
    error: mergeObjectArray(a.error, b.error),
    // @ts-ignore
    standaloneSchema: (
      // @ts-ignore
      a.standaloneSchema || b.standaloneSchema ? (
        // @ts-ignore
        a.standaloneSchema && !b.standaloneSchema ? (
          // @ts-ignore
          a.standaloneSchema
        ) : (
          // @ts-ignore
          b.standaloneSchema && !a.standaloneSchema ? b.standaloneSchema : [
            // @ts-ignore
            ...a.standaloneSchema ?? [],
            ...b.standaloneSchema ?? []
          ]
        )
      ) : void 0
    )
  };
  return hook.resolve && delete hook.resolve, hook;
}, lifeCycleToArray = (a) => {
  a.parse && !Array.isArray(a.parse) && (a.parse = [a.parse]), a.transform && !Array.isArray(a.transform) && (a.transform = [a.transform]), a.afterHandle && !Array.isArray(a.afterHandle) && (a.afterHandle = [a.afterHandle]), a.mapResponse && !Array.isArray(a.mapResponse) && (a.mapResponse = [a.mapResponse]), a.afterResponse && !Array.isArray(a.afterResponse) && (a.afterResponse = [a.afterResponse]), a.trace && !Array.isArray(a.trace) && (a.trace = [a.trace]), a.error && !Array.isArray(a.error) && (a.error = [a.error]);
  let beforeHandle = [];
  return a.resolve && (beforeHandle = fnToContainer(
    // @ts-expect-error
    Array.isArray(a.resolve) ? a.resolve : [a.resolve],
    "resolve"
  ), delete a.resolve), a.beforeHandle && (beforeHandle.length ? beforeHandle = beforeHandle.concat(
    Array.isArray(a.beforeHandle) ? a.beforeHandle : [a.beforeHandle]
  ) : beforeHandle = Array.isArray(a.beforeHandle) ? a.beforeHandle : [a.beforeHandle]), beforeHandle.length && (a.beforeHandle = beforeHandle), a;
}, hasHeaderShorthand = isBun ? "toJSON" in new Headers() : !1, hasSetImmediate = typeof setImmediate == "function", checksum = (s) => {
  let h = 9;
  for (let i = 0; i < s.length; ) h = Math.imul(h ^ s.charCodeAt(i++), 9 ** 9);
  return h = h ^ h >>> 9;
}, injectChecksum = (checksum2, x) => {
  if (!x) return;
  if (!Array.isArray(x)) {
    const fn = x;
    return checksum2 && !fn.checksum && (fn.checksum = checksum2), fn.scope === "scoped" && (fn.scope = "local"), fn;
  }
  const fns = [...x];
  for (const fn of fns)
    checksum2 && !fn.checksum && (fn.checksum = checksum2), fn.scope === "scoped" && (fn.scope = "local");
  return fns;
}, mergeLifeCycle = (a, b, checksum2) => ({
  start: mergeObjectArray(
    a.start,
    injectChecksum(checksum2, b?.start)
  ),
  request: mergeObjectArray(
    a.request,
    injectChecksum(checksum2, b?.request)
  ),
  parse: mergeObjectArray(
    a.parse,
    injectChecksum(checksum2, b?.parse)
  ),
  transform: mergeObjectArray(
    a.transform,
    injectChecksum(checksum2, b?.transform)
  ),
  beforeHandle: mergeObjectArray(
    mergeObjectArray(
      // @ts-ignore
      fnToContainer(a.resolve, "resolve"),
      a.beforeHandle
    ),
    injectChecksum(
      checksum2,
      mergeObjectArray(
        fnToContainer(b?.resolve, "resolve"),
        b?.beforeHandle
      )
    )
  ),
  afterHandle: mergeObjectArray(
    a.afterHandle,
    injectChecksum(checksum2, b?.afterHandle)
  ),
  mapResponse: mergeObjectArray(
    a.mapResponse,
    injectChecksum(checksum2, b?.mapResponse)
  ),
  afterResponse: mergeObjectArray(
    a.afterResponse,
    injectChecksum(checksum2, b?.afterResponse)
  ),
  // Already merged on Elysia._use, also logic is more complicated, can't directly merge
  trace: mergeObjectArray(
    a.trace,
    injectChecksum(checksum2, b?.trace)
  ),
  error: mergeObjectArray(
    a.error,
    injectChecksum(checksum2, b?.error)
  ),
  stop: mergeObjectArray(
    a.stop,
    injectChecksum(checksum2, b?.stop)
  )
}), asHookType = (fn, inject, { skipIfHasType = !1 }) => {
  if (!fn) return fn;
  if (!Array.isArray(fn))
    return skipIfHasType ? fn.scope ??= inject : fn.scope = inject, fn;
  for (const x of fn)
    skipIfHasType ? x.scope ??= inject : x.scope = inject;
  return fn;
}, filterGlobal = (fn) => {
  if (!fn) return fn;
  if (!Array.isArray(fn))
    switch (fn.scope) {
      case "global":
      case "scoped":
        return { ...fn };
      default:
        return { fn };
    }
  const array = [];
  for (const x of fn)
    switch (x.scope) {
      case "global":
      case "scoped":
        array.push({
          ...x
        });
        break;
    }
  return array;
}, filterGlobalHook = (hook) => ({
  // rest is validator
  ...hook,
  type: hook?.type,
  detail: hook?.detail,
  parse: filterGlobal(hook?.parse),
  transform: filterGlobal(hook?.transform),
  beforeHandle: filterGlobal(hook?.beforeHandle),
  afterHandle: filterGlobal(hook?.afterHandle),
  mapResponse: filterGlobal(hook?.mapResponse),
  afterResponse: filterGlobal(hook?.afterResponse),
  error: filterGlobal(hook?.error),
  trace: filterGlobal(hook?.trace)
}), StatusMap = {
  Continue: 100,
  "Switching Protocols": 101,
  Processing: 102,
  "Early Hints": 103,
  OK: 200,
  Created: 201,
  Accepted: 202,
  "Non-Authoritative Information": 203,
  "No Content": 204,
  "Reset Content": 205,
  "Partial Content": 206,
  "Multi-Status": 207,
  "Already Reported": 208,
  "Multiple Choices": 300,
  "Moved Permanently": 301,
  Found: 302,
  "See Other": 303,
  "Not Modified": 304,
  "Temporary Redirect": 307,
  "Permanent Redirect": 308,
  "Bad Request": 400,
  Unauthorized: 401,
  "Payment Required": 402,
  Forbidden: 403,
  "Not Found": 404,
  "Method Not Allowed": 405,
  "Not Acceptable": 406,
  "Proxy Authentication Required": 407,
  "Request Timeout": 408,
  Conflict: 409,
  Gone: 410,
  "Length Required": 411,
  "Precondition Failed": 412,
  "Payload Too Large": 413,
  "URI Too Long": 414,
  "Unsupported Media Type": 415,
  "Range Not Satisfiable": 416,
  "Expectation Failed": 417,
  "I'm a teapot": 418,
  "Enhance Your Calm": 420,
  "Misdirected Request": 421,
  "Unprocessable Content": 422,
  Locked: 423,
  "Failed Dependency": 424,
  "Too Early": 425,
  "Upgrade Required": 426,
  "Precondition Required": 428,
  "Too Many Requests": 429,
  "Request Header Fields Too Large": 431,
  "Unavailable For Legal Reasons": 451,
  "Internal Server Error": 500,
  "Not Implemented": 501,
  "Bad Gateway": 502,
  "Service Unavailable": 503,
  "Gateway Timeout": 504,
  "HTTP Version Not Supported": 505,
  "Variant Also Negotiates": 506,
  "Insufficient Storage": 507,
  "Loop Detected": 508,
  "Not Extended": 510,
  "Network Authentication Required": 511
}, InvertedStatusMap = Object.fromEntries(
  Object.entries(StatusMap).map(([k, v]) => [v, k])
);
function removeTrailingEquals(digest) {
  let trimmedDigest = digest;
  for (; trimmedDigest.endsWith("="); )
    trimmedDigest = trimmedDigest.slice(0, -1);
  return trimmedDigest;
}
const encoder = new TextEncoder(), signCookie = async (val, secret) => {
  if (typeof val == "object" ? val = JSON.stringify(val) : typeof val != "string" && (val = val + ""), secret == null)
    throw new TypeError("Secret key must be provided");
  const secretKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    !1,
    ["sign"]
  ), hmacBuffer = await crypto.subtle.sign(
    "HMAC",
    secretKey,
    encoder.encode(val)
  );
  return val + "." + removeTrailingEquals(Buffer.from(hmacBuffer).toString("base64"));
}, constantTimeEqual = typeof crypto?.timingSafeEqual == "function" ? (a, b) => {
  const ab = Buffer.from(a, "utf8"), bb = Buffer.from(b, "utf8");
  return ab.length !== bb.length ? !1 : crypto.timingSafeEqual(ab, bb);
} : (a, b) => a === b, unsignCookie = async (input, secret) => {
  if (typeof input != "string")
    throw new TypeError("Signed cookie string must be provided.");
  const dot = input.lastIndexOf(".");
  if (dot === -1)
    return secret === null ? input : !1;
  const tentativeValue = input.slice(0, dot), expectedInput = await signCookie(tentativeValue, secret);
  return constantTimeEqual(expectedInput, input) ? tentativeValue : !1;
}, insertStandaloneValidator = (hook, name, value) => {
  if (!hook.standaloneValidator?.length || !Array.isArray(hook.standaloneValidator)) {
    hook.standaloneValidator = [
      {
        [name]: value
      }
    ];
    return;
  }
  const last = hook.standaloneValidator[hook.standaloneValidator.length - 1];
  name in last ? hook.standaloneValidator.push({
    [name]: value
  }) : last[name] = value;
}, parseNumericString = (message) => {
  if (typeof message == "number") return message;
  if (message.length < 16) {
    if (message.trim().length === 0) return null;
    const length = Number(message);
    return Number.isNaN(length) ? null : length;
  }
  if (message.length === 16) {
    if (message.trim().length === 0) return null;
    const number = Number(message);
    return Number.isNaN(number) || number.toString() !== message ? null : number;
  }
  return null;
}, isNumericString = (message) => parseNumericString(message) !== null;
class PromiseGroup {
  constructor(onError = console.error, onFinally = () => {
  }) {
    this.onError = onError;
    this.onFinally = onFinally;
    this.root = null;
    this.promises = [];
  }
  /**
   * The number of promises still being awaited.
   */
  get size() {
    return this.promises.length;
  }
  /**
   * Add a promise to the group.
   * @returns The promise that was added.
   */
  add(promise) {
    return this.promises.push(promise), this.root ||= this.drain(), this.promises.length === 1 && this.then(this.onFinally), promise;
  }
  async drain() {
    for (; this.promises.length > 0; ) {
      try {
        await this.promises[0];
      } catch (error) {
        this.onError(error);
      }
      this.promises.shift();
    }
    this.root = null;
  }
  // Allow the group to be awaited.
  then(onfulfilled, onrejected) {
    return (this.root ?? Promise.resolve()).then(onfulfilled, onrejected);
  }
}
const fnToContainer = (fn, subType) => {
  if (!fn) return fn;
  if (!Array.isArray(fn)) {
    if (typeof fn == "function" || typeof fn == "string")
      return subType ? { fn, subType } : { fn };
    if ("fn" in fn) return fn;
  }
  const fns = [];
  for (const x of fn)
    typeof x == "function" || typeof x == "string" ? fns.push(subType ? { fn: x, subType } : { fn: x }) : "fn" in x && fns.push(x);
  return fns;
}, localHookToLifeCycleStore = (a) => (a.start && (a.start = fnToContainer(a.start)), a.request && (a.request = fnToContainer(a.request)), a.parse && (a.parse = fnToContainer(a.parse)), a.transform && (a.transform = fnToContainer(a.transform)), a.beforeHandle && (a.beforeHandle = fnToContainer(a.beforeHandle)), a.afterHandle && (a.afterHandle = fnToContainer(a.afterHandle)), a.mapResponse && (a.mapResponse = fnToContainer(a.mapResponse)), a.afterResponse && (a.afterResponse = fnToContainer(a.afterResponse)), a.trace && (a.trace = fnToContainer(a.trace)), a.error && (a.error = fnToContainer(a.error)), a.stop && (a.stop = fnToContainer(a.stop)), a), lifeCycleToFn = (a) => {
  const lifecycle = /* @__PURE__ */ Object.create(null);
  return a.start?.map && (lifecycle.start = a.start.map((x) => x.fn)), a.request?.map && (lifecycle.request = a.request.map((x) => x.fn)), a.parse?.map && (lifecycle.parse = a.parse.map((x) => x.fn)), a.transform?.map && (lifecycle.transform = a.transform.map((x) => x.fn)), a.beforeHandle?.map && (lifecycle.beforeHandle = a.beforeHandle.map((x) => x.fn)), a.afterHandle?.map && (lifecycle.afterHandle = a.afterHandle.map((x) => x.fn)), a.mapResponse?.map && (lifecycle.mapResponse = a.mapResponse.map((x) => x.fn)), a.afterResponse?.map && (lifecycle.afterResponse = a.afterResponse.map((x) => x.fn)), a.error?.map && (lifecycle.error = a.error.map((x) => x.fn)), a.stop?.map && (lifecycle.stop = a.stop.map((x) => x.fn)), a.trace?.map ? lifecycle.trace = a.trace.map((x) => x.fn) : lifecycle.trace = [], lifecycle;
}, cloneInference = (inference) => ({
  body: inference.body,
  cookie: inference.cookie,
  headers: inference.headers,
  query: inference.query,
  set: inference.set,
  server: inference.server,
  path: inference.path,
  route: inference.route,
  url: inference.url
}), redirect = (url, status = 302) => Response.redirect(url, status), ELYSIA_FORM_DATA = Symbol("ElysiaFormData"), ELYSIA_REQUEST_ID = Symbol("ElysiaRequestId"), form = (items) => {
  const formData = new FormData();
  if (formData[ELYSIA_FORM_DATA] = {}, items)
    for (const [key, value] of Object.entries(items)) {
      if (Array.isArray(value)) {
        formData[ELYSIA_FORM_DATA][key] = [];
        for (const v of value)
          value instanceof File ? formData.append(key, value, value.name) : value instanceof ElysiaFile ? formData.append(key, value.value, value.value?.name) : formData.append(key, value), formData[ELYSIA_FORM_DATA][key].push(value);
        continue;
      }
      value instanceof File ? formData.append(key, value, value.name) : value instanceof ElysiaFile ? formData.append(key, value.value, value.value?.name) : formData.append(key, value), formData[ELYSIA_FORM_DATA][key] = value;
    }
  return formData;
}, randomId = typeof crypto > "u" || isCloudflareWorker() ? () => {
  let result = "";
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 16; i++)
    result += characters.charAt(
      // 62 is characters.length
      Math.floor(Math.random() * 62)
    );
  return result;
} : () => {
  const uuid = crypto.randomUUID();
  return uuid.slice(0, 8) + uuid.slice(24, 32);
}, deduplicateChecksum = (array) => {
  if (!array.length) return [];
  const hashes = [];
  for (let i = 0; i < array.length; i++) {
    const item = array[i];
    item.checksum && (hashes.includes(item.checksum) && (array.splice(i, 1), i--), hashes.push(item.checksum));
  }
  return array;
}, promoteEvent = (events, as = "scoped") => {
  if (events) {
    if (as === "scoped") {
      for (const event of events)
        "scope" in event && event.scope === "local" && (event.scope = "scoped");
      return;
    }
    for (const event of events) "scope" in event && (event.scope = "global");
  }
}, getLoosePath = (path) => path.charCodeAt(path.length - 1) === 47 ? path.slice(0, path.length - 1) : path + "/", isNotEmpty = (obj) => {
  if (!obj) return !1;
  for (const _ in obj) return !0;
  return !1;
}, encodePath = (path, { dynamic = !1 } = {}) => {
  let encoded = encodeURIComponent(path).replace(/%2F/g, "/");
  return dynamic && (encoded = encoded.replace(/%3A/g, ":").replace(/%3F/g, "?")), encoded;
}, supportPerMethodInlineHandler = !!(typeof Bun > "u" || Bun.semver?.satisfies?.(Bun.version, ">=1.2.14")), sse = (_payload) => {
  if (_payload instanceof ReadableStream)
    return _payload.sse = !0, _payload;
  const payload = typeof _payload == "string" ? { data: _payload } : _payload;
  return payload.sse = !0, payload.toSSE = () => {
    let payloadString = "";
    return payload.id !== void 0 && payload.id !== null && (payloadString += `id: ${payload.id}
`), payload.event && (payloadString += `event: ${payload.event}
`), payload.retry !== void 0 && (payloadString += `retry: ${payload.retry}
`), payload.data === null ? payloadString += `data: null
` : typeof payload.data == "string" ? payloadString += `data: ${payload.data}
` : typeof payload.data == "object" && (payloadString += `data: ${JSON.stringify(payload.data)}
`), payloadString && (payloadString += `
`), payloadString;
  }, payload;
};
async function getResponseLength(response) {
  if (response.bodyUsed || !response.body) return 0;
  let length = 0;
  const reader = response.body.getReader();
  for (; ; ) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
  }
  return length;
}
const emptySchema = {
  headers: !0,
  cookie: !0,
  query: !0,
  params: !0,
  body: !0,
  response: !0
};
function deepClone(source, weak = /* @__PURE__ */ new WeakMap()) {
  if (source === null || typeof source != "object" || typeof source == "function")
    return source;
  if (weak.has(source)) return weak.get(source);
  if (Array.isArray(source)) {
    const copy = new Array(source.length);
    weak.set(source, copy);
    for (let i = 0; i < source.length; i++)
      copy[i] = deepClone(source[i], weak);
    return copy;
  }
  if (typeof source == "object") {
    const keys = Object.keys(source).concat(
      Object.getOwnPropertySymbols(source)
    ), cloned = {};
    weak.set(source, cloned);
    for (const key of keys)
      cloned[key] = deepClone(source[key], weak);
    return cloned;
  }
  return source;
}
export {
  ELYSIA_FORM_DATA,
  ELYSIA_REQUEST_ID,
  InvertedStatusMap,
  PromiseGroup,
  StatusMap,
  asHookType,
  checksum,
  cloneInference,
  deduplicateChecksum,
  deepClone,
  emptySchema,
  encodePath,
  filterGlobalHook,
  fnToContainer,
  form,
  getLoosePath,
  getResponseLength,
  hasHeaderShorthand,
  hasSetImmediate,
  injectChecksum,
  insertStandaloneValidator,
  isClass,
  isNotEmpty,
  isNumericString,
  lifeCycleToArray,
  lifeCycleToFn,
  localHookToLifeCycleStore,
  mergeCookie,
  mergeDeep,
  mergeHook,
  mergeLifeCycle,
  mergeObjectArray,
  mergeResponse,
  mergeSchemaValidator,
  primitiveHooks,
  promoteEvent,
  randomId,
  redirect,
  replaceUrlPath,
  signCookie,
  sse,
  supportPerMethodInlineHandler,
  unsignCookie
};

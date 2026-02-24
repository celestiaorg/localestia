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
var sucrose_exports = {};
__export(sucrose_exports, {
  bracketPairRange: () => bracketPairRange,
  bracketPairRangeReverse: () => bracketPairRangeReverse,
  clearSucroseCache: () => clearSucroseCache,
  extractMainParameter: () => extractMainParameter,
  findAlias: () => findAlias,
  findParameterReference: () => findParameterReference,
  inferBodyReference: () => inferBodyReference,
  isContextPassToFunction: () => isContextPassToFunction,
  mergeInference: () => mergeInference,
  removeColonAlias: () => removeColonAlias,
  removeDefaultParameter: () => removeDefaultParameter,
  retrieveRootparameters: () => retrieveRootparameters,
  separateFunction: () => separateFunction,
  sucrose: () => sucrose
});
module.exports = __toCommonJS(sucrose_exports);
var import_utils = require('./utils.js'), import_utils2 = require('./universal/utils.js');
const separateFunction = (code) => {
  code.startsWith("async") && (code = code.slice(5)), code = code.trimStart();
  let index = -1;
  if (code.charCodeAt(0) === 40 && (index = code.indexOf("=>", code.indexOf(")")), index !== -1)) {
    let bracketEndIndex = index;
    for (; bracketEndIndex > 0 && code.charCodeAt(--bracketEndIndex) !== 41; )
      ;
    let body = code.slice(index + 2);
    return body.charCodeAt(0) === 32 && (body = body.trimStart()), [
      code.slice(1, bracketEndIndex),
      body,
      {
        isArrowReturn: body.charCodeAt(0) !== 123
      }
    ];
  }
  if (/^(\w+)=>/g.test(code) && (index = code.indexOf("=>"), index !== -1)) {
    let body = code.slice(index + 2);
    return body.charCodeAt(0) === 32 && (body = body.trimStart()), [
      code.slice(0, index),
      body,
      {
        isArrowReturn: body.charCodeAt(0) !== 123
      }
    ];
  }
  if (code.startsWith("function")) {
    index = code.indexOf("(");
    const end = code.indexOf(")");
    return [
      code.slice(index + 1, end),
      code.slice(end + 2),
      {
        isArrowReturn: !1
      }
    ];
  }
  const start = code.indexOf("(");
  if (start !== -1) {
    const sep = code.indexOf(`
`, 2), parameter = code.slice(0, sep), end = parameter.lastIndexOf(")") + 1, body = code.slice(sep + 1);
    return [
      parameter.slice(start, end),
      "{" + body,
      {
        isArrowReturn: !1
      }
    ];
  }
  const x = code.split(`
`, 2);
  return [x[0], x[1], { isArrowReturn: !1 }];
}, bracketPairRange = (parameter) => {
  const start = parameter.indexOf("{");
  if (start === -1) return [-1, 0];
  let end = start + 1, deep = 1;
  for (; end < parameter.length; end++) {
    const char = parameter.charCodeAt(end);
    if (char === 123 ? deep++ : char === 125 && deep--, deep === 0) break;
  }
  return deep !== 0 ? [0, parameter.length] : [start, end + 1];
}, bracketPairRangeReverse = (parameter) => {
  const end = parameter.lastIndexOf("}");
  if (end === -1) return [-1, 0];
  let start = end - 1, deep = 1;
  for (; start >= 0; start--) {
    const char = parameter.charCodeAt(start);
    if (char === 125 ? deep++ : char === 123 && deep--, deep === 0) break;
  }
  return deep !== 0 ? [-1, 0] : [start, end + 1];
}, removeColonAlias = (parameter) => {
  for (; ; ) {
    const start = parameter.indexOf(":");
    if (start === -1) break;
    let end = parameter.indexOf(",", start);
    end === -1 && (end = parameter.indexOf("}", start) - 1), end === -2 && (end = parameter.length), parameter = parameter.slice(0, start) + parameter.slice(end);
  }
  return parameter;
}, retrieveRootparameters = (parameter) => {
  let hasParenthesis = !1;
  parameter.charCodeAt(0) === 40 && (parameter = parameter.slice(1, -1)), parameter.charCodeAt(0) === 123 && (hasParenthesis = !0, parameter = parameter.slice(1, -1)), parameter = parameter.replace(/( |\t|\n)/g, "").trim();
  let parameters = [];
  for (; ; ) {
    let [start, end] = bracketPairRange(parameter);
    if (start === -1) break;
    parameters.push(parameter.slice(0, start - 1)), parameter.charCodeAt(end) === 44 && end++, parameter = parameter.slice(end);
  }
  parameter = removeColonAlias(parameter), parameter && (parameters = parameters.concat(parameter.split(",")));
  const parameterMap = /* @__PURE__ */ Object.create(null);
  for (const p of parameters) {
    if (p.indexOf(",") === -1) {
      parameterMap[p] = !0;
      continue;
    }
    for (const q of p.split(",")) parameterMap[q.trim()] = !0;
  }
  return {
    hasParenthesis,
    parameters: parameterMap
  };
}, findParameterReference = (parameter, inference) => {
  const { parameters, hasParenthesis } = retrieveRootparameters(parameter);
  return parameters.query && (inference.query = !0), parameters.headers && (inference.headers = !0), parameters.body && (inference.body = !0), parameters.cookie && (inference.cookie = !0), parameters.set && (inference.set = !0), parameters.server && (inference.server = !0), parameters.route && (inference.route = !0), parameters.url && (inference.url = !0), parameters.path && (inference.path = !0), hasParenthesis ? `{ ${Object.keys(parameters).join(", ")} }` : Object.keys(parameters).join(", ");
}, findEndIndex = (type, content, index) => {
  const regex = new RegExp(
    `${type.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\n\\t,; ]`
  );
  index !== void 0 && (regex.lastIndex = index);
  const match = regex.exec(content);
  return match ? match.index : -1;
}, findEndQueryBracketIndex = (type, content, index) => {
  const bracketEndIndex = content.indexOf(type + "]", index), singleQuoteIndex = content.indexOf(type + "'", index), doubleQuoteIndex = content.indexOf(type + '"', index);
  return [bracketEndIndex, singleQuoteIndex, doubleQuoteIndex].filter((i) => i > 0).sort((a, b) => a - b)[0] || -1;
}, findAlias = (type, body, depth = 0) => {
  if (depth > 5) return [];
  const aliases = [];
  let content = body;
  for (; ; ) {
    let index = findEndIndex(" = " + type, content);
    if (index === -1 && (index = findEndIndex("=" + type, content)), index === -1) {
      let lastIndex = content.indexOf(" = " + type);
      if (lastIndex === -1 && (lastIndex = content.indexOf("=" + type)), lastIndex + 3 + type.length !== content.length) break;
      index = lastIndex;
    }
    const part = content.slice(0, index), lastPart = part.lastIndexOf(" ");
    let variable = part.slice(lastPart !== -1 ? lastPart + 1 : -1);
    if (variable === "}") {
      const [start, end] = bracketPairRangeReverse(part);
      aliases.push(removeColonAlias(content.slice(start, end))), content = content.slice(index + 3 + type.length);
      continue;
    }
    for (; variable.charCodeAt(0) === 44; ) variable = variable.slice(1);
    for (; variable.charCodeAt(0) === 9; ) variable = variable.slice(1);
    variable.includes("(") || aliases.push(variable), content = content.slice(index + 3 + type.length);
  }
  for (const alias of aliases) {
    if (alias.charCodeAt(0) === 123) continue;
    const deepAlias = findAlias(alias, body);
    deepAlias.length > 0 && aliases.push(...deepAlias);
  }
  return aliases;
}, extractMainParameter = (parameter) => {
  if (!parameter) return;
  if (parameter.charCodeAt(0) !== 123) return parameter;
  if (parameter = parameter.slice(2, -2), !parameter.includes(","))
    return parameter.indexOf("...") !== -1 ? parameter.slice(parameter.indexOf("...") + 3) : void 0;
  const spreadIndex = parameter.indexOf("...");
  if (spreadIndex !== -1)
    return parameter.slice(spreadIndex + 3).trimEnd();
}, inferBodyReference = (code, aliases, inference) => {
  const access = (type, alias) => new RegExp(
    `${alias}\\.(${type})|${alias}\\["${type}"\\]|${alias}\\['${type}'\\]`
  ).test(code);
  for (const alias of aliases)
    if (alias) {
      if (alias.charCodeAt(0) === 123) {
        const parameters = retrieveRootparameters(alias).parameters;
        parameters.query && (inference.query = !0), parameters.headers && (inference.headers = !0), parameters.body && (inference.body = !0), parameters.cookie && (inference.cookie = !0), parameters.set && (inference.set = !0), parameters.server && (inference.server = !0), parameters.url && (inference.url = !0), parameters.route && (inference.route = !0), parameters.path && (inference.path = !0);
        continue;
      }
      if (!inference.query && (access("query", alias) || code.includes("return " + alias) || code.includes("return " + alias + ".query")) && (inference.query = !0), !inference.headers && access("headers", alias) && (inference.headers = !0), !inference.body && access("body", alias) && (inference.body = !0), !inference.cookie && access("cookie", alias) && (inference.cookie = !0), !inference.set && access("set", alias) && (inference.set = !0), !inference.server && access("server", alias) && (inference.server = !0), !inference.route && access("route", alias) && (inference.route = !0), !inference.url && access("url", alias) && (inference.url = !0), !inference.path && access("path", alias) && (inference.path = !0), inference.query && inference.headers && inference.body && inference.cookie && inference.set && inference.server && inference.route && inference.url && inference.path)
        break;
    }
  return aliases;
}, removeDefaultParameter = (parameter) => {
  for (; ; ) {
    const index = parameter.indexOf("=");
    if (index === -1) break;
    const commaIndex = parameter.indexOf(",", index), bracketIndex = parameter.indexOf("}", index), end = [commaIndex, bracketIndex].filter((i) => i > 0).sort((a, b) => a - b)[0] || -1;
    if (end === -1) {
      parameter = parameter.slice(0, index);
      break;
    }
    parameter = parameter.slice(0, index) + parameter.slice(end);
  }
  return parameter.split(",").map((i) => i.trim()).join(", ");
}, isContextPassToFunction = (context, body, inference) => {
  try {
    const captureFunction = new RegExp(
      `\\w\\((?:.*?)?${context}(?:.*?)?\\)`,
      "gs"
    ), exactParameter = new RegExp(`${context}(,|\\))`, "gs"), length = body.length;
    let fn;
    for (fn = captureFunction.exec(body) + ""; captureFunction.lastIndex !== 0 && captureFunction.lastIndex < length + (fn ? fn.length : 0); ) {
      if (fn && exactParameter.test(fn))
        return inference.query = !0, inference.headers = !0, inference.body = !0, inference.cookie = !0, inference.set = !0, inference.server = !0, inference.url = !0, inference.route = !0, inference.path = !0, !0;
      fn = captureFunction.exec(body) + "";
    }
    const nextChar = body.charCodeAt(captureFunction.lastIndex);
    return nextChar === 41 || nextChar === 44 ? (inference.query = !0, inference.headers = !0, inference.body = !0, inference.cookie = !0, inference.set = !0, inference.server = !0, inference.url = !0, inference.route = !0, inference.path = !0, !0) : !1;
  } catch {
    return console.log(
      "[Sucrose] warning: unexpected isContextPassToFunction error, you may continue development as usual but please report the following to maintainers:"
    ), console.log("--- body ---"), console.log(body), console.log("--- context ---"), console.log(context), !0;
  }
};
let pendingGC, caches = {};
const clearSucroseCache = (delay) => {
  delay === null || (0, import_utils2.isCloudflareWorker)() || (delay === void 0 && (delay = 4 * 60 * 1e3 + 55 * 1e3), pendingGC && clearTimeout(pendingGC), pendingGC = setTimeout(() => {
    caches = {}, pendingGC = void 0, import_utils2.isBun && Bun.gc(!1);
  }, delay), pendingGC.unref?.());
}, mergeInference = (a, b) => ({
  body: a.body || b.body,
  cookie: a.cookie || b.cookie,
  headers: a.headers || b.headers,
  query: a.query || b.query,
  set: a.set || b.set,
  server: a.server || b.server,
  url: a.url || b.url,
  route: a.route || b.route,
  path: a.path || b.path
}), sucrose = (lifeCycle, inference = {
  query: !1,
  headers: !1,
  body: !1,
  cookie: !1,
  set: !1,
  server: !1,
  url: !1,
  route: !1,
  path: !1
}, settings = {}) => {
  const events = [];
  lifeCycle.request?.length && events.push(...lifeCycle.request), lifeCycle.beforeHandle?.length && events.push(...lifeCycle.beforeHandle), lifeCycle.parse?.length && events.push(...lifeCycle.parse), lifeCycle.error?.length && events.push(...lifeCycle.error), lifeCycle.transform?.length && events.push(...lifeCycle.transform), lifeCycle.afterHandle?.length && events.push(...lifeCycle.afterHandle), lifeCycle.mapResponse?.length && events.push(...lifeCycle.mapResponse), lifeCycle.afterResponse?.length && events.push(...lifeCycle.afterResponse), lifeCycle.handler && typeof lifeCycle.handler == "function" && events.push(lifeCycle.handler);
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    if (!e) continue;
    const event = typeof e == "object" ? e.fn : e;
    if (typeof event != "function") continue;
    const content = event.toString(), key = (0, import_utils.checksum)(content), cachedInference = caches[key];
    if (cachedInference) {
      inference = mergeInference(inference, cachedInference);
      continue;
    }
    clearSucroseCache(settings.gcTime);
    const fnInference = {
      query: !1,
      headers: !1,
      body: !1,
      cookie: !1,
      set: !1,
      server: !1,
      url: !1,
      route: !1,
      path: !1
    }, [parameter, body] = separateFunction(content), rootParameters = findParameterReference(parameter, fnInference), mainParameter = extractMainParameter(rootParameters);
    if (mainParameter) {
      const aliases = findAlias(mainParameter, body.slice(1, -1));
      aliases.splice(0, -1, mainParameter);
      let code = body;
      code.charCodeAt(0) === 123 && code.charCodeAt(body.length - 1) === 125 && (code = code.slice(1, -1).trim()), isContextPassToFunction(mainParameter, code, fnInference) || inferBodyReference(code, aliases, fnInference), !fnInference.query && code.includes("return " + mainParameter + ".query") && (fnInference.query = !0);
    }
    if (caches[key] || (caches[key] = fnInference), inference = mergeInference(inference, fnInference), inference.query && inference.headers && inference.body && inference.cookie && inference.set && inference.server && inference.url && inference.route && inference.path)
      break;
  }
  return inference;
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  bracketPairRange,
  bracketPairRangeReverse,
  clearSucroseCache,
  extractMainParameter,
  findAlias,
  findParameterReference,
  inferBodyReference,
  isContextPassToFunction,
  mergeInference,
  removeColonAlias,
  removeDefaultParameter,
  retrieveRootparameters,
  separateFunction,
  sucrose
});

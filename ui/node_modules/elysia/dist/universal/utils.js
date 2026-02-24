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
var utils_exports = {};
__export(utils_exports, {
  isBun: () => isBun,
  isCloudflareWorker: () => isCloudflareWorker,
  isDeno: () => isDeno
});
module.exports = __toCommonJS(utils_exports);
const isBun = typeof Bun < "u", isDeno = typeof Deno < "u";
function isCloudflareWorker() {
  try {
    if (
      // @ts-ignore
      typeof caches < "u" && // @ts-ignore
      typeof caches.default < "u" || typeof WebSocketPair < "u"
    ) return !0;
  } catch {
    return !1;
  }
  return !1;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  isBun,
  isCloudflareWorker,
  isDeno
});

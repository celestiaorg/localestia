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
var types_exports = {};
__export(types_exports, {
  WebStandardRequest: () => WebStandardRequest,
  WebStandardResponse: () => WebStandardResponse
});
module.exports = __toCommonJS(types_exports);
class WebStandardRequest {
}
class WebStandardResponse {
  constructor(body, init) {
  }
  static error() {
    return Response.error();
  }
  static json(data, init) {
    return Response.json(data, init);
  }
  static redirect(url, status) {
    return Response.redirect(url, status);
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  WebStandardRequest,
  WebStandardResponse
});

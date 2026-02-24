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
var cloudflare_worker_exports = {};
__export(cloudflare_worker_exports, {
  CloudflareAdapter: () => CloudflareAdapter
});
module.exports = __toCommonJS(cloudflare_worker_exports);
var import_web_standard = require('../web-standard/index.js'), import_compose = require('../../compose.js');
const CloudflareAdapter = {
  ...import_web_standard.WebStandardAdapter,
  name: "cloudflare-worker",
  composeGeneralHandler: {
    ...import_web_standard.WebStandardAdapter.composeGeneralHandler,
    error404(hasEventHook, hasErrorHook, afterHandle) {
      const { code } = import_web_standard.WebStandardAdapter.composeGeneralHandler.error404(
        hasEventHook,
        hasErrorHook,
        afterHandle
      );
      return {
        code,
        declare: hasErrorHook ? "" : (
          // This only work because Elysia only clone the Response via .clone()
          `const error404Message=notFound.message.toString()
const error404={clone:()=>new Response(error404Message,{status:404})}
`
        )
      };
    }
  },
  beforeCompile(app) {
    app.handleError = (0, import_compose.composeErrorHandler)(app);
    for (const route of app.routes) route.compile();
  },
  listen() {
    return () => {
      console.warn(
        "Cloudflare Worker does not support listen method. Please export default Elysia instance instead."
      );
    };
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  CloudflareAdapter
});

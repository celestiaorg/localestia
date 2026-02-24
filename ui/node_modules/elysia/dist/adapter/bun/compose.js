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
var compose_exports = {};
__export(compose_exports, {
  createBunRouteHandler: () => createBunRouteHandler
});
module.exports = __toCommonJS(compose_exports);
var import_handler = require('./handler.js'), import_sucrose = require('../../sucrose.js'), import_compose = require('../../compose.js'), import_utils = require('../../utils.js'), import_error = require('../../error.js'), import_trace = require('../../trace.js');
const allocateIf = (value, condition) => condition ? value : "", createContext = (app, route, inference, isInline = !1) => {
  let fnLiteral = "";
  const defaultHeaders = app.setHeaders, hasTrace = !!app.event.trace?.length;
  hasTrace && (fnLiteral += `const id=randomId()
`);
  const isDynamic = /[:*]/.test(route.path), getQi = `const u=request.url,s=u.indexOf('/',${app.config.handler?.standardHostname ?? !0 ? 11 : 7}),qi=u.indexOf('?',s+1)
`, needsQuery = inference.query || !!route.hooks.query || !!route.hooks.standaloneValidator?.find(
    (x) => x.query
  ) || app.event.request?.length;
  needsQuery && (fnLiteral += getQi);
  const getPath = inference.path ? isDynamic ? "get path(){" + (needsQuery ? "" : getQi) + `if(qi===-1)return u.substring(s)
return u.substring(s,qi)
},` : `path:'${route.path}',` : "";
  fnLiteral += allocateIf("const c=", !isInline) + "{request,store," + allocateIf("qi,", needsQuery) + allocateIf("params:request.params,", isDynamic) + getPath + allocateIf(
    "url:request.url,",
    hasTrace || inference.url || needsQuery
  ) + "redirect,status,set:{headers:" + ((0, import_utils.isNotEmpty)(defaultHeaders) ? "Object.assign({},app.setHeaders)" : "Object.create(null)") + ",status:200}", inference.server && (fnLiteral += ",get server(){return app.getServer()}"), hasTrace && (fnLiteral += ",[ELYSIA_REQUEST_ID]:id");
  {
    let decoratorsLiteral = "";
    for (const key of Object.keys(app.singleton.decorator))
      decoratorsLiteral += `,'${key}':decorator['${key}']`;
    fnLiteral += decoratorsLiteral;
  }
  return fnLiteral += `}
`, fnLiteral;
}, createBunRouteHandler = (app, route) => {
  const hasTrace = !!app.event.trace?.length, hasHoc = !!app.extender.higherOrderFunctions.length;
  let inference = (0, import_sucrose.sucrose)(
    route.hooks,
    // @ts-expect-error
    app.inference
  );
  inference = (0, import_sucrose.sucrose)(
    {
      handler: route.handler
    },
    inference
  );
  let fnLiteral = "const handler=data.handler,app=data.app,store=data.store,decorator=data.decorator,redirect=data.redirect,route=data.route,mapEarlyResponse=data.mapEarlyResponse," + allocateIf("randomId=data.randomId,", hasTrace) + allocateIf("ELYSIA_REQUEST_ID=data.ELYSIA_REQUEST_ID,", hasTrace) + allocateIf("ELYSIA_TRACE=data.ELYSIA_TRACE,", hasTrace) + allocateIf("trace=data.trace,", hasTrace) + allocateIf("hoc=data.hoc,", hasHoc) + `status=data.status
`;
  app.event.request?.length && (fnLiteral += `const onRequest=app.event.request.map(x=>x.fn)
`), fnLiteral += `${app.event.request?.find(import_compose.isAsync) ? "async" : ""} function map(request){`;
  const needsQuery = inference.query || !!route.hooks.query || !!route.hooks.standaloneValidator?.find(
    (x) => x.query
  );
  return hasTrace || needsQuery || app.event.request?.length ? (fnLiteral += createContext(app, route, inference), fnLiteral += (0, import_compose.createOnRequestHandler)(app), fnLiteral += "return handler(c)}") : fnLiteral += `return handler(${createContext(app, route, inference, !0)})}`, fnLiteral += (0, import_compose.createHoc)(app), Function(
    "data",
    fnLiteral
  )({
    app,
    handler: route.compile?.() ?? route.composed,
    redirect: import_utils.redirect,
    status: import_error.status,
    // @ts-expect-error private property
    hoc: app.extender.higherOrderFunctions.map((x) => x.fn),
    store: app.store,
    decorator: app.decorator,
    route: route.path,
    randomId: hasTrace ? import_utils.randomId : void 0,
    ELYSIA_TRACE: hasTrace ? import_trace.ELYSIA_TRACE : void 0,
    ELYSIA_REQUEST_ID: hasTrace ? import_utils.ELYSIA_REQUEST_ID : void 0,
    trace: hasTrace ? app.event.trace?.map((x) => x?.fn ?? x) : void 0,
    mapEarlyResponse: import_handler.mapEarlyResponse
  });
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  createBunRouteHandler
});

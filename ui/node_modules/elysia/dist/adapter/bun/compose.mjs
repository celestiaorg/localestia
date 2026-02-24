import { mapEarlyResponse } from "./handler.mjs";
import { sucrose } from "../../sucrose.mjs";
import { createHoc, createOnRequestHandler, isAsync } from "../../compose.mjs";
import { randomId, ELYSIA_REQUEST_ID, redirect, isNotEmpty } from "../../utils.mjs";
import { status } from "../../error.mjs";
import { ELYSIA_TRACE } from "../../trace.mjs";
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
  ) + "redirect,status,set:{headers:" + (isNotEmpty(defaultHeaders) ? "Object.assign({},app.setHeaders)" : "Object.create(null)") + ",status:200}", inference.server && (fnLiteral += ",get server(){return app.getServer()}"), hasTrace && (fnLiteral += ",[ELYSIA_REQUEST_ID]:id");
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
  let inference = sucrose(
    route.hooks,
    // @ts-expect-error
    app.inference
  );
  inference = sucrose(
    {
      handler: route.handler
    },
    inference
  );
  let fnLiteral = "const handler=data.handler,app=data.app,store=data.store,decorator=data.decorator,redirect=data.redirect,route=data.route,mapEarlyResponse=data.mapEarlyResponse," + allocateIf("randomId=data.randomId,", hasTrace) + allocateIf("ELYSIA_REQUEST_ID=data.ELYSIA_REQUEST_ID,", hasTrace) + allocateIf("ELYSIA_TRACE=data.ELYSIA_TRACE,", hasTrace) + allocateIf("trace=data.trace,", hasTrace) + allocateIf("hoc=data.hoc,", hasHoc) + `status=data.status
`;
  app.event.request?.length && (fnLiteral += `const onRequest=app.event.request.map(x=>x.fn)
`), fnLiteral += `${app.event.request?.find(isAsync) ? "async" : ""} function map(request){`;
  const needsQuery = inference.query || !!route.hooks.query || !!route.hooks.standaloneValidator?.find(
    (x) => x.query
  );
  return hasTrace || needsQuery || app.event.request?.length ? (fnLiteral += createContext(app, route, inference), fnLiteral += createOnRequestHandler(app), fnLiteral += "return handler(c)}") : fnLiteral += `return handler(${createContext(app, route, inference, !0)})}`, fnLiteral += createHoc(app), Function(
    "data",
    fnLiteral
  )({
    app,
    handler: route.compile?.() ?? route.composed,
    redirect,
    status,
    // @ts-expect-error private property
    hoc: app.extender.higherOrderFunctions.map((x) => x.fn),
    store: app.store,
    decorator: app.decorator,
    route: route.path,
    randomId: hasTrace ? randomId : void 0,
    ELYSIA_TRACE: hasTrace ? ELYSIA_TRACE : void 0,
    ELYSIA_REQUEST_ID: hasTrace ? ELYSIA_REQUEST_ID : void 0,
    trace: hasTrace ? app.event.trace?.map((x) => x?.fn ?? x) : void 0,
    mapEarlyResponse
  });
};
export {
  createBunRouteHandler
};

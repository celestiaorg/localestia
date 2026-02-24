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
var bun_exports = {};
__export(bun_exports, {
  BunAdapter: () => BunAdapter,
  isHTMLBundle: () => isHTMLBundle
});
module.exports = __toCommonJS(bun_exports);
var import_web_standard = require('../web-standard/index.js'), import_utils = require('../utils.js'), import_compose = require('./compose.js'), import_handler_native = require('./handler-native.js'), import_cookies = require('../../cookies.js'), import_error = require('../../error.js'), import_schema = require('../../schema.js'), import_utils2 = require('../../utils.js'), import_handler = require('./handler.js'), import_ws = require('../../ws/index.js');
const optionalParam = /:.+?\?(?=\/|$)/, getPossibleParams = (path) => {
  const match = optionalParam.exec(path);
  if (!match) return [path];
  const routes = [], head = path.slice(0, match.index), param = match[0].slice(0, -1), tail = path.slice(match.index + match[0].length);
  routes.push(head.slice(0, -1)), routes.push(head + param);
  for (const fragment of getPossibleParams(tail))
    fragment && (fragment.startsWith("/:") || routes.push(head.slice(0, -1) + fragment), routes.push(head + param + fragment));
  return routes;
}, isHTMLBundle = (handle) => typeof handle == "object" && handle !== null && (handle.toString() === "[object HTMLBundle]" || typeof handle.index == "string"), supportedMethods = {
  GET: !0,
  HEAD: !0,
  OPTIONS: !0,
  DELETE: !0,
  PATCH: !0,
  POST: !0,
  PUT: !0
}, mapRoutes = (app) => {
  if (!app.config.aot || app.config.systemRouter === !1) return;
  const routes = {}, add = (route, handler) => {
    const path = encodeURI(route.path);
    routes[path] ? routes[path][route.method] || (routes[path][route.method] = handler) : routes[path] = {
      [route.method]: handler
    };
  }, tree = app.routeTree;
  for (const route of app.router.history) {
    if (typeof route.handler != "function") continue;
    const method = route.method;
    if (method === "GET" && `WS_${route.path}` in tree || method === "WS" || route.path.charCodeAt(route.path.length - 1) === 42 || !(method in supportedMethods))
      continue;
    if (method === "ALL") {
      `WS_${route.path}` in tree || (routes[route.path] = route.hooks?.config?.mount ? route.hooks.trace || app.event.trace || // @ts-expect-error private property
      app.extender.higherOrderFunctions ? (0, import_compose.createBunRouteHandler)(app, route) : route.hooks.mount || route.handler : route.handler);
      continue;
    }
    let compiled;
    const handler = app.config.precompile ? (0, import_compose.createBunRouteHandler)(app, route) : (request) => compiled ? compiled(request) : (compiled = (0, import_compose.createBunRouteHandler)(app, route))(
      request
    );
    for (const path of getPossibleParams(route.path))
      add(
        {
          method,
          path
        },
        handler
      );
  }
  return routes;
}, mergeRoutes = (r1, r2) => {
  if (!r2) return r1;
  for (const key of Object.keys(r2))
    if (r1[key] !== r2[key]) {
      if (!r1[key]) {
        r1[key] = r2[key];
        continue;
      }
      if (r1[key] && r2[key]) {
        if (typeof r1[key] == "function" || r1[key] instanceof Response) {
          r1[key] = r2[key];
          continue;
        }
        r1[key] = {
          ...r1[key],
          ...r2[key]
        };
      }
    }
  return r1;
}, BunAdapter = {
  ...import_web_standard.WebStandardAdapter,
  name: "bun",
  handler: {
    mapResponse: import_handler.mapResponse,
    mapEarlyResponse: import_handler.mapEarlyResponse,
    mapCompactResponse: import_handler.mapCompactResponse,
    createStaticHandler: import_handler.createStaticHandler,
    createNativeStaticHandler: import_handler_native.createNativeStaticHandler
  },
  composeHandler: {
    ...import_web_standard.WebStandardAdapter.composeHandler,
    headers: import_utils2.hasHeaderShorthand ? `c.headers=c.request.headers.toJSON()
` : `c.headers={}
for(const [k,v] of c.request.headers.entries())c.headers[k]=v
`
  },
  listen(app) {
    return (options, callback) => {
      if (typeof Bun > "u")
        throw new Error(
          ".listen() is designed to run on Bun only. If you are running Elysia in other environment please use a dedicated plugin or export the handler via Elysia.fetch"
        );
      if (app.compile(), typeof options == "string") {
        if (!(0, import_utils2.isNumericString)(options))
          throw new Error("Port must be a numeric value");
        options = parseInt(options);
      }
      const createStaticRoute = (iterator, { withAsync = !1 } = {}) => {
        const staticRoutes = {}, ops = [];
        for (let [path, route] of Object.entries(iterator))
          if (path = encodeURI(path), import_utils2.supportPerMethodInlineHandler) {
            if (!route) continue;
            for (const [method, value] of Object.entries(route))
              if (!(!value || !(method in supportedMethods))) {
                if (value instanceof Promise) {
                  withAsync && (staticRoutes[path] || (staticRoutes[path] = {}), ops.push(
                    value.then((awaited) => {
                      awaited instanceof Response && (staticRoutes[path][method] = awaited), isHTMLBundle(awaited) && (staticRoutes[path][method] = awaited);
                    })
                  ));
                  continue;
                }
                !(value instanceof Response) && !isHTMLBundle(value) || (staticRoutes[path] || (staticRoutes[path] = {}), staticRoutes[path][method] = value);
              }
          } else {
            if (!route) continue;
            if (route instanceof Promise) {
              withAsync && (staticRoutes[path] || (staticRoutes[path] = {}), ops.push(
                route.then((awaited) => {
                  awaited instanceof Response && (staticRoutes[path] = awaited);
                })
              ));
              continue;
            }
            if (!(route instanceof Response)) continue;
            staticRoutes[path] = route;
          }
        return withAsync ? Promise.all(ops).then(() => staticRoutes) : staticRoutes;
      }, serve = typeof options == "object" ? {
        development: !import_error.isProduction,
        reusePort: !0,
        idleTimeout: 30,
        ...app.config.serve || {},
        ...options || {},
        // @ts-ignore
        routes: mergeRoutes(
          mergeRoutes(
            createStaticRoute(app.router.response),
            mapRoutes(app)
          ),
          // @ts-ignore
          app.config.serve?.routes
        ),
        websocket: {
          ...app.config.websocket || {},
          ...import_ws.websocket || {},
          ...options.websocket || {}
        },
        fetch: app.fetch
      } : {
        development: !import_error.isProduction,
        reusePort: !0,
        idleTimeout: 30,
        ...app.config.serve || {},
        // @ts-ignore
        routes: mergeRoutes(
          mergeRoutes(
            createStaticRoute(app.router.response),
            mapRoutes(app)
          ),
          // @ts-ignore
          app.config.serve?.routes
        ),
        websocket: {
          ...app.config.websocket || {},
          ...import_ws.websocket || {}
        },
        port: options,
        fetch: app.fetch
      };
      if (app.server = Bun.serve(serve), app.event.start)
        for (let i = 0; i < app.event.start.length; i++)
          app.event.start[i].fn(app);
      callback && callback(app.server), process.on("beforeExit", async () => {
        if (app.server && (await app.server.stop?.(), app.server = null, app.event.stop))
          for (let i = 0; i < app.event.stop.length; i++)
            app.event.stop[i].fn(app);
      }), app.promisedModules.then(async () => {
        app.config.aot, app.compile(), app.server?.reload({
          ...serve,
          fetch: app.fetch,
          // @ts-ignore
          routes: mergeRoutes(
            mergeRoutes(
              await createStaticRoute(app.router.response, {
                withAsync: !0
              }),
              mapRoutes(app)
            ),
            // @ts-ignore
            app.config.serve?.routes
          )
        }), Bun?.gc(!1);
      });
    };
  },
  async stop(app, closeActiveConnections) {
    if (app.server) {
      if (await app.server.stop(closeActiveConnections), app.server = null, app.event.stop?.length)
        for (let i = 0; i < app.event.stop.length; i++)
          app.event.stop[i].fn(app);
    } else
      console.log(
        "Elysia isn't running. Call `app.listen` to start the server.",
        new Error().stack
      );
  },
  ws(app, path, options) {
    const { parse, body, response, ...rest } = options, messageValidator = (0, import_schema.getSchemaValidator)(body, {
      // @ts-expect-error private property
      modules: app.definitions.typebox,
      // @ts-expect-error private property
      models: app.definitions.type,
      normalize: app.config.normalize
    }), validateMessage = messageValidator ? messageValidator.provider === "standard" ? (data) => messageValidator.schema["~standard"].validate(data).issues : (data) => messageValidator.Check(data) === !1 : void 0, responseValidator = (0, import_schema.getSchemaValidator)(response, {
      // @ts-expect-error private property
      modules: app.definitions.typebox,
      // @ts-expect-error private property
      models: app.definitions.type,
      normalize: app.config.normalize
    });
    app.route(
      "WS",
      path,
      async (context) => {
        const server = context.server ?? app.server, { set, path: path2, qi, headers, query, params } = context;
        if (context.validator = responseValidator, options.upgrade)
          if (typeof options.upgrade == "function") {
            const temp = options.upgrade(context);
            temp instanceof Promise && await temp;
          } else options.upgrade && Object.assign(
            set.headers,
            options.upgrade
          );
        if (set.cookie && (0, import_utils2.isNotEmpty)(set.cookie)) {
          const cookie = (0, import_cookies.serializeCookie)(set.cookie);
          cookie && (set.headers["set-cookie"] = cookie);
        }
        set.headers["set-cookie"] && Array.isArray(set.headers["set-cookie"]) && (set.headers = (0, import_utils.parseSetCookies)(
          new Headers(set.headers),
          set.headers["set-cookie"]
        ));
        const handleResponse = (0, import_ws.createHandleWSResponse)(responseValidator), parseMessage = (0, import_ws.createWSMessageParser)(parse);
        let _id;
        if (typeof options.beforeHandle == "function") {
          const result = options.beforeHandle(context);
          result instanceof Promise && await result;
        }
        const errorHandlers = [
          ...options.error ? Array.isArray(options.error) ? options.error : [options.error] : [],
          ...(app.event.error ?? []).map(
            (x) => typeof x == "function" ? x : x.fn
          )
        ].filter((x) => x), hasCustomErrorHandlers = errorHandlers.length > 0, handleErrors = hasCustomErrorHandlers ? async (ws, error) => {
          for (const handleError of errorHandlers) {
            let response2 = handleError(
              Object.assign(context, { error })
            );
            if (response2 instanceof Promise && (response2 = await response2), await handleResponse(ws, response2), response2) break;
          }
        } : () => {
        };
        if (!server?.upgrade(context.request, {
          headers: (0, import_utils2.isNotEmpty)(set.headers) ? set.headers : void 0,
          data: {
            ...context,
            get id() {
              return _id || (_id = (0, import_utils2.randomId)());
            },
            validator: responseValidator,
            ping(ws, data) {
              options.ping?.(ws, data);
            },
            pong(ws, data) {
              options.pong?.(ws, data);
            },
            open: async (ws) => {
              try {
                await handleResponse(
                  ws,
                  options.open?.(
                    new import_ws.ElysiaWS(ws, context)
                  )
                );
              } catch (error) {
                handleErrors(ws, error);
              }
            },
            message: async (ws, _message) => {
              const message = await parseMessage(ws, _message);
              if (validateMessage && validateMessage(message)) {
                const validationError = new import_error.ValidationError(
                  "message",
                  messageValidator,
                  message
                );
                return hasCustomErrorHandlers ? handleErrors(ws, validationError) : void ws.send(
                  validationError.message
                );
              }
              try {
                await handleResponse(
                  ws,
                  options.message?.(
                    new import_ws.ElysiaWS(
                      ws,
                      context,
                      message
                    ),
                    message
                  )
                );
              } catch (error) {
                handleErrors(ws, error);
              }
            },
            drain: async (ws) => {
              try {
                await handleResponse(
                  ws,
                  options.drain?.(
                    new import_ws.ElysiaWS(ws, context)
                  )
                );
              } catch (error) {
                handleErrors(ws, error);
              }
            },
            close: async (ws, code, reason) => {
              try {
                await handleResponse(
                  ws,
                  options.close?.(
                    new import_ws.ElysiaWS(ws, context),
                    code,
                    reason
                  )
                );
              } catch (error) {
                handleErrors(ws, error);
              }
            }
          }
        }))
          return (0, import_error.status)(400, "Expected a websocket connection");
      },
      {
        ...rest,
        websocket: options
      }
    );
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  BunAdapter,
  isHTMLBundle
});

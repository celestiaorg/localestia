import { WebStandardAdapter } from "../web-standard/index.mjs";
import { parseSetCookies } from "../utils.mjs";
import { createBunRouteHandler } from "./compose.mjs";
import { createNativeStaticHandler } from "./handler-native.mjs";
import { serializeCookie } from "../../cookies.mjs";
import { isProduction, status, ValidationError } from "../../error.mjs";
import { getSchemaValidator } from "../../schema.mjs";
import {
  hasHeaderShorthand,
  isNotEmpty,
  isNumericString,
  randomId,
  supportPerMethodInlineHandler
} from "../../utils.mjs";
import {
  mapResponse,
  mapEarlyResponse,
  mapCompactResponse,
  createStaticHandler
} from "./handler.mjs";
import {
  createHandleWSResponse,
  createWSMessageParser,
  ElysiaWS,
  websocket
} from "../../ws/index.mjs";
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
      app.extender.higherOrderFunctions ? createBunRouteHandler(app, route) : route.hooks.mount || route.handler : route.handler);
      continue;
    }
    let compiled;
    const handler = app.config.precompile ? createBunRouteHandler(app, route) : (request) => compiled ? compiled(request) : (compiled = createBunRouteHandler(app, route))(
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
  ...WebStandardAdapter,
  name: "bun",
  handler: {
    mapResponse,
    mapEarlyResponse,
    mapCompactResponse,
    createStaticHandler,
    createNativeStaticHandler
  },
  composeHandler: {
    ...WebStandardAdapter.composeHandler,
    headers: hasHeaderShorthand ? `c.headers=c.request.headers.toJSON()
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
        if (!isNumericString(options))
          throw new Error("Port must be a numeric value");
        options = parseInt(options);
      }
      const createStaticRoute = (iterator, { withAsync = !1 } = {}) => {
        const staticRoutes = {}, ops = [];
        for (let [path, route] of Object.entries(iterator))
          if (path = encodeURI(path), supportPerMethodInlineHandler) {
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
        development: !isProduction,
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
          ...websocket || {},
          ...options.websocket || {}
        },
        fetch: app.fetch
      } : {
        development: !isProduction,
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
          ...websocket || {}
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
    const { parse, body, response, ...rest } = options, messageValidator = getSchemaValidator(body, {
      // @ts-expect-error private property
      modules: app.definitions.typebox,
      // @ts-expect-error private property
      models: app.definitions.type,
      normalize: app.config.normalize
    }), validateMessage = messageValidator ? messageValidator.provider === "standard" ? (data) => messageValidator.schema["~standard"].validate(data).issues : (data) => messageValidator.Check(data) === !1 : void 0, responseValidator = getSchemaValidator(response, {
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
        if (set.cookie && isNotEmpty(set.cookie)) {
          const cookie = serializeCookie(set.cookie);
          cookie && (set.headers["set-cookie"] = cookie);
        }
        set.headers["set-cookie"] && Array.isArray(set.headers["set-cookie"]) && (set.headers = parseSetCookies(
          new Headers(set.headers),
          set.headers["set-cookie"]
        ));
        const handleResponse = createHandleWSResponse(responseValidator), parseMessage = createWSMessageParser(parse);
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
          headers: isNotEmpty(set.headers) ? set.headers : void 0,
          data: {
            ...context,
            get id() {
              return _id || (_id = randomId());
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
                    new ElysiaWS(ws, context)
                  )
                );
              } catch (error) {
                handleErrors(ws, error);
              }
            },
            message: async (ws, _message) => {
              const message = await parseMessage(ws, _message);
              if (validateMessage && validateMessage(message)) {
                const validationError = new ValidationError(
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
                    new ElysiaWS(
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
                    new ElysiaWS(ws, context)
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
                    new ElysiaWS(ws, context),
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
          return status(400, "Expected a websocket connection");
      },
      {
        ...rest,
        websocket: options
      }
    );
  }
};
export {
  BunAdapter,
  isHTMLBundle
};

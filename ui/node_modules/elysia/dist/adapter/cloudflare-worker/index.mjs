import { WebStandardAdapter } from "../web-standard/index.mjs";
import { composeErrorHandler } from "../../compose.mjs";
const CloudflareAdapter = {
  ...WebStandardAdapter,
  name: "cloudflare-worker",
  composeGeneralHandler: {
    ...WebStandardAdapter.composeGeneralHandler,
    error404(hasEventHook, hasErrorHook, afterHandle) {
      const { code } = WebStandardAdapter.composeGeneralHandler.error404(
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
    app.handleError = composeErrorHandler(app);
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
export {
  CloudflareAdapter
};

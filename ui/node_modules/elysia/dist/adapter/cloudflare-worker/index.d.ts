import { ElysiaAdapter } from '../..';
/**
 * Cloudflare Adapter (Experimental)
 * @see https://elysiajs.com/integrations/cloudflare-worker
 *
 * @example
 * ```ts
 * import { Elysia } from 'elysia'
 * import { CloudflareAdapter } from 'elysia/adapter/cloudflare-worker'
 *
 * const app = new Elysia({
 * 	  adapter: CloudflareAdapter,
 * })
 * 	  .get('/', () => 'Hello Elysia')
 * 	  .compile()
 *
 * export default app
 * ```
 */
export declare const CloudflareAdapter: ElysiaAdapter;

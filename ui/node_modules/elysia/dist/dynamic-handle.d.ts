import type { Context } from './context';
import { type ElysiaErrors } from './error';
import type { AnyElysia } from './index';
import type { Handler, LifeCycleStore, SchemaValidator } from './types';
export type DynamicHandler = {
    handle: unknown | Handler<any, any>;
    content?: string;
    hooks: Partial<LifeCycleStore>;
    validator?: SchemaValidator;
    route: string;
};
export declare const createDynamicHandler: (app: AnyElysia) => (request: Request) => Promise<Response>;
export declare const createDynamicErrorHandler: (app: AnyElysia) => (context: Context & {
    response: unknown;
}, error: ElysiaErrors) => Promise<unknown>;

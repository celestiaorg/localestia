import { AnyElysia } from './index';
import { Sucrose } from './sucrose';
import type { ComposedHandler, Handler, HookContainer, LifeCycleStore, MaybePromise, SchemaValidator } from './types';
export declare const isAsync: (v: Function | HookContainer) => boolean;
export declare const composeHandler: ({ app, path, method, hooks, validator, handler, allowMeta, inference }: {
    app: AnyElysia;
    path: string;
    method: string;
    hooks: Partial<LifeCycleStore>;
    validator: SchemaValidator;
    handler: unknown | Handler<any, any>;
    allowMeta?: boolean;
    inference: Sucrose.Inference;
}) => ComposedHandler;
export interface ComposerGeneralHandlerOptions {
    /**
     * optimization for standard internet hostname
     * this will assume hostname is always use a standard internet hostname
     * assuming hostname is at minimum of 11 length of string (http://a.bc)
     *
     * setting this to true will skip the first 11 character of the hostname
     *
     * @default true
     */
    standardHostname?: boolean;
}
export declare const createOnRequestHandler: (app: AnyElysia, addFn?: (word: string) => void) => string;
export declare const createHoc: (app: AnyElysia, fnName?: string) => string;
export declare const composeGeneralHandler: (app: AnyElysia) => ((request: Request) => MaybePromise<Response>);
export declare const composeErrorHandler: (app: AnyElysia) => any;

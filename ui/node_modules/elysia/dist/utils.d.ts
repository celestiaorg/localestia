import type { Sucrose } from './sucrose';
import type { LifeCycleStore, MaybeArray, InputSchema, LifeCycleType, HookContainer, Replace, SchemaValidator, AnyLocalHook, SSEPayload, Prettify } from './types';
import { ElysiaFile } from './universal/file';
export declare const replaceUrlPath: (url: string, pathname: string) => string;
export declare const isClass: (v: Object) => boolean;
export declare const mergeDeep: <A extends Record<string, any>, B extends Record<string, any>>(target: A, source: B, options?: {
    skipKeys?: string[];
    override?: boolean;
    mergeArray?: boolean;
    seen?: WeakSet<object>;
}) => A & B;
export declare const mergeCookie: <const A extends Object, const B extends Object>(a: A, b: B) => A & B;
export declare const mergeObjectArray: <T extends HookContainer>(a: T | T[] | undefined, b: T | T[] | undefined) => T[] | undefined;
export declare const primitiveHooks: readonly ["start", "request", "parse", "transform", "resolve", "beforeHandle", "afterHandle", "mapResponse", "afterResponse", "trace", "error", "stop", "body", "headers", "params", "query", "response", "type", "detail"];
export declare const mergeResponse: (a: InputSchema["response"], b: InputSchema["response"]) => string | import("@sinclair/typebox").TSchema | import("./types").StandardSchemaV1Like<unknown, unknown> | {
    [x: number]: string | import("./types").AnySchema;
} | undefined;
export declare const mergeSchemaValidator: (a?: SchemaValidator | null, b?: SchemaValidator | null) => SchemaValidator;
export declare const mergeHook: (a?: Partial<LifeCycleStore>, b?: AnyLocalHook) => LifeCycleStore;
export declare const lifeCycleToArray: (a: LifeCycleStore) => LifeCycleStore;
export declare const hasHeaderShorthand: boolean;
export declare const hasSetImmediate: boolean;
export declare const checksum: (s: string) => number;
export declare const injectChecksum: (checksum: number | undefined, x: MaybeArray<HookContainer> | undefined) => HookContainer | HookContainer[] | undefined;
export declare const mergeLifeCycle: (a: Partial<LifeCycleStore>, b: Partial<LifeCycleStore | AnyLocalHook>, checksum?: number) => LifeCycleStore;
export declare const asHookType: (fn: HookContainer, inject: LifeCycleType, { skipIfHasType }: {
    skipIfHasType?: boolean;
}) => HookContainer;
export declare const filterGlobalHook: (hook: AnyLocalHook) => AnyLocalHook;
export declare const StatusMap: {
    readonly Continue: 100;
    readonly 'Switching Protocols': 101;
    readonly Processing: 102;
    readonly 'Early Hints': 103;
    readonly OK: 200;
    readonly Created: 201;
    readonly Accepted: 202;
    readonly 'Non-Authoritative Information': 203;
    readonly 'No Content': 204;
    readonly 'Reset Content': 205;
    readonly 'Partial Content': 206;
    readonly 'Multi-Status': 207;
    readonly 'Already Reported': 208;
    readonly 'Multiple Choices': 300;
    readonly 'Moved Permanently': 301;
    readonly Found: 302;
    readonly 'See Other': 303;
    readonly 'Not Modified': 304;
    readonly 'Temporary Redirect': 307;
    readonly 'Permanent Redirect': 308;
    readonly 'Bad Request': 400;
    readonly Unauthorized: 401;
    readonly 'Payment Required': 402;
    readonly Forbidden: 403;
    readonly 'Not Found': 404;
    readonly 'Method Not Allowed': 405;
    readonly 'Not Acceptable': 406;
    readonly 'Proxy Authentication Required': 407;
    readonly 'Request Timeout': 408;
    readonly Conflict: 409;
    readonly Gone: 410;
    readonly 'Length Required': 411;
    readonly 'Precondition Failed': 412;
    readonly 'Payload Too Large': 413;
    readonly 'URI Too Long': 414;
    readonly 'Unsupported Media Type': 415;
    readonly 'Range Not Satisfiable': 416;
    readonly 'Expectation Failed': 417;
    readonly "I'm a teapot": 418;
    readonly 'Enhance Your Calm': 420;
    readonly 'Misdirected Request': 421;
    readonly 'Unprocessable Content': 422;
    readonly Locked: 423;
    readonly 'Failed Dependency': 424;
    readonly 'Too Early': 425;
    readonly 'Upgrade Required': 426;
    readonly 'Precondition Required': 428;
    readonly 'Too Many Requests': 429;
    readonly 'Request Header Fields Too Large': 431;
    readonly 'Unavailable For Legal Reasons': 451;
    readonly 'Internal Server Error': 500;
    readonly 'Not Implemented': 501;
    readonly 'Bad Gateway': 502;
    readonly 'Service Unavailable': 503;
    readonly 'Gateway Timeout': 504;
    readonly 'HTTP Version Not Supported': 505;
    readonly 'Variant Also Negotiates': 506;
    readonly 'Insufficient Storage': 507;
    readonly 'Loop Detected': 508;
    readonly 'Not Extended': 510;
    readonly 'Network Authentication Required': 511;
};
export declare const InvertedStatusMap: { [K in keyof StatusMap as StatusMap[K]]: K; };
export type StatusMap = typeof StatusMap;
export type InvertedStatusMap = typeof InvertedStatusMap;
export declare const signCookie: (val: string, secret: string | null) => Promise<string>;
export declare const unsignCookie: (input: string, secret: string | null) => Promise<string | false>;
export declare const insertStandaloneValidator: <const Name extends keyof InputSchema>(hook: {
    standaloneValidator: InputSchema[];
}, name: Name, value: InputSchema[Name]) => void;
export declare const isNumericString: (message: string | number) => boolean;
export declare class PromiseGroup implements PromiseLike<void> {
    onError: (error: any) => void;
    onFinally: () => void;
    root: Promise<any> | null;
    promises: Promise<any>[];
    constructor(onError?: (error: any) => void, onFinally?: () => void);
    /**
     * The number of promises still being awaited.
     */
    get size(): number;
    /**
     * Add a promise to the group.
     * @returns The promise that was added.
     */
    add<T>(promise: Promise<T>): Promise<T>;
    private drain;
    then<TResult1 = void, TResult2 = never>(onfulfilled?: ((value: void) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): PromiseLike<TResult1 | TResult2>;
}
export declare const fnToContainer: (fn: MaybeArray<Function | HookContainer>, 
/** Only add subType to non contained fn */
subType?: HookContainer["subType"]) => MaybeArray<HookContainer>;
export declare const localHookToLifeCycleStore: (a: AnyLocalHook) => LifeCycleStore;
export declare const lifeCycleToFn: (a: Partial<LifeCycleStore>) => AnyLocalHook;
export declare const cloneInference: (inference: Sucrose.Inference) => {
    body: boolean;
    cookie: boolean;
    headers: boolean;
    query: boolean;
    set: boolean;
    server: boolean;
    path: boolean;
    route: boolean;
    url: boolean;
};
/**
 *
 * @param url URL to redirect to
 * @param HTTP status code to send,
 */
export declare const redirect: (url: string, status?: 301 | 302 | 303 | 307 | 308) => Response;
export type redirect = typeof redirect;
export declare const ELYSIA_FORM_DATA: unique symbol;
export type ELYSIA_FORM_DATA = typeof ELYSIA_FORM_DATA;
type IsTuple<T> = T extends readonly any[] ? number extends T['length'] ? false : true : false;
export type ElysiaFormData<T extends Record<keyof any, unknown>> = FormData & {
    [ELYSIA_FORM_DATA]: Replace<T, Blob | ElysiaFile, File> extends infer A ? {
        [key in keyof A]: IsTuple<A[key]> extends true ? A[key][number] extends Blob | ElysiaFile ? File[] : A[key] : A[key];
    } : T;
};
export declare const ELYSIA_REQUEST_ID: unique symbol;
export type ELYSIA_REQUEST_ID = typeof ELYSIA_REQUEST_ID;
export declare const form: <const T extends Record<keyof any, unknown>>(items: T) => ElysiaFormData<T>;
/**
 * Generates a random ID for schema identification.
 *
 * Uses crypto.randomUUID() when available, with a Math.random() fallback
 * for environments where crypto.randomUUID() throws an error
 * (e.g., Cloudflare Workers global scope).
 *
 * @see https://developers.cloudflare.com/workers/runtime-apis/handlers/
 */
export declare const randomId: () => string;
export declare const deduplicateChecksum: <T extends Function>(array: HookContainer<T>[]) => HookContainer<T>[];
/**
 * Since it's a plugin, which means that ephemeral is demoted to volatile.
 * Which  means there's no volatile and all previous ephemeral become volatile
 * We can just promote back without worry
 */
export declare const promoteEvent: (events?: (HookContainer | Function)[], as?: "scoped" | "global") => void;
export declare const getLoosePath: (path: string) => string;
export declare const isNotEmpty: (obj?: Object) => boolean;
export declare const encodePath: (path: string, { dynamic }?: {
    dynamic?: boolean | undefined;
}) => string;
export declare const supportPerMethodInlineHandler: boolean;
type FormatSSEPayload<T = unknown> = T extends string ? {
    readonly data: T;
} : Prettify<SSEPayload<T>>;
/**
 * Return a Server Sent Events (SSE) payload
 *
 * @example
 * ```ts
 * import { sse } from 'elysia'
 *
 * new Elysia()
 *   .get('/sse', function*() {
 *     yield sse('Hello, world!')
 *     yield sse({
 *       event: 'message',
 *       data: { message: 'This is a JSON object' }
 *     })
 *   }
 */
export declare const sse: <const T extends string | SSEPayload | Generator | AsyncGenerator | ReadableStream>(_payload: T) => T extends string ? {
    readonly data: T;
} : T extends SSEPayload ? T : T extends ReadableStream<infer A> ? ReadableStream<FormatSSEPayload<A>> : T extends Generator<infer A, infer B, infer C> ? Generator<FormatSSEPayload<A>, B, C> : T extends AsyncGenerator<infer A, infer B_1, infer C_1> ? AsyncGenerator<FormatSSEPayload<A>, B_1, C_1> : T;
export declare function getResponseLength(response: Response): Promise<number>;
export declare const emptySchema: {
    readonly headers: true;
    readonly cookie: true;
    readonly query: true;
    readonly params: true;
    readonly body: true;
    readonly response: true;
};
export declare function deepClone<T>(source: T, weak?: WeakMap<object, any>): T;
export {};

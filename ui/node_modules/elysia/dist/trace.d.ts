import type { Context } from './context';
import type { Prettify, RouteSchema, SingletonBase } from './types';
export type TraceEvent = 'request' | 'parse' | 'transform' | 'beforeHandle' | 'handle' | 'afterHandle' | 'mapResponse' | 'afterResponse' | 'error';
export type TraceStream = {
    id: number;
    event: TraceEvent;
    type: 'begin' | 'end';
    begin: number;
    name?: string;
    total?: number;
};
type TraceEndDetail = {
    /**
     * Timestamp of a function after it's executed since the server start
     */
    end: TraceProcess<'end'>;
    /**
     * Error that was thrown in the lifecycle
     */
    error: Error | null;
    /**
     * Elapsed time of the lifecycle
     */
    elapsed: number;
};
export type TraceProcess<Type extends 'begin' | 'end' = 'begin' | 'end', WithChildren extends boolean = true> = Type extends 'begin' ? Prettify<{
    /**
     * Function name
     */
    name: string;
    /**
     * Timestamp of a function is called since the server start
     */
    begin: number;
    /**
     * Timestamp of a function after it's executed since the server start
     */
    end: Promise<number>;
    /**
     * Error that was thrown in the lifecycle
     */
    error: Promise<Error | null>;
    /**
     * Listener to intercept the end of the lifecycle
     *
     * If you want to mutate the context, you must do it in this function
     * as there's a lock mechanism to ensure the context is mutate successfully
     */
    onStop(
    /**
     * A callback function that will be called when the function ends
     *
     * If you want to mutate the context, you must do it in this function
     * as there's a lock mechanism to ensure the context is mutate successfully
     */
    callback?: (detail: TraceEndDetail) => unknown): Promise<void>;
} & (WithChildren extends true ? {
    /**
     * total number of lifecycle's children and
     * total number of `onEvent` will be called
     * if there were no early exists or error thrown
     */
    total: number;
    /**
     * Listener to intercept each child lifecycle
     */
    onEvent(
    /**
     * Callback function that will be called for when each child start
     */
    callback?: (process: TraceProcess<'begin', false>) => unknown): Promise<void>;
} : {
    /**
     * Index of the child event
     */
    index: number;
})> : number;
export type TraceListener = (callback?: (process: TraceProcess<'begin'>) => unknown) => Promise<TraceProcess<'begin'>>;
export type TraceHandler<in out Route extends RouteSchema = {}, in out Singleton extends SingletonBase = {
    decorator: {};
    store: {};
    derive: {};
    resolve: {};
}> = {
    (lifecycle: Prettify<{
        id: number;
        context: Context<Route, Singleton>;
        set: Context['set'];
        time: number;
        store: Singleton['store'];
        response: unknown;
    } & {
        [x in `on${Capitalize<TraceEvent>}`]: TraceListener;
    }>): unknown;
};
export declare const ELYSIA_TRACE: unique symbol;
export declare const createTracer: (traceListener: TraceHandler) => (context: Context) => {
    request: (process: TraceStream) => {
        resolveChild: ((process: TraceStream) => () => void)[];
        resolve(error?: Error | null): void;
    };
    parse: (process: TraceStream) => {
        resolveChild: ((process: TraceStream) => () => void)[];
        resolve(error?: Error | null): void;
    };
    transform: (process: TraceStream) => {
        resolveChild: ((process: TraceStream) => () => void)[];
        resolve(error?: Error | null): void;
    };
    beforeHandle: (process: TraceStream) => {
        resolveChild: ((process: TraceStream) => () => void)[];
        resolve(error?: Error | null): void;
    };
    handle: (process: TraceStream) => {
        resolveChild: ((process: TraceStream) => () => void)[];
        resolve(error?: Error | null): void;
    };
    afterHandle: (process: TraceStream) => {
        resolveChild: ((process: TraceStream) => () => void)[];
        resolve(error?: Error | null): void;
    };
    error: (process: TraceStream) => {
        resolveChild: ((process: TraceStream) => () => void)[];
        resolve(error?: Error | null): void;
    };
    mapResponse: (process: TraceStream) => {
        resolveChild: ((process: TraceStream) => () => void)[];
        resolve(error?: Error | null): void;
    };
    afterResponse: (process: TraceStream) => {
        resolveChild: ((process: TraceStream) => () => void)[];
        resolve(error?: Error | null): void;
    };
};
export {};

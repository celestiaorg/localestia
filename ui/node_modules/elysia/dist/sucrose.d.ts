import type { Handler, LifeCycleStore } from './types';
export declare namespace Sucrose {
    interface Inference {
        query: boolean;
        headers: boolean;
        body: boolean;
        cookie: boolean;
        set: boolean;
        server: boolean;
        route: boolean;
        url: boolean;
        path: boolean;
    }
    interface LifeCycle extends Partial<LifeCycleStore> {
        handler?: Handler;
    }
    interface Settings {
        /**
         * If no sucrose usage is found in time
         * it's likely that server is either idle or
         * no new compilation is happening
         * clear the cache to free up memory
         *
         * @default 4 * 60 * 1000 + 55 * 1000 (4 minutes 55 seconds)
         */
        gcTime?: number | null;
    }
}
/**
 * Separate stringified function body and parameter
 *
 * @example
 * ```typescript
 * separateFunction('async ({ hello }) => { return hello }') // => ['({ hello })', '{ return hello }']
 * ```
 */
export declare const separateFunction: (code: string) => [string, string, {
    isArrowReturn: boolean;
}];
/**
 * Get range between bracket pair
 *
 * @example
 * ```typescript
 * bracketPairRange('hello: { world: { a } }, elysia') // [6, 20]
 * ```
 */
export declare const bracketPairRange: (parameter: string) => [number, number];
/**
 * Similar to `bracketPairRange` but in reverse order
 * Get range between bracket pair from end to beginning
 *
 * @example
 * ```typescript
 * bracketPairRange('hello: { world: { a } }, elysia') // [6, 20]
 * ```
 */
export declare const bracketPairRangeReverse: (parameter: string) => [number, number];
export declare const removeColonAlias: (parameter: string) => string;
/**
 * Retrieve only root parameters of a function
 *
 * @example
 * ```typescript
 * retrieveRootParameters('({ hello: { world: { a } }, elysia })') // => {
 *   parameters: ['hello', 'elysia'],
 *   hasParenthesis: true
 * }
 * ```
 */
export declare const retrieveRootparameters: (parameter: string) => {
    hasParenthesis: boolean;
    parameters: Record<string, true>;
};
/**
 * Find inference from parameter
 *
 * @param parameter stringified parameter
 */
export declare const findParameterReference: (parameter: string, inference: Sucrose.Inference) => string;
/**
 * Find alias of variable from function body
 *
 * @example
 * ```typescript
 * findAlias('body', '{ const a = body, b = body }') // => ['a', 'b']
 * ```
 */
export declare const findAlias: (type: string, body: string, depth?: number) => string[];
export declare const extractMainParameter: (parameter: string) => string | undefined;
/**
 * Analyze if context is mentioned in body
 */
export declare const inferBodyReference: (code: string, aliases: string[], inference: Sucrose.Inference) => string[];
export declare const removeDefaultParameter: (parameter: string) => string;
export declare const isContextPassToFunction: (context: string, body: string, inference: Sucrose.Inference) => boolean;
export declare const clearSucroseCache: (delay: Sucrose.Settings["gcTime"]) => void;
export declare const mergeInference: (a: Sucrose.Inference, b: Sucrose.Inference) => {
    body: boolean;
    cookie: boolean;
    headers: boolean;
    query: boolean;
    set: boolean;
    server: boolean;
    url: boolean;
    route: boolean;
    path: boolean;
};
export declare const sucrose: (lifeCycle: Sucrose.LifeCycle, inference?: Sucrose.Inference, settings?: Sucrose.Settings) => Sucrose.Inference;

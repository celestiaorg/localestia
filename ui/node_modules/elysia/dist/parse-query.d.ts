export declare function parseQueryFromURL(input: string, startIndex?: number, array?: {
    [key: string]: 1;
}, object?: {
    [key: string]: 1;
}): Record<string, string>;
/**
 * @callback parse
 * @param {string} input
 */
export declare function parseQueryStandardSchema(input: string, startIndex?: number): Record<string, string | string[]>;
/**
 * @callback parse
 * @param {string} input
 */
export declare function parseQuery(input: string): Record<string, string | string[]>;

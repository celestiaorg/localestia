import type { TSchema } from '@sinclair/typebox';
import type { TypeCheck, ValueError, ValueErrorIterator } from '@sinclair/typebox/compiler';
import { StatusMap, InvertedStatusMap } from './utils';
import type { ElysiaTypeCheck } from './schema';
import { StandardSchemaV1Like } from './types';
export declare const ERROR_CODE: unique symbol;
export type ERROR_CODE = typeof ERROR_CODE;
export declare const isProduction: boolean;
export type ElysiaErrors = InternalServerError | NotFoundError | ParseError | ValidationError | InvalidCookieSignature;
type CheckExcessProps<T, U> = 0 extends 1 & T ? T : U extends U ? Exclude<keyof T, keyof U> extends never ? T : {
    [K in keyof U]: U[K];
} & {
    [K in Exclude<keyof T, keyof U>]: never;
} : never;
export type SelectiveStatus<in out Res> = <const Code extends keyof Res | InvertedStatusMap[Extract<keyof InvertedStatusMap, keyof Res>], T extends Code extends keyof Res ? Res[Code] : Code extends keyof StatusMap ? Res[StatusMap[Code]] : never>(code: Code, response: CheckExcessProps<T, Code extends keyof Res ? Res[Code] : Code extends keyof StatusMap ? Res[StatusMap[Code]] : never>) => ElysiaCustomStatusResponse<Code, T>;
export declare class ElysiaCustomStatusResponse<const in out Code extends number | keyof StatusMap, T = Code extends keyof InvertedStatusMap ? InvertedStatusMap[Code] : Code, const in out Status extends Code extends keyof StatusMap ? StatusMap[Code] : Code = Code extends keyof StatusMap ? StatusMap[Code] : Code> {
    code: Status;
    response: T;
    constructor(code: Code, response: T);
}
export declare const ElysiaStatus: typeof ElysiaCustomStatusResponse;
export declare const status: <const Code extends number | keyof StatusMap, const T = Code extends keyof InvertedStatusMap ? InvertedStatusMap[Code] : Code>(code: Code, response?: T) => ElysiaCustomStatusResponse<Code, T, Code extends "Continue" | "Switching Protocols" | "Processing" | "Early Hints" | "OK" | "Created" | "Accepted" | "Non-Authoritative Information" | "No Content" | "Reset Content" | "Partial Content" | "Multi-Status" | "Already Reported" | "Multiple Choices" | "Moved Permanently" | "Found" | "See Other" | "Not Modified" | "Temporary Redirect" | "Permanent Redirect" | "Bad Request" | "Unauthorized" | "Payment Required" | "Forbidden" | "Not Found" | "Method Not Allowed" | "Not Acceptable" | "Proxy Authentication Required" | "Request Timeout" | "Conflict" | "Gone" | "Length Required" | "Precondition Failed" | "Payload Too Large" | "URI Too Long" | "Unsupported Media Type" | "Range Not Satisfiable" | "Expectation Failed" | "I'm a teapot" | "Enhance Your Calm" | "Misdirected Request" | "Unprocessable Content" | "Locked" | "Failed Dependency" | "Too Early" | "Upgrade Required" | "Precondition Required" | "Too Many Requests" | "Request Header Fields Too Large" | "Unavailable For Legal Reasons" | "Internal Server Error" | "Not Implemented" | "Bad Gateway" | "Service Unavailable" | "Gateway Timeout" | "HTTP Version Not Supported" | "Variant Also Negotiates" | "Insufficient Storage" | "Loop Detected" | "Not Extended" | "Network Authentication Required" ? {
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
}[Code] : Code>;
export declare class InternalServerError extends Error {
    code: string;
    status: number;
    constructor(message?: string);
}
export declare class NotFoundError extends Error {
    code: string;
    status: number;
    constructor(message?: string);
}
export declare class ParseError extends Error {
    code: string;
    status: number;
    constructor(cause?: Error);
}
export declare class InvalidCookieSignature extends Error {
    key: string;
    code: string;
    status: number;
    constructor(key: string, message?: string);
}
interface ValueErrorWithSummary extends ValueError {
    summary?: string;
}
export declare const mapValueError: (error: ValueError | undefined) => ValueErrorWithSummary | undefined;
export declare class InvalidFileType extends Error {
    property: string;
    expected: string | string[];
    message: string;
    code: string;
    status: number;
    constructor(property: string, expected: string | string[], message?: string);
    toResponse(headers?: Record<string, any>): Response;
}
export declare class ValidationError extends Error {
    type: string;
    validator: TSchema | TypeCheck<any> | ElysiaTypeCheck<any> | StandardSchemaV1Like;
    /**
     * Input value
     */
    value: unknown;
    private allowUnsafeValidationDetails;
    code: string;
    status: number;
    /**
     * An actual value of `message`
     *
     * Since `message` is string
     * use this instead of message
     */
    valueError?: ValueError;
    /**
     * Alias of `valueError`
     */
    get messageValue(): ValueError | undefined;
    /**
     * Expected value of the schema
     */
    expected?: unknown;
    /**
     * Custom error if provided
     */
    customError?: unknown;
    constructor(type: string, validator: TSchema | TypeCheck<any> | ElysiaTypeCheck<any> | StandardSchemaV1Like, 
    /**
     * Input value
     */
    value: unknown, allowUnsafeValidationDetails?: boolean, errors?: ValueErrorIterator);
    get all(): ValueErrorWithSummary[];
    static simplifyModel(validator: TSchema | TypeCheck<any> | ElysiaTypeCheck<any>): any;
    get model(): any;
    toResponse(headers?: Record<string, any>): Response;
    /**
     * Utility function to inherit add custom error and keep the original Validation error
     *
     * @since 1.3.14
     *
     * @example
     * ```ts
     * new Elysia()
     *		.onError(({ error, code }) => {
     *			if (code === 'VALIDATION') return error.detail(error.message)
     *		})
     *		.post('/', () => 'Hello World!', {
     *			body: t.Object({
     *				x: t.Number({
     *					error: 'x must be a number'
     *				})
     *			})
     *		})
     * ```
     */
    detail(message: unknown, allowUnsafeValidatorDetails?: boolean): string | {
        type: string;
        on: string;
        found: unknown;
        message: unknown;
        property?: undefined;
        summary?: undefined;
        expected?: undefined;
        errors?: undefined;
    } | {
        type: string;
        on: string;
        property: string;
        message: unknown;
        summary: string | undefined;
        found: unknown;
        expected: unknown;
        errors: ValueErrorWithSummary[];
    };
}
export {};

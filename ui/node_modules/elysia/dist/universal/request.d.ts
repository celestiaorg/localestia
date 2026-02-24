import type { RequestCache, RequestCredentials, RequestDestination, RequestDuplex, RequestInfo, RequestInit, RequestMode, RequestRedirect, WebStandardRequest } from './types';
export declare class ElysiaRequest implements WebStandardRequest {
    private input;
    private init?;
    constructor(input: RequestInfo, init?: RequestInit | undefined);
    readonly cache: RequestCache;
    readonly credentials: RequestCredentials;
    readonly destination: RequestDestination;
    readonly integrity: string;
    readonly method: string;
    readonly mode: RequestMode;
    readonly redirect: RequestRedirect;
    readonly referrerPolicy: string;
    readonly url: string;
    private _headers;
    get headers(): Headers;
    readonly keepalive: boolean;
    private _signal;
    get signal(): AbortSignal;
    readonly duplex: RequestDuplex;
    readonly bodyUsed: boolean;
    get body(): ReadableStream | null;
    arrayBuffer(): Promise<ArrayBuffer>;
    blob(): Promise<Blob>;
    formData(): Promise<FormData>;
    json(): Promise<any>;
    text(): Promise<string>;
    clone(): ElysiaRequest;
}

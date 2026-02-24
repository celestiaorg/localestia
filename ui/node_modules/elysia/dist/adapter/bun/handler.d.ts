import type { Context } from '../../context';
import type { AnyLocalHook } from '../../types';
export declare const mapResponse: (response: unknown, set: Context["set"], request?: Request) => Response;
export declare const mapEarlyResponse: (response: unknown, set: Context["set"], request?: Request) => Response | undefined;
export declare const mapCompactResponse: (response: unknown, request?: Request) => Response;
export declare const errorToResponse: (error: Error, set?: Context["set"]) => any;
export declare const createStaticHandler: (handle: unknown, hooks: Partial<AnyLocalHook>, setHeaders?: Context["set"]["headers"]) => (() => Response) | undefined;

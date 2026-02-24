import type { ServerWebSocket, ServerWebSocketSendStatus, BufferSource, WebSocketHandler } from './bun';
import type { TSchema } from '@sinclair/typebox';
import type { TypeCheck } from '../type-system';
import type { ElysiaTypeCheck } from '../schema';
import type { FlattenResponse, WSParseHandler } from './types';
import type { MaybeArray, Prettify, RouteSchema } from '../types';
export declare const websocket: WebSocketHandler<any>;
type ElysiaServerWebSocket = Omit<ServerWebSocket<unknown>, 'send' | 'ping' | 'pong' | 'publish'>;
export declare class ElysiaWS<Context = unknown, Route extends RouteSchema = {}> implements ElysiaServerWebSocket {
    raw: ServerWebSocket<{
        id?: string;
        validator?: TypeCheck<TSchema>;
    }>;
    data: Prettify<Omit<Context, 'body' | 'error' | 'status' | 'redirect'>>;
    body: Route['body'];
    constructor(raw: ServerWebSocket<{
        id?: string;
        validator?: TypeCheck<TSchema>;
    }>, data: Prettify<Omit<Context, 'body' | 'error' | 'status' | 'redirect'>>, body?: Route['body']);
    /**
     * Sends a message to the client.
     *
     * @param data The data to send.
     * @param compress Should the data be compressed? If the client does not support compression, this is ignored.
     * @example
     * ws.send("Hello!");
     * ws.send("Compress this.", true);
     * ws.send(new Uint8Array([1, 2, 3, 4]));
     */
    send(data: FlattenResponse<Route['response']> | BufferSource, compress?: boolean): ServerWebSocketSendStatus;
    /**
     * Sends a ping.
     *
     * @param data The data to send
     */
    ping(data?: FlattenResponse<Route['response']> | BufferSource): ServerWebSocketSendStatus;
    /**
     * Sends a pong.
     *
     * @param data The data to send
     */
    pong(data?: FlattenResponse<Route['response']> | BufferSource): ServerWebSocketSendStatus;
    /**
     * Sends a message to subscribers of the topic.
     *
     * @param topic The topic name.
     * @param data The data to send.
     * @param compress Should the data be compressed? If the client does not support compression, this is ignored.
     * @example
     * ws.publish("chat", "Hello!");
     * ws.publish("chat", "Compress this.", true);
     * ws.publish("chat", new Uint8Array([1, 2, 3, 4]));
     */
    publish(topic: string, data: FlattenResponse<Route['response']> | BufferSource, compress?: boolean): ServerWebSocketSendStatus;
    sendText: ServerWebSocket['sendText'];
    sendBinary: ServerWebSocket['sendBinary'];
    close: ServerWebSocket['close'];
    terminate: ServerWebSocket['terminate'];
    publishText: ServerWebSocket['publishText'];
    publishBinary: ServerWebSocket['publishBinary'];
    subscribe: ServerWebSocket['subscribe'];
    unsubscribe: ServerWebSocket['unsubscribe'];
    isSubscribed: ServerWebSocket['isSubscribed'];
    cork: ServerWebSocket['cork'];
    remoteAddress: ServerWebSocket['remoteAddress'];
    binaryType: ServerWebSocket['binaryType'];
    subscriptions: ServerWebSocket['subscriptions'];
    get readyState(): import("./bun").WebSocketReadyState;
    validator?: TypeCheck<TSchema>;
    ['~types']?: {
        validator: Prettify<Route>;
    };
    get id(): string;
}
export declare const createWSMessageParser: (parse: MaybeArray<WSParseHandler<any>>) => (ws: ServerWebSocket<any>, message: any) => Promise<any>;
export declare const createHandleWSResponse: (responseValidator: TypeCheck<any> | ElysiaTypeCheck<any> | undefined) => (ws: ServerWebSocket<any>, data: unknown) => unknown;
export type { WSLocalHook } from './types';

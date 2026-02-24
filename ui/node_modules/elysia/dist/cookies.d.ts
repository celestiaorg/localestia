import type { Context } from './context';
import type { Prettify } from './types';
export interface CookieOptions {
    /**
     * Specifies the value for the {@link https://tools.ietf.org/html/rfc6265#section-5.2.3|Domain Set-Cookie attribute}. By default, no
     * domain is set, and most clients will consider the cookie to apply to only
     * the current domain.
     */
    domain?: string | undefined;
    /**
     * Specifies the `Date` object to be the value for the {@link https://tools.ietf.org/html/rfc6265#section-5.2.1|`Expires` `Set-Cookie` attribute}. By default,
     * no expiration is set, and most clients will consider this a "non-persistent cookie" and will delete
     * it on a condition like exiting a web browser application.
     *
     * *Note* the {@link https://tools.ietf.org/html/rfc6265#section-5.3|cookie storage model specification}
     * states that if both `expires` and `maxAge` are set, then `maxAge` takes precedence, but it is
     * possible not all clients by obey this, so if both are set, they should
     * point to the same date and time.
     */
    expires?: Date | undefined;
    /**
     * Specifies the boolean value for the {@link https://tools.ietf.org/html/rfc6265#section-5.2.6|`HttpOnly` `Set-Cookie` attribute}.
     * When truthy, the `HttpOnly` attribute is set, otherwise it is not. By
     * default, the `HttpOnly` attribute is not set.
     *
     * *Note* be careful when setting this to true, as compliant clients will
     * not allow client-side JavaScript to see the cookie in `document.cookie`.
     */
    httpOnly?: boolean | undefined;
    /**
     * Specifies the number (in seconds) to be the value for the `Max-Age`
     * `Set-Cookie` attribute. The given number will be converted to an integer
     * by rounding down. By default, no maximum age is set.
     *
     * *Note* the {@link https://tools.ietf.org/html/rfc6265#section-5.3|cookie storage model specification}
     * states that if both `expires` and `maxAge` are set, then `maxAge` takes precedence, but it is
     * possible not all clients by obey this, so if both are set, they should
     * point to the same date and time.
     */
    maxAge?: number | undefined;
    /**
     * Specifies the value for the {@link https://tools.ietf.org/html/rfc6265#section-5.2.4|`Path` `Set-Cookie` attribute}.
     * By default, the path is considered the "default path".
     */
    path?: string | undefined;
    /**
     * Specifies the `string` to be the value for the [`Priority` `Set-Cookie` attribute][rfc-west-cookie-priority-00-4.1].
     *
     * - `'low'` will set the `Priority` attribute to `Low`.
     * - `'medium'` will set the `Priority` attribute to `Medium`, the default priority when not set.
     * - `'high'` will set the `Priority` attribute to `High`.
     *
     * More information about the different priority levels can be found in
     * [the specification][rfc-west-cookie-priority-00-4.1].
     *
     * **note** This is an attribute that has not yet been fully standardized, and may change in the future.
     * This also means many clients may ignore this attribute until they understand it.
     */
    priority?: 'low' | 'medium' | 'high' | undefined;
    /**
     * Specifies the `boolean` value for the [`Partitioned` `Set-Cookie`](rfc-cutler-httpbis-partitioned-cookies)
     * attribute. When truthy, the `Partitioned` attribute is set, otherwise it is not. By default, the
     * `Partitioned` attribute is not set.
     *
     * **note** This is an attribute that has not yet been fully standardized, and may change in the future.
     * This also means many clients may ignore this attribute until they understand it.
     *
     * More information about can be found in [the proposal](https://github.com/privacycg/CHIPS)
     */
    partitioned?: boolean | undefined;
    /**
     * Specifies the boolean or string to be the value for the {@link https://tools.ietf.org/html/draft-ietf-httpbis-rfc6265bis-03#section-4.1.2.7|`SameSite` `Set-Cookie` attribute}.
     *
     * - `true` will set the `SameSite` attribute to `Strict` for strict same
     * site enforcement.
     * - `false` will not set the `SameSite` attribute.
     * - `'lax'` will set the `SameSite` attribute to Lax for lax same site
     * enforcement.
     * - `'strict'` will set the `SameSite` attribute to Strict for strict same
     * site enforcement.
     *  - `'none'` will set the SameSite attribute to None for an explicit
     *  cross-site cookie.
     *
     * More information about the different enforcement levels can be found in {@link https://tools.ietf.org/html/draft-ietf-httpbis-rfc6265bis-03#section-4.1.2.7|the specification}.
     *
     * *note* This is an attribute that has not yet been fully standardized, and may change in the future. This also means many clients may ignore this attribute until they understand it.
     */
    sameSite?: true | false | 'lax' | 'strict' | 'none' | undefined;
    /**
     * Specifies the boolean value for the {@link https://tools.ietf.org/html/rfc6265#section-5.2.5|`Secure` `Set-Cookie` attribute}. When truthy, the
     * `Secure` attribute is set, otherwise it is not. By default, the `Secure` attribute is not set.
     *
     * *Note* be careful when setting this to `true`, as compliant clients will
     * not send the cookie back to the server in the future if the browser does
     * not have an HTTPS connection.
     */
    secure?: boolean | undefined;
    /**
     * Secret key for signing cookie
     *
     * If array is passed, will use Key Rotation.
     *
     * Key rotation is when an encryption key is retired
     * and replaced by generating a new cryptographic key.
     *
     * When null is provided in array,
     * Elysia will allow unsigned cookie for smooth
     * transition from unsign to sign
     */
    secrets?: string | null | (string | null)[];
}
export type ElysiaCookie = Prettify<CookieOptions & {
    value?: unknown;
}>;
type Updater<T> = T | ((value: T) => T);
export declare class Cookie<T> implements ElysiaCookie {
    private name;
    private jar;
    private initial;
    private valueHash?;
    constructor(name: string, jar: Record<string, ElysiaCookie>, initial?: Partial<ElysiaCookie>);
    get cookie(): ElysiaCookie;
    set cookie(jar: ElysiaCookie);
    protected get setCookie(): ElysiaCookie;
    protected set setCookie(jar: ElysiaCookie);
    get value(): T;
    set value(value: T);
    get expires(): Date | undefined;
    set expires(expires: Date | undefined);
    get maxAge(): number | undefined;
    set maxAge(maxAge: number | undefined);
    get domain(): string | undefined;
    set domain(domain: string | undefined);
    get path(): string | undefined;
    set path(path: string | undefined);
    get secure(): boolean | undefined;
    set secure(secure: boolean | undefined);
    get httpOnly(): boolean | undefined;
    set httpOnly(httpOnly: boolean | undefined);
    get sameSite(): true | false | "lax" | "strict" | "none" | undefined;
    set sameSite(sameSite: true | false | 'lax' | 'strict' | 'none' | undefined);
    get priority(): "low" | "medium" | "high" | undefined;
    set priority(priority: 'low' | 'medium' | 'high' | undefined);
    get partitioned(): boolean | undefined;
    set partitioned(partitioned: boolean | undefined);
    get secrets(): ElysiaCookie["secrets"];
    set secrets(secrets: ElysiaCookie['secrets']);
    update(config: Updater<Partial<ElysiaCookie>>): this;
    set(config: Updater<Partial<ElysiaCookie>>): this;
    remove(): this | undefined;
    toString(): string;
}
export declare const createCookieJar: (set: Context["set"], store: Record<string, ElysiaCookie>, initial?: Partial<ElysiaCookie>) => Record<string, Cookie<unknown>>;
export declare const parseCookie: (set: Context["set"], cookieString?: string | null, { secrets, sign, ...initial }?: CookieOptions & {
    sign?: true | string | string[];
}) => Promise<Record<string, Cookie<unknown>>>;
export declare const serializeCookie: (cookies: Context["set"]["cookie"]) => string | string[] | undefined;
export {};

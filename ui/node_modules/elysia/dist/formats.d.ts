/**
 * ? Fork of ajv-formats without ajv as dependencies
 *
 * @see https://github.com/ajv-validator/ajv-formats/blob/master/src/formats.ts
 **/
export type FormatName = 'date' | 'time' | 'date-time' | 'iso-time' | 'iso-date-time' | 'duration' | 'uri' | 'uri-reference' | 'uri-template' | 'url' | 'email' | 'hostname' | 'ipv4' | 'ipv6' | 'regex' | 'uuid' | 'json-pointer' | 'json-pointer-uri-fragment' | 'relative-json-pointer' | 'byte' | 'int32' | 'int64' | 'float' | 'double' | 'password' | 'binary';
export declare const fullFormats: {
    readonly date: typeof date;
    readonly time: (str: string) => boolean;
    readonly 'date-time': (str: string) => boolean;
    readonly 'iso-time': (str: string) => boolean;
    readonly 'iso-date-time': (str: string) => boolean;
    readonly duration: RegExp;
    readonly uri: typeof uri;
    readonly 'uri-reference': RegExp;
    readonly 'uri-template': RegExp;
    readonly url: RegExp;
    readonly email: RegExp;
    readonly hostname: RegExp;
    readonly ipv4: RegExp;
    readonly ipv6: RegExp;
    readonly regex: typeof regex;
    readonly uuid: RegExp;
    readonly 'json-pointer': RegExp;
    readonly 'json-pointer-uri-fragment': RegExp;
    readonly 'relative-json-pointer': RegExp;
    readonly byte: typeof byte;
    readonly int32: {
        readonly type: "number";
        readonly validate: typeof validateInt32;
    };
    readonly int64: {
        readonly type: "number";
        readonly validate: typeof validateInt64;
    };
    readonly float: {
        readonly type: "number";
        readonly validate: typeof validateNumber;
    };
    readonly double: {
        readonly type: "number";
        readonly validate: typeof validateNumber;
    };
    readonly password: true;
    readonly binary: true;
};
declare function date(str: string): boolean;
declare function uri(str: string): boolean;
declare function byte(str: string): boolean;
declare function validateInt32(value: number): boolean;
declare function validateInt64(value: number): boolean;
declare function validateNumber(): boolean;
declare function regex(str: string): boolean;
export {};
/**
 * @license
 *
 * MIT License
 *
 * Copyright (c) 2020 Evgeny Poberezkin
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

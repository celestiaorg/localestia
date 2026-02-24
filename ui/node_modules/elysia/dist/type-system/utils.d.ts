import { TUnsafe, TypeRegistry, type TAnySchema } from '@sinclair/typebox';
import { TypeCheck } from '@sinclair/typebox/compiler';
import { ValidationError } from '../error';
import type { ElysiaTypeCustomErrorCallback, FileOptions, FileUnit, FileType } from './types';
import type { MaybeArray } from '../types';
export declare const tryParse: (v: unknown, schema: TAnySchema) => any;
export declare function createType<TSchema = unknown, TReturn = unknown>(kind: string, func: TypeRegistry.TypeRegistryValidationFunction<TSchema>): TUnsafe<TReturn>;
export declare const compile: <T extends TAnySchema>(schema: T) => (TypeCheck<T> & {
    Create(): T["static"];
    Error(v: unknown): asserts v is T["static"];
}) | {
    Check: (v: unknown) => v is (T & {
        params: [];
    })["static"];
    CheckThrow: (v: unknown) => void;
    Decode: (v: unknown) => import("@sinclair/typebox").StaticDecodeIsAny<T> extends true ? unknown : (import("@sinclair/typebox").TDecodeType<T> & {
        params: [];
    })["static"];
    Create: () => (T & {
        params: [];
    })["static"];
    Error: (v: unknown) => ValidationError;
};
export declare const parseFileUnit: (size: FileUnit) => number;
export declare const checkFileExtension: (type: string, extension: string) => boolean;
export declare const loadFileType: () => Promise<void | Function>;
export declare const fileTypeFromBlob: (file: Blob | File) => any;
export declare const fileType: (file: MaybeArray<Blob | File | undefined>, extension: FileType | FileType[], name?: any) => Promise<boolean>;
/**
 * This only check file extension based on it's name / mimetype
 * to actual check the file type, use `validateFileExtension` instead
 */
export declare const validateFile: (options: FileOptions, value: any) => boolean;
/**
 * Utility function to inherit add custom error and keep the original Validation error
 *
 * @since 1.3.14
 *
 * @example
 * ```ts
 * import { Elysia, t, errorWithDetail } from 'elysia'
 *
 * new Elysia()
 *		.post('/', () => 'Hello World!', {
 *			body: t.Object({
 *				x: t.Number({
 *					error: validationDetail('x must be a number')
 *				})
 *			})
 *		})
 */
export declare const validationDetail: <T>(message: T) => (error: Parameters<ElysiaTypeCustomErrorCallback>[0]) => {
    message: T;
    type: "validation";
    on: "body" | "query" | "params" | "headers" | "cookie" | "response";
    found: unknown;
    value: unknown;
    summary?: string;
    property?: string;
    expected?: unknown;
    errors: import("@sinclair/typebox/value").ValueError[];
};

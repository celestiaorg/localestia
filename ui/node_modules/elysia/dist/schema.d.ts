import { TModule, TObject, TSchema, type TAnySchema } from '@sinclair/typebox';
import { type Instruction as ExactMirrorInstruction } from 'exact-mirror';
import { type TypeCheck } from './type-system';
import { mapValueError } from './error';
import type { CookieOptions } from './cookies';
import type { ElysiaConfig, InputSchema, MaybeArray, StandaloneInputSchema, UnwrapSchema } from './types';
import type { StandardSchemaV1Like } from './types';
import { type ReplaceSchemaTypeOptions } from './replace-schema';
type MapValueError = ReturnType<typeof mapValueError>;
export interface ElysiaTypeCheck<T extends TSchema> extends Omit<TypeCheck<T>, 'schema'> {
    provider: 'typebox' | 'standard';
    schema: T;
    config: Object;
    Clean?(v: unknown): UnwrapSchema<T>;
    parse(v: unknown): UnwrapSchema<T>;
    safeParse(v: unknown): {
        success: true;
        data: UnwrapSchema<T>;
        error: null;
    } | {
        success: false;
        data: null;
        error: string | undefined;
        errors: MapValueError[];
    };
    hasAdditionalProperties: boolean;
    '~hasAdditionalProperties'?: boolean;
    hasDefault: boolean;
    '~hasDefault'?: boolean;
    isOptional: boolean;
    '~isOptional'?: boolean;
    hasTransform: boolean;
    '~hasTransform'?: boolean;
    hasRef: boolean;
    '~hasRef'?: boolean;
}
export declare const isOptional: (schema?: TSchema | TypeCheck<any> | ElysiaTypeCheck<any>) => any;
export declare const hasAdditionalProperties: (_schema: TAnySchema | TypeCheck<any> | ElysiaTypeCheck<any>) => boolean;
/**
 * Resolve a schema that might be a model reference (string) to the actual schema
 */
export declare const resolveSchema: (schema: TAnySchema | string | undefined, models?: Record<string, TAnySchema | StandardSchemaV1Like>, modules?: TModule<any, any>) => TAnySchema | StandardSchemaV1Like | undefined;
export declare const hasType: (type: string, schema: TAnySchema) => boolean;
export declare const hasElysiaMeta: (meta: string, _schema: TAnySchema) => boolean;
export declare const hasProperty: (expectedProperty: string, _schema: TAnySchema | TypeCheck<any> | ElysiaTypeCheck<any>) => boolean;
export declare const hasRef: (schema: TAnySchema) => boolean;
export declare const hasTransform: (schema: TAnySchema) => boolean;
export declare const getSchemaValidator: <T extends TSchema | StandardSchemaV1Like | string | undefined>(s: T, { models, dynamic, modules, normalize, additionalProperties, forceAdditionalProperties, coerce, additionalCoerce, validators, sanitize }?: {
    models?: Record<string, TSchema | StandardSchemaV1Like>;
    modules?: TModule<any, any>;
    additionalProperties?: boolean;
    forceAdditionalProperties?: boolean;
    dynamic?: boolean;
    normalize?: ElysiaConfig<"">["normalize"];
    coerce?: boolean;
    additionalCoerce?: MaybeArray<ReplaceSchemaTypeOptions>;
    validators?: InputSchema["body"][];
    sanitize?: () => ExactMirrorInstruction["sanitize"];
}) => T extends TSchema ? ElysiaTypeCheck<T> : undefined;
export declare const isUnion: (schema: TSchema) => boolean;
export declare const getSchemaProperties: (schema: TAnySchema | undefined) => Record<string, TAnySchema> | undefined;
export declare const mergeObjectSchemas: (schemas: TSchema[]) => {
    schema: TObject | undefined;
    notObjects: TSchema[];
};
export declare const getResponseSchemaValidator: (s: InputSchema["response"] | undefined, { models, modules, dynamic, normalize, additionalProperties, validators, sanitize }: {
    modules: TModule<any, any>;
    models?: Record<string, TSchema | StandardSchemaV1Like>;
    additionalProperties?: boolean;
    dynamic?: boolean;
    normalize?: ElysiaConfig<"">["normalize"];
    validators?: StandaloneInputSchema["response"][];
    sanitize?: () => ExactMirrorInstruction["sanitize"];
}) => Record<number, ElysiaTypeCheck<any>> | undefined;
export declare const getCookieValidator: ({ validator, modules, defaultConfig, config, dynamic, normalize, models, validators, sanitize }: {
    validator: TSchema | StandardSchemaV1Like | ElysiaTypeCheck<any> | string | undefined;
    modules: TModule<any, any>;
    defaultConfig: CookieOptions | undefined;
    config: CookieOptions;
    dynamic: boolean;
    normalize: ElysiaConfig<"">["normalize"] | undefined;
    models: Record<string, TSchema | StandardSchemaV1Like> | undefined;
    validators?: InputSchema["cookie"][];
    sanitize?: () => ExactMirrorInstruction["sanitize"];
}) => ElysiaTypeCheck<any>;
/**
 * This function will return the type of unioned if all unioned type is the same.
 * It's intent to use for content-type mapping only
 *
 * ```ts
 * t.Union([
 *   t.Object({
 *     password: t.String()
 *   }),
 *   t.Object({
 *     token: t.String()
 *   })
 * ])
 * ```
 */
export declare const unwrapImportSchema: (schema: TSchema) => TSchema;
export {};

import { type TAnySchema, type TSchema } from "@sinclair/typebox";
import type { MaybeArray } from "./types";
export interface ReplaceSchemaTypeOptions {
    from: TSchema;
    to(schema: TSchema): TSchema | null;
    excludeRoot?: boolean;
    rootOnly?: boolean;
    original?: TAnySchema;
    /**
     * Traverse until object is found except root object
     **/
    untilObjectFound?: boolean;
    /**
     * Only replace first object type, can be paired with excludeRoot
     **/
    onlyFirst?: "object" | "array" | (string & {});
}
/**
 * Replace schema types with custom transformation
 *
 * @param schema - The schema to transform
 * @param options - Transformation options (single or array)
 * @returns Transformed schema
 *
 * @example
 * // Transform Object to ObjectString
 * replaceSchemaType(schema, {
 *   from: t.Object({}),
 *   to: (s) => t.ObjectString(s.properties || {}, s),
 *   excludeRoot: true,
 *   onlyFirst: 'object'
 * })
 */
export declare const replaceSchemaTypeFromManyOptions: (schema: TSchema, options: MaybeArray<ReplaceSchemaTypeOptions>) => TSchema;
/**
 * Helper: Extract plain Object from ObjectString
 *
 * @example
 * ObjectString structure:
 * {
 *   elysiaMeta: "ObjectString",
 *   anyOf: [
 *     { type: "string", format: "ObjectString" },  // ← String branch
 *     { type: "object", properties: {...} }        // ← Object branch (we want this)
 *   ]
 * }
 * ArrayString structure:
 * {
 *   elysiaMeta: "ArrayString",
 *   anyOf: [
 *     { type: "string", format: "ArrayString" },  // ← String branch
 *     { type: "array", items: {...} }             // ← Array branch (we want this)
 *   ]
 * }
 */
export declare const revertObjAndArrStr: (schema: TSchema) => TSchema;
export declare const stringToStructureCoercions: () => ReplaceSchemaTypeOptions[];
export declare const queryCoercions: () => ReplaceSchemaTypeOptions[];
export declare const coercePrimitiveRoot: () => ReplaceSchemaTypeOptions[];
export declare const coerceFormData: () => ReplaceSchemaTypeOptions[];

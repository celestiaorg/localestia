import { Type, Kind } from "@sinclair/typebox";
import {
  compile,
  createType,
  loadFileType,
  tryParse,
  validateFile
} from "./utils.mjs";
import { ELYSIA_FORM_DATA, form } from "../utils.mjs";
import { ValidationError } from "../error.mjs";
import { parseDateTimeEmptySpace } from "./format.mjs";
const t = Object.assign({}, Type);
createType(
  "UnionEnum",
  (schema, value) => (typeof value == "number" || typeof value == "string" || value === null) && schema.enum.includes(value)
), createType(
  "ArrayBuffer",
  (schema, value) => value instanceof ArrayBuffer
);
const internalFiles = createType(
  "Files",
  (options, value) => {
    if (options.minItems && options.minItems > 1 && !Array.isArray(value))
      return !1;
    if (!Array.isArray(value)) return validateFile(options, value);
    if (options.minItems && value.length < options.minItems || options.maxItems && value.length > options.maxItems) return !1;
    for (let i = 0; i < value.length; i++)
      if (!validateFile(options, value[i])) return !1;
    return !0;
  }
), internalFormData = createType(
  "ElysiaForm",
  ({ compiler, ...schema }, value) => {
    if (!(value instanceof FormData)) return !1;
    if (compiler) {
      if (!(ELYSIA_FORM_DATA in value))
        throw new ValidationError("property", schema, value);
      if (!compiler.Check(value[ELYSIA_FORM_DATA]))
        throw compiler.Error(value[ELYSIA_FORM_DATA]);
    }
    return !0;
  }
), ElysiaType = {
  // @ts-ignore
  String: (property) => Type.String(property),
  Numeric: (property) => {
    const schema = Type.Number(property), compiler = compile(schema);
    return t.Transform(
      t.Union(
        [
          t.String({
            format: "numeric",
            default: 0
          }),
          t.Number(property)
        ],
        property
      )
    ).Decode((value) => {
      const number = +value;
      if (isNaN(number)) return value;
      if (property && !compiler.Check(number))
        throw compiler.Error(number);
      return number;
    }).Encode((value) => value);
  },
  NumericEnum(item, property) {
    const schema = Type.Enum(item, property), compiler = compile(schema);
    return t.Transform(
      t.Union([t.String({ format: "numeric" }), t.Number()], property)
    ).Decode((value) => {
      const number = +value;
      if (isNaN(number) || !compiler.Check(number)) throw compiler.Error(number);
      return number;
    }).Encode((value) => value);
  },
  Integer: (property) => {
    const schema = Type.Integer(property), compiler = compile(schema);
    return t.Transform(
      t.Union(
        [
          t.String({
            format: "integer",
            default: 0
          }),
          Type.Integer(property)
        ],
        property
      )
    ).Decode((value) => {
      const number = +value;
      if (!compiler.Check(number)) throw compiler.Error(number);
      return number;
    }).Encode((value) => value);
  },
  Date: (property) => {
    const schema = Type.Date(property), compiler = compile(schema), _default = property?.default ? new Date(property.default) : void 0;
    return t.Transform(
      t.Union(
        [
          Type.Date(property),
          t.String({
            format: "date-time",
            default: _default?.toISOString()
          }),
          t.String({
            format: "date",
            default: _default?.toISOString()
          }),
          t.Number({ default: _default?.getTime() })
        ],
        property
      )
    ).Decode((value) => {
      if (typeof value == "number") {
        const date2 = new Date(value);
        if (!compiler.Check(date2)) throw compiler.Error(date2);
        return date2;
      }
      if (value instanceof Date) return value;
      const date = new Date(parseDateTimeEmptySpace(value));
      if (!date || isNaN(date.getTime()))
        throw new ValidationError("property", schema, date);
      if (!compiler.Check(date)) throw compiler.Error(date);
      return date;
    }).Encode((value) => {
      if (value instanceof Date) return value.toISOString();
      if (typeof value == "string") {
        const parsed = new Date(parseDateTimeEmptySpace(value));
        if (isNaN(parsed.getTime()))
          throw new ValidationError("property", schema, value);
        return parsed.toISOString();
      }
      if (!compiler.Check(value)) throw compiler.Error(value);
      return value;
    });
  },
  BooleanString: (property) => {
    const schema = Type.Boolean(property), compiler = compile(schema);
    return t.Transform(
      t.Union(
        [
          t.Boolean(property),
          t.String({
            format: "boolean",
            default: !1
          })
        ],
        property
      )
    ).Decode((value) => {
      if (typeof value == "string") return value === "true";
      if (value !== void 0 && !compiler.Check(value))
        throw compiler.Error(value);
      return value;
    }).Encode((value) => value);
  },
  ObjectString: (properties, options) => {
    const schema = t.Object(properties, options), compiler = compile(schema);
    return t.Transform(
      t.Union(
        [
          t.String({
            format: "ObjectString",
            default: options?.default
          }),
          schema
        ],
        {
          elysiaMeta: "ObjectString"
        }
      )
    ).Decode((value) => {
      if (typeof value == "string") {
        if (value.charCodeAt(0) !== 123)
          throw new ValidationError("property", schema, value);
        if (!compiler.Check(value = tryParse(value, schema)))
          throw compiler.Error(value);
        return compiler.Decode(value);
      }
      return value;
    }).Encode((value) => {
      let original;
      if (typeof value == "string" && (value = tryParse(original = value, schema)), !compiler.Check(value)) throw compiler.Error(value);
      return original ?? JSON.stringify(value);
    });
  },
  ArrayString: (children = t.String(), options) => {
    const schema = t.Array(children, options), compiler = compile(schema), decode = (value, isProperty = !1) => {
      if (value.charCodeAt(0) === 91) {
        if (!compiler.Check(value = tryParse(value, schema)))
          throw compiler.Error(value);
        return compiler.Decode(value);
      }
      if (isProperty) return value;
      throw new ValidationError("property", schema, value);
    };
    return t.Transform(
      t.Union(
        [
          t.String({
            format: "ArrayString",
            default: options?.default
          }),
          schema
        ],
        {
          elysiaMeta: "ArrayString"
        }
      )
    ).Decode((value) => {
      if (Array.isArray(value)) {
        let values = [];
        for (let i = 0; i < value.length; i++) {
          const v = value[i];
          if (typeof v == "string") {
            const t2 = decode(v, !0);
            Array.isArray(t2) ? values = values.concat(t2) : values.push(t2);
            continue;
          }
          values.push(v);
        }
        return values;
      }
      return typeof value == "string" ? decode(value) : value;
    }).Encode((value) => {
      let original;
      if (typeof value == "string" && (value = tryParse(original = value, schema)), !compiler.Check(value))
        throw new ValidationError("property", schema, value);
      return original ?? JSON.stringify(value);
    });
  },
  ArrayQuery: (children = t.String(), options) => {
    const schema = t.Array(children, options), compiler = compile(schema), decode = (value) => value.indexOf(",") !== -1 ? compiler.Decode(value.split(",")) : compiler.Decode([value]);
    return t.Transform(
      t.Union(
        [
          t.String({
            default: options?.default
          }),
          schema
        ],
        {
          elysiaMeta: "ArrayQuery"
        }
      )
    ).Decode((value) => {
      if (Array.isArray(value)) {
        let values = [];
        for (let i = 0; i < value.length; i++) {
          const v = value[i];
          if (typeof v == "string") {
            const t2 = decode(v);
            Array.isArray(t2) ? values = values.concat(t2) : values.push(t2);
            continue;
          }
          values.push(v);
        }
        return values;
      }
      return typeof value == "string" ? decode(value) : value;
    }).Encode((value) => {
      let original;
      if (typeof value == "string" && (value = tryParse(original = value, schema)), !compiler.Check(value))
        throw new ValidationError("property", schema, value);
      return original ?? JSON.stringify(value);
    });
  },
  File: createType(
    "File",
    validateFile
  ),
  Files: (options = {}) => t.Transform(internalFiles(options)).Decode((value) => Array.isArray(value) ? value : [value]).Encode((value) => value),
  Nullable: (schema, options) => t.Union([schema, t.Null()], {
    ...options,
    nullable: !0
  }),
  /**
   * Allow Optional, Nullable and Undefined
   */
  MaybeEmpty: (schema, options) => t.Union([schema, t.Null(), t.Undefined()], options),
  Cookie: (properties, {
    domain,
    expires,
    httpOnly,
    maxAge,
    path,
    priority,
    sameSite,
    secure,
    secrets,
    sign,
    ...options
  } = {}) => {
    const v = t.Object(properties, options);
    return v.config = {
      domain,
      expires,
      httpOnly,
      maxAge,
      path,
      priority,
      sameSite,
      secure,
      secrets,
      sign
    }, v;
  },
  UnionEnum: (values, options = {}) => {
    const type = values.every((value) => typeof value == "string") ? { type: "string" } : values.every((value) => typeof value == "number") ? { type: "number" } : values.every((value) => value === null) ? { type: "null" } : {};
    if (values.some((x) => typeof x == "object" && x !== null))
      throw new Error("This type does not support objects or arrays");
    return {
      // default is need for generating error message
      default: values[0],
      ...options,
      [Kind]: "UnionEnum",
      ...type,
      enum: values
    };
  },
  NoValidate: (v, enabled = !0) => (v.noValidate = enabled, v),
  Form: (v, options = {}) => {
    const schema = t.Object(v, {
      default: form({}),
      ...options
    }), compiler = compile(schema);
    return t.Union([
      schema,
      // @ts-expect-error
      internalFormData({
        compiler
      })
    ]);
  },
  ArrayBuffer(options = {}) {
    return {
      // default is need for generating error message
      default: [1, 2, 3],
      ...options,
      [Kind]: "ArrayBuffer"
    };
  },
  Uint8Array: (options) => {
    const schema = Type.Uint8Array(options), compiler = compile(schema);
    return t.Transform(t.Union([t.ArrayBuffer(), Type.Uint8Array(options)])).Decode((value) => {
      if (value instanceof ArrayBuffer) {
        if (!compiler.Check(value = new Uint8Array(value)))
          throw compiler.Error(value);
        return value;
      }
      return value;
    }).Encode((value) => value);
  }
};
t.BooleanString = ElysiaType.BooleanString, t.ObjectString = ElysiaType.ObjectString, t.ArrayString = ElysiaType.ArrayString, t.ArrayQuery = ElysiaType.ArrayQuery, t.Numeric = ElysiaType.Numeric, t.NumericEnum = ElysiaType.NumericEnum, t.Integer = ElysiaType.Integer, t.File = (arg) => (arg?.type && loadFileType(), ElysiaType.File({
  default: "File",
  ...arg,
  extension: arg?.type,
  type: "string",
  format: "binary"
})), t.Files = (arg) => (arg?.type && loadFileType(), ElysiaType.Files({
  ...arg,
  elysiaMeta: "Files",
  default: "Files",
  extension: arg?.type,
  type: "array",
  items: {
    ...arg,
    default: "Files",
    type: "string",
    format: "binary"
  }
})), t.Nullable = ElysiaType.Nullable, t.MaybeEmpty = ElysiaType.MaybeEmpty, t.Cookie = ElysiaType.Cookie, t.Date = ElysiaType.Date, t.UnionEnum = ElysiaType.UnionEnum, t.NoValidate = ElysiaType.NoValidate, t.Form = ElysiaType.Form, t.ArrayBuffer = ElysiaType.ArrayBuffer, t.Uint8Array = ElysiaType.Uint8Array;
import {
  TypeSystemPolicy,
  TypeSystem,
  TypeSystemDuplicateFormat,
  TypeSystemDuplicateTypeKind
} from "@sinclair/typebox/system";
import { TypeRegistry, FormatRegistry } from "@sinclair/typebox";
import { TypeCompiler, TypeCheck } from "@sinclair/typebox/compiler";
export {
  ElysiaType,
  FormatRegistry,
  TypeCheck,
  TypeCompiler,
  TypeRegistry,
  TypeSystem,
  TypeSystemDuplicateFormat,
  TypeSystemDuplicateTypeKind,
  TypeSystemPolicy,
  t
};

import {
  Kind,
  OptionalKind,
  TransformKind
} from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import { TypeCompiler } from "@sinclair/typebox/compiler";
import {
  createMirror
} from "exact-mirror";
import { t } from "./type-system/index.mjs";
import { mergeCookie, mergeDeep, randomId } from "./utils.mjs";
import { mapValueError } from "./error.mjs";
import {
  replaceSchemaTypeFromManyOptions,
  stringToStructureCoercions
} from "./replace-schema.mjs";
const isOptional = (schema) => schema ? schema?.[Kind] === "Import" && schema.References ? schema.References().some(isOptional) : (schema.schema && (schema = schema.schema), !!schema && OptionalKind in schema) : !1, hasAdditionalProperties = (_schema) => {
  if (!_schema) return !1;
  const schema = _schema?.schema ?? _schema;
  if (schema[Kind] === "Import" && _schema.References)
    return _schema.References().some(hasAdditionalProperties);
  if (schema.anyOf) return schema.anyOf.some(hasAdditionalProperties);
  if (schema.someOf) return schema.someOf.some(hasAdditionalProperties);
  if (schema.allOf) return schema.allOf.some(hasAdditionalProperties);
  if (schema.not) return schema.not.some(hasAdditionalProperties);
  if (schema.type === "object") {
    const properties = schema.properties;
    if ("additionalProperties" in schema) return schema.additionalProperties;
    if ("patternProperties" in schema) return !1;
    for (const key of Object.keys(properties)) {
      const property = properties[key];
      if (property.type === "object") {
        if (hasAdditionalProperties(property)) return !0;
      } else if (property.anyOf) {
        for (let i = 0; i < property.anyOf.length; i++)
          if (hasAdditionalProperties(property.anyOf[i])) return !0;
      }
      return property.additionalProperties;
    }
    return !1;
  }
  return schema.type === "array" && schema.items && !Array.isArray(schema.items) ? hasAdditionalProperties(schema.items) : !1;
}, resolveSchema = (schema, models, modules) => {
  if (schema)
    return typeof schema != "string" ? schema : modules && schema in modules.$defs ? modules.Import(schema) : models?.[schema];
}, hasType = (type, schema) => {
  if (!schema) return !1;
  if (Kind in schema && schema[Kind] === type) return !0;
  if (Kind in schema && schema[Kind] === "Import" && schema.$defs && schema.$ref) {
    const ref = schema.$ref.replace("#/$defs/", "");
    if (schema.$defs[ref])
      return hasType(type, schema.$defs[ref]);
  }
  if (schema.anyOf) return schema.anyOf.some((s) => hasType(type, s));
  if (schema.oneOf) return schema.oneOf.some((s) => hasType(type, s));
  if (schema.allOf) return schema.allOf.some((s) => hasType(type, s));
  if (schema.type === "array" && schema.items)
    return type === "Files" && Kind in schema.items && schema.items[Kind] === "File" ? !0 : hasType(type, schema.items);
  if (schema.type === "object") {
    const properties = schema.properties;
    if (!properties) return !1;
    for (const key of Object.keys(properties))
      if (hasType(type, properties[key])) return !0;
  }
  return !1;
}, hasElysiaMeta = (meta, _schema) => {
  if (!_schema) return !1;
  const schema = _schema?.schema ?? _schema;
  if (schema.elysiaMeta === meta) return !0;
  if (schema[Kind] === "Import" && _schema.References)
    return _schema.References().some((schema2) => hasElysiaMeta(meta, schema2));
  if (schema.anyOf)
    return schema.anyOf.some(
      (schema2) => hasElysiaMeta(meta, schema2)
    );
  if (schema.someOf)
    return schema.someOf.some(
      (schema2) => hasElysiaMeta(meta, schema2)
    );
  if (schema.allOf)
    return schema.allOf.some(
      (schema2) => hasElysiaMeta(meta, schema2)
    );
  if (schema.not)
    return schema.not.some((schema2) => hasElysiaMeta(meta, schema2));
  if (schema.type === "object") {
    const properties = schema.properties;
    if (!properties) return !1;
    for (const key of Object.keys(properties)) {
      const property = properties[key];
      if (property.type === "object") {
        if (hasElysiaMeta(meta, property)) return !0;
      } else if (property.anyOf) {
        for (let i = 0; i < property.anyOf.length; i++)
          if (hasElysiaMeta(meta, property.anyOf[i])) return !0;
      }
      return schema.elysiaMeta === meta;
    }
    return !1;
  }
  return schema.type === "array" && schema.items && !Array.isArray(schema.items) ? hasElysiaMeta(meta, schema.items) : !1;
}, hasProperty = (expectedProperty, _schema) => {
  if (!_schema) return !1;
  const schema = _schema.schema ?? _schema;
  if (schema[Kind] === "Import" && _schema.References)
    return _schema.References().some((schema2) => hasProperty(expectedProperty, schema2));
  if (schema.anyOf)
    return schema.anyOf.some(
      (s) => hasProperty(expectedProperty, s)
    );
  if (schema.allOf)
    return schema.allOf.some(
      (s) => hasProperty(expectedProperty, s)
    );
  if (schema.oneOf)
    return schema.oneOf.some(
      (s) => hasProperty(expectedProperty, s)
    );
  if (schema.type === "object") {
    const properties = schema.properties;
    if (!properties) return !1;
    for (const key of Object.keys(properties)) {
      const property = properties[key];
      if (expectedProperty in property) return !0;
      if (property.type === "object") {
        if (hasProperty(expectedProperty, property)) return !0;
      } else if (property.anyOf) {
        for (let i = 0; i < property.anyOf.length; i++)
          if (hasProperty(expectedProperty, property.anyOf[i]))
            return !0;
      }
    }
    return !1;
  }
  return expectedProperty in schema;
}, hasRef = (schema) => {
  if (!schema) return !1;
  if (schema.oneOf) {
    for (let i = 0; i < schema.oneOf.length; i++)
      if (hasRef(schema.oneOf[i])) return !0;
  }
  if (schema.anyOf) {
    for (let i = 0; i < schema.anyOf.length; i++)
      if (hasRef(schema.anyOf[i])) return !0;
  }
  if (schema.oneOf) {
    for (let i = 0; i < schema.oneOf.length; i++)
      if (hasRef(schema.oneOf[i])) return !0;
  }
  if (schema.allOf) {
    for (let i = 0; i < schema.allOf.length; i++)
      if (hasRef(schema.allOf[i])) return !0;
  }
  if (schema.not && hasRef(schema.not)) return !0;
  if (schema.type === "object" && schema.properties) {
    const properties = schema.properties;
    for (const key of Object.keys(properties)) {
      const property = properties[key];
      if (hasRef(property) || property.type === "array" && property.items && hasRef(property.items))
        return !0;
    }
  }
  return schema.type === "array" && schema.items && hasRef(schema.items) ? !0 : schema[Kind] === "Ref" && "$ref" in schema;
}, hasTransform = (schema) => {
  if (!schema) return !1;
  if (schema.$ref && schema.$defs && schema.$ref in schema.$defs && hasTransform(schema.$defs[schema.$ref]))
    return !0;
  if (schema.oneOf) {
    for (let i = 0; i < schema.oneOf.length; i++)
      if (hasTransform(schema.oneOf[i])) return !0;
  }
  if (schema.anyOf) {
    for (let i = 0; i < schema.anyOf.length; i++)
      if (hasTransform(schema.anyOf[i])) return !0;
  }
  if (schema.allOf) {
    for (let i = 0; i < schema.allOf.length; i++)
      if (hasTransform(schema.allOf[i])) return !0;
  }
  if (schema.not && hasTransform(schema.not)) return !0;
  if (schema.type === "object" && schema.properties) {
    const properties = schema.properties;
    for (const key of Object.keys(properties)) {
      const property = properties[key];
      if (hasTransform(property) || property.type === "array" && property.items && hasTransform(property.items))
        return !0;
    }
  }
  return schema.type === "array" && schema.items && hasTransform(schema.items) ? !0 : TransformKind in schema;
}, createCleaner = (schema) => (value) => {
  if (typeof value == "object")
    try {
      return Value.Clean(schema, value);
    } catch {
    }
  return value;
}, getSchemaValidator = (s, {
  models = {},
  dynamic = !1,
  modules,
  normalize = !1,
  additionalProperties = !1,
  forceAdditionalProperties = !1,
  coerce = !1,
  additionalCoerce = [],
  validators,
  sanitize
} = {}) => {
  if (validators = validators?.filter((x) => x), !s) {
    if (!validators?.length) return;
    s = validators[0], validators = validators.slice(1);
  }
  let doesHaveRef;
  const replaceSchema = (schema2) => coerce ? replaceSchemaTypeFromManyOptions(schema2, [
    {
      from: t.Number(),
      to: (options) => t.Numeric(options),
      untilObjectFound: !0
    },
    {
      from: t.Boolean(),
      to: (options) => t.BooleanString(options),
      untilObjectFound: !0
    },
    ...Array.isArray(additionalCoerce) ? additionalCoerce : [additionalCoerce]
  ]) : replaceSchemaTypeFromManyOptions(schema2, additionalCoerce), mapSchema = (s2) => {
    if (s2 && typeof s2 != "string" && "~standard" in s2)
      return s2;
    if (!s2) return;
    let schema2;
    if (typeof s2 != "string") schema2 = s2;
    else if (schema2 = // @ts-expect-error private property
    modules && s2 in modules.$defs ? modules.Import(s2) : models[s2], !schema2) return;
    const hasAdditionalCoerce = Array.isArray(additionalCoerce) ? additionalCoerce.length > 0 : !!additionalCoerce;
    if (Kind in schema2)
      if (schema2[Kind] === "Import")
        hasRef(schema2.$defs[schema2.$ref]) || (schema2 = schema2.$defs[schema2.$ref] ?? models[schema2.$ref], (coerce || hasAdditionalCoerce) && (schema2 = replaceSchema(schema2), "$id" in schema2 && !schema2.$defs && (schema2.$id = `${schema2.$id}_coerced_${randomId()}`)));
      else if (hasRef(schema2)) {
        const id = randomId();
        schema2 = t.Module({
          // @ts-expect-error private property
          ...modules?.$defs,
          [id]: schema2
        }).Import(id);
      } else (coerce || hasAdditionalCoerce) && (schema2 = replaceSchema(schema2));
    return schema2;
  };
  let schema = mapSchema(s), _validators = validators;
  if ("~standard" in schema || validators?.length && validators.some(
    (x) => x && typeof x != "string" && "~standard" in x
  )) {
    const typeboxSubValidator = (schema2) => {
      let mirror;
      if (normalize === !0 || normalize === "exactMirror")
        try {
          mirror = createMirror(schema2, {
            TypeCompiler,
            sanitize: sanitize?.(),
            modules
          });
        } catch {
          console.warn(
            "Failed to create exactMirror. Please report the following code to https://github.com/elysiajs/elysia/issues"
          ), console.warn(schema2), mirror = createCleaner(schema2);
        }
      const vali = getSchemaValidator(schema2, {
        models,
        modules,
        dynamic,
        normalize,
        additionalProperties: !0,
        forceAdditionalProperties: !0,
        coerce,
        additionalCoerce
      });
      return vali.Decode = mirror, (v) => vali.Check(v) ? {
        value: vali.Decode(v)
      } : {
        issues: [...vali.Errors(v)]
      };
    }, mainCheck = schema["~standard"] ? schema["~standard"].validate : typeboxSubValidator(schema);
    let checkers = [];
    if (validators?.length) {
      for (const validator2 of validators)
        if (validator2 && typeof validator2 != "string") {
          if (validator2?.["~standard"]) {
            checkers.push(validator2["~standard"]);
            continue;
          }
          if (Kind in validator2) {
            checkers.push(typeboxSubValidator(validator2));
            continue;
          }
        }
    }
    async function Check(value) {
      let v = mainCheck(value);
      if (v instanceof Promise && (v = await v), v.issues) return v;
      const values = [];
      v && typeof v == "object" && values.push(v.value);
      for (let i = 0; i < checkers.length; i++) {
        if (v = checkers[i].validate(value), v instanceof Promise && (v = await v), v.issues) return v;
        v && typeof v == "object" && values.push(v.value);
      }
      if (!values.length) return { value: v };
      if (values.length === 1) return { value: values[0] };
      if (values.length === 2)
        return { value: mergeDeep(values[0], values[1]) };
      let newValue = mergeDeep(values[0], values[1]);
      for (let i = 2; i < values.length; i++)
        newValue = mergeDeep(newValue, values[i]);
      return { value: newValue };
    }
    const validator = {
      provider: "standard",
      schema,
      references: "",
      checkFunc: () => {
      },
      code: "",
      // @ts-ignore
      Check,
      // @ts-ignore
      Errors: (value) => Check(value)?.then?.((x) => x?.issues),
      Code: () => "",
      // @ts-ignore
      Decode: Check,
      // @ts-ignore
      Encode: (value) => value,
      hasAdditionalProperties: !1,
      hasDefault: !1,
      isOptional: !1,
      hasTransform: !1,
      hasRef: !1
    };
    return validator.parse = (v) => {
      try {
        return validator.Decode(validator.Clean?.(v) ?? v);
      } catch {
        throw [...validator.Errors(v)].map(mapValueError);
      }
    }, validator.safeParse = (v) => {
      try {
        return {
          success: !0,
          data: validator.Decode(validator.Clean?.(v) ?? v),
          error: null
        };
      } catch {
        const errors = [...compiled.Errors(v)].map(mapValueError);
        return {
          success: !1,
          data: null,
          error: errors[0]?.summary,
          errors
        };
      }
    }, validator;
  } else if (validators?.length) {
    let hasAdditional = !1;
    const validators2 = _validators, { schema: mergedObjectSchema, notObjects } = mergeObjectSchemas([
      schema,
      ...validators2.map(mapSchema)
    ]);
    notObjects && (schema = t.Intersect([
      ...mergedObjectSchema ? [mergedObjectSchema] : [],
      ...notObjects.map((x) => {
        const schema2 = mapSchema(x);
        return schema2.type === "object" && "additionalProperties" in schema2 && (!hasAdditional && schema2.additionalProperties === !1 && (hasAdditional = !0), delete schema2.additionalProperties), schema2;
      })
    ]), schema.type === "object" && hasAdditional && (schema.additionalProperties = !1));
  } else
    schema.type === "object" && (!("additionalProperties" in schema) || forceAdditionalProperties) ? schema.additionalProperties = additionalProperties : schema = replaceSchemaTypeFromManyOptions(schema, {
      onlyFirst: "object",
      from: t.Object({}),
      to(schema2) {
        return !schema2.properties || "additionalProperties" in schema2 ? schema2 : t.Object(schema2.properties, {
          ...schema2,
          additionalProperties: !1
        });
      }
    });
  if (dynamic)
    if (Kind in schema) {
      const validator = {
        provider: "typebox",
        schema,
        references: "",
        checkFunc: () => {
        },
        code: "",
        // @ts-expect-error
        Check: (value) => Value.Check(schema, value),
        Errors: (value) => Value.Errors(schema, value),
        Code: () => "",
        Clean: createCleaner(schema),
        Decode: (value) => Value.Decode(schema, value),
        Encode: (value) => Value.Encode(schema, value),
        get hasAdditionalProperties() {
          return "~hasAdditionalProperties" in this ? this["~hasAdditionalProperties"] : this["~hasAdditionalProperties"] = hasAdditionalProperties(schema);
        },
        get hasDefault() {
          return "~hasDefault" in this ? this["~hasDefault"] : this["~hasDefault"] = hasProperty(
            "default",
            schema
          );
        },
        get isOptional() {
          return "~isOptional" in this ? this["~isOptional"] : this["~isOptional"] = isOptional(schema);
        },
        get hasTransform() {
          return "~hasTransform" in this ? this["~hasTransform"] : this["~hasTransform"] = hasTransform(schema);
        },
        "~hasRef": doesHaveRef,
        get hasRef() {
          return "~hasRef" in this ? this["~hasRef"] : this["~hasRef"] = hasTransform(schema);
        }
      };
      if (schema.config && (validator.config = schema.config, validator?.schema?.config && delete validator.schema.config), normalize && schema.additionalProperties === !1)
        if (normalize === !0 || normalize === "exactMirror")
          try {
            validator.Clean = createMirror(schema, {
              TypeCompiler,
              sanitize: sanitize?.(),
              modules
            });
          } catch {
            console.warn(
              "Failed to create exactMirror. Please report the following code to https://github.com/elysiajs/elysia/issues"
            ), console.warn(schema), validator.Clean = createCleaner(schema);
          }
        else validator.Clean = createCleaner(schema);
      return validator.parse = (v) => {
        try {
          return validator.Decode(validator.Clean?.(v) ?? v);
        } catch {
          throw [...validator.Errors(v)].map(mapValueError);
        }
      }, validator.safeParse = (v) => {
        try {
          return {
            success: !0,
            data: validator.Decode(validator.Clean?.(v) ?? v),
            error: null
          };
        } catch {
          const errors = [...compiled.Errors(v)].map(mapValueError);
          return {
            success: !1,
            data: null,
            error: errors[0]?.summary,
            errors
          };
        }
      }, validator;
    } else {
      const validator = {
        provider: "standard",
        schema,
        references: "",
        checkFunc: () => {
        },
        code: "",
        // @ts-ignore
        Check: (v) => schema["~standard"].validate(v),
        // @ts-ignore
        Errors(value) {
          const response = schema["~standard"].validate(value);
          if (response instanceof Promise)
            throw Error(
              "Async validation is not supported in non-dynamic schema"
            );
          return response.issues;
        },
        Code: () => "",
        // @ts-ignore
        Decode(value) {
          const response = schema["~standard"].validate(value);
          if (response instanceof Promise)
            throw Error(
              "Async validation is not supported in non-dynamic schema"
            );
          return response;
        },
        // @ts-ignore
        Encode: (value) => value,
        hasAdditionalProperties: !1,
        hasDefault: !1,
        isOptional: !1,
        hasTransform: !1,
        hasRef: !1
      };
      return validator.parse = (v) => {
        try {
          return validator.Decode(validator.Clean?.(v) ?? v);
        } catch {
          throw [...validator.Errors(v)].map(mapValueError);
        }
      }, validator.safeParse = (v) => {
        try {
          return {
            success: !0,
            data: validator.Decode(validator.Clean?.(v) ?? v),
            error: null
          };
        } catch {
          const errors = [...compiled.Errors(v)].map(mapValueError);
          return {
            success: !1,
            data: null,
            error: errors[0]?.summary,
            errors
          };
        }
      }, validator;
    }
  let compiled;
  if (Kind in schema)
    if (compiled = TypeCompiler.Compile(
      schema,
      Object.values(models).filter((x) => Kind in x)
    ), compiled.provider = "typebox", schema.config && (compiled.config = schema.config, compiled?.schema?.config && delete compiled.schema.config), normalize === !0 || normalize === "exactMirror")
      try {
        compiled.Clean = createMirror(schema, {
          TypeCompiler,
          sanitize: sanitize?.(),
          modules
        });
      } catch {
        console.warn(
          "Failed to create exactMirror. Please report the following code to https://github.com/elysiajs/elysia/issues"
        ), console.dir(schema, {
          depth: null
        }), compiled.Clean = createCleaner(schema);
      }
    else normalize === "typebox" && (compiled.Clean = createCleaner(schema));
  else
    compiled = {
      provider: "standard",
      schema,
      references: "",
      checkFunc(value) {
        const response = schema["~standard"].validate(value);
        if (response instanceof Promise)
          throw Error(
            "Async validation is not supported in non-dynamic schema"
          );
        return response;
      },
      code: "",
      // @ts-ignore
      Check: (v) => schema["~standard"].validate(v),
      // @ts-ignore
      Errors(value) {
        const response = schema["~standard"].validate(value);
        if (response instanceof Promise)
          throw Error(
            "Async validation is not supported in non-dynamic schema"
          );
        return response.issues;
      },
      Code: () => "",
      // @ts-ignore
      Decode(value) {
        const response = schema["~standard"].validate(value);
        if (response instanceof Promise)
          throw Error(
            "Async validation is not supported in non-dynamic schema"
          );
        return response;
      },
      // @ts-ignore
      Encode: (value) => value,
      hasAdditionalProperties: !1,
      hasDefault: !1,
      isOptional: !1,
      hasTransform: !1,
      hasRef: !1
    };
  return compiled.parse = (v) => {
    try {
      return compiled.Decode(compiled.Clean?.(v) ?? v);
    } catch {
      throw [...compiled.Errors(v)].map(mapValueError);
    }
  }, compiled.safeParse = (v) => {
    try {
      return {
        success: !0,
        data: compiled.Decode(compiled.Clean?.(v) ?? v),
        error: null
      };
    } catch {
      const errors = [...compiled.Errors(v)].map(mapValueError);
      return {
        success: !1,
        data: null,
        error: errors[0]?.summary,
        errors
      };
    }
  }, Kind in schema && Object.assign(compiled, {
    get hasAdditionalProperties() {
      return "~hasAdditionalProperties" in this ? this["~hasAdditionalProperties"] : this["~hasAdditionalProperties"] = hasAdditionalProperties(compiled);
    },
    get hasDefault() {
      return "~hasDefault" in this ? this["~hasDefault"] : this["~hasDefault"] = hasProperty("default", compiled);
    },
    get isOptional() {
      return "~isOptional" in this ? this["~isOptional"] : this["~isOptional"] = isOptional(compiled);
    },
    get hasTransform() {
      return "~hasTransform" in this ? this["~hasTransform"] : this["~hasTransform"] = hasTransform(schema);
    },
    get hasRef() {
      return "~hasRef" in this ? this["~hasRef"] : this["~hasRef"] = hasRef(schema);
    },
    "~hasRef": doesHaveRef
  }), compiled;
}, isUnion = (schema) => schema[Kind] === "Union" || !schema.schema && !!schema.anyOf, getSchemaProperties = (schema) => {
  if (!schema) return;
  if (schema.properties) return schema.properties;
  const members = schema.allOf ?? schema.anyOf ?? schema.oneOf;
  if (members) {
    const result = {};
    for (const member of members) {
      const props = getSchemaProperties(member);
      props && Object.assign(result, props);
    }
    return Object.keys(result).length > 0 ? result : void 0;
  }
}, mergeObjectSchemas = (schemas) => {
  if (schemas.length === 0)
    return {
      schema: void 0,
      notObjects: []
    };
  if (schemas.length === 1)
    return schemas[0].type === "object" ? {
      schema: schemas[0],
      notObjects: []
    } : {
      schema: void 0,
      notObjects: schemas
    };
  let newSchema;
  const notObjects = [];
  let additionalPropertiesIsTrue = !1, additionalPropertiesIsFalse = !1;
  for (const schema of schemas) {
    if (schema.type !== "object") {
      notObjects.push(schema);
      continue;
    }
    if ("additionalProperties" in schema && (schema.additionalProperties === !0 ? additionalPropertiesIsTrue = !0 : schema.additionalProperties === !1 && (additionalPropertiesIsFalse = !0)), !newSchema) {
      newSchema = schema;
      continue;
    }
    newSchema = {
      ...newSchema,
      ...schema,
      properties: {
        ...newSchema.properties,
        ...schema.properties
      },
      required: [
        ...newSchema?.required ?? [],
        ...schema.required ?? []
      ]
    };
  }
  return newSchema && (newSchema.required && (newSchema.required = [...new Set(newSchema.required)]), additionalPropertiesIsFalse ? newSchema.additionalProperties = !1 : additionalPropertiesIsTrue && (newSchema.additionalProperties = !0)), {
    schema: newSchema,
    notObjects
  };
}, getResponseSchemaValidator = (s, {
  models = {},
  modules,
  dynamic = !1,
  normalize = !1,
  additionalProperties = !1,
  validators = [],
  sanitize
}) => {
  if (validators = validators.filter((x) => x), !s) {
    if (!validators?.length) return;
    s = validators[0], validators = validators.slice(1);
  }
  let maybeSchemaOrRecord;
  if (typeof s != "string") maybeSchemaOrRecord = s;
  else if (maybeSchemaOrRecord = // @ts-expect-error private property
  modules && s in modules.$defs ? modules.Import(s) : models[s], !maybeSchemaOrRecord) return;
  if (!maybeSchemaOrRecord) return;
  if (Kind in maybeSchemaOrRecord || "~standard" in maybeSchemaOrRecord)
    return {
      200: getSchemaValidator(
        maybeSchemaOrRecord,
        {
          modules,
          models,
          additionalProperties,
          dynamic,
          normalize,
          coerce: !1,
          additionalCoerce: [],
          validators: validators.map((x) => x[200]),
          sanitize
        }
      )
    };
  const record = {};
  return Object.keys(maybeSchemaOrRecord).forEach((status) => {
    if (isNaN(+status)) return;
    const maybeNameOrSchema = maybeSchemaOrRecord[+status];
    if (typeof maybeNameOrSchema == "string") {
      if (maybeNameOrSchema in models) {
        const schema = models[maybeNameOrSchema];
        if (!schema) return;
        record[+status] = Kind in schema || "~standard" in schema ? getSchemaValidator(schema, {
          modules,
          models,
          additionalProperties,
          dynamic,
          normalize,
          coerce: !1,
          additionalCoerce: [],
          validators: validators.map((x) => x[+status]),
          sanitize
        }) : schema;
      }
      return;
    }
    record[+status] = Kind in maybeNameOrSchema || "~standard" in maybeNameOrSchema ? getSchemaValidator(maybeNameOrSchema, {
      modules,
      models,
      additionalProperties,
      dynamic,
      normalize,
      coerce: !1,
      additionalCoerce: [],
      validators: validators.map((x) => x[+status]),
      sanitize
    }) : maybeNameOrSchema;
  }), record;
}, getCookieValidator = ({
  validator,
  modules,
  defaultConfig = {},
  config,
  dynamic,
  normalize = !1,
  models,
  validators,
  sanitize
}) => {
  let cookieValidator = (
    // @ts-ignore
    validator?.provider ? validator : (
      // @ts-ignore
      getSchemaValidator(validator, {
        modules,
        dynamic,
        models,
        normalize,
        additionalProperties: !0,
        coerce: !0,
        additionalCoerce: stringToStructureCoercions(),
        validators,
        sanitize
      })
    )
  );
  return cookieValidator ? cookieValidator.config = mergeCookie(cookieValidator.config, config) : (cookieValidator = getSchemaValidator(t.Cookie(t.Any()), {
    modules,
    dynamic,
    models,
    additionalProperties: !0,
    validators,
    sanitize
  }), cookieValidator.config = defaultConfig), cookieValidator;
}, unwrapImportSchema = (schema) => schema && schema[Kind] === "Import" && schema.$defs[schema.$ref][Kind] === "Object" ? schema.$defs[schema.$ref] : schema;
export {
  getCookieValidator,
  getResponseSchemaValidator,
  getSchemaProperties,
  getSchemaValidator,
  hasAdditionalProperties,
  hasElysiaMeta,
  hasProperty,
  hasRef,
  hasTransform,
  hasType,
  isOptional,
  isUnion,
  mergeObjectSchemas,
  resolveSchema,
  unwrapImportSchema
};

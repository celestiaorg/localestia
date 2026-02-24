"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: !0 });
}, __copyProps = (to, from, except, desc) => {
  if (from && typeof from == "object" || typeof from == "function")
    for (let key of __getOwnPropNames(from))
      !__hasOwnProp.call(to, key) && key !== except && __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: !0 }), mod);
var replace_schema_exports = {};
__export(replace_schema_exports, {
  coerceFormData: () => coerceFormData,
  coercePrimitiveRoot: () => coercePrimitiveRoot,
  queryCoercions: () => queryCoercions,
  replaceSchemaTypeFromManyOptions: () => replaceSchemaTypeFromManyOptions,
  revertObjAndArrStr: () => revertObjAndArrStr,
  stringToStructureCoercions: () => stringToStructureCoercions
});
module.exports = __toCommonJS(replace_schema_exports);
var import_typebox = require("@sinclair/typebox"), import_type_system = require('./type-system/index.js');
const replaceSchemaTypeFromManyOptions = (schema, options) => {
  if (Array.isArray(options)) {
    let result = schema;
    for (const option of options)
      result = replaceSchemaTypeFromOption(result, option);
    return result;
  }
  return replaceSchemaTypeFromOption(schema, options);
}, replaceSchemaTypeFromOption = (schema, option) => {
  if (option.rootOnly && option.excludeRoot)
    throw new Error("Can't set both rootOnly and excludeRoot");
  if (option.rootOnly && option.onlyFirst)
    throw new Error("Can't set both rootOnly and onlyFirst");
  if (option.rootOnly && option.untilObjectFound)
    throw new Error("Can't set both rootOnly and untilObjectFound");
  const walk = ({ s, isRoot, treeLvl }) => {
    if (!s) return s;
    const skipRoot = isRoot && option.excludeRoot, fromKind = option.from[import_typebox.Kind];
    if (s.elysiaMeta)
      return option.from.elysiaMeta === s.elysiaMeta && !skipRoot ? option.to(s) : s;
    const shouldTransform = fromKind && s[import_typebox.Kind] === fromKind;
    if (!skipRoot && option.onlyFirst && s.type === option.onlyFirst || isRoot && option.rootOnly)
      return shouldTransform ? option.to(s) : s;
    if (!isRoot && option.untilObjectFound && s.type === "object")
      return s;
    const newWalkInput = { isRoot: !1, treeLvl: treeLvl + 1 }, withTransformedChildren = { ...s };
    if (s.oneOf && (withTransformedChildren.oneOf = s.oneOf.map(
      (x) => walk({ ...newWalkInput, s: x })
    )), s.anyOf && (withTransformedChildren.anyOf = s.anyOf.map(
      (x) => walk({ ...newWalkInput, s: x })
    )), s.allOf && (withTransformedChildren.allOf = s.allOf.map(
      (x) => walk({ ...newWalkInput, s: x })
    )), s.not && (withTransformedChildren.not = walk({ ...newWalkInput, s: s.not })), s.properties) {
      withTransformedChildren.properties = {};
      for (const [k, v] of Object.entries(s.properties))
        withTransformedChildren.properties[k] = walk({
          ...newWalkInput,
          s: v
        });
    }
    if (s.items) {
      const items = s.items;
      withTransformedChildren.items = Array.isArray(items) ? items.map((x) => walk({ ...newWalkInput, s: x })) : walk({ ...newWalkInput, s: items });
    }
    return !skipRoot && fromKind && withTransformedChildren[import_typebox.Kind] === fromKind ? option.to(withTransformedChildren) : withTransformedChildren;
  };
  return walk({ s: schema, isRoot: !0, treeLvl: 0 });
}, revertObjAndArrStr = (schema) => {
  if (schema.elysiaMeta !== "ObjectString" && schema.elysiaMeta !== "ArrayString")
    return schema;
  const anyOf = schema.anyOf;
  return anyOf?.[1] ? anyOf[1] : schema;
};
let _stringToStructureCoercions;
const stringToStructureCoercions = () => (_stringToStructureCoercions || (_stringToStructureCoercions = [
  {
    from: import_type_system.t.Object({}),
    to: (schema) => import_type_system.t.ObjectString(schema.properties || {}, schema),
    excludeRoot: !0
  },
  {
    from: import_type_system.t.Array(import_type_system.t.Any()),
    to: (schema) => import_type_system.t.ArrayString(schema.items || import_type_system.t.Any(), schema)
  }
]), _stringToStructureCoercions);
let _queryCoercions;
const queryCoercions = () => (_queryCoercions || (_queryCoercions = [
  {
    from: import_type_system.t.Object({}),
    to: (schema) => import_type_system.t.ObjectString(schema.properties ?? {}, schema),
    excludeRoot: !0
  },
  {
    from: import_type_system.t.Array(import_type_system.t.Any()),
    to: (schema) => import_type_system.t.ArrayQuery(schema.items ?? import_type_system.t.Any(), schema)
  }
]), _queryCoercions);
let _coercePrimitiveRoot;
const coercePrimitiveRoot = () => (_coercePrimitiveRoot || (_coercePrimitiveRoot = [
  {
    from: import_type_system.t.Number(),
    to: (schema) => import_type_system.t.Numeric(schema),
    rootOnly: !0
  },
  {
    from: import_type_system.t.Boolean(),
    to: (schema) => import_type_system.t.BooleanString(schema),
    rootOnly: !0
  }
]), _coercePrimitiveRoot);
let _coerceFormData;
const coerceFormData = () => (_coerceFormData || (_coerceFormData = [
  {
    from: import_type_system.t.Object({}),
    to: (schema) => import_type_system.t.ObjectString(schema.properties ?? {}, schema),
    onlyFirst: "object",
    excludeRoot: !0
  },
  {
    from: import_type_system.t.Array(import_type_system.t.Any()),
    to: (schema) => import_type_system.t.ArrayString(schema.items ?? import_type_system.t.Any(), schema),
    onlyFirst: "array",
    excludeRoot: !0
  }
]), _coerceFormData);
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  coerceFormData,
  coercePrimitiveRoot,
  queryCoercions,
  replaceSchemaTypeFromManyOptions,
  revertObjAndArrStr,
  stringToStructureCoercions
});

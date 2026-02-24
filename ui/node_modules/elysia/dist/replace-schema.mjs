import { Kind } from "@sinclair/typebox";
import { t } from "./type-system/index.mjs";
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
    const skipRoot = isRoot && option.excludeRoot, fromKind = option.from[Kind];
    if (s.elysiaMeta)
      return option.from.elysiaMeta === s.elysiaMeta && !skipRoot ? option.to(s) : s;
    const shouldTransform = fromKind && s[Kind] === fromKind;
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
    return !skipRoot && fromKind && withTransformedChildren[Kind] === fromKind ? option.to(withTransformedChildren) : withTransformedChildren;
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
    from: t.Object({}),
    to: (schema) => t.ObjectString(schema.properties || {}, schema),
    excludeRoot: !0
  },
  {
    from: t.Array(t.Any()),
    to: (schema) => t.ArrayString(schema.items || t.Any(), schema)
  }
]), _stringToStructureCoercions);
let _queryCoercions;
const queryCoercions = () => (_queryCoercions || (_queryCoercions = [
  {
    from: t.Object({}),
    to: (schema) => t.ObjectString(schema.properties ?? {}, schema),
    excludeRoot: !0
  },
  {
    from: t.Array(t.Any()),
    to: (schema) => t.ArrayQuery(schema.items ?? t.Any(), schema)
  }
]), _queryCoercions);
let _coercePrimitiveRoot;
const coercePrimitiveRoot = () => (_coercePrimitiveRoot || (_coercePrimitiveRoot = [
  {
    from: t.Number(),
    to: (schema) => t.Numeric(schema),
    rootOnly: !0
  },
  {
    from: t.Boolean(),
    to: (schema) => t.BooleanString(schema),
    rootOnly: !0
  }
]), _coercePrimitiveRoot);
let _coerceFormData;
const coerceFormData = () => (_coerceFormData || (_coerceFormData = [
  {
    from: t.Object({}),
    to: (schema) => t.ObjectString(schema.properties ?? {}, schema),
    onlyFirst: "object",
    excludeRoot: !0
  },
  {
    from: t.Array(t.Any()),
    to: (schema) => t.ArrayString(schema.items ?? t.Any(), schema),
    onlyFirst: "array",
    excludeRoot: !0
  }
]), _coerceFormData);
export {
  coerceFormData,
  coercePrimitiveRoot,
  queryCoercions,
  replaceSchemaTypeFromManyOptions,
  revertObjAndArrStr,
  stringToStructureCoercions
};

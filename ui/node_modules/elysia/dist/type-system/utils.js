"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf, __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: !0 });
}, __copyProps = (to, from, except, desc) => {
  if (from && typeof from == "object" || typeof from == "function")
    for (let key of __getOwnPropNames(from))
      !__hasOwnProp.call(to, key) && key !== except && __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: !0 }) : target,
  mod
)), __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: !0 }), mod);
var utils_exports = {};
__export(utils_exports, {
  checkFileExtension: () => checkFileExtension,
  compile: () => compile,
  createType: () => createType,
  fileType: () => fileType,
  fileTypeFromBlob: () => fileTypeFromBlob,
  loadFileType: () => loadFileType,
  parseFileUnit: () => parseFileUnit,
  tryParse: () => tryParse,
  validateFile: () => validateFile,
  validationDetail: () => validationDetail
});
module.exports = __toCommonJS(utils_exports);
var import_typebox = require("@sinclair/typebox"), import_value = require("@sinclair/typebox/value"), import_compiler = require("@sinclair/typebox/compiler"), import_file = require('../universal/file.js'), import_error = require('../error.js');
const tryParse = (v, schema) => {
  try {
    return JSON.parse(v);
  } catch {
    throw new import_error.ValidationError("property", schema, v);
  }
};
function createType(kind, func) {
  return import_typebox.TypeRegistry.Has(kind) || import_typebox.TypeRegistry.Set(kind, func), (options = {}) => (0, import_typebox.Unsafe)({ ...options, [import_typebox.Kind]: kind });
}
const compile = (schema) => {
  try {
    const compiler = import_compiler.TypeCompiler.Compile(schema);
    return compiler.Create = () => import_value.Value.Create(schema), compiler.Error = (v) => (
      // @ts-ignore
      new import_error.ValidationError("property", schema, v, compiler.Errors(v))
    ), compiler;
  } catch {
    return {
      Check: (v) => import_value.Value.Check(schema, v),
      CheckThrow: (v) => {
        if (!import_value.Value.Check(schema, v))
          throw new import_error.ValidationError(
            "property",
            schema,
            v,
            // @ts-ignore
            import_value.Value.Errors(schema, v)
          );
      },
      Decode: (v) => import_value.Value.Decode(schema, v),
      Create: () => import_value.Value.Create(schema),
      Error: (v) => new import_error.ValidationError(
        "property",
        schema,
        v,
        // @ts-ignore
        import_value.Value.Errors(schema, v)
      )
    };
  }
}, parseFileUnit = (size) => {
  if (typeof size == "string")
    switch (size.slice(-1)) {
      case "k":
        return +size.slice(0, size.length - 1) * 1024;
      case "m":
        return +size.slice(0, size.length - 1) * 1048576;
      default:
        return +size;
    }
  return size;
}, checkFileExtension = (type, extension) => type.startsWith(extension) ? !0 : extension.charCodeAt(extension.length - 1) === 42 && extension.charCodeAt(extension.length - 2) === 47 && type.startsWith(extension.slice(0, -1));
let _fileTypeFromBlobWarn = !1;
const warnIfFileTypeIsNotInstalled = () => {
  _fileTypeFromBlobWarn || (console.warn(
    "[Elysia] Attempt to validate file type without 'file-type'. This may lead to security risks. We recommend installing 'file-type' to properly validate file extension."
  ), _fileTypeFromBlobWarn = !0);
}, loadFileType = async () => import("file-type").then((x) => (_fileTypeFromBlob = x.fileTypeFromBlob, _fileTypeFromBlob)).catch(warnIfFileTypeIsNotInstalled);
let _fileTypeFromBlob;
const fileTypeFromBlob = (file) => _fileTypeFromBlob ? _fileTypeFromBlob(file) : loadFileType().then((mod) => {
  if (mod) return mod(file);
}), fileType = async (file, extension, name = file?.name ?? "") => {
  if (Array.isArray(file))
    return await Promise.all(file.map((f) => fileType(f, extension, name))), !0;
  if (!file) return !1;
  const result = await fileTypeFromBlob(file);
  if (!result) throw new import_error.InvalidFileType(name, extension);
  if (typeof extension == "string" && !checkFileExtension(result.mime, extension))
    throw new import_error.InvalidFileType(name, extension);
  for (let i = 0; i < extension.length; i++)
    if (checkFileExtension(result.mime, extension[i])) return !0;
  throw new import_error.InvalidFileType(name, extension);
}, validateFile = (options, value) => {
  if (value instanceof import_file.ElysiaFile) return !0;
  if (!(value instanceof Blob) || options.minSize && value.size < parseFileUnit(options.minSize) || options.maxSize && value.size > parseFileUnit(options.maxSize))
    return !1;
  if (options.extension) {
    if (typeof options.extension == "string")
      return checkFileExtension(value.type, options.extension);
    for (let i = 0; i < options.extension.length; i++)
      if (checkFileExtension(value.type, options.extension[i]))
        return !0;
    return !1;
  }
  return !0;
}, validationDetail = (message) => (error) => ({
  ...error,
  message
});
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  checkFileExtension,
  compile,
  createType,
  fileType,
  fileTypeFromBlob,
  loadFileType,
  parseFileUnit,
  tryParse,
  validateFile,
  validationDetail
});

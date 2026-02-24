import {
  Kind,
  TypeRegistry,
  Unsafe
} from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import { TypeCompiler } from "@sinclair/typebox/compiler";
import { ElysiaFile } from "../universal/file.mjs";
import { InvalidFileType, ValidationError } from "../error.mjs";
const tryParse = (v, schema) => {
  try {
    return JSON.parse(v);
  } catch {
    throw new ValidationError("property", schema, v);
  }
};
function createType(kind, func) {
  return TypeRegistry.Has(kind) || TypeRegistry.Set(kind, func), (options = {}) => Unsafe({ ...options, [Kind]: kind });
}
const compile = (schema) => {
  try {
    const compiler = TypeCompiler.Compile(schema);
    return compiler.Create = () => Value.Create(schema), compiler.Error = (v) => (
      // @ts-ignore
      new ValidationError("property", schema, v, compiler.Errors(v))
    ), compiler;
  } catch {
    return {
      Check: (v) => Value.Check(schema, v),
      CheckThrow: (v) => {
        if (!Value.Check(schema, v))
          throw new ValidationError(
            "property",
            schema,
            v,
            // @ts-ignore
            Value.Errors(schema, v)
          );
      },
      Decode: (v) => Value.Decode(schema, v),
      Create: () => Value.Create(schema),
      Error: (v) => new ValidationError(
        "property",
        schema,
        v,
        // @ts-ignore
        Value.Errors(schema, v)
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
  if (!result) throw new InvalidFileType(name, extension);
  if (typeof extension == "string" && !checkFileExtension(result.mime, extension))
    throw new InvalidFileType(name, extension);
  for (let i = 0; i < extension.length; i++)
    if (checkFileExtension(result.mime, extension[i])) return !0;
  throw new InvalidFileType(name, extension);
}, validateFile = (options, value) => {
  if (value instanceof ElysiaFile) return !0;
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
export {
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
};

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
var error_exports = {};
__export(error_exports, {
  ERROR_CODE: () => ERROR_CODE,
  ElysiaCustomStatusResponse: () => ElysiaCustomStatusResponse,
  ElysiaStatus: () => ElysiaStatus,
  InternalServerError: () => InternalServerError,
  InvalidCookieSignature: () => InvalidCookieSignature,
  InvalidFileType: () => InvalidFileType,
  NotFoundError: () => NotFoundError,
  ParseError: () => ParseError,
  ValidationError: () => ValidationError,
  isProduction: () => isProduction,
  mapValueError: () => mapValueError,
  status: () => status
});
module.exports = __toCommonJS(error_exports);
var import_value = require("@sinclair/typebox/value"), import_utils = require('./utils.js');
const env = typeof Bun < "u" ? Bun.env : typeof process < "u" ? process?.env : void 0, ERROR_CODE = Symbol("ElysiaErrorCode"), isProduction = (env?.NODE_ENV ?? env?.ENV) === "production", emptyHttpStatus = {
  101: void 0,
  204: void 0,
  205: void 0,
  304: void 0,
  307: void 0,
  308: void 0
};
class ElysiaCustomStatusResponse {
  constructor(code, response) {
    const res = response ?? (code in import_utils.InvertedStatusMap ? (
      // @ts-expect-error Always correct
      import_utils.InvertedStatusMap[code]
    ) : code);
    this.code = import_utils.StatusMap[code] ?? code, code in emptyHttpStatus ? this.response = void 0 : this.response = res;
  }
}
const ElysiaStatus = ElysiaCustomStatusResponse, status = (code, response) => new ElysiaCustomStatusResponse(code, response);
class InternalServerError extends Error {
  constructor(message) {
    super(message ?? "INTERNAL_SERVER_ERROR");
    this.code = "INTERNAL_SERVER_ERROR";
    this.status = 500;
  }
}
class NotFoundError extends Error {
  constructor(message) {
    super(message ?? "NOT_FOUND");
    this.code = "NOT_FOUND";
    this.status = 404;
  }
}
class ParseError extends Error {
  constructor(cause) {
    super("Bad Request", {
      cause
    });
    this.code = "PARSE";
    this.status = 400;
  }
}
class InvalidCookieSignature extends Error {
  constructor(key, message) {
    super(message ?? `"${key}" has invalid cookie signature`);
    this.key = key;
    this.code = "INVALID_COOKIE_SIGNATURE";
    this.status = 400;
  }
}
const mapValueError = (error) => {
  if (!error) return error;
  let { message, path, value, type } = error;
  Array.isArray(path) && (path = path[0]);
  const property = typeof path == "string" ? path.slice(1).replaceAll("/", ".") : "unknown", isRoot = path === "";
  switch (type) {
    case 42:
      return {
        ...error,
        summary: isRoot ? "Value should not be provided" : `Property '${property}' should not be provided`
      };
    case 45:
      return {
        ...error,
        summary: isRoot ? "Value is missing" : `Property '${property}' is missing`
      };
    case 50:
      const quoteIndex = message.indexOf("'"), format = message.slice(
        quoteIndex + 1,
        message.indexOf("'", quoteIndex + 1)
      );
      return {
        ...error,
        summary: isRoot ? "Value should be an email" : `Property '${property}' should be ${format}`
      };
    case 54:
      return {
        ...error,
        summary: `${message.slice(0, 9).trim()} property '${property}' to be ${message.slice(8).trim()} but found: ${value}`
      };
    case 62:
      const union = error.schema.anyOf.map((x) => `'${x?.format ?? x.type}'`).join(", ");
      return {
        ...error,
        summary: isRoot ? `Value should be one of ${union}` : `Property '${property}' should be one of: ${union}`
      };
    default:
      return { summary: message, ...error };
  }
};
class InvalidFileType extends Error {
  constructor(property, expected, message = `"${property}" has invalid file type`) {
    super(message);
    this.property = property;
    this.expected = expected;
    this.message = message;
    this.code = "INVALID_FILE_TYPE";
    this.status = 422;
    Object.setPrototypeOf(this, InvalidFileType.prototype);
  }
  toResponse(headers) {
    return isProduction ? new Response(
      JSON.stringify({
        type: "validation",
        on: "body"
      }),
      {
        status: 422,
        headers: {
          ...headers,
          "content-type": "application/json"
        }
      }
    ) : new Response(
      JSON.stringify({
        type: "validation",
        on: "body",
        summary: "Invalid file type",
        message: this.message,
        property: this.property,
        expected: this.expected
      }),
      {
        status: 422,
        headers: {
          ...headers,
          "content-type": "application/json"
        }
      }
    );
  }
}
class ValidationError extends Error {
  constructor(type, validator, value, allowUnsafeValidationDetails = !1, errors) {
    let message = "", error, expected, customError;
    if (
      // @ts-ignore
      validator?.provider === "standard" || "~standard" in validator || // @ts-ignore
      validator.schema && "~standard" in validator.schema
    ) {
      const standard = (
        // @ts-ignore
        ("~standard" in validator ? validator : validator.schema)["~standard"]
      );
      error = (errors ?? standard.validate(value).issues)?.[0], isProduction && !allowUnsafeValidationDetails ? message = JSON.stringify({
        type: "validation",
        on: type,
        found: value
      }) : message = JSON.stringify(
        {
          type: "validation",
          on: type,
          property: error.path?.[0] || "root",
          message: error?.message,
          summary: error?.problem,
          expected,
          found: value,
          errors
        },
        null,
        2
      ), customError = error?.message;
    } else {
      value && typeof value == "object" && value instanceof ElysiaCustomStatusResponse && (value = value.response), error = errors?.First() ?? ("Errors" in validator ? validator.Errors(value).First() : import_value.Value.Errors(validator, value).First());
      const accessor = error?.path || "root", schema = validator?.schema ?? validator;
      if (!isProduction && !allowUnsafeValidationDetails)
        try {
          expected = import_value.Value.Create(schema);
        } catch (error2) {
          expected = {
            type: "Could not create expected value",
            // @ts-expect-error
            message: error2?.message,
            error: error2
          };
        }
      customError = error?.schema?.message || error?.schema?.error !== void 0 ? typeof error.schema.error == "function" ? error.schema.error(
        isProduction && !allowUnsafeValidationDetails ? {
          type: "validation",
          on: type,
          found: value
        } : {
          type: "validation",
          on: type,
          value,
          property: accessor,
          message: error?.message,
          summary: mapValueError(error)?.summary,
          found: value,
          expected,
          errors: "Errors" in validator ? [
            ...validator.Errors(
              value
            )
          ].map(mapValueError) : [
            ...import_value.Value.Errors(
              validator,
              value
            )
          ].map(mapValueError)
        },
        validator
      ) : error.schema.error : void 0, customError !== void 0 ? message = typeof customError == "object" ? JSON.stringify(customError) : customError + "" : isProduction && !allowUnsafeValidationDetails ? message = JSON.stringify({
        type: "validation",
        on: type,
        found: value
      }) : message = JSON.stringify(
        {
          type: "validation",
          on: type,
          property: accessor,
          message: error?.message,
          summary: mapValueError(error)?.summary,
          expected,
          found: value,
          errors: "Errors" in validator ? [...validator.Errors(value)].map(
            mapValueError
          ) : [...import_value.Value.Errors(validator, value)].map(
            mapValueError
          )
        },
        null,
        2
      );
    }
    super(message);
    this.type = type;
    this.validator = validator;
    this.value = value;
    this.allowUnsafeValidationDetails = allowUnsafeValidationDetails;
    this.code = "VALIDATION";
    this.status = 422;
    this.valueError = error, this.expected = expected, this.customError = customError, Object.setPrototypeOf(this, ValidationError.prototype);
  }
  /**
   * Alias of `valueError`
   */
  get messageValue() {
    return this.valueError;
  }
  get all() {
    return (
      // @ts-ignore
      this.validator?.provider === "standard" || "~standard" in this.validator || // @ts-ignore
      "schema" in this.validator && // @ts-ignore
      this.validator.schema && // @ts-ignore
      "~standard" in this.validator.schema ? /* @ts-ignore */ ("~standard" in this.validator ? this.validator : (
        // @ts-ignore
        this.validator.schema
      ))["~standard"].validate(this.value).issues?.map((issue) => ({
        summary: issue.message,
        path: issue.path?.join(".") || "root",
        message: issue.message,
        value: this.value
      })) || [] : "Errors" in this.validator ? [...this.validator.Errors(this.value)].filter((x) => x).map((x) => mapValueError(x)) : (
        // @ts-ignore
        [...import_value.Value.Errors(this.validator, this.value)].map(mapValueError)
      )
    );
  }
  static simplifyModel(validator) {
    const model = "schema" in validator ? validator.schema : validator;
    try {
      return import_value.Value.Create(model);
    } catch {
      return model;
    }
  }
  get model() {
    return "~standard" in this.validator ? this.validator : ValidationError.simplifyModel(this.validator);
  }
  toResponse(headers) {
    return new Response(this.message, {
      status: 400,
      headers: {
        ...headers,
        "content-type": "application/json"
      }
    });
  }
  /**
   * Utility function to inherit add custom error and keep the original Validation error
   *
   * @since 1.3.14
   *
   * @example
   * ```ts
   * new Elysia()
   *		.onError(({ error, code }) => {
   *			if (code === 'VALIDATION') return error.detail(error.message)
   *		})
   *		.post('/', () => 'Hello World!', {
   *			body: t.Object({
   *				x: t.Number({
   *					error: 'x must be a number'
   *				})
   *			})
   *		})
   * ```
   */
  detail(message, allowUnsafeValidatorDetails = this.allowUnsafeValidationDetails) {
    if (!this.customError) return this.message;
    const value = this.value, expected = this.expected, errors = this.all;
    return isProduction && !allowUnsafeValidatorDetails ? {
      type: "validation",
      on: this.type,
      found: value,
      message
    } : {
      type: "validation",
      on: this.type,
      property: this.valueError?.path || "root",
      message,
      summary: mapValueError(this.valueError)?.summary,
      found: value,
      expected,
      errors
    };
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ERROR_CODE,
  ElysiaCustomStatusResponse,
  ElysiaStatus,
  InternalServerError,
  InvalidCookieSignature,
  InvalidFileType,
  NotFoundError,
  ParseError,
  ValidationError,
  isProduction,
  mapValueError,
  status
});

import decode from "fast-decode-uri-component";
const KEY_HAS_PLUS = 1, KEY_NEEDS_DECODE = 2, VALUE_HAS_PLUS = 4, VALUE_NEEDS_DECODE = 8;
function parseQueryFromURL(input, startIndex = 0, array, object) {
  const result = /* @__PURE__ */ Object.create(null);
  let flags = 0;
  const inputLength = input.length;
  let startingIndex = startIndex - 1, equalityIndex = startingIndex;
  for (let i = 0; i < inputLength; i++)
    switch (input.charCodeAt(i)) {
      // '&'
      case 38:
        processKeyValuePair(input, i), startingIndex = i, equalityIndex = i, flags = 0;
        break;
      // '='
      case 61:
        equalityIndex <= startingIndex ? equalityIndex = i : flags |= VALUE_NEEDS_DECODE;
        break;
      // '+'
      case 43:
        equalityIndex > startingIndex ? flags |= VALUE_HAS_PLUS : flags |= KEY_HAS_PLUS;
        break;
      // '%'
      case 37:
        equalityIndex > startingIndex ? flags |= VALUE_NEEDS_DECODE : flags |= KEY_NEEDS_DECODE;
        break;
    }
  return startingIndex < inputLength && processKeyValuePair(input, inputLength), result;
  function processKeyValuePair(input2, endIndex) {
    const hasBothKeyValuePair = equalityIndex > startingIndex, effectiveEqualityIndex = hasBothKeyValuePair ? equalityIndex : endIndex, keySlice = input2.slice(startingIndex + 1, effectiveEqualityIndex);
    if (!hasBothKeyValuePair && keySlice.length === 0) return;
    let finalKey = keySlice;
    flags & KEY_HAS_PLUS && (finalKey = finalKey.replace(/\+/g, " ")), flags & KEY_NEEDS_DECODE && (finalKey = decode(finalKey) || finalKey);
    let finalValue = "";
    if (hasBothKeyValuePair) {
      let valueSlice = input2.slice(equalityIndex + 1, endIndex);
      flags & VALUE_HAS_PLUS && (valueSlice = valueSlice.replace(/\+/g, " ")), flags & VALUE_NEEDS_DECODE && (valueSlice = decode(valueSlice) || valueSlice), finalValue = valueSlice;
    }
    const currentValue = result[finalKey];
    array && array?.[finalKey] ? finalValue.charCodeAt(0) === 91 ? (object && object?.[finalKey] ? finalValue = JSON.parse(finalValue) : finalValue = finalValue.slice(1, -1).split(","), currentValue === void 0 ? result[finalKey] = finalValue : Array.isArray(currentValue) ? currentValue.push(...finalValue) : (result[finalKey] = finalValue, result[finalKey].unshift(currentValue))) : currentValue === void 0 ? result[finalKey] = finalValue : Array.isArray(currentValue) ? currentValue.push(finalValue) : result[finalKey] = [currentValue, finalValue] : result[finalKey] = finalValue;
  }
}
function parseQueryStandardSchema(input, startIndex = 0) {
  const result = /* @__PURE__ */ Object.create(null);
  let flags = 0;
  const inputLength = input.length;
  let startingIndex = startIndex - 1, equalityIndex = startingIndex;
  for (let i = 0; i < inputLength; i++)
    switch (input.charCodeAt(i)) {
      // '&'
      case 38:
        processKeyValuePair(input, i), startingIndex = i, equalityIndex = i, flags = 0;
        break;
      // '='
      case 61:
        equalityIndex <= startingIndex ? equalityIndex = i : flags |= VALUE_NEEDS_DECODE;
        break;
      // '+'
      case 43:
        equalityIndex > startingIndex ? flags |= VALUE_HAS_PLUS : flags |= KEY_HAS_PLUS;
        break;
      // '%'
      case 37:
        equalityIndex > startingIndex ? flags |= VALUE_NEEDS_DECODE : flags |= KEY_NEEDS_DECODE;
        break;
    }
  return startingIndex < inputLength && processKeyValuePair(input, inputLength), result;
  function processKeyValuePair(input2, endIndex) {
    const hasBothKeyValuePair = equalityIndex > startingIndex, effectiveEqualityIndex = hasBothKeyValuePair ? equalityIndex : endIndex, keySlice = input2.slice(startingIndex + 1, effectiveEqualityIndex);
    if (!hasBothKeyValuePair && keySlice.length === 0) return;
    let finalKey = keySlice;
    flags & KEY_HAS_PLUS && (finalKey = finalKey.replace(/\+/g, " ")), flags & KEY_NEEDS_DECODE && (finalKey = decode(finalKey) || finalKey);
    let finalValue = "";
    if (hasBothKeyValuePair) {
      let valueSlice = input2.slice(equalityIndex + 1, endIndex);
      flags & VALUE_HAS_PLUS && (valueSlice = valueSlice.replace(/\+/g, " ")), flags & VALUE_NEEDS_DECODE && (valueSlice = decode(valueSlice) || valueSlice), finalValue = valueSlice;
    }
    const currentValue = result[finalKey];
    if (finalValue.charCodeAt(0) === 91 && finalValue.charCodeAt(finalValue.length - 1) === 93) {
      try {
        finalValue = JSON.parse(finalValue);
      } catch {
      }
      currentValue === void 0 ? result[finalKey] = finalValue : Array.isArray(currentValue) ? currentValue.push(finalValue) : result[finalKey] = [currentValue, finalValue];
    } else if (finalValue.charCodeAt(0) === 123 && finalValue.charCodeAt(finalValue.length - 1) === 125) {
      try {
        finalValue = JSON.parse(finalValue);
      } catch {
      }
      currentValue === void 0 ? result[finalKey] = finalValue : Array.isArray(currentValue) ? currentValue.push(finalValue) : result[finalKey] = [currentValue, finalValue];
    } else
      finalValue.includes(",") && (finalValue = finalValue.split(",")), currentValue === void 0 ? result[finalKey] = finalValue : Array.isArray(currentValue) ? currentValue.push(finalValue) : result[finalKey] = [currentValue, finalValue];
  }
}
function parseQuery(input) {
  const result = /* @__PURE__ */ Object.create(null);
  let flags = 0;
  const inputLength = input.length;
  let startingIndex = -1, equalityIndex = -1;
  for (let i = 0; i < inputLength; i++)
    switch (input.charCodeAt(i)) {
      // '&'
      case 38:
        processKeyValuePair(input, i), startingIndex = i, equalityIndex = i, flags = 0;
        break;
      // '='
      case 61:
        equalityIndex <= startingIndex ? equalityIndex = i : flags |= VALUE_NEEDS_DECODE;
        break;
      // '+'
      case 43:
        equalityIndex > startingIndex ? flags |= VALUE_HAS_PLUS : flags |= KEY_HAS_PLUS;
        break;
      // '%'
      case 37:
        equalityIndex > startingIndex ? flags |= VALUE_NEEDS_DECODE : flags |= KEY_NEEDS_DECODE;
        break;
    }
  return startingIndex < inputLength && processKeyValuePair(input, inputLength), result;
  function processKeyValuePair(input2, endIndex) {
    const hasBothKeyValuePair = equalityIndex > startingIndex, effectiveEqualityIndex = hasBothKeyValuePair ? equalityIndex : endIndex, keySlice = input2.slice(startingIndex + 1, effectiveEqualityIndex);
    if (!hasBothKeyValuePair && keySlice.length === 0) return;
    let finalKey = keySlice;
    flags & KEY_HAS_PLUS && (finalKey = finalKey.replace(/\+/g, " ")), flags & KEY_NEEDS_DECODE && (finalKey = decode(finalKey) || finalKey);
    let finalValue = "";
    if (hasBothKeyValuePair) {
      let valueSlice = input2.slice(equalityIndex + 1, endIndex);
      flags & VALUE_HAS_PLUS && (valueSlice = valueSlice.replace(/\+/g, " ")), flags & VALUE_NEEDS_DECODE && (valueSlice = decode(valueSlice) || valueSlice), finalValue = valueSlice;
    }
    const currentValue = result[finalKey];
    currentValue === void 0 ? result[finalKey] = finalValue : Array.isArray(currentValue) ? currentValue.push(finalValue) : result[finalKey] = [currentValue, finalValue];
  }
}
export {
  parseQuery,
  parseQueryFromURL,
  parseQueryStandardSchema
};

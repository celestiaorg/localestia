import { isBun } from "./utils.mjs";
const env = isBun ? Bun.env : typeof process < "u" && process?.env ? process.env : {};
export {
  env
};

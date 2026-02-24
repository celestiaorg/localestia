const isBun = typeof Bun < "u", isDeno = typeof Deno < "u";
function isCloudflareWorker() {
  try {
    if (
      // @ts-ignore
      typeof caches < "u" && // @ts-ignore
      typeof caches.default < "u" || typeof WebSocketPair < "u"
    ) return !0;
  } catch {
    return !1;
  }
  return !1;
}
export {
  isBun,
  isCloudflareWorker,
  isDeno
};

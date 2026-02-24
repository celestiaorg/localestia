class WebStandardRequest {
}
class WebStandardResponse {
  constructor(body, init) {
  }
  static error() {
    return Response.error();
  }
  static json(data, init) {
    return Response.json(data, init);
  }
  static redirect(url, status) {
    return Response.redirect(url, status);
  }
}
export {
  WebStandardRequest,
  WebStandardResponse
};

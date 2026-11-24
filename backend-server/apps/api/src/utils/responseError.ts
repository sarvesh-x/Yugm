import { ErrorCode, HttpError } from "./http.js";

export function responseError(error: unknown) {
  if (typeof error === "object" && error !== null && "code" in error && error.code === "LIMIT_FILE_SIZE") {
    return { status: 413, message: "Uploaded file is too large", code: ErrorCode.VALIDATION };
  }
  if (error instanceof HttpError) {
    return {
      status: error.status,
      message: error.message,
      code: error.code ?? ErrorCode.INTERNAL
    };
  }
  const maybeHttp = (error ?? {}) as { status?: unknown; statusCode?: unknown; type?: unknown };
  if (maybeHttp.type === "entity.parse.failed") {
    return {
      status: 400,
      message: "Invalid JSON body",
      code: ErrorCode.VALIDATION
    };
  }
  const status = typeof maybeHttp.status === "number"
    ? maybeHttp.status
    : typeof maybeHttp.statusCode === "number"
      ? maybeHttp.statusCode
      : 500;
  return {
    status: status >= 400 && status < 600 ? status : 500,
    message: status >= 400 && status < 500
        ? typeof error === "object" && error != null && "message" in error
          ? (error as { message?: unknown }).message
          : "Unexpected server error"
        : error instanceof Error
          ? error.message
          : "Unexpected server error",
    code: status >= 400 && status < 500 ? ErrorCode.VALIDATION : ErrorCode.INTERNAL
  };
}

import mongoose from "mongoose";
import { ErrorCode } from "./http.js";
import { responseError } from "./responseError.js";

export function mongoResponseError(error: unknown) {
  if (error instanceof mongoose.Error.CastError) {
    return { status: 400, message: "Invalid identifier", code: ErrorCode.VALIDATION };
  }
  if (error instanceof mongoose.Error.ValidationError) {
    return { status: 400, message: error.message, code: ErrorCode.VALIDATION };
  }
  return responseError(error);
}

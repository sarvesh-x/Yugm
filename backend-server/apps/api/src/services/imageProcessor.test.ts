import assert from "node:assert/strict";
import { after, test } from "node:test";
import { HttpError } from "../utils/http.js";
import {
  getImageProcessor,
  getImageProcessorHealth,
  hasImageProcessor,
  setImageProcessor,
  type ImageProcessor
} from "./imageProcessor.js";

after(() => setImageProcessor(undefined));

test("image processor registry reports only non-sensitive configuration", () => {
  setImageProcessor(undefined);
  assert.equal(hasImageProcessor(), false);
  assert.deepEqual(getImageProcessorHealth(), { configured: false, provider: null });
  assert.throws(
    () => getImageProcessor(),
    (error: unknown) => error instanceof HttpError && error.status === 503
  );

  const stub: ImageProcessor = {
    name: "stub",
    async metadata() { return { width: 1, height: 1, format: "image/png" }; },
    async resizeToWebp() { return { data: Buffer.alloc(0), info: { width: 1, height: 1, format: "webp" } }; }
  };
  setImageProcessor(stub);
  assert.equal(hasImageProcessor(), true);
  assert.equal(getImageProcessor(), stub);
  assert.deepEqual(getImageProcessorHealth(), { configured: true, provider: "stub" });
});

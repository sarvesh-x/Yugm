import { HttpError } from "../utils/http.js";

/**
 * Host-neutral image processing boundary.
 *
 * The Node API installs the Sharp implementation from
 * `imageProcessor.node.ts`; the Cloudflare Worker installs the Images binding
 * implementation from its own app. Service modules only depend on this
 * registry, so a native image library can never be pulled into the Worker
 * bundle through `media.ts`, `assets.ts` or scheduled maintenance.
 */

export interface ImageMetadata {
  width: number;
  height: number;
  format?: string;
  pages?: number;
}

export interface ImageMetadataOptions {
  animated?: boolean;
  limitInputPixels?: number;
}

export interface ResizeToWebpOptions {
  width?: number;
  height?: number;
  fit?: "inside" | "cover" | "contain";
  withoutEnlargement?: boolean;
  quality?: number;
  animated?: boolean;
  limitInputPixels?: number;
}

export interface ProcessedImage {
  data: Buffer;
  info: {
    width: number;
    height: number;
    format: "webp";
  };
}

export interface ImageProcessor {
  /** Stable provider name included in health output. Never a secret. */
  readonly name: string;
  /** Reads dimensions/format without retaining the decoded image. */
  metadata(input: Buffer, options?: ImageMetadataOptions): Promise<ImageMetadata>;
  /** Re-encodes as WebP with the requested bounded resize. */
  resizeToWebp(input: Buffer, options: ResizeToWebpOptions): Promise<ProcessedImage>;
}

let activeProcessor: ImageProcessor | undefined;

export function setImageProcessor(processor: ImageProcessor | undefined): void {
  activeProcessor = processor;
}

export function hasImageProcessor(): boolean {
  return activeProcessor !== undefined;
}

export function getImageProcessor(): ImageProcessor {
  if (!activeProcessor) {
    throw new HttpError(503, "Image processing is unavailable on this host");
  }
  return activeProcessor;
}

/** Non-sensitive readiness detail for `/ready`. */
export function getImageProcessorHealth(): { configured: boolean; provider: string | null } {
  return {
    configured: activeProcessor !== undefined,
    provider: activeProcessor?.name ?? null
  };
}

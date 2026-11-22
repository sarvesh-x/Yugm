import sharp from "sharp";
import { setImageProcessor } from "./imageProcessor.js";
import type {
  ImageMetadata,
  ImageMetadataOptions,
  ImageProcessor,
  ProcessedImage,
  ResizeToWebpOptions
} from "./imageProcessor.js";

/**
 * Sharp-backed provider for Node deployments only.
 *
 * This is the only module in the API workspace that may import `sharp`.
 * Import it from the Node entry point (or a Node-only test), never from a
 * module reachable by the Cloudflare Worker.
 */
export function createSharpImageProcessor(): ImageProcessor {
  return {
    name: "sharp",
    async metadata(input: Buffer, options?: ImageMetadataOptions): Promise<ImageMetadata> {
      const metadata = await sharp(input, {
        animated: options?.animated ?? false,
        limitInputPixels: options?.limitInputPixels
      }).metadata();
      return {
        width: metadata.width ?? 0,
        height: metadata.height ?? 0,
        format: metadata.format,
        pages: metadata.pages
      };
    },
    async resizeToWebp(input: Buffer, options: ResizeToWebpOptions): Promise<ProcessedImage> {
      const output = await sharp(input, {
        animated: options.animated ?? false,
        limitInputPixels: options.limitInputPixels
      })
        .rotate()
        .resize({
          width: options.width,
          height: options.height,
          fit: options.fit ?? "inside",
          withoutEnlargement: options.withoutEnlargement ?? true
        })
        .webp({ quality: options.quality ?? 82, effort: 4 })
        .toBuffer({ resolveWithObject: true });
      return {
        data: output.data,
        info: {
          width: output.info.width,
          height: output.info.height,
          format: "webp"
        }
      };
    }
  };
}

export function installSharpImageProcessor(): ImageProcessor {
  const processor = createSharpImageProcessor();
  setImageProcessor(processor);
  return processor;
}

import { setImageProcessor, type ImageMetadata, type ImageProcessor, type ProcessedImage, type ResizeToWebpOptions } from "../../api/src/services/imageProcessor.js";
import { HttpError } from "../../api/src/utils/http.js";

/**
 * Cloudflare Images binding provider.
 *
 * This file is part of the Worker bundle and uses only binding APIs. Sharp and
 * every native filesystem/child-process module stay in the Node-only provider.
 */
interface ImagesInfo {
  format: string;
  fileSize?: number;
  width?: number;
  height?: number;
}

interface ImagesTransformer {
  transform(transform: {
    width?: number;
    height?: number;
    fit?: "scale-down" | "contain" | "cover";
  }): ImagesTransformer;
  output(options: { format: "image/webp"; quality?: number; anim?: boolean }): Promise<{
    response(): Response;
  }>;
}

interface ImagesBindingLike {
  info(stream: ReadableStream<Uint8Array>): Promise<ImagesInfo>;
  input(stream: ReadableStream<Uint8Array>): ImagesTransformer;
}

function toByteStream(input: Buffer): ReadableStream<Uint8Array> {
  const bytes = new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  return new Response(bytes as unknown as BodyInit).body as ReadableStream<Uint8Array>;
}

function isImagesBinding(value: unknown): value is ImagesBindingLike {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ImagesBindingLike>;
  return typeof candidate.info === "function" && typeof candidate.input === "function";
}

export function createCloudflareImageProcessor(binding: unknown): ImageProcessor | undefined {
  if (!isImagesBinding(binding)) return undefined;
  const images = binding;

  async function readMetadata(input: Buffer): Promise<ImageMetadata> {
    try {
      const info = await images.info(toByteStream(input));
      if (!info.width || !info.height) {
        throw new HttpError(400, "Uploaded file is not a supported image");
      }
      return { width: info.width, height: info.height, format: info.format };
    } catch (error) {
      if (error instanceof HttpError) throw error;
      // ImagesError uses numeric platform codes for invalid input.
      if (typeof (error as { code?: unknown }).code === "number") {
        throw new HttpError(400, "Uploaded file is not a supported image");
      }
      throw new HttpError(503, "Image processing is temporarily unavailable");
    }
  }

  return {
    name: "cloudflare-images",
    metadata: readMetadata,
    async resizeToWebp(input: Buffer, options: ResizeToWebpOptions): Promise<ProcessedImage> {
      // Cloudflare Images defaults to `fit=scale-down`: preserve aspect ratio,
      // fit inside width/height and never upscale. That matches Sharp's
      // `inside` + `withoutEnlargement` behavior used by the Node provider.
      const fit = options.fit === "cover" || options.fit === "contain" ? options.fit : "scale-down";
      const transformer = images.input(toByteStream(input)).transform({
        ...(options.width ? { width: options.width } : {}),
        ...(options.height ? { height: options.height } : {}),
        fit
      });
      const result = await transformer.output({
        format: "image/webp",
        quality: options.quality ?? 82,
        anim: options.animated ?? false
      });
      const data = Buffer.from(await result.response().arrayBuffer());
      const info = await readMetadata(data);
      return {
        data,
        info: { width: info.width, height: info.height, format: "webp" }
      };
    }
  };
}

/** Installs the provider only when the binding is present. */
export function installCloudflareImageProcessor(binding: unknown): void {
  setImageProcessor(createCloudflareImageProcessor(binding));
}

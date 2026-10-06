import sharp from "sharp";

export interface Optimised { bytes: Buffer; width: number; height: number; ext: "webp"; mime: "image/webp" }

/**
 * Low size, high quality: auto-rotate, strip metadata (EXIF/GPS), fit inside 1600x1200 without enlarging,
 * and encode as WebP (typically 60-70% smaller than the JPEG at the same visual quality).
 */
export async function optimiseImage(input: Uint8Array | Buffer, opts: { maxWidth?: number; maxHeight?: number; quality?: number } = {}): Promise<Optimised> {
  const { maxWidth = 1600, maxHeight = 1200, quality = 82 } = opts;
  const { data, info } = await sharp(input, { failOn: "error", limitInputPixels: 80_000_000 })
    .rotate()
    .resize({ width: maxWidth, height: maxHeight, fit: "inside", withoutEnlargement: true })
    .webp({ quality, effort: 5, smartSubsample: true })
    .toBuffer({ resolveWithObject: true });
  return { bytes: data, width: info.width, height: info.height, ext: "webp", mime: "image/webp" };
}

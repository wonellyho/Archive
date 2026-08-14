/**
 * Turns a user-picked photo into a wallpaper we can safely keep in
 * localStorage: downscaled + re-encoded as JPEG (so a 12MP phone photo
 * doesn't blow the ~5MB storage quota), plus a quick average-luminance
 * sample so the UI can decide whether light or dark text reads better on
 * top of it.
 */

export type BackgroundTone = "light" | "dark";

export interface ProcessedBackground {
  dataUrl: string;
  tone: BackgroundTone;
}

const MAX_DIMENSION = 1920;
const JPEG_QUALITY = 0.82;
/** Below this average luminance (0–255) the photo reads as "dark". */
const DARK_THRESHOLD = 130;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Couldn't load that image."));
    img.src = src;
  });
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Couldn't read that file."));
    reader.readAsDataURL(file);
  });
}

/** Average perceptual luminance of the canvas, sampled on a coarse grid
 * (a few thousand pixels is plenty accurate and stays fast on big photos). */
function averageLuminance(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const { data } = ctx.getImageData(0, 0, width, height);
  const step = Math.max(4, Math.floor(data.length / 4 / 2000)) * 4;
  let total = 0;
  let count = 0;
  for (let i = 0; i < data.length; i += step) {
    total += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    count++;
  }
  return count ? total / count : 255;
}

export async function processBackgroundImage(file: File): Promise<ProcessedBackground> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please choose an image file.");
  }

  const dataUrl = await readAsDataUrl(file);
  const img = await loadImage(dataUrl);

  const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser can't process images.");

  ctx.drawImage(img, 0, 0, width, height);

  const tone: BackgroundTone =
    averageLuminance(ctx, width, height) < DARK_THRESHOLD ? "dark" : "light";

  return { dataUrl: canvas.toDataURL("image/jpeg", JPEG_QUALITY), tone };
}

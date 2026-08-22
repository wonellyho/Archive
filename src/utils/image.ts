/**
 * Reads an image file and returns a canvas downscaled so its longest side is at
 * most maxSize. Shared by the data-URL (localStorage/Supabase-direct fallback)
 * and Blob (backend Storage upload) variants below.
 */
function fileToDownscaledCanvas(
  file: File,
  maxSize: number,
): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read the image."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Failed to load the image."));
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Failed to process the image."));
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Downscaled JPEG data URL. Used as the fallback when the backend upload isn't
 * configured (folder covers are then stored inline as data URLs).
 */
export async function fileToCoverDataUrl(
  file: File,
  maxSize = 480,
): Promise<string> {
  const canvas = await fileToDownscaledCanvas(file, maxSize);
  return canvas.toDataURL("image/jpeg", 0.82);
}

/** A crop window, as fractions of the source image (0–1 on each axis). */
export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Cuts a region out of an image and returns it as a downscaled JPEG data URL.
 * Fractions rather than pixels so a crop chosen against a preview at whatever
 * size it happened to render applies correctly to the full-resolution source.
 */
export async function cropToDataUrl(
  src: string,
  rect: CropRect,
  maxSize = 900,
): Promise<string> {
  const img = await loadImage(src);
  const sx = Math.round(rect.x * img.width);
  const sy = Math.round(rect.y * img.height);
  const sw = Math.max(1, Math.round(rect.width * img.width));
  const sh = Math.max(1, Math.round(rect.height * img.height));

  const scale = Math.min(1, maxSize / Math.max(sw, sh));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(sw * scale));
  canvas.height = Math.max(1, Math.round(sh * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to process the image.");
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.85);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load the image."));
    img.src = src;
  });
}

/**
 * Downscaled JPEG Blob for Storage upload (POST /api/uploads). Keeps covers
 * small so they stay well under the server size limit.
 */
export async function fileToCoverBlob(file: File, maxSize = 480): Promise<Blob> {
  const canvas = await fileToDownscaledCanvas(file, maxSize);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("Failed to process the image.")),
      "image/jpeg",
      0.82,
    );
  });
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}

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
    reader.onerror = () => reject(new Error("이미지를 읽지 못했습니다."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("이미지를 불러오지 못했습니다."));
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("이미지를 처리하지 못했습니다."));
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

/**
 * Downscaled JPEG Blob for Storage upload (POST /api/uploads). Keeps covers
 * small so they stay well under the server size limit.
 */
export async function fileToCoverBlob(file: File, maxSize = 480): Promise<Blob> {
  const canvas = await fileToDownscaledCanvas(file, maxSize);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("이미지를 처리하지 못했습니다.")),
      "image/jpeg",
      0.82,
    );
  });
}

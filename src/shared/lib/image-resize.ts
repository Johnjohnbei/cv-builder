/**
 * Downscale an image file to a small JPEG data-URI suitable for a CV photo.
 *
 * The photo is stored as base64 inside cvData and travels with every
 * auto-save payload (Convex documents are capped at ~1 MiB), so it must stay
 * far below that: 512px max side at JPEG q0.85 lands around 30-80 kB.
 */
export function downscaleImageToDataURI(file: File, maxSide = 512, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas 2D context unavailable'));
        return;
      }
      // White background: JPEG has no alpha, transparent PNGs would go black
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Image load failed'));
    };
    img.src = url;
  });
}

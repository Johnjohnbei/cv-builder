/**
 * Downscale an image file to a small JPEG data-URI suitable for a CV photo.
 *
 * The photo is stored as base64 inside cvData and travels with every
 * auto-save payload (Convex documents are capped at ~1 MiB), so it must stay
 * far below that: 512px max side at JPEG q0.85 lands around 30-80 kB.
 */
/**
 * Whether a CV photo is a link to another host rather than inline image data.
 * The PDF is rendered by a server that fetches nothing but fonts, so such a
 * photo shows in the preview and prints as an empty square.
 */
export function isRemotePhoto(photoUrl: string | undefined): boolean {
  return /^https?:\/\//i.test(photoUrl?.trim() ?? '');
}

/**
 * "Greenhouse Recruiting can't parse resumes larger than 2.5MB"
 * (support.greenhouse.io, primary source read on 2026-11-06). The CV itself is
 * text and a subset of its fonts, a few hundred kB; the only thing that can
 * cross the limit is the photo, carried inline as base64 on the CV.
 */
const PARSER_SIZE_LIMIT_BYTES = 2.5 * 1024 * 1024;

/** What the exported PDF weighs beside the photo: the fonts it embeds, around 500 kB */
const PDF_BASE_BYTES = 500 * 1024;

/**
 * Bytes a photo adds to the PDF. A data URI carries base64, four characters
 * for every three bytes; a link weighs nothing and prints nothing either, the
 * PDF renderer fetching no image.
 */
export function photoBytes(photoUrl: string | undefined): number {
  const data = photoUrl?.startsWith('data:') ? photoUrl.split(',')[1] : undefined;
  return data ? Math.round((data.length * 3) / 4) : 0;
}

/** Whether the exported PDF stays under the size a parser reads */
export function fitsParserSizeLimit(photoUrl: string | undefined, showPhoto: boolean | undefined): boolean {
  return PDF_BASE_BYTES + (showPhoto ? photoBytes(photoUrl) : 0) < PARSER_SIZE_LIMIT_BYTES;
}

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

export const MAX_IMAGE_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB limit for input
export const TARGET_MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2MB target max limit
export const AVATAR_FRAME_SIZE = 512;
export const ALLOWED_AVATAR_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'] as const;
export const STYLIST_AVATAR_HELPER_TEXT =
  'Upload profile photo (JPG, PNG up to 5MB). Images automatically fit and balance.';

/** Light / contrast / warmth that matches the salon UI (light canvas, warm accent). */
export const THEME_BALANCE = {
  brightness: 1.06,
  contrast: 1.08,
  warmth: 8,
} as const;

export interface FileValidationResult {
  isValid: boolean;
  errorMessage?: string;
  dataUrl?: string;
}

export interface CompressionResult {
  isValid: boolean;
  errorMessage?: string;
  dataUrl?: string;
  fileName: string;
  fileType: string;
  originalSizeKb: number;
  compressedSizeKb: number;
  width: number;
  height: number;
  compressionRatio: number;
}

export function formatBytesAsMb(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1);
}

function fileExtension(name: string): string {
  const match = /\.([a-z0-9]+)$/i.exec(name || '');
  return match ? match[1].toLowerCase() : '';
}

/**
 * Rejects unsupported formats and files over 5 MB before any canvas work.
 */
export function validateImageFile(
  file: File | null | undefined,
  options: { maxBytes?: number; allowedTypes?: readonly string[] } = {}
): FileValidationResult {
  if (!file) {
    return { isValid: false, errorMessage: 'No file selected.' };
  }

  const maxBytes = options.maxBytes ?? MAX_IMAGE_FILE_SIZE_BYTES;
  const allowed = options.allowedTypes ?? ALLOWED_AVATAR_MIME_TYPES;
  const type = String(file.type || '').toLowerCase();
  const ext = fileExtension(file.name);
  const typeOk =
    (type && allowed.includes(type)) ||
    (!type && ['jpg', 'jpeg', 'png', 'webp'].includes(ext));

  if (!typeOk) {
    return {
      isValid: false,
      errorMessage: 'Unsupported format. Use a JPG or PNG photo (up to 5 MB).',
    };
  }

  if (file.size > maxBytes) {
    return {
      isValid: false,
      errorMessage: `This photo is ${formatBytesAsMb(file.size)} MB. Please choose a JPG or PNG under 5 MB.`,
    };
  }

  return { isValid: true };
}

/**
 * Largest centred square inside the source — cover-crop so a 1:1 frame fills
 * without stretching or letterboxing.
 */
export function coverCropRect(srcWidth: number, srcHeight: number): { sx: number; sy: number; sw: number; sh: number } {
  const width = Math.max(1, Math.round(srcWidth));
  const height = Math.max(1, Math.round(srcHeight));
  const side = Math.min(width, height);
  return {
    sx: Math.floor((width - side) / 2),
    sy: Math.floor((height - side) / 2),
    sw: side,
    sh: side,
  };
}

function clampChannel(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

/** Auto-adjust a single RGB pixel to the salon UI (lift, contrast, warm balance). */
export function applyThemeBalancePixel(r: number, g: number, b: number): [number, number, number] {
  const { brightness, contrast, warmth } = THEME_BALANCE;
  const intercept = 128 * (1 - contrast);
  return [
    clampChannel(r * brightness * contrast + intercept + warmth),
    clampChannel(g * brightness * contrast + intercept),
    clampChannel(b * brightness * contrast + intercept - warmth),
  ];
}

export function applyThemeBalanceToImageData(data: Uint8ClampedArray): void {
  for (let i = 0; i < data.length; i += 4) {
    const [r, g, b] = applyThemeBalancePixel(data[i], data[i + 1], data[i + 2]);
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
  }
}

/**
 * Validates file size and converts file to Base64 / Data URL string
 */
export async function validateAndReadImageFile(file: File): Promise<FileValidationResult> {
  const check = validateImageFile(file);
  if (!check.isValid) return check;

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (result) {
        resolve({ isValid: true, dataUrl: result });
      } else {
        resolve({ isValid: false, errorMessage: 'Failed to process image file.' });
      }
    };
    reader.onerror = () => {
      resolve({ isValid: false, errorMessage: 'An error occurred while reading the file.' });
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Automatically resizes and compresses an image to be <= 2MB using HTML5 Canvas API
 * maintains aspect ratio and scales quality/resolution iteratively.
 */
export async function compressAndResizeImage(
  file: File,
  maxDimension: number = 1600, // Maximum width or height
  targetMaxSizeBytes: number = 2 * 1024 * 1024 // 2 MB limit
): Promise<CompressionResult> {
  if (!file) {
    return { 
      isValid: false, 
      errorMessage: 'No file selected.', 
      fileName: '', 
      fileType: '', 
      originalSizeKb: 0, 
      compressedSizeKb: 0, 
      width: 0, 
      height: 0, 
      compressionRatio: 0 
    };
  }

  if (!file.type.startsWith('image/')) {
    return { 
      isValid: false, 
      errorMessage: 'Please select a valid image file (PNG, JPG, WEBP).', 
      fileName: file.name, 
      fileType: file.type, 
      originalSizeKb: 0, 
      compressedSizeKb: 0, 
      width: 0, 
      height: 0, 
      compressionRatio: 0 
    };
  }

  const originalSizeKb = Math.round((file.size / 1024) * 100) / 100;

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Auto-scale maintaining aspect ratio
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve({
            isValid: false,
            errorMessage: 'Could not create canvas 2D context.',
            fileName: file.name,
            fileType: file.type,
            originalSizeKb,
            compressedSizeKb: originalSizeKb,
            width: img.width,
            height: img.height,
            compressionRatio: 0
          });
          return;
        }

        // Draw image onto canvas
        ctx.drawImage(img, 0, 0, width, height);

        // Iterative quality reduction to meet 2MB threshold
        let quality = 0.90;
        let dataUrl = '';
        let compressedSizeKb = 0;
        let scaleFactor = 1.0;

        // Try jpeg compression first, fallback to png if transparent (or just jpeg/webp for max compression)
        const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';

        const runCompression = () => {
          let currentWidth = Math.round(width * scaleFactor);
          let currentHeight = Math.round(height * scaleFactor);

          const compressCanvas = document.createElement('canvas');
          compressCanvas.width = currentWidth;
          compressCanvas.height = currentHeight;
          const compressCtx = compressCanvas.getContext('2d');
          
          if (compressCtx) {
            compressCtx.drawImage(canvas, 0, 0, currentWidth, currentHeight);
            if (outputType === 'image/jpeg') {
              dataUrl = compressCanvas.toDataURL('image/jpeg', quality);
            } else {
              dataUrl = compressCanvas.toDataURL('image/png');
            }
          } else {
            dataUrl = canvas.toDataURL(outputType, outputType === 'image/jpeg' ? quality : undefined);
          }

          // Calculate payload size of Base64 string
          const parts = dataUrl.split(',');
          const base64Length = parts[1] ? parts[1].length : 0;
          compressedSizeKb = Math.round(((base64Length * 0.75) / 1024) * 100) / 100;
        };

        // First compression pass
        runCompression();

        // If compressed image still exceeds the threshold, iteratively downscale resolution or quality
        while (compressedSizeKb * 1024 > targetMaxSizeBytes && (quality > 0.2 || scaleFactor > 0.4)) {
          if (outputType === 'image/jpeg') {
            quality -= 0.15;
            if (quality < 0.3) {
              quality = 0.7; // reset quality but downscale dimensions
              scaleFactor *= 0.75;
            }
          } else {
            // PNG only shrinks by reducing resolution
            scaleFactor *= 0.70;
          }
          runCompression();
        }

        const compressionRatio = Math.round((1 - (compressedSizeKb / originalSizeKb)) * 100);

        resolve({
          isValid: true,
          dataUrl,
          fileName: file.name,
          fileType: outputType,
          originalSizeKb,
          compressedSizeKb,
          width: Math.round(width * scaleFactor),
          height: Math.round(height * scaleFactor),
          compressionRatio: Math.max(0, compressionRatio)
        });
      };

      img.onerror = () => {
        resolve({
          isValid: false,
          errorMessage: 'Failed to parse image data.',
          fileName: file.name,
          fileType: file.type,
          originalSizeKb,
          compressedSizeKb: 0,
          width: 0,
          height: 0,
          compressionRatio: 0
        });
      };

      img.src = event.target?.result as string;
    };

    reader.onerror = () => {
      resolve({
        isValid: false,
        errorMessage: 'Failed to read image file.',
        fileName: file.name,
        fileType: file.type,
        originalSizeKb,
        compressedSizeKb: 0,
        width: 0,
        height: 0,
        compressionRatio: 0
      });
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Stylist avatar pipeline: 5 MB + format check → centred 1:1 cover crop →
 * light/contrast/balance for the UI theme → square JPEG data URL.
 */
export async function prepareStylistAvatar(file: File, frameSize: number = AVATAR_FRAME_SIZE): Promise<CompressionResult> {
  const originalSizeKb = file ? Math.round((file.size / 1024) * 100) / 100 : 0;
  const fail = (errorMessage: string): CompressionResult => ({
    isValid: false,
    errorMessage,
    fileName: file?.name || '',
    fileType: file?.type || '',
    originalSizeKb,
    compressedSizeKb: 0,
    width: 0,
    height: 0,
    compressionRatio: 0,
  });

  const check = validateImageFile(file);
  if (!check.isValid) return fail(check.errorMessage || 'Invalid photo.');

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const crop = coverCropRect(img.width, img.height);
        const size = Math.max(64, Math.min(frameSize, 1024));
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(fail('Could not create canvas 2D context.'));
          return;
        }
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, size, size);
        try {
          const pixels = ctx.getImageData(0, 0, size, size);
          applyThemeBalanceToImageData(pixels.data);
          ctx.putImageData(pixels, 0, 0);
        } catch {
          // Tainted canvas (remote) — keep the crop without pixel balance.
        }
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        const base64Length = (dataUrl.split(',')[1] || '').length;
        const compressedSizeKb = Math.round(((base64Length * 0.75) / 1024) * 100) / 100;
        resolve({
          isValid: true,
          dataUrl,
          fileName: file.name,
          fileType: 'image/jpeg',
          originalSizeKb,
          compressedSizeKb,
          width: size,
          height: size,
          compressionRatio: Math.max(0, Math.round((1 - compressedSizeKb / Math.max(originalSizeKb, 0.01)) * 100)),
        });
      };
      img.onerror = () => resolve(fail('Failed to parse image data.'));
      img.src = event.target?.result as string;
    };
    reader.onerror = () => resolve(fail('Failed to read image file.'));
    reader.readAsDataURL(file);
  });
}

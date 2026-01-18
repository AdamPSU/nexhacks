/**
 * Corrects yellowed white pixels in an image by pushing near-white colors to pure white.
 * This is useful for fixing the slight yellow tint that can appear in AI-generated images.
 *
 * @param imageUrl - Base64 data URL of the image to process
 * @param threshold - Minimum RGB value to consider as "near white" (default: 240)
 * @returns Promise resolving to the processed image as a base64 data URL
 */
export async function correctYellowedWhites(
  imageUrl: string,
  threshold: number = 240
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      // Create an offscreen canvas
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      canvas.width = img.width;
      canvas.height = img.height;

      // Draw the image onto the canvas
      ctx.drawImage(img, 0, 0);

      // Get pixel data
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // Process each pixel
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        const minChannel = Math.min(r, g, b);
        const maxChannel = Math.max(r, g, b);

        // If all channels are above threshold, push to white
        if (minChannel >= threshold) {
          data[i] = 255;     // R
          data[i + 1] = 255; // G
          data[i + 2] = 255; // B
        }

        else if (r >= threshold && g >= threshold && b >= threshold - 15 && b < threshold) {
          data[i] = 255;     // R
          data[i + 1] = 255; // G
          data[i + 2] = 255; // B
        }
      }

      ctx.putImageData(imageData, 0, 0);

      const processedUrl = canvas.toDataURL('image/png');
      resolve(processedUrl);
    };

    img.onerror = () => {
      reject(new Error('Failed to load image for processing'));
    };

    img.src = imageUrl;
  });
}

/**
 * Removes the white background from an image by making white pixels transparent.
 *
 * @param imageUrl - Base64 data URL of the image to process
 * @param threshold - Minimum RGB value to consider as "white" (default: 240)
 * @returns Promise resolving to the processed image as a base64 data URL
 */
export async function removeWhiteBackground(
  imageUrl: string,
  threshold: number = 240
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      canvas.width = img.width;
      canvas.height = img.height;

      // Draw the image onto the canvas
      ctx.drawImage(img, 0, 0);

      // Get pixel data
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // Process each pixel
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        // If all channels are above threshold, make transparent
        if (r >= threshold && g >= threshold && b >= threshold) {
          data[i + 3] = 0; // Alpha
        }
      }

      ctx.putImageData(imageData, 0, 0);

      const processedUrl = canvas.toDataURL('image/png');
      resolve(processedUrl);
    };

    img.onerror = () => {
      reject(new Error('Failed to load image for processing'));
    };

    img.src = imageUrl;
  });
}
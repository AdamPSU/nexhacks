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
        // alpha is at data[i + 3]

        // Check if pixel is "near white"
        // A yellowed white typically has high R and G but slightly lower B
        // We want to catch pixels where all channels are high (near white)
        // or where R and G are very high but B is slightly lower (yellowish)

        const minChannel = Math.min(r, g, b);
        const maxChannel = Math.max(r, g, b);

        // If all channels are above threshold, push to white
        if (minChannel >= threshold) {
          data[i] = 255;     // R
          data[i + 1] = 255; // G
          data[i + 2] = 255; // B
        }
        // Also catch yellowed whites: high R and G (>= threshold),
        // with B slightly lower but still quite high (>= threshold - 15)
        else if (r >= threshold && g >= threshold && b >= threshold - 15 && b < threshold) {
          data[i] = 255;     // R
          data[i + 1] = 255; // G
          data[i + 2] = 255; // B
        }
      }

      // Put the modified pixel data back
      ctx.putImageData(imageData, 0, 0);

      // Convert back to base64 data URL
      const processedUrl = canvas.toDataURL('image/png');
      resolve(processedUrl);
    };

    img.onerror = () => {
      reject(new Error('Failed to load image for processing'));
    };

    img.src = imageUrl;
  });
}

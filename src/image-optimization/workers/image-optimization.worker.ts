import sharp from 'sharp';
import { ImageFormat } from '../image-format.enum';

export interface OptimizationTask {
  imageBuffer: Buffer;
  options: {
    width?: number;
    height?: number;
    quality?: number;
    format?: ImageFormat;
  };
  originalName: string;
}

export interface OptimizationResult {
  optimizedBuffer: Buffer;
  originalSize: number;
  optimizedSize: number;
  originalName: string;
  success: boolean;
  error?: string;
}

/**
 * Worker function for image optimization using Sharp
 * Runs in a separate worker thread for better performance
 */
export default async function optimizeImageWorker(
  task: OptimizationTask,
): Promise<OptimizationResult> {
  try {
    const { imageBuffer, options, originalName } = task;
    const originalSize = imageBuffer.length;

    // Create Sharp pipeline
    let pipeline = sharp(imageBuffer);

    // Apply resize if width or height is specified
    if (options.width || options.height) {
      pipeline = pipeline.resize(options.width, options.height, {
        fit: 'inside',
        withoutEnlargement: true,
      });
    }

    // Apply format and quality
    switch (options.format) {
      case ImageFormat.JPEG:
        pipeline = pipeline.jpeg({ quality: options.quality || 80 });
        break;
      case ImageFormat.PNG:
        pipeline = pipeline.png({ quality: options.quality || 80 });
        break;
      case ImageFormat.WEBP:
        pipeline = pipeline.webp({ quality: options.quality || 80 });
        break;
      case ImageFormat.AVIF:
        pipeline = pipeline.avif({ quality: options.quality || 80 });
        break;
      case ImageFormat.GIF:
        pipeline = pipeline.gif();
        break;
      case ImageFormat.TIFF:
        pipeline = pipeline.tiff({ quality: options.quality || 80 });
        break;
      case ImageFormat.AUTO:
        // Implement automatic format detection by testing different formats and selecting the smallest
        try {
          const jpegBuffer = await pipeline
            .clone()
            .jpeg({ quality: options.quality || 80 })
            .toBuffer();
          const webpBuffer = await pipeline
            .clone()
            .webp({ quality: options.quality || 80 })
            .toBuffer();
          const avifBuffer = await pipeline
            .clone()
            .avif({ quality: options.quality || 80 })
            .toBuffer();
          const pngBuffer = await pipeline
            .clone()
            .png({ quality: options.quality || 80 })
            .toBuffer();

          const formats = [
            { format: 'jpeg', buffer: jpegBuffer, size: jpegBuffer.length },
            { format: 'webp', buffer: webpBuffer, size: webpBuffer.length },
            { format: 'avif', buffer: avifBuffer, size: avifBuffer.length },
            { format: 'png', buffer: pngBuffer, size: pngBuffer.length },
          ];

          // Sort by size and pick the smallest
          formats.sort((a, b) => a.size - b.size);

          // Use the smallest format's buffer for the final output
          // The pipeline will be overwritten with the selected format's buffer
          // This is a simplification; a more robust approach might re-process with the chosen format
          // However, given the current structure, returning the buffer directly is more straightforward.
          // We'll return the buffer directly in the result object instead of modifying the pipeline.
          // The final `toBuffer()` call after the switch will not be used for AUTO.
          // We need to adjust the return logic outside the switch.

          // Let's adjust the logic to return the best buffer directly.
          // The switch statement should determine the *best* format and then we process it once.
          // Reverting to a simpler approach: determine the best format, then apply it.

          let bestFormat: ImageFormat = ImageFormat.JPEG; // Default fallback
          let minSize = Infinity;

          const testFormats = [
            {
              format: ImageFormat.JPEG,
              method: (p: sharp.Sharp) =>
                p.jpeg({ quality: options.quality || 80 }),
            },
            {
              format: ImageFormat.WEBP,
              method: (p: sharp.Sharp) =>
                p.webp({ quality: options.quality || 80 }),
            },
            {
              format: ImageFormat.AVIF,
              method: (p: sharp.Sharp) =>
                p.avif({ quality: options.quality || 80 }),
            },
            {
              format: ImageFormat.PNG,
              method: (p: sharp.Sharp) =>
                p.png({ quality: options.quality || 80 }),
            },
          ];

          for (const test of testFormats) {
            try {
              const testBuffer = await test.method(pipeline.clone()).toBuffer();
              if (testBuffer.length < minSize) {
                minSize = testBuffer.length;
                bestFormat = test.format;
              }
            } catch (testError) {
              console.warn(
                `Failed to test format ${test.format}: ${testError.message}`,
              );
              // Continue to test other formats
            }
          }

          // Now apply the best format to the original pipeline
          switch (bestFormat) {
            case ImageFormat.JPEG:
              pipeline = pipeline.jpeg({ quality: options.quality || 80 });
              break;
            case ImageFormat.PNG:
              pipeline = pipeline.png({ quality: options.quality || 80 });
              break;
            case ImageFormat.WEBP:
              pipeline = pipeline.webp({ quality: options.quality || 80 });
              break;
            case ImageFormat.AVIF:
              pipeline = pipeline.avif({ quality: options.quality || 80 });
              break;
            // GIF and TIFF are not included in auto testing for smallest size
            default:
              pipeline = pipeline.jpeg({ quality: options.quality || 80 }); // Should not happen with current logic
          }
        } catch (autoError) {
          console.error(
            `Automatic format detection failed: ${autoError.message}`,
          );
          // Fallback to JPEG if auto detection fails
          pipeline = pipeline.jpeg({ quality: options.quality || 80 });
        }
        break;
      default:
        pipeline = pipeline.jpeg({ quality: options.quality || 80 });
    }

    const optimizedBuffer = await pipeline.toBuffer();

    return {
      optimizedBuffer,
      originalSize,
      optimizedSize: optimizedBuffer.length,
      originalName,
      success: true,
    };
  } catch (error) {
    return {
      optimizedBuffer: Buffer.alloc(0),
      originalSize: task.imageBuffer.length,
      optimizedSize: 0,
      originalName: task.originalName,
      success: false,
      error: error.message,
    };
  }
}

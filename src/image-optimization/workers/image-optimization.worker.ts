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
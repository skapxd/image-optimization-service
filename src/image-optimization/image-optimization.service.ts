import { Injectable, BadRequestException } from '@nestjs/common';
import sharp from 'sharp';
import { ImageFormat } from './image-format.enum';

export interface OptimizationOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: ImageFormat;
}

@Injectable()
export class ImageOptimizationService {
  async optimizeImage(
    imagePath: string,
    options: OptimizationOptions,
  ): Promise<Buffer> {
    try {
      const imageBuffer = await sharp(imagePath).toBuffer();

      let pipeline = sharp(imageBuffer);

      // Resize if dimensions are provided
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
          pipeline = pipeline.png({
            quality: options.quality || 80,
            compressionLevel: 9,
          });
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

      return await pipeline.toBuffer();
    } catch (error) {
      throw new BadRequestException(
        `Failed to optimize image: ${error.message}`,
      );
    }
  }

  async getImageMetadata(imageBuffer: Buffer) {
    try {
      const metadata = await sharp(imageBuffer).metadata();
      return {
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        size: metadata.size,
        channels: metadata.channels,
        density: metadata.density,
      };
    } catch (error) {
      throw new BadRequestException(
        `Failed to read image metadata: ${error.message}`,
      );
    }
  }

  async convertFormat(
    imageBuffer: Buffer,
    targetFormat: ImageFormat,
  ): Promise<Buffer> {
    try {
      let pipeline = sharp(imageBuffer);

      switch (targetFormat) {
        case ImageFormat.JPEG:
          pipeline = pipeline.jpeg({ quality: 90 });
          break;
        case ImageFormat.PNG:
          pipeline = pipeline.png();
          break;
        case ImageFormat.WEBP:
          pipeline = pipeline.webp({ quality: 90 });
          break;
        case ImageFormat.AVIF:
          pipeline = pipeline.avif({ quality: 90 });
          break;
        case ImageFormat.GIF:
          pipeline = pipeline.gif();
          break;
        case ImageFormat.TIFF:
          pipeline = pipeline.tiff({ quality: 90 });
          break;
        default:
          pipeline = pipeline.jpeg({ quality: 90 });
      }

      return await pipeline.toBuffer();
    } catch (error) {
      throw new BadRequestException(
        `Failed to convert image format: ${error.message}`,
      );
    }
  }

  async createThumbnail(
    imageBuffer: Buffer,
    width: number = 800,
    height?: number,
  ): Promise<Buffer> {
    try {
      const resizeOptions: any = {
        fit: height ? 'cover' : 'inside',
        position: 'center',
        withoutEnlargement: true,
      };

      return await sharp(imageBuffer)
        .resize(width, height, resizeOptions)
        .jpeg({ quality: 80 })
        .toBuffer();
    } catch (error) {
      throw new BadRequestException(
        `Failed to create thumbnail: ${error.message}`,
      );
    }
  }

  async addWatermark(
    imageBuffer: Buffer,
    watermarkText: string,
    options?: {
      fontSize?: number;
      fontWeight?: 'normal' | 'bold';
      color?: string;
      opacity?: number;
    },
  ): Promise<Buffer> {
    try {
      const { width, height } = await sharp(imageBuffer).metadata();

      // Create SVG watermark
      const fontSize = options?.fontSize || Math.min(width!, height!) / 20;
      const svgWatermark = `
        <svg width="${width}" height="${height}">
          <text
            x="50%"
            y="95%"
            font-family="Arial, sans-serif"
            font-size="${fontSize}"
            font-weight="${options?.fontWeight || 'normal'}"
            fill="${options?.color || 'white'}"
            fill-opacity="${options?.opacity || 0.7}"
            text-anchor="middle"
            dominant-baseline="middle">
            ${watermarkText}
          </text>
        </svg>
      `;

      return await sharp(imageBuffer)
        .composite([
          {
            input: Buffer.from(svgWatermark),
            top: 0,
            left: 0,
          },
        ])
        .toBuffer();
    } catch (error) {
      throw new BadRequestException(
        `Failed to add watermark: ${error.message}`,
      );
    }
  }

  /**
   * Create a lightweight blurred placeholder for an image
   * Optimized for mobile devices and responsive design
   * Useful for preventing layout shift while the main image loads
   */
  async createBlurPlaceholder(
    imageBuffer: Buffer,
    options: {
      width?: number;
      height?: number;
      blurRadius?: number;
      quality?: number;
      mobileOptimized?: boolean;
    } = {},
  ): Promise<Buffer> {
    try {
      const {
        width = 40,
        height,
        blurRadius = 15,
        quality = 15,
        mobileOptimized = true,
      } = options;

      // Get original image metadata for aspect ratio calculations
      const metadata = await sharp(imageBuffer).metadata();
      const aspectRatio =
        metadata.width && metadata.height
          ? metadata.width / metadata.height
          : 1;

      // Calculate mobile-optimized dimensions
      let finalWidth = width;
      let finalHeight = height;

      if (mobileOptimized && !height) {
        // For mobile, use smaller dimensions but maintain aspect ratio
        finalWidth = Math.max(20, Math.min(width, 40)); // Cap at 40px for mobile
        finalHeight = Math.round(finalWidth / aspectRatio);
      } else if (!height) {
        finalHeight = Math.round(finalWidth / aspectRatio);
      }

      const sharpInstance = sharp(imageBuffer)
        .resize(finalWidth, finalHeight, {
          fit: 'cover',
          withoutEnlargement: true,
          background: { r: 128, g: 128, b: 128, alpha: 1 }, // Neutral gray background
        })
        .blur(blurRadius)
        .jpeg({
          quality: mobileOptimized ? Math.max(10, quality - 5) : quality,
          progressive: mobileOptimized === true,
          mozjpeg: true,
          chromaSubsampling: '4:2:0', // Better compression for mobile
          trellisQuantisation: true,
          optimiseScans: mobileOptimized === true,
        });

      return await sharpInstance.toBuffer();
    } catch (error) {
      throw new BadRequestException(
        `Failed to create blur placeholder: ${error.message}`,
      );
    }
  }
}

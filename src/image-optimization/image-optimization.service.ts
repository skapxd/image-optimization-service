import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import sharp from 'sharp';
import { ImageFormat } from './image-format.enum';
import { ImageUploadService } from '../image-upload/image-upload.service';
import { ClientContextService } from 'src/client-context/client-context.service';
import { NotifyCallbackService } from '../notify-callbacks/notify-callbacks.service';
import { ConfigService } from '@nestjs/config';
import { WorkerPoolService } from './services/worker-pool.service';
import { OptimizationTask } from './workers/image-optimization.worker';

export interface OptimizationOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: ImageFormat;
}

@Injectable()
export class ImageOptimizationService {
  private readonly logger = new Logger(ImageOptimizationService.name);

  constructor(
    private readonly imageUploadService: ImageUploadService,
    private readonly clientContext: ClientContextService,
    private readonly notifyCallbackService: NotifyCallbackService,
    private readonly configService: ConfigService,
    private readonly workerPoolService: WorkerPoolService,
  ) {}

  async optimizeImage(
    file: Express.Multer.File,
    options: OptimizationOptions,
    optimizationId: string,
  ): Promise<{ originalSize: number; optimizedSize: number }> {
    try {
      const controllerParams =
        this.clientContext.getControllerParamsContext(optimizationId);

      if (!controllerParams) {
        throw new BadRequestException('Controller parameters not found');
      }

      const { newFilePath } = controllerParams;

      // Read image file
      const imageBuffer = await sharp(file.path).toBuffer();

      // Create optimization task for worker
      const task: OptimizationTask = {
        imageBuffer,
        options: {
          width: options.width,
          height: options.height,
          quality: options.quality,
          format: options.format,
        },
        originalName: file.originalname,
      };

      // Process image using worker pool
      const result = await this.workerPoolService.optimizeImage(task);

      if (!result.success) {
        throw new BadRequestException(
          `Worker optimization failed: ${result.error}`,
        );
      }

      // Upload optimized image
      const mimetype = `image/${options.format || 'jpeg'}`;
      await this.imageUploadService.uploadFile(
        result.optimizedBuffer,
        optimizationId,
        mimetype,
      );

      this.logger.log(
        `Image optimized successfully: ${file.originalname} -> ${newFilePath}`,
      );

      return {
        originalSize: result.originalSize,
        optimizedSize: result.optimizedSize,
      };
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

  async batchOptimizeImages(
    files: Express.Multer.File[],
    optimizationId: string,
    options: OptimizationOptions,
  ): Promise<void> {
    try {
      const controllerParams =
        this.clientContext.getControllerParamsContext(optimizationId);

      if (!controllerParams) {
        throw new BadRequestException('Controller parameters not found');
      }

      const { callbacks, newFilePaths } = controllerParams;

      // Prepare optimization tasks for all files
      const tasks: OptimizationTask[] = await Promise.all(
        files.map(async (file, index) => {
          const imageBuffer = await sharp(file.path).toBuffer();
          return {
            imageBuffer,
            options: {
              width: options.width,
              height: options.height,
              quality: options.quality,
              format: options.format,
            },
            originalName: file.originalname,
          };
        }),
      );

      // Process all images using worker pool
      const workerResults = await this.workerPoolService.optimizeImages(tasks);

      // Process upload and callback results
      const results = await Promise.all(
        workerResults.map(async (workerResult, index) => {
          try {
            const newFilePath = newFilePaths[index];
            const file = files[index];

            if (!workerResult.success) {
              this.logger.error(
                `Failed to optimize batch image ${file.originalname}: ${workerResult.error}`,
              );
              return {
                originalName: file.originalname,
                error: workerResult.error,
                success: false,
              };
            }

            // Store newFilePath in context for this specific file
            this.clientContext.setControllerParamsContext(
              `${optimizationId}_${index}`,
              {
                ...controllerParams,
                newFilePath,
              },
            );

            // Upload optimized image
            const mimetype = `image/${options.format || 'jpeg'}`;
            await this.imageUploadService.uploadFile(
              workerResult.optimizedBuffer,
              `${optimizationId}_${index}`,
              mimetype,
            );

            this.logger.log(
              `Batch image ${index + 1}/${files.length} optimized successfully: ${file.originalname} -> ${newFilePath}`,
            );

            return {
              originalName: file.originalname,
              originalSize: workerResult.originalSize,
              optimizedSize: workerResult.optimizedSize,
              newFilePath,
              success: true,
            };
          } catch (error) {
            this.logger.error(
              `Failed to upload batch image ${files[index].originalname}: ${error.message}`,
            );
            return {
              originalName: files[index].originalname,
              error: error.message,
              success: false,
            };
          }
        }),
      );

      // Notify callbacks if provided
      if (callbacks && callbacks.length > 0) {
        this.notifyCallbackService
          .notify(callbacks, {
            optimizationId,
            type: 'batch',
            results,
            totalFiles: files.length,
            successfulFiles: results.filter((r) => r.success).length,
            failedFiles: results.filter((r) => !r.success).length,
          })
          .catch((err) => {
            this.logger.error(`Failed to notify callbacks: ${err.message}`);
          });
      }
    } catch (error) {
      throw new BadRequestException(
        `Failed to optimize batch images: ${error.message}`,
      );
    }
  }
}

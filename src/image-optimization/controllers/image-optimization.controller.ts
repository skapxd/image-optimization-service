import {
  Controller,
  Post,
  Get,
  Param,
  Res,
  NotFoundException,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
  Query,
  BadRequestException,
  ParseIntPipe,
  DefaultValuePipe,
  Body,
  Headers,
} from '@nestjs/common';
import { Response } from 'express';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiConsumes,
  ApiBody,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { ImageOptimizationService } from '../image-optimization.service';
import { ImageFormat } from '../image-format.enum';
import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { OptimizationCallback } from 'src/notify-callbacks/notify-callbacks.service';
import { ClientContextService } from 'src/client-context/client-context.service';
import { getNewFilePath } from 'src/utils/get-new-file-path';
import { CallbacksJsonPipe } from '../pipes/callbacks-json.pipe';

@ApiTags('image-optimization')
@Controller('image-optimization')
export class ImageOptimizationController {
  constructor(
    private readonly imageOptimizationService: ImageOptimizationService,
    private readonly configService: ConfigService,
    private readonly clientContext: ClientContextService,
  ) {}

  @Post('optimize')
  @ApiOperation({
    summary: 'Optimize a single image with specified dimensions and quality',
    description:
      'Upload a single image for optimization. Returns optimized image data and download URL.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Image file to optimize and callback URLs',
    schema: {
      type: 'object',
      properties: {
        image: {
          type: 'string',
          format: 'binary',
          description: 'Image file to optimize (JPEG, PNG, WebP, TIFF, GIF)',
        },
        callbacks: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'URL to notify when optimization is complete',
              },
              headers: {
                type: 'object',
                description: 'Optional headers for the callback request',
              },
              method: {
                type: 'string',
                enum: ['GET', 'POST', 'PUT', 'PATCH'],
                default: 'POST',
                description: 'HTTP method for the callback request',
              },
            },
            required: ['url'],
          },
          description: 'Callbacks to notify when optimization is complete',
        },
      },
      required: ['image'],
    },
  })
  @ApiQuery({
    name: 'width',
    required: false,
    description:
      'Target width in pixels (optimized for high DPI mobile devices)',
    example: 800,
  })
  @ApiQuery({
    name: 'height',
    required: false,
    description:
      'Target height in pixels (leave empty to maintain aspect ratio)',
    example: null,
  })
  @ApiQuery({
    name: 'quality',
    required: false,
    description: 'Quality level (1-100)',
    example: 80,
  })
  @ApiQuery({
    name: 'format',
    required: false,
    description: 'Output format',
    enum: ImageFormat,
    example: ImageFormat.JPEG,
  })
  @ApiResponse({
    status: 200,
    description: 'Image optimized successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        originalName: { type: 'string' },
        originalSize: { type: 'number' },
        optimizedSize: { type: 'number' },
        compressionRatio: { type: 'number' },
        data: {
          type: 'string',
          description: 'Filename of the optimized image',
        },
        downloadUrl: {
          type: 'string',
          description: 'URL to download the optimized image',
        },
        callbacksScheduled: {
          type: 'number',
          description: 'Number of callbacks scheduled',
        },
        optimizationId: {
          type: 'string',
          description: 'ID for subscribing to SSE notifications',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - invalid file or parameters',
  })
  @UseInterceptors(FileInterceptor('image'))
  optimizeImage(
    @UploadedFile() file: Express.Multer.File,
    @Body('callbacks', CallbacksJsonPipe)
    callbacks: OptimizationCallback[] = [],
    @Query('width', new DefaultValuePipe(800), ParseIntPipe) width: number,
    @Query('height', new DefaultValuePipe(null)) height: number | null,
    @Query('quality', new DefaultValuePipe(80), ParseIntPipe) quality: number,
    @Query('format', new DefaultValuePipe('jpeg')) format: string,
  ) {
    if (!file) {
      throw new BadRequestException('No image file provided');
    }

    // Validar parámetros
    if (width < 1 || width > 8000) {
      throw new BadRequestException('Width must be between 1 and 8000 pixels');
    }

    if (height !== null && (height < 1 || height > 8000)) {
      throw new BadRequestException('Height must be between 1 and 8000 pixels');
    }

    if (quality < 1 || quality > 100) {
      throw new BadRequestException('Quality must be between 1 and 100');
    }

    if (
      !Object.values(ImageFormat).includes(format.toLowerCase() as ImageFormat)
    ) {
      throw new BadRequestException(
        `Format must be one of: ${Object.values(ImageFormat).join(', ')}`,
      );
    }

    const newFilePath = getNewFilePath(format);
    const optimizationId = randomUUID();

    // Almacenar los parámetros del controlador en el contexto del cliente
    this.clientContext.setControllerParamsContext(optimizationId, {
      file,
      callbacks,
      width,
      height,
      quality,
      format,
      newFilePath,
    });

    // Iniciar el proceso de optimización
    this.imageOptimizationService
      .optimizeImage(
        file,
        {
          width,
          ...(height !== null && { height }),
          quality,
          format: format.toLowerCase() as ImageFormat,
        },
        optimizationId,
      )
      .catch((error) => {
        console.error('Error optimizing image:', error);
      });

    const urlBase = this.configService.get<string>('S3_CUSTOM_DOMAIN');

    return {
      message: 'Image optimization started',
      originalSize: file.size,
      data: newFilePath,
      downloadUrl: new URL(newFilePath, urlBase),
      callbacksScheduled: callbacks?.length || 0,
      optimizationId, // Devolver el ID para que el cliente pueda suscribirse a los eventos
    };
  }

  @Post('batch-optimize')
  @ApiOperation({
    summary: 'Optimize multiple images in batch',
    description:
      'Upload multiple images for optimization. Returns batch optimization status and download URLs for each processed image.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Image files to optimize and optional callback URLs',
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
          description: 'Image files to optimize (JPEG, PNG, WebP, TIFF, GIF)',
          maxItems: 10,
        },
        callbacks: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description:
                  'URL to notify when batch optimization is complete',
              },
              headers: {
                type: 'object',
                description: 'Optional headers for the callback request',
              },
              method: {
                type: 'string',
                enum: ['GET', 'POST', 'PUT', 'PATCH'],
                default: 'POST',
                description: 'HTTP method for the callback request',
              },
            },
            required: ['url'],
          },
          description:
            'Callbacks to notify when batch optimization is complete',
        },
      },
      required: ['files'],
    },
  })
  @ApiQuery({
    name: 'width',
    required: false,
    description:
      'Target width in pixels (optimized for high DPI mobile devices)',
    example: 800,
    type: 'number',
    minimum: 1,
    maximum: 8000,
  })
  @ApiQuery({
    name: 'height',
    required: false,
    description:
      'Target height in pixels (leave empty to maintain aspect ratio)',
    example: null,
    type: 'number',
    minimum: 1,
    maximum: 8000,
  })
  @ApiQuery({
    name: 'quality',
    required: false,
    description: 'Quality level for JPEG/WebP formats (1-100)',
    example: 80,
    type: 'number',
    minimum: 1,
    maximum: 100,
  })
  @ApiQuery({
    name: 'format',
    required: false,
    description: 'Output format for all optimized images',
    enum: ImageFormat,
    example: ImageFormat.JPEG,
  })
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
      },
    }),
  )
  batchOptimizeImages(
    @UploadedFiles() files: Express.Multer.File[],
    @Body('callbacks', CallbacksJsonPipe)
    callbacks: OptimizationCallback[] = [],
    @Query('width', new DefaultValuePipe(800), ParseIntPipe) width: number,
    @Query('height', new DefaultValuePipe(null)) height: number | null,
    @Query('quality', new DefaultValuePipe(80), ParseIntPipe) quality: number,
    @Query('format', new DefaultValuePipe('jpeg')) format: string,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No image files provided');
    }

    // Validar parámetros
    if (width < 1 || width > 8000) {
      throw new BadRequestException('Width must be between 1 and 8000 pixels');
    }

    if (height !== null && (height < 1 || height > 8000)) {
      throw new BadRequestException('Height must be between 1 and 8000 pixels');
    }

    if (quality < 1 || quality > 100) {
      throw new BadRequestException('Quality must be between 1 and 100');
    }

    if (
      !Object.values(ImageFormat).includes(format.toLowerCase() as ImageFormat)
    ) {
      throw new BadRequestException(
        `Format must be one of: ${Object.values(ImageFormat).join(', ')}`,
      );
    }

    const optimizationId = randomUUID();
    const newFilePaths = files.map(() => getNewFilePath(format));

    // Almacenar los parámetros del controlador en el contexto del cliente
    this.clientContext.setControllerParamsContext(optimizationId, {
      files,
      callbacks,
      width,
      height,
      quality,
      format,
      newFilePaths,
    });

    // Iniciar el proceso de optimización en lote
    this.imageOptimizationService
      .batchOptimizeImages(files, optimizationId, {
        width,
        ...(height !== null && { height }),
        quality,
        format: format.toLowerCase() as ImageFormat,
      })
      .catch((error) => {
        console.error('Error optimizing batch images:', error);
      });

    const urlBase = this.configService.get<string>('S3_CUSTOM_DOMAIN');

    return {
      message: 'Batch image optimization started',
      count: files.length,
      callbacksScheduled: callbacks?.length || 0,
      optimizationId, // Devolver el ID para que el cliente pueda suscribirse a los eventos
      results: files.map((file, index) => ({
        originalName: file.originalname,
        originalSize: file.size,
        data: newFilePaths[index],
        downloadUrl: new URL(newFilePaths[index], urlBase),
      })),
    };
  }

  @Post('blur-placeholder')
  @ApiOperation({
    summary:
      'Generate a mobile-optimized blurred placeholder for an image to prevent layout shift',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Image file to create blur placeholder from',
    schema: {
      type: 'object',
      properties: {
        image: {
          type: 'string',
          format: 'binary',
          description:
            'Image file to create blur placeholder from (JPEG, PNG, WebP, TIFF, GIF)',
        },
      },
      required: ['image'],
    },
  })
  @ApiQuery({
    name: 'width',
    required: false,
    description:
      'Placeholder width in pixels (default: 40, optimized for mobile)',
    example: 40,
  })
  @ApiQuery({
    name: 'height',
    required: false,
    description:
      'Placeholder height in pixels (leave empty to maintain aspect ratio)',
    example: null,
  })
  @ApiQuery({
    name: 'blurRadius',
    required: false,
    description:
      'Blur intensity (1-50, default: 15 for better mobile appearance)',
    example: 15,
  })
  @ApiQuery({
    name: 'quality',
    required: false,
    description:
      'JPEG quality for placeholder (1-50, default: 15 for mobile optimization)',
    example: 15,
  })
  @ApiQuery({
    name: 'mobileOptimized',
    required: false,
    description: 'Enable mobile-specific optimizations (default: true)',
    example: true,
  })
  @ApiResponse({
    status: 200,
    description: 'Blur placeholder generated successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        originalSize: { type: 'number' },
        placeholderSize: { type: 'number' },
        compressionRatio: { type: 'number' },
        data: {
          type: 'string',
          description: 'Base64 encoded blur placeholder',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - invalid file or parameters',
  })
  @UseInterceptors(FileInterceptor('image'))
  async createBlurPlaceholder(
    @UploadedFile() file: Express.Multer.File,
    @Query('width', new DefaultValuePipe(40), ParseIntPipe) width: number,
    @Query('height', new DefaultValuePipe(null)) height: number | null,
    @Query('blurRadius', new DefaultValuePipe(15), ParseIntPipe)
    blurRadius: number,
    @Query('quality', new DefaultValuePipe(15), ParseIntPipe) quality: number,
    @Query('mobileOptimized', new DefaultValuePipe(true))
    mobileOptimized: boolean,
  ) {
    if (!file) {
      throw new BadRequestException('No image file provided');
    }

    if (blurRadius < 1 || blurRadius > 50) {
      throw new BadRequestException('Blur radius must be between 1 and 50');
    }

    if (quality < 1 || quality > 50) {
      throw new BadRequestException(
        'Quality must be between 1 and 50 for blur placeholders',
      );
    }

    if (width < 10 || width > 256) {
      throw new BadRequestException(
        'Width must be between 10 and 256 pixels for blur placeholders',
      );
    }

    const blurPlaceholder =
      await this.imageOptimizationService.createBlurPlaceholder(file.buffer, {
        width,
        ...(height !== null && { height }),
        blurRadius,
        quality,
        mobileOptimized,
      });

    return {
      message: 'Blur placeholder generated successfully',
      originalSize: file.size,
      placeholderSize: blurPlaceholder.length,
      compressionRatio: Math.round(
        ((file.size - blurPlaceholder.length) / file.size) * 100,
      ),
      data: blurPlaceholder.toString('base64'),
    };
  }

  @Post('test')
  test(@Body() body: any, @Headers() headers: Record<string, string>): string {
    return 'test';
  }
}

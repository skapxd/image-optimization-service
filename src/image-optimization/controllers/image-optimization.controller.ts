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
      .optimizeImage(file.path, optimizationId, {
        width,
        ...(height !== null && { height }),
        quality,
        format: format.toLowerCase() as ImageFormat,
      })
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
      'Upload multiple images for optimization. Returns optimization status and download URLs.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Image files to optimize and callback URLs',
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
        },
        callbacks: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              url: { type: 'string' },
              method: { type: 'string', enum: ['GET', 'POST'] },
              headers: { type: 'object' },
            },
          },
          description:
            'Optional callback URLs to notify when optimization is complete',
        },
      },
      required: ['files'],
    },
  })
  @ApiQuery({
    name: 'width',
    required: false,
    description: 'Target width in pixels',
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
    description: 'JPEG/WebP quality (1-100)',
    example: 80,
  })
  @ApiQuery({
    name: 'format',
    required: false,
    description: 'Output format (jpeg, png, webp, avif)',
    example: 'jpeg',
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
    @Body('callbacks') callbacks: OptimizationCallback[] = [],
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
      !['jpeg', 'jpg', 'png', 'webp', 'avif'].includes(format.toLowerCase())
    ) {
      throw new BadRequestException(
        'Format must be one of: jpeg, jpg, png, webp, avif',
      );
    }

    // Generar un ID único para esta optimización por lotes
    const optimizationId = randomUUID();

    // Almacenar los parámetros del controlador en el contexto del cliente
    this.clientContext.setControllerParamsContext(optimizationId, {
      files,
      callbacks,
      width,
      height,
      quality,
      format,
    });

    //   if (!files || files.length === 0) {
    //     throw new BadRequestException('No image files provided');
    //   }
    //   if (quality < 1 || quality > 100) {
    //     throw new BadRequestException('Quality must be between 1 and 100');
    //   }
    //   if (
    //     !Object.values(ImageFormat).includes(format.toLowerCase() as ImageFormat)
    //   ) {
    //     throw new BadRequestException(
    //       `Format must be one of: ${Object.values(ImageFormat).join(', ')}`,
    //     );
    //   }
    //   const optimizationId = randomUUID();
    //   // Generar nombres de archivo únicos para cada imagen antes del procesamiento
    //   const fileNames = files.map(
    //     (file, index) => `${randomUUID()}_${Date.now()}_${index}.${format}`,
    //   );
    //   // Definir el tipo para los resultados
    //   const results: Array<{
    //     originalName: string;
    //     originalSize: number;
    //     optimizedSize?: number;
    //     compressionRatio?: number;
    //     fileName?: string;
    //     error?: string;
    //   }> = [];
    //   // Enviar evento de inicio de optimización por lotes
    //   this.sseController.sendOptimizationEvent({
    //     id: optimizationId,
    //     type: 'progress',
    //     data: {
    //       progress: 0,
    //       message: 'Starting batch optimization',
    //       totalFiles: files.length,
    //     },
    //   });
    //   // Procesar cada archivo
    //   const processPromises = files.map(async (file, index) => {
    //     try {
    //       const newFileName = fileNames[index];
    //       // Enviar evento de progreso para este archivo
    //       this.sseController.sendOptimizationEvent({
    //         id: optimizationId,
    //         type: 'progress',
    //         data: {
    //           progress: Math.round((index / files.length) * 100),
    //           message: `Optimizing file ${index + 1} of ${files.length}`,
    //           fileName: newFileName,
    //           originalName: file.originalname,
    //           originalSize: file.size,
    //         },
    //       });
    //       const optimizedImage =
    //         await this.imageOptimizationService.optimizeImage(file.path, {
    //           width,
    //           ...(height !== null && { height }),
    //           quality,
    //           format: format.toLowerCase() as ImageFormat,
    //         });
    //       await writeFile(`./uploads/optimized/${newFileName}`, optimizedImage);
    //       const fileResult = {
    //         originalName: file.originalname,
    //         originalSize: file.size,
    //         optimizedSize: optimizedImage.length,
    //         compressionRatio: Math.round(
    //           ((file.size - optimizedImage.length) / file.size) * 100,
    //         ),
    //         fileName: newFileName,
    //       };
    //       results.push(fileResult);
    //       return fileResult;
    //     } catch (error) {
    //       console.error(`Error optimizing image ${file.originalname}:`, error);
    //       // Enviar evento de error para este archivo específico
    //       this.sseController.sendOptimizationEvent({
    //         id: optimizationId,
    //         type: 'progress',
    //         data: {
    //           progress: Math.round((index / files.length) * 100),
    //           message: `Error optimizing file ${index + 1} of ${files.length}`,
    //           fileName: file.originalname,
    //           error: error.message,
    //         },
    //       });
    //       return {
    //         originalName: file.originalname,
    //         originalSize: file.size,
    //         error: error.message,
    //       };
    //     }
    //   });
    //   // Iniciar el procesamiento en segundo plano
    //   Promise.all(processPromises)
    //     .then((processedResults) => {
    //       // Datos de optimización por lotes
    //       const batchData = {
    //         count: processedResults.length,
    //         results: processedResults,
    //       };
    //       // Enviar evento de finalización de optimización por lotes
    //       this.sseController.sendOptimizationEvent({
    //         id: optimizationId,
    //         type: 'complete',
    //         data: batchData,
    //       });
    //       // Notificar a todos los callbacks
    //       if (callbacks && callbacks.length > 0) {
    //         this.notifyCallbacks(JSON.parse(callbacks as any), batchData);
    //       }
    //     })
    //     .catch((error) => {
    //       console.error('Error in batch optimization:', error);
    //       // Enviar evento de error general
    //       this.sseController.sendOptimizationEvent({
    //         id: optimizationId,
    //         type: 'error',
    //         data: {
    //           message: 'Error in batch optimization',
    //           error: error.message,
    //         },
    //       });
    //     });
    //   return {
    //     message: 'Batch image optimization started',
    //     count: files.length,
    //     callbacksScheduled: callbacks?.length || 0,
    //     optimizationId, // Devolver el ID para que el cliente pueda suscribirse a los eventos
    //     results: files.map((file, index) => {
    //       return {
    //         originalName: file.originalname,
    //         originalSize: file.size,
    //         data: `Processing...`, // No devolvemos los datos de la imagen, ya que se procesarán de forma asíncrona
    //         expectedFilename: fileNames[index],
    //         downloadUrl: `/image-optimization/download/${fileNames[index]}`,
    //       };
    //     }),
    //   };
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

  @Get('download/:filename')
  @ApiOperation({
    summary: 'Download an optimized image by filename',
    description:
      'Retrieve and download an optimized image file using its filename',
  })
  @ApiResponse({
    status: 200,
    description: 'Image file downloaded successfully',
    content: {
      'image/jpeg': {
        schema: {
          type: 'string',
          format: 'binary',
        },
      },
      'image/png': {
        schema: {
          type: 'string',
          format: 'binary',
        },
      },
      'image/webp': {
        schema: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Image file not found',
  })
  downloadOptimizedImage(
    @Param('filename') filename: string,
    @Res() res: Response,
  ) {
    // Validar que el filename no contenga caracteres peligrosos
    if (!/^[a-zA-Z0-9_-]+\.[a-zA-Z]{2,4}$/.test(filename)) {
      throw new BadRequestException('Invalid filename format');
    }

    // Construir la ruta del archivo
    const filePath = join(process.cwd(), 'uploads', 'optimized', filename);

    // Verificar que el archivo existe
    if (!existsSync(filePath)) {
      throw new NotFoundException('Image file not found');
    }

    // Determinar el tipo de contenido basado en la extensión
    const extension = filename.split('.').pop()?.toLowerCase();
    let contentType = 'application/octet-stream';

    switch (extension) {
      case 'jpg':
      case 'jpeg':
        contentType = 'image/jpeg';
        break;
      case 'png':
        contentType = 'image/png';
        break;
      case 'webp':
        contentType = 'image/webp';
        break;
      case 'gif':
        contentType = 'image/gif';
        break;
      case 'tiff':
      case 'tif':
        contentType = 'image/tiff';
        break;
    }

    // Configurar headers de respuesta
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache por 1 año

    // Enviar el archivo
    res.sendFile(filePath);
  }

  @Post('test')
  test(@Body() body: any) {
    return 'test';
  }
}

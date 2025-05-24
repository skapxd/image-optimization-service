import {
  Controller,
  Post,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
  Query,
  BadRequestException,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiConsumes,
  ApiBody,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { ImageOptimizationService } from './image-optimization.service';
import { ImageFormat } from './image-format.enum';

@ApiTags('image-optimization')
@Controller('image-optimization')
export class ImageOptimizationController {
  constructor(
    private readonly imageOptimizationService: ImageOptimizationService,
  ) {}

  @Post('optimize')
  @ApiOperation({ summary: 'Optimize a single image with specified dimensions and quality' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Image file to optimize',
    schema: {
      type: 'object',
      properties: {
        image: {
          type: 'string',
          format: 'binary',
          description: 'Image file to optimize (JPEG, PNG, WebP, TIFF, GIF)',
        },
      },
      required: ['image'],
    },
  })
  @ApiQuery({ name: 'width', required: false, description: 'Target width in pixels (optimized for high DPI mobile devices)', example: 937 })
  @ApiQuery({ name: 'height', required: false, description: 'Target height in pixels (leave empty to maintain aspect ratio)', example: null })
  @ApiQuery({ name: 'quality', required: false, description: 'Quality level (1-100)', example: 80 })
  @ApiQuery({ name: 'format', required: false, description: 'Output format', enum: ImageFormat, example: ImageFormat.JPEG })
  @ApiResponse({
    status: 200,
    description: 'Image optimized successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        originalSize: { type: 'number' },
        optimizedSize: { type: 'number' },
        compressionRatio: { type: 'number' },
        data: { type: 'string', description: 'Base64 encoded optimized image' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Bad request - invalid file or parameters' })
  @UseInterceptors(FileInterceptor('image'))
  async optimizeImage(
    @UploadedFile() file: Express.Multer.File,
    @Query('width', new DefaultValuePipe(937), ParseIntPipe) width: number,
    @Query('height', new DefaultValuePipe(null)) height: number | null,
    @Query('quality', new DefaultValuePipe(80), ParseIntPipe) quality: number,
    @Query('format', new DefaultValuePipe('jpeg')) format: string,
  ) {
    if (!file) {
      throw new BadRequestException('No image file provided');
    }

    if (quality < 1 || quality > 100) {
      throw new BadRequestException('Quality must be between 1 and 100');
    }

    if (!Object.values(ImageFormat).includes(format.toLowerCase() as ImageFormat)) {
      throw new BadRequestException(`Format must be one of: ${Object.values(ImageFormat).join(', ')}`);
    }

    const optimizedImage = await this.imageOptimizationService.optimizeImage(
      file.buffer,
      {
        width,
        ...(height !== null && { height }),
        quality,
        format: format.toLowerCase() as ImageFormat,
      },
    );

    return {
      message: 'Image optimized successfully',
      originalSize: file.size,
      optimizedSize: optimizedImage.length,
      compressionRatio: Math.round(
        ((file.size - optimizedImage.length) / file.size) * 100,
      ),
      data: optimizedImage.toString('base64'),
    };
  }

  @Post('batch-optimize')
  @ApiOperation({ summary: 'Optimize multiple images at once' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Multiple image files to optimize',
    schema: {
      type: 'object',
      properties: {
        images: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
          description: 'Array of image files to optimize',
        },
      },
      required: ['images'],
    },
  })
  @ApiQuery({ name: 'width', required: false, description: 'Target width in pixels (optimized for high DPI mobile devices)', example: 937 })
  @ApiQuery({ name: 'height', required: false, description: 'Target height in pixels (leave empty to maintain aspect ratio)', example: null })
  @ApiQuery({ name: 'quality', required: false, description: 'Quality level (1-100)', example: 80 })
  @ApiQuery({ name: 'format', required: false, description: 'Output format', enum: ImageFormat, example: ImageFormat.JPEG })
  @ApiResponse({
    status: 200,
    description: 'Images optimized successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        count: { type: 'number' },
        results: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              originalName: { type: 'string' },
              originalSize: { type: 'number' },
              optimizedSize: { type: 'number' },
              compressionRatio: { type: 'number' },
              data: { type: 'string', description: 'Base64 encoded optimized image' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Bad request - invalid files or parameters' })
  @UseInterceptors(FilesInterceptor('images'))
  async batchOptimizeImages(
    @UploadedFiles() files: Express.Multer.File[],
    @Query('width', new DefaultValuePipe(937), ParseIntPipe) width: number,
    @Query('height', new DefaultValuePipe(null)) height: number | null,
    @Query('quality', new DefaultValuePipe(80), ParseIntPipe) quality: number,
    @Query('format', new DefaultValuePipe('jpeg')) format: string,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No image files provided');
    }

    const results = await Promise.all(
      files.map(async (file) => {
        const optimizedImage =
          await this.imageOptimizationService.optimizeImage(file.buffer, {
            width,
            ...(height !== null && { height }),
            quality,
            format: format.toLowerCase() as ImageFormat,
          });

        return {
          originalName: file.originalname,
          originalSize: file.size,
          optimizedSize: optimizedImage.length,
          compressionRatio: Math.round(
            ((file.size - optimizedImage.length) / file.size) * 100,
          ),
          data: optimizedImage.toString('base64'),
        };
      }),
    );

    return {
      message: 'Images optimized successfully',
      count: results.length,
      results,
    };
  }

  @Post('blur-placeholder')
  @ApiOperation({ summary: 'Generate a mobile-optimized blurred placeholder for an image to prevent layout shift' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Image file to create blur placeholder from',
    schema: {
      type: 'object',
      properties: {
        image: {
          type: 'string',
          format: 'binary',
          description: 'Image file to create blur placeholder from (JPEG, PNG, WebP, TIFF, GIF)',
        },
      },
      required: ['image'],
    },
  })
  @ApiQuery({ name: 'width', required: false, description: 'Placeholder width in pixels (default: 40, optimized for mobile)', example: 40 })
  @ApiQuery({ name: 'height', required: false, description: 'Placeholder height in pixels (leave empty to maintain aspect ratio)', example: null })
  @ApiQuery({ name: 'blurRadius', required: false, description: 'Blur intensity (1-50, default: 15 for better mobile appearance)', example: 15 })
  @ApiQuery({ name: 'quality', required: false, description: 'JPEG quality for placeholder (1-50, default: 15 for mobile optimization)', example: 15 })
  @ApiQuery({ name: 'mobileOptimized', required: false, description: 'Enable mobile-specific optimizations (default: true)', example: true })
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
        data: { type: 'string', description: 'Base64 encoded blur placeholder' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Bad request - invalid file or parameters' })
  @UseInterceptors(FileInterceptor('image'))
  async createBlurPlaceholder(
    @UploadedFile() file: Express.Multer.File,
    @Query('width', new DefaultValuePipe(40), ParseIntPipe) width: number,
    @Query('height', new DefaultValuePipe(null)) height: number | null,
    @Query('blurRadius', new DefaultValuePipe(15), ParseIntPipe) blurRadius: number,
    @Query('quality', new DefaultValuePipe(15), ParseIntPipe) quality: number,
    @Query('mobileOptimized', new DefaultValuePipe(true)) mobileOptimized: boolean,
  ) {
    if (!file) {
      throw new BadRequestException('No image file provided');
    }

    if (blurRadius < 1 || blurRadius > 50) {
      throw new BadRequestException('Blur radius must be between 1 and 50');
    }

    if (quality < 1 || quality > 50) {
      throw new BadRequestException('Quality must be between 1 and 50 for blur placeholders');
    }

    if (width < 10 || width > 256) {
      throw new BadRequestException('Width must be between 10 and 256 pixels for blur placeholders');
    }

    const blurPlaceholder = await this.imageOptimizationService.createBlurPlaceholder(
      file.buffer,
      {
        width,
        ...(height !== null && { height }),
        blurRadius,
        quality,
        mobileOptimized,
      },
    );

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
}
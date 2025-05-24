import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  Query,
  BadRequestException,
  Body,
  Get,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
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

@ApiTags('advanced-image')
@Controller('advanced-image')
export class AdvancedImageController {
  constructor(
    private readonly imageOptimizationService: ImageOptimizationService,
  ) {}

  @Post('metadata')
  @ApiOperation({ summary: 'Get metadata information from an image' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Image file to analyze',
    schema: {
      type: 'object',
      properties: {
        image: {
          type: 'string',
          format: 'binary',
          description: 'Image file to get metadata from',
        },
      },
      required: ['image'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Image metadata retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        filename: { type: 'string' },
        mimetype: { type: 'string' },
        fileSize: { type: 'number' },
        metadata: {
          type: 'object',
          properties: {
            width: { type: 'number' },
            height: { type: 'number' },
            format: { type: 'string' },
            size: { type: 'number' },
            density: { type: 'number' },
            hasAlpha: { type: 'boolean' },
            space: { type: 'string' },
            channels: { type: 'number' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'No image file provided' })
  @UseInterceptors(FileInterceptor('image'))
  async getImageMetadata(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No image file provided');
    }

    const metadata = await this.imageOptimizationService.getImageMetadata(
      file.buffer,
    );

    return {
      filename: file.originalname,
      mimetype: file.mimetype,
      fileSize: file.size,
      metadata,
    };
  }

  @Post('convert')
  @ApiOperation({ summary: 'Convert image to different format' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Image file to convert',
    schema: {
      type: 'object',
      properties: {
        image: {
          type: 'string',
          format: 'binary',
          description: 'Image file to convert',
        },
      },
      required: ['image'],
    },
  })
  @ApiQuery({
    name: 'format',
    required: true,
    description: 'Target format',
    enum: ImageFormat,
    example: ImageFormat.WEBP,
  })
  @ApiResponse({
    status: 200,
    description: 'Image converted successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        originalFormat: { type: 'string' },
        newFormat: { type: 'string' },
        originalSize: { type: 'number' },
        newSize: { type: 'number' },
        data: { type: 'string', description: 'Base64 encoded image data' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - invalid file or format',
  })
  @UseInterceptors(FileInterceptor('image'))
  async convertFormat(
    @UploadedFile() file: Express.Multer.File,
    @Query('format') format: string,
  ) {
    if (!file) {
      throw new BadRequestException('No image file provided');
    }

    if (
      !Object.values(ImageFormat).includes(format.toLowerCase() as ImageFormat)
    ) {
      throw new BadRequestException(
        `Format must be one of: ${Object.values(ImageFormat).join(', ')}`,
      );
    }

    const convertedImage = await this.imageOptimizationService.convertFormat(
      file.buffer,
      format.toLowerCase() as ImageFormat,
    );

    return {
      message: 'Image format converted successfully',
      originalFormat: file.mimetype,
      newFormat: format.toLowerCase(),
      originalSize: file.size,
      newSize: convertedImage.length,
      data: convertedImage.toString('base64'),
    };
  }

  @Post('thumbnail')
  @ApiOperation({ summary: 'Create a thumbnail from an image' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Image file to create thumbnail from',
    schema: {
      type: 'object',
      properties: {
        image: {
          type: 'string',
          format: 'binary',
          description: 'Image file to create thumbnail from',
        },
      },
      required: ['image'],
    },
  })
  @ApiQuery({
    name: 'width',
    required: false,
    description:
      'Thumbnail width in pixels (optimized for high DPI mobile devices)',
    example: 937,
  })
  @ApiQuery({
    name: 'height',
    required: false,
    description:
      'Thumbnail height in pixels (optional, omit to maintain aspect ratio)',
    example: null,
  })
  @ApiResponse({
    status: 200,
    description: 'Thumbnail created successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        originalSize: { type: 'number' },
        thumbnailSize: { type: 'number' },
        dimensions: {
          type: 'object',
          properties: {
            width: { type: 'number' },
            height: { type: 'number' },
          },
        },
        data: { type: 'string', description: 'Base64 encoded thumbnail data' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'No image file provided' })
  @UseInterceptors(FileInterceptor('image'))
  async createThumbnail(
    @UploadedFile() file: Express.Multer.File,
    @Query('width', new DefaultValuePipe(937), ParseIntPipe) width: number,
    @Query('height', new DefaultValuePipe(null)) height?: number,
  ) {
    if (!file) {
      throw new BadRequestException('No image file provided');
    }

    const thumbnail = await this.imageOptimizationService.createThumbnail(
      file.buffer,
      width,
      height,
    );

    return {
      message: 'Thumbnail created successfully',
      originalSize: file.size,
      thumbnailSize: thumbnail.length,
      dimensions: { width, height },
      data: thumbnail.toString('base64'),
    };
  }

  @Post('watermark')
  @ApiOperation({ summary: 'Add a text watermark to an image' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Image file and watermark options',
    schema: {
      type: 'object',
      properties: {
        image: {
          type: 'string',
          format: 'binary',
          description: 'Image file to add watermark to',
        },
        text: {
          type: 'string',
          description: 'Watermark text',
          example: 'Copyright 2024',
        },
        fontSize: {
          type: 'number',
          description: 'Font size for watermark',
          example: 24,
        },
        fontWeight: {
          type: 'string',
          enum: ['normal', 'bold'],
          description: 'Font weight for watermark',
          example: 'normal',
        },
        color: {
          type: 'string',
          description: 'Color for watermark text',
          example: '#ffffff',
        },
        opacity: {
          type: 'number',
          description: 'Watermark opacity (0-1)',
          example: 0.5,
        },
      },
      required: ['image', 'text'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Watermark added successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        originalSize: { type: 'number' },
        watermarkedSize: { type: 'number' },
        watermarkText: { type: 'string' },
        data: {
          type: 'string',
          description: 'Base64 encoded watermarked image data',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - missing file or text',
  })
  @UseInterceptors(FileInterceptor('image'))
  async addWatermark(
    @UploadedFile() file: Express.Multer.File,
    @Body()
    watermarkOptions: {
      text: string;
      fontSize?: number;
      fontWeight?: 'normal' | 'bold';
      color?: string;
      opacity?: number;
    },
  ) {
    if (!file) {
      throw new BadRequestException('No image file provided');
    }

    if (!watermarkOptions.text) {
      throw new BadRequestException('Watermark text is required');
    }

    const watermarkedImage = await this.imageOptimizationService.addWatermark(
      file.buffer,
      watermarkOptions.text,
      {
        fontSize: watermarkOptions.fontSize,
        fontWeight: watermarkOptions.fontWeight,
        color: watermarkOptions.color,
        opacity: watermarkOptions.opacity,
      },
    );

    return {
      message: 'Watermark added successfully',
      originalSize: file.size,
      watermarkedSize: watermarkedImage.length,
      watermarkText: watermarkOptions.text,
      data: watermarkedImage.toString('base64'),
    };
  }

  @Get('supported-formats')
  @ApiOperation({ summary: 'Get list of supported image formats' })
  @ApiResponse({
    status: 200,
    description: 'List of supported formats',
    schema: {
      type: 'object',
      properties: {
        inputFormats: {
          type: 'array',
          items: { type: 'string' },
          description: 'Supported input formats',
        },
        outputFormats: {
          type: 'array',
          items: { type: 'string' },
          description: 'Supported output formats',
        },
        description: { type: 'string' },
      },
    },
  })
  getSupportedFormats() {
    return {
      inputFormats: ['jpeg', 'jpg', 'png', 'gif', 'webp', 'svg', 'tiff', 'bmp'],
      outputFormats: ['jpeg', 'png', 'webp'],
      description: 'List of supported input and output image formats',
    };
  }

  @Get('optimization-presets')
  @ApiOperation({ summary: 'Get available optimization presets' })
  @ApiResponse({
    status: 200,
    description: 'Available optimization presets',
    schema: {
      type: 'object',
      properties: {
        web: {
          type: 'object',
          properties: {
            description: { type: 'string' },
            maxWidth: { type: 'number' },
            maxHeight: { type: 'number' },
            quality: { type: 'number' },
            format: { type: 'string' },
          },
        },
        thumbnail: {
          type: 'object',
          properties: {
            description: { type: 'string' },
            maxWidth: { type: 'number' },
            maxHeight: { type: 'number' },
            quality: { type: 'number' },
            format: { type: 'string' },
          },
        },
        print: {
          type: 'object',
          properties: {
            description: { type: 'string' },
            maxWidth: { type: 'number' },
            maxHeight: { type: 'number' },
            quality: { type: 'number' },
            format: { type: 'string' },
          },
        },
        mobile: {
          type: 'object',
          properties: {
            description: { type: 'string' },
            maxWidth: { type: 'number' },
            maxHeight: { type: 'number' },
            quality: { type: 'number' },
            format: { type: 'string' },
          },
        },
      },
    },
  })
  getOptimizationPresets() {
    return {
      web: {
        description: 'Optimized for web usage',
        maxWidth: 1920,
        maxHeight: 1080,
        quality: 85,
        format: 'webp',
      },
      thumbnail: {
        description: 'Small thumbnail images',
        maxWidth: 300,
        maxHeight: 300,
        quality: 80,
        format: 'jpeg',
      },
      print: {
        description: 'High quality for printing',
        maxWidth: 3000,
        maxHeight: 3000,
        quality: 95,
        format: 'png',
      },
      mobile: {
        description: 'Optimized for mobile devices',
        maxWidth: 800,
        maxHeight: 600,
        quality: 70,
        format: 'webp',
      },
    };
  }
}

import { IsNumber, IsOptional, IsString, Min, Max, IsEnum } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ImageFormat } from '../image-format.enum';

export class ImageOptimizationRequestDto {
  @ApiPropertyOptional({
    description: 'Target width in pixels',
    example: 937,
    minimum: 1,
    maximum: 10000,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10000)
  @Transform(({ value }) => parseInt(value))
  width?: number;

  @ApiPropertyOptional({
    description: 'Target height in pixels',
    example: 1000,
    minimum: 1,
    maximum: 10000,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10000)
  @Transform(({ value }) => parseInt(value))
  height?: number;

  @ApiPropertyOptional({
    description: 'Quality level (1-100)',
    example: 80,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Transform(({ value }) => parseInt(value))
  quality?: number;

  @ApiPropertyOptional({
    description: 'Output format',
    enum: ImageFormat,
    example: ImageFormat.JPEG,
  })
  @IsOptional()
  @IsEnum(ImageFormat)
  format?: ImageFormat;

  @ApiPropertyOptional({
    description: 'Time to live in hours (default: 24)',
    example: 24,
    minimum: 1,
    maximum: 168, // 7 días máximo
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(168)
  @Transform(({ value }) => parseInt(value))
  ttl?: number = 24;
}

export class JobStatusRequestDto {
  @ApiProperty({
    description: 'Job ID to check status',
    example: 'uuid-job-id',
  })
  @IsString()
  jobId: string;
}
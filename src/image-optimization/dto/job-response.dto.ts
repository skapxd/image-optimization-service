import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { JobStatus } from '../enums/job-status.enum';

export class JobResponseDto {
  @ApiProperty({
    description: 'Unique job identifier',
    example: 'uuid-job-id',
  })
  jobId: string;

  @ApiProperty({
    description: 'Current job status',
    enum: JobStatus,
    example: JobStatus.PENDING,
  })
  status: JobStatus;

  @ApiPropertyOptional({
    description: 'URL to access the optimized image (available when completed)',
    example: 'http://localhost:3000/api/images/optimized/uuid-job-id.jpg',
  })
  imageUrl?: string;

  @ApiPropertyOptional({
    description: 'Error message if job failed',
    example: 'Invalid image format',
  })
  error?: string;

  @ApiPropertyOptional({
    description: 'Job progress percentage (0-100)',
    example: 75,
  })
  progress?: number;

  @ApiProperty({
    description: 'Job creation timestamp',
    example: '2023-12-01T10:00:00Z',
  })
  createdAt: Date;

  @ApiPropertyOptional({
    description: 'Job completion timestamp',
    example: '2023-12-01T10:02:30Z',
  })
  completedAt?: Date;

  @ApiPropertyOptional({
    description: 'Time when the optimized image will expire',
    example: '2023-12-02T10:02:30Z',
  })
  expiresAt?: Date;
}

export class ImageUploadResponseDto {
  @ApiProperty({
    description: 'Unique job identifier',
    example: 'uuid-job-id',
  })
  jobId: string;

  @ApiProperty({
    description: 'Initial job status',
    enum: JobStatus,
    example: JobStatus.PENDING,
  })
  status: JobStatus;

  @ApiProperty({
    description: 'Job creation timestamp',
    example: '2023-12-01T10:00:00Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'URL to check job status',
    example: 'http://localhost:3000/api/jobs/status/uuid-job-id',
  })
  statusUrl: string;

  @ApiProperty({
    description: 'Time when the optimized image will expire after completion',
    example: '2023-12-02T10:02:30Z',
  })
  expiresAt: Date;

  @ApiProperty({
    description: 'Estimated processing time in seconds',
    example: 30,
  })
  estimatedTime: number;
}
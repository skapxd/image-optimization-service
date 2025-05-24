import {
  Controller,
  Post,
  Get,
  Delete,
  UseInterceptors,
  UploadedFile,
  Query,
  Param,
  BadRequestException,
  NotFoundException,
  Logger,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { Response } from 'express';
import * as fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiParam,
} from '@nestjs/swagger';

import { JobService } from '../services/job.service';
import { QueueService } from '../services/queue.service';
import { JobStatus } from '../enums/job-status.enum';
import {
  ImageOptimizationRequestDto,
  JobStatusRequestDto,
} from '../dto/job-request.dto';
import {
  ImageUploadResponseDto,
  JobResponseDto,
} from '../dto/job-response.dto';

@ApiTags('Queue-based Image Optimization')
@Controller('api/images')
export class QueueController {
  private readonly logger = new Logger(QueueController.name);
  private readonly uploadsDir = join(process.cwd(), 'uploads', 'original');
  private readonly optimizedDir = join(process.cwd(), 'uploads', 'optimized');
  private readonly baseUrl = process.env.BASE_URL || 'http://localhost:3000';

  constructor(
    private readonly jobService: JobService,
    private readonly queueService: QueueService,
  ) {
    this.ensureDirectories();
  }

  private async ensureDirectories(): Promise<void> {
    try {
      await fs.access(this.uploadsDir);
    } catch {
      await fs.mkdir(this.uploadsDir, { recursive: true });
    }

    try {
      await fs.access(this.optimizedDir);
    } catch {
      await fs.mkdir(this.optimizedDir, { recursive: true });
    }
  }

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: diskStorage({
        destination: join(process.cwd(), 'uploads', 'original'),
        filename: (req, file, callback) => {
          const uniqueId = uuidv4();
          const ext = extname(file.originalname);
          callback(null, `${uniqueId}${ext}`);
        },
      }),
      limits: {
        fileSize: 50 * 1024 * 1024, // 50MB límite
      },
      fileFilter: (req, file, callback) => {
        const allowedMimes = [
          'image/jpeg',
          'image/jpg',
          'image/png',
          'image/webp',
          'image/gif',
          'image/bmp',
          'image/tiff',
        ];

        if (allowedMimes.includes(file.mimetype)) {
          callback(null, true);
        } else {
          callback(
            new BadRequestException(
              'Invalid file type. Only images are allowed.',
            ),
            false,
          );
        }
      },
    }),
  )
  @ApiOperation({ summary: 'Upload image for optimization' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({
    status: 201,
    description: 'Image uploaded successfully',
    type: ImageUploadResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - invalid file or parameters',
  })
  async uploadImage(
    @UploadedFile() file: Express.Multer.File,
    @Query() dto: ImageOptimizationRequestDto,
  ): Promise<ImageUploadResponseDto> {
    if (!file) {
      throw new BadRequestException('No image file provided');
    }

    this.logger.log(
      `Processing upload: ${file.originalname} (${file.size} bytes)`,
    );

    try {
      // Crear el job
      const jobId = await this.jobService.createJob(
        file.filename,
        file.originalname,
        file.path,
        {
          width: dto.width,
          height: dto.height,
          quality: dto.quality,
          format: dto.format,
        },
        dto.ttl,
      );

      // Obtener el job para agregarlo a la cola
      const job = await this.jobService.getJob(jobId);

      // Agregar a la cola con prioridad basada en el tamaño del archivo
      const priority = this.calculatePriority(file.size);
      await this.queueService.addImageOptimizationJob(job, priority);

      const statusUrl = `${this.baseUrl}/api/images/status/${jobId}`;

      return {
        jobId,
        status: JobStatus.PENDING,
        createdAt: job.createdAt,
        statusUrl,
        estimatedTime: this.calculateEstimatedTime(priority),
        expiresAt: job.expiresAt,
      };
    } catch (error) {
      this.logger.error(`Error processing upload:`, error);

      // Limpiar archivo si hubo error
      try {
        await fs.unlink(file.path);
      } catch {}

      throw new BadRequestException('Failed to process image upload');
    }
  }

  @Get('status/:jobId')
  @ApiOperation({ summary: 'Get job status' })
  @ApiParam({ name: 'jobId', description: 'Job ID' })
  @ApiResponse({
    status: 200,
    description: 'Job status retrieved',
    type: JobResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Job not found' })
  async getJobStatus(@Param('jobId') jobId: string): Promise<JobResponseDto> {
    try {
      const job = await this.jobService.getJob(jobId);
      const queueStatus = await this.queueService.getJobStatus(jobId);

      return {
        jobId: job.id,
        status: job.status as any,
        imageUrl: job.resultUrl,
        error: job.errorMessage,
        progress: queueStatus.progress,
        createdAt: job.createdAt,
        completedAt: job.completedAt,
        expiresAt: job.expiresAt,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(`Error getting job status for ${jobId}:`, error);
      throw new BadRequestException('Failed to get job status');
    }
  }

  @Get('optimized/:filename')
  @ApiOperation({ summary: 'Download optimized image' })
  @ApiParam({ name: 'filename', description: 'Optimized image filename' })
  @ApiResponse({ status: 200, description: 'Optimized image' })
  @ApiResponse({ status: 404, description: 'Image not found' })
  async getOptimizedImage(
    @Param('filename') filename: string,
    @Res() res: Response,
  ): Promise<void> {
    const filePath = join(this.optimizedDir, filename);

    try {
      await fs.access(filePath);

      // Establecer headers apropiados
      const ext = extname(filename).toLowerCase();
      const mimeTypes = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.webp': 'image/webp',
        '.gif': 'image/gif',
        '.bmp': 'image/bmp',
        '.tiff': 'image/tiff',
      };

      const contentType = mimeTypes[ext] || 'application/octet-stream';

      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 año de cache
      res.setHeader('ETag', filename); // Simple ETag usando el nombre del archivo

      res.sendFile(filePath);
    } catch {
      throw new NotFoundException('Optimized image not found');
    }
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get queue and job statistics' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved' })
  async getStats(): Promise<{
    jobs: {
      total: number;
      pending: number;
      processing: number;
      completed: number;
      failed: number;
    };
    queue: {
      active: number;
      waiting: number;
      completed: number;
      failed: number;
      delayed: number;
      paused: number;
    };
  }> {
    const [jobStats, queueStats] = await Promise.all([
      this.jobService.getJobStats(),
      this.queueService.getQueueStats(),
    ]);

    return {
      jobs: jobStats,
      queue: queueStats,
    };
  }

  @Post('admin/cleanup')
  @ApiOperation({ summary: 'Manually trigger cleanup of expired jobs' })
  @ApiResponse({ status: 200, description: 'Cleanup completed' })
  async manualCleanup(): Promise<{ deletedCount: number }> {
    const deletedCount = await this.jobService.cleanupExpiredJobs();
    return { deletedCount };
  }

  @Post('admin/retry-failed')
  @ApiOperation({ summary: 'Retry all failed jobs' })
  @ApiResponse({ status: 200, description: 'Failed jobs retried' })
  async retryFailedJobs(): Promise<{ retriedCount: number }> {
    const retriedCount = await this.queueService.retryFailedJobs();
    return { retriedCount };
  }

  @Post('admin/pause-queue')
  @ApiOperation({ summary: 'Pause the optimization queue' })
  @ApiResponse({ status: 200, description: 'Queue paused' })
  async pauseQueue(): Promise<{ message: string }> {
    await this.queueService.pauseQueue();
    return { message: 'Queue paused successfully' };
  }

  @Post('admin/resume-queue')
  @ApiOperation({ summary: 'Resume the optimization queue' })
  @ApiResponse({ status: 200, description: 'Queue resumed' })
  async resumeQueue(): Promise<{ message: string }> {
    await this.queueService.resumeQueue();
    return { message: 'Queue resumed successfully' };
  }

  private calculatePriority(fileSize: number): number {
    // Archivos más pequeños = mayor prioridad
    if (fileSize < 1024 * 1024) return 10; // < 1MB
    if (fileSize < 5 * 1024 * 1024) return 5; // < 5MB
    if (fileSize < 10 * 1024 * 1024) return 0; // < 10MB
    return -5; // >= 10MB
  }

  private calculateEstimatedTime(priority: number): number {
    // Estimación basada en prioridad (en segundos)
    if (priority >= 10) return 30; // Alta prioridad: ~30 segundos
    if (priority >= 5) return 60; // Media prioridad: ~1 minuto
    if (priority >= 0) return 120; // Baja prioridad: ~2 minutos
    return 180; // Muy baja prioridad: ~3 minutos
  }
}

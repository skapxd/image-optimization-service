import { Process, Processor } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bull';
import { ImageOptimizationService } from '../image-optimization.service';
import { JobService } from '../services/job.service';
import { ImageOptimizationJob } from '../interfaces/job.interface';
import { ImageFormat } from '../image-format.enum';
import { JobStatus } from '../enums/job-status.enum';
import * as path from 'path';
import * as fs from 'fs/promises';

@Injectable()
@Processor('image-optimization')
export class ImageOptimizationProcessor {
  private readonly logger = new Logger(ImageOptimizationProcessor.name);
  private readonly optimizedDir = path.join(
    process.cwd(),
    'uploads',
    'optimized',
  );
  private readonly baseUrl = process.env.BASE_URL || 'http://localhost:3000';

  constructor(
    private readonly imageOptimizationService: ImageOptimizationService,
    private readonly jobService: JobService,
  ) {}

  @Process('optimize-image')
  async handleImageOptimization(job: Job<ImageOptimizationJob>): Promise<void> {
    //   const { data: jobData } = job;
    //   const startTime = Date.now();
    //   this.logger.log(`Starting optimization for job ${jobData.id}`);
    //   try {
    //     // Actualizar estado a "processing"
    //     await this.jobService.updateJobStatus(jobData.id, JobStatus.PROCESSING);
    //     // Actualizar progreso en Bull job
    //     await job.progress(10);
    //     // Leer el archivo original
    //     const originalFile = await fs.readFile(jobData.filePath);
    //     await job.progress(20);
    //     // Optimizar la imagen
    //     this.logger.log(`Optimizing image with options:`, jobData.options);
    //     const optimizedBuffer = await this.imageOptimizationService.optimizeImage(
    //       jobData.filePath,
    //       jobData.options,
    //     );
    //     await job.progress(80);
    //     // Determine target format
    //     const targetFormat: ImageFormat =
    //       jobData.options.format || ImageFormat.JPEG;
    //     // Generate optimized file name with correct extension
    //     const getExtension = (format: ImageFormat): string => {
    //       switch (format) {
    //         case ImageFormat.JPEG:
    //           return 'jpg';
    //         case ImageFormat.PNG:
    //           return 'png';
    //         case ImageFormat.WEBP:
    //           return 'webp';
    //         case ImageFormat.AVIF:
    //           return 'avif';
    //         case ImageFormat.GIF:
    //           return 'gif';
    //         case ImageFormat.TIFF:
    //           return 'tiff';
    //         case ImageFormat.SVG:
    //           return 'svg';
    //         default:
    //           return 'jpg';
    //       }
    //     };
    //     const ext = getExtension(targetFormat);
    //     const optimizedFileName = `optimized_${Date.now()}_${jobData.fileName.split('.')[0]}.${ext}`;
    //     const optimizedFilePath = path.join(this.optimizedDir, optimizedFileName);
    //     // Guardar imagen optimizada
    //     await fs.writeFile(optimizedFilePath, optimizedBuffer);
    //     await job.progress(95);
    //     // Generar URL para acceder a la imagen
    //     const resultUrl = `${this.baseUrl}/api/images/optimized/${optimizedFileName}`;
    //     // Actualizar estado a "completed"
    //     await this.jobService.updateJobStatus(
    //       jobData.id,
    //       JobStatus.COMPLETED,
    //       resultUrl,
    //     );
    //     await job.progress(100);
    //     const endTime = Date.now();
    //     const processingTime = endTime - startTime;
    //     // Calcular estadísticas de compresión
    //     const originalStats = await fs.stat(jobData.filePath);
    //     const optimizedStats = await fs.stat(optimizedFilePath);
    //     const compressionRatio = (
    //       ((originalStats.size - optimizedStats.size) / originalStats.size) *
    //       100
    //     ).toFixed(2);
    //     this.logger.log(
    //       `Job ${jobData.id} completed successfully in ${processingTime}ms. ` +
    //         `Original: ${this.formatBytes(originalStats.size)}, ` +
    //         `Optimized: ${this.formatBytes(optimizedStats.size)}, ` +
    //         `Compression: ${compressionRatio}%`,
    //     );
    //   } catch (error) {
    //     this.logger.error(`Failed to process job ${jobData.id}:`, error);
    //     // Actualizar estado a "failed"
    //     await this.jobService.updateJobStatus(
    //       jobData.id,
    //       JobStatus.FAILED,
    //       undefined,
    //       error.message,
    //     );
    //     throw error; // Re-lanzar para que Bull maneje el retry si está configurado
    //   }
  }

  @Process('cleanup-expired')
  async handleCleanupExpired(job: Job): Promise<void> {
    this.logger.log('Starting cleanup of expired jobs');

    try {
      const deletedCount = await this.jobService.cleanupExpiredJobs();
      this.logger.log(`Cleaned up ${deletedCount} expired jobs`);
    } catch (error) {
      this.logger.error('Failed to cleanup expired jobs:', error);
      throw error;
    }
  }

  private formatBytes(bytes: number, decimals = 2): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }
}

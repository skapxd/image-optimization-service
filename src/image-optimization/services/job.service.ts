import { Injectable, NotFoundException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { ImageOptimizationJob } from '../interfaces/job.interface';
import { JobStatus } from '../enums/job-status.enum';
import { ImageFormat } from '../image-format.enum';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class JobService {
  private jobs: Map<string, ImageOptimizationJob> = new Map();
  private readonly optimizedDir = path.join(
    process.cwd(),
    'uploads',
    'optimized',
  );

  async onModuleInit() {
    // Crear directorio para imágenes optimizadas si no existe
    try {
      await fs.access(this.optimizedDir);
    } catch {
      await fs.mkdir(this.optimizedDir, { recursive: true });
    }
  }

  async createJob(
    fileName: string,
    originalName: string,
    filePath: string,
    options: {
      width?: number;
      height?: number;
      quality?: number;
      format?: ImageFormat;
    },
    ttl: number = 24,
  ): Promise<string> {
    const jobId = uuidv4();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttl * 60 * 60 * 1000); // TTL en horas

    const job: ImageOptimizationJob = {
      id: jobId,
      fileName,
      originalName,
      filePath,
      options,
      status: JobStatus.PENDING,
      createdAt: now,
      ttl,
      expiresAt,
    };

    this.jobs.set(jobId, job);
    return jobId;
  }

  async getJob(jobId: string): Promise<ImageOptimizationJob> {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new NotFoundException(`Job with ID ${jobId} not found`);
    }
    return job;
  }

  async updateJobStatus(
    jobId: string,
    status: JobStatus,
    resultUrl?: string,
    errorMessage?: string,
  ): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new NotFoundException(`Job with ID ${jobId} not found`);
    }

    job.status = status;

    if (status === JobStatus.PROCESSING && !job.processedAt) {
      job.processedAt = new Date();
    }

    if (status === JobStatus.COMPLETED || status === JobStatus.FAILED) {
      job.completedAt = new Date();

      if (resultUrl) {
        job.resultUrl = resultUrl;
      }

      if (errorMessage) {
        job.errorMessage = errorMessage;
      }
    }

    this.jobs.set(jobId, job);
  }

  async getAllJobs(): Promise<ImageOptimizationJob[]> {
    return Array.from(this.jobs.values());
  }

  async getExpiredJobs(): Promise<ImageOptimizationJob[]> {
    const now = new Date();
    return Array.from(this.jobs.values()).filter((job) => job.expiresAt < now);
  }

  async deleteJob(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (job) {
      // Eliminar archivo optimizado si existe
      if (job.resultUrl) {
        try {
          const fileName = path.basename(job.resultUrl);
          const filePath = path.join(this.optimizedDir, fileName);
          await fs.unlink(filePath);
        } catch (error) {
          console.warn(
            `Failed to delete optimized file for job ${jobId}:`,
            error.message,
          );
        }
      }

      // Eliminar archivo original
      try {
        await fs.unlink(job.filePath);
      } catch (error) {
        console.warn(
          `Failed to delete original file for job ${jobId}:`,
          error.message,
        );
      }

      this.jobs.delete(jobId);
    }
  }

  async cleanupExpiredJobs(): Promise<number> {
    const expiredJobs = await this.getExpiredJobs();
    let deletedCount = 0;

    for (const job of expiredJobs) {
      await this.deleteJob(job.id);
      deletedCount++;
    }

    return deletedCount;
  }

  getJobStats(): {
    total: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  } {
    const jobs = Array.from(this.jobs.values());
    return {
      total: jobs.length,
      pending: jobs.filter((j) => j.status === JobStatus.PENDING).length,
      processing: jobs.filter((j) => j.status === JobStatus.PROCESSING).length,
      completed: jobs.filter((j) => j.status === JobStatus.COMPLETED).length,
      failed: jobs.filter((j) => j.status === JobStatus.FAILED).length,
    };
  }
}

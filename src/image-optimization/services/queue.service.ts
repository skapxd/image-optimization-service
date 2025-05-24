import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue, Job } from 'bull';
import { Cron, CronExpression, SchedulerRegistry } from '@nestjs/schedule';
import { ImageOptimizationJob } from '../interfaces/job.interface';
import { JobStatus } from '../enums/job-status.enum';
import { JobService } from './job.service';

@Injectable()
export class QueueService implements OnModuleInit {
  private readonly logger = new Logger(QueueService.name);

  constructor(
    @InjectQueue('image-optimization')
    private readonly imageOptimizationQueue: Queue,
    private readonly jobService: JobService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {}

  async onModuleInit() {
    // Wait a bit to ensure everything is properly initialized
    setTimeout(() => {
      this.setupCronJobs();
    }, 2000);
  }

  private setupCronJobs() {
    try {
      // Add cron jobs manually
      const CronJob = require('cron').CronJob;
      
      // Hourly cleanup job
      const cleanupJob = new CronJob('0 * * * *', () => {
        this.scheduleCleanup();
      });
      
      // Every 4 hours old jobs cleanup
      const oldJobsCleanupJob = new CronJob('0 */4 * * *', () => {
        this.cleanOldJobs();
      });
      
      this.schedulerRegistry.addCronJob('cleanup', cleanupJob);
      this.schedulerRegistry.addCronJob('cleanOldJobs', oldJobsCleanupJob);
      
      cleanupJob.start();
      oldJobsCleanupJob.start();
      
      this.logger.log('Cron jobs scheduled successfully');
    } catch (error) {
      this.logger.error('Failed to setup cron jobs:', error);
    }
  }

  async addImageOptimizationJob(
    jobData: ImageOptimizationJob,
    priority: number = 0,
  ): Promise<Job> {
    this.logger.log(`Adding image optimization job ${jobData.id} to queue`);

    const job = await this.imageOptimizationQueue.add(
      'optimize-image',
      jobData,
      {
        priority, // Mayor prioridad = se procesa antes
        attempts: 3, // Número máximo de reintentos
        backoff: {
          type: 'exponential',
          delay: 2000, // Retraso inicial de 2 segundos
        },
        removeOnComplete: 10, // Mantener solo los últimos 10 jobs completados
        removeOnFail: 5, // Mantener solo los últimos 5 jobs fallidos
        delay: 0, // Sin retraso inicial
        jobId: jobData.id, // Usar el job ID como clave única
      },
    );

    this.logger.log(
      `Job ${jobData.id} added to queue with Bull job ID ${job.id}`,
    );
    return job;
  }

  async getJobStatus(jobId: string): Promise<{
    status: string;
    progress: number;
    data?: any;
    error?: any;
  }> {
    try {
      const job = await this.imageOptimizationQueue.getJob(jobId);

      if (!job) {
        return {
          status: 'not_found',
          progress: 0,
        };
      }

      const state = await job.getState();
      const progress = job.progress() || 0;

      return {
        status: state,
        progress: typeof progress === 'number' ? progress : 0,
        data: job.data,
        error: job.failedReason,
      };
    } catch (error) {
      this.logger.error(`Error getting job status for ${jobId}:`, error);
      return {
        status: 'error',
        progress: 0,
        error: error.message,
      };
    }
  }

  async getQueueStats(): Promise<{
    active: number;
    waiting: number;
    completed: number;
    failed: number;
    delayed: number;
    paused: number;
  }> {
    const [
      active,
      waiting,
      completed,
      failed,
      delayed,
    ] = await Promise.all([
        this.imageOptimizationQueue.getActive(),
        this.imageOptimizationQueue.getWaiting(),
        this.imageOptimizationQueue.getCompleted(),
        this.imageOptimizationQueue.getFailed(),
        this.imageOptimizationQueue.getDelayed(),
      ]);

    const isPaused = await this.imageOptimizationQueue.isPaused();

    return {
      active: active.length,
      waiting: waiting.length,
      completed: completed.length,
      failed: failed.length,
      delayed: delayed.length,
      paused: isPaused ? 1 : 0,
    };
  }

  async pauseQueue(): Promise<void> {
    await this.imageOptimizationQueue.pause();
    this.logger.log('Queue paused');
  }

  async resumeQueue(): Promise<void> {
    await this.imageOptimizationQueue.resume();
    this.logger.log('Queue resumed');
  }

  async cleanQueue(): Promise<void> {
    await this.imageOptimizationQueue.clean(5000, 'completed');
    await this.imageOptimizationQueue.clean(5000, 'failed');
    this.logger.log('Queue cleaned');
  }

  // Programar limpieza automática cada hora
  async scheduleCleanup(): Promise<void> {
    this.logger.log('Scheduling automatic cleanup job');

    await this.imageOptimizationQueue.add(
      'cleanup-expired',
      {},
      {
        priority: -10, // Baja prioridad
        attempts: 1,
        removeOnComplete: 1,
        removeOnFail: 1,
      },
    );
  }

  // Limpiar trabajos antiguos cada 4 horas
  async cleanOldJobs(): Promise<void> {
    try {
      await this.cleanQueue();
      this.logger.log('Old jobs cleaned from queue');
    } catch (error) {
      this.logger.error('Error cleaning old jobs:', error);
    }
  }

  async retryFailedJobs(): Promise<number> {
    const failedJobs = await this.imageOptimizationQueue.getFailed();
    let retriedCount = 0;

    for (const job of failedJobs) {
      try {
        await job.retry();
        retriedCount++;
        this.logger.log(`Retried failed job ${job.id}`);
      } catch (error) {
        this.logger.error(`Failed to retry job ${job.id}:`, error);
      }
    }

    this.logger.log(`Retried ${retriedCount} failed jobs`);
    return retriedCount;
  }
}

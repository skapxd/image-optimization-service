import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Piscina from 'piscina';
import { join } from 'path';
import {
  OptimizationTask,
  OptimizationResult,
} from '../workers/image-optimization.worker';

@Injectable()
export class WorkerPoolService implements OnModuleDestroy {
  private readonly logger = new Logger(WorkerPoolService.name);
  private piscina: Piscina;

  constructor() {
    try {
      // Get configuration from environment variables with sensible defaults
      const maxThreads = parseInt(process.env.PISCINA_THREADS || '4', 10);
      const minThreads = Math.max(1, Math.floor(maxThreads / 2));
      const idleTimeout = parseInt(
        process.env.PISCINA_IDLE_TIMEOUT || '5000',
        10,
      );

      this.piscina = new Piscina({
        filename: join(__dirname, '../workers/image-optimization.worker.js'),
        minThreads,
        maxThreads,
        idleTimeout,
      });

      this.logger.log(
        `Worker pool initialized with ${minThreads}-${maxThreads} threads, ${idleTimeout}ms idle timeout`,
      );
    } catch (error) {
      this.logger.error('Failed to initialize worker pool:', error.message);
      throw error;
    }
  }

  /**
   * Optimize a single image using the worker pool
   */
  async optimizeImage(task: OptimizationTask): Promise<OptimizationResult> {
    try {
      this.logger.debug(`Starting optimization for: ${task.originalName}`);

      const result = await this.piscina.run(task);

      this.logger.debug(
        `Completed optimization for: ${task.originalName} (${result.originalSize} -> ${result.optimizedSize} bytes)`,
      );

      return result;
    } catch (error) {
      this.logger.error(
        `Worker pool optimization failed for ${task.originalName}: ${error.message}`,
      );

      return {
        optimizedBuffer: Buffer.alloc(0),
        originalSize: task.imageBuffer.length,
        optimizedSize: 0,
        originalName: task.originalName,
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Process multiple images in parallel using the worker pool
   */
  async optimizeImages(
    tasks: OptimizationTask[],
  ): Promise<OptimizationResult[]> {
    try {
      this.logger.log(`Processing ${tasks.length} images with worker pool`);

      const promises = tasks.map((task) => this.optimizeImage(task));
      const results = await Promise.all(promises);

      const successful = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success).length;

      this.logger.log(
        `Completed batch optimization: ${successful} successful, ${failed} failed`,
      );

      return results;
    } catch (error) {
      this.logger.error(`Batch optimization failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get worker pool statistics
   */
  getStats() {
    return {
      queueSize: this.piscina.queueSize,
      threads: this.piscina.threads.length,
      maxThreads: this.piscina.options.maxThreads,
      minThreads: this.piscina.options.minThreads,
    };
  }

  /**
   * Clean up resources when module is destroyed
   */
  async onModuleDestroy() {
    try {
      this.logger.log('Destroying worker pool...');
      await this.piscina.destroy();
      this.logger.log('Worker pool destroyed successfully');
    } catch (error) {
      this.logger.error('Error destroying worker pool:', error.message);
    }
  }
}

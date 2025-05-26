import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { MulterModule } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { ImageOptimizationController } from './controllers/image-optimization.controller';
import { AdvancedImageController } from './controllers/advanced-image.controller';
import { QueueController } from './controllers/queue.controller';
import { ImageOptimizationSseController } from './controllers/image-optimization-sse.controller';
import { ImageOptimizationService } from './image-optimization.service';
import { QueueService } from './services/queue.service';
import { JobService } from './services/job.service';
import { ImageOptimizationProcessor } from './processors/image-optimization.processor';
import { randomUUID } from 'crypto';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'image-optimization',
    }),
    MulterModule.register({
      storage: diskStorage({
        destination: './uploads/original',
        filename: (req, file, cb) => {
          const uniqueName = `${randomUUID()}_${Date.now()}${extname(file.originalname)}`;

          cb(null, uniqueName);
        },
      }),
      limits: {
        fileSize: 50 * 1024 * 1024, // 50MB
      },
    }),
  ],
  controllers: [
    ImageOptimizationController,
    AdvancedImageController,
    QueueController,
    ImageOptimizationSseController,
  ],
  providers: [
    ImageOptimizationService,
    QueueService,
    JobService,
    ImageOptimizationProcessor,
    ImageOptimizationSseController,
  ],
  exports: [ImageOptimizationService, QueueService, JobService],
})
export class ImageOptimizationModule {}

import { Module } from '@nestjs/common';
import { ImageOptimizationService } from './image-optimization.service';
import { ImageOptimizationController } from './controllers/image-optimization.controller';
import { ImageOptimizationSseController } from './controllers/image-optimization-sse.controller';
import { BullModule } from '@nestjs/bull';
import { ImageOptimizationProcessor } from './processors/image-optimization.processor';
import { JobService } from './services/job.service';
import { QueueService } from './services/queue.service';
import { AdvancedImageController } from './controllers/advanced-image.controller';
import { QueueController } from './controllers/queue.controller';
import { ImageUploadModule } from 'src/image-upload/image-upload.module';
import { diskStorage } from 'multer';
import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { MulterModule } from '@nestjs/platform-express';

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
    ImageUploadModule,
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
    JobService,
    QueueService,
  ],
  exports: [ImageOptimizationService, ImageOptimizationSseController],
})
export class ImageOptimizationModule {}

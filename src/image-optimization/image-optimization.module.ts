import { Module } from '@nestjs/common';
import { ImageOptimizationController } from './image-optimization.controller';
import { AdvancedImageController } from './advanced-image.controller';
import { ImageOptimizationService } from './image-optimization.service';

@Module({
  controllers: [ImageOptimizationController, AdvancedImageController],
  providers: [ImageOptimizationService],
  exports: [ImageOptimizationService],
})
export class ImageOptimizationModule {}
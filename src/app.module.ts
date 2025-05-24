import { Module } from '@nestjs/common';
import { ImageOptimizationModule } from './image-optimization/image-optimization.module';

@Module({
  imports: [ImageOptimizationModule],
})
export class AppModule {}

import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ImageOptimizationModule } from './image-optimization/image-optimization.module';

@Module({
  imports: [ImageOptimizationModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

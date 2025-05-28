import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validate } from './validation-schema';
import { ImageUploadService } from './image-upload.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: '.env',
      validate,
    }),
  ],
  providers: [ImageUploadService],
  exports: [ImageUploadService],
})
export class ImageUploadModule {}

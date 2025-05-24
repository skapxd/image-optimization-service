import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const config = new DocumentBuilder()
    .setTitle('Image Optimization API')
    .setDescription('A powerful API for image optimization, format conversion, thumbnail generation, and watermarking')
    .setVersion('1.0')
    .addTag('image-optimization', 'Basic image optimization operations')
    .addTag('advanced-image', 'Advanced image processing features')
    .build();
  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, documentFactory);

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();

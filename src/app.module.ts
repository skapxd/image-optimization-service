import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { ImageOptimizationModule } from './image-optimization/image-optimization.module';
import { TimeToLiveDBModule } from './time-to-live-db/time-to-live-db.module';
import { ClientContextModule } from './client-context/client-context.module';
import Joi from 'joi';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationOptions: {
        abortEarly: false,
      },
      validationSchema: Joi.object({
        S3_CUSTOM_DOMAIN: Joi.string().required(),

        // Redis Configuration
        REDIS_HOST: Joi.string().default('redis-dev'),
        REDIS_PORT: Joi.number().default(6379),
        REDIS_PASSWORD: Joi.string().allow('').optional(),
        REDIS_DB: Joi.number().default(0),

        // Application Configuration
        PORT: Joi.number().default(3000),
        NODE_ENV: Joi.string()
          .valid('development', 'production', 'test')
          .default('development'),

        // File Storage
        UPLOAD_PATH: Joi.string().default('./uploads'),
        OPTIMIZED_PATH: Joi.string().default('./uploads/optimized'),

        // Image Processing
        MAX_FILE_SIZE: Joi.number().default(52428800), // 50MB
        DEFAULT_QUALITY: Joi.number().min(1).max(100).default(80),
        DEFAULT_TTL: Joi.number().default(3600), // 1 hour
        MAX_TTL: Joi.number().default(86400), // 24 hours
        CLIENT_CONTEXT_TTL: Joi.number().default(3600), // 1 hour

        // Queue Configuration
        QUEUE_CONCURRENCY: Joi.number().default(4),
        CLEANUP_INTERVAL: Joi.number().default(300000), // 5 minutes
        MAX_RETRIES: Joi.number().default(3),

        // Sharp Optimization
        UV_THREADPOOL_SIZE: Joi.number().default(16),
        SHARP_CACHE_MEMORY: Joi.number().default(2048),
        SHARP_CONCURRENCY: Joi.number().default(4),
      }),
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        redis: {
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: configService.get<number>('REDIS_PORT', 6379),
          password: configService.get<string>('REDIS_PASSWORD'),
          db: configService.get<number>('REDIS_DB', 0),
        },
      }),
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: 60,
          limit: 100,
        },
      ],
    }),
    ImageOptimizationModule,
    TimeToLiveDBModule,
    ClientContextModule,
  ],
})
export class AppModule {}

import { Global, Module } from '@nestjs/common';
import { TimeToLiveDBService } from './time-to-live-db.service';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';

@Global()
@Module({
  imports: [ConfigModule, ScheduleModule],
  providers: [TimeToLiveDBService],
  exports: [TimeToLiveDBService],
})
export class TimeToLiveDBModule {}

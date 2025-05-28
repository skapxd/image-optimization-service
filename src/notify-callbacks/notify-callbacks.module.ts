import { Module } from '@nestjs/common';
import { NotifyCallbackService } from './notify-callbacks.service';

@Module({
  providers: [NotifyCallbackService],
  exports: [NotifyCallbackService],
})
export class NotifyCallbackModule {}

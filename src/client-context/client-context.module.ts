import { Global, Module } from '@nestjs/common';
import { ClientContextService } from './client-context.service';
import { TimeToLiveDBModule } from '../time-to-live-db/time-to-live-db.module';
import { ConfigModule } from '@nestjs/config';

/**
 * Módulo para gestionar el contexto del cliente
 * Proporciona un servicio type-safe para almacenar y recuperar datos de contexto
 */
@Global()
@Module({
  imports: [TimeToLiveDBModule, ConfigModule],
  providers: [ClientContextService],
  exports: [ClientContextService],
})
export class ClientContextModule {}

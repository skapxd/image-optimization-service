import {
  Controller,
  Get,
  Param,
  Res,
  Sse,
  MessageEvent,
  BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { Observable, Subject, interval, map, filter } from 'rxjs';
import { ApiTags, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';

// Interfaz para los eventos de optimización
interface OptimizationEvent {
  id: string;
  type: 'progress' | 'complete' | 'error';
  data: any;
}

@ApiTags('image-optimization-sse')
@Controller('image-optimization-sse')
export class ImageOptimizationSseController {
  // Almacén de eventos para cada ID de optimización
  private optimizationEvents = new Map<string, Subject<OptimizationEvent>>();

  constructor() {}

  @Get('subscribe/:id')
  @ApiOperation({
    summary: 'Subscribe to image optimization events for a specific ID',
    description:
      'Returns a Server-Sent Events stream with optimization progress and completion events',
  })
  @ApiParam({
    name: 'id',
    description: 'The optimization ID to subscribe to',
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: 'SSE stream established successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - invalid optimization ID',
  })
  @Sse()
  subscribe(@Param('id') id: string): Observable<MessageEvent> {
    // Verificar si el ID es válido
    if (!id || id.trim() === '') {
      throw new BadRequestException('Invalid optimization ID');
    }

    // Crear un nuevo subject si no existe
    if (!this.optimizationEvents.has(id)) {
      this.optimizationEvents.set(id, new Subject<OptimizationEvent>());

      // Configurar limpieza automática después de 1 hora
      setTimeout(
        () => {
          const subject = this.optimizationEvents.get(id);
          if (subject) {
            subject.complete();
            this.optimizationEvents.delete(id);
          }
        },
        60 * 60 * 1000,
      ); // 1 hora
    }

    // Obtener el subject para este ID
    const subject = this.optimizationEvents.get(id);

    // Verificar que subject existe
    if (!subject) {
      throw new BadRequestException('Optimization ID not found');
    }

    // Convertir el subject a un Observable de MessageEvent
    return subject.pipe(
      map((event) => ({
        data: event,
        id: event.id,
        type: event.type,
      })),
    );
  }

  // Método para enviar eventos de optimización
  public sendOptimizationEvent(event: OptimizationEvent): void {
    const subject = this.optimizationEvents.get(event.id);
    if (subject) {
      subject.next(event);

      // Si el evento es 'complete' o 'error', completar el subject después de un tiempo
      if (event.type === 'complete' || event.type === 'error') {
        setTimeout(() => {
          subject.complete();
          this.optimizationEvents.delete(event.id);
        }, 5000); // 5 segundos para asegurar que el cliente reciba el evento
      }
    }
  }

  @Get('test-event/:id')
  @ApiOperation({
    summary:
      'Test sending an event to a specific optimization ID (for development only)',
  })
  @ApiParam({
    name: 'id',
    description: 'The optimization ID to send a test event to',
    required: true,
  })
  testEvent(@Param('id') id: string, @Res() res: Response) {
    // Enviar un evento de prueba
    this.sendOptimizationEvent({
      id,
      type: 'progress',
      data: {
        progress: 50,
        message: 'Test event',
      },
    });

    res.json({ success: true, message: 'Test event sent' });
  }
}

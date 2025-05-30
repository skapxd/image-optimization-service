import { Injectable, Logger } from '@nestjs/common';
import { TimeToLiveDBService } from '../time-to-live-db/time-to-live-db.service';
import { ConfigService } from '@nestjs/config';
import {
  ContextKey,
  ContextType,
  ControllerParamsContext,
  ImageOptimizationContext,
  RequestContext,
  UserContext,
} from './client-context.types';

/**
 * Servicio para gestionar el contexto del cliente
 * Proporciona una interfaz type-safe para almacenar y recuperar datos de contexto
 */
@Injectable()
export class ClientContextService {
  private readonly logger = new Logger(ClientContextService.name);
  private readonly defaultTTL: number; // en segundos

  constructor(
    private readonly ttlDB: TimeToLiveDBService,
    private readonly configService: ConfigService,
  ) {
    this.defaultTTL = this.configService.get<number>(
      'CLIENT_CONTEXT_TTL',
      3600,
    ); // 1 hora por defecto
  }

  /**
   * Genera una clave única para el contexto
   * @param contextType Tipo de contexto
   * @param id Identificador único
   * @returns Clave única
   */
  private generateKey(contextType: ContextType, id: string): ContextKey {
    return `${contextType}:${id}`;
  }

  /**
   * Almacena un contexto de optimización de imágenes
   * @param id Identificador único
   * @param context Datos del contexto
   * @param ttl Tiempo de vida en segundos (opcional)
   */
  setImageOptimizationContext(
    id: string,
    context: Partial<ImageOptimizationContext>,
    ttl?: number,
  ): void {
    const key = this.generateKey(ContextType.IMAGE_OPTIMIZATION, id);
    const existingContext = this.getImageOptimizationContext(id);

    const updatedContext: ImageOptimizationContext = {
      ...existingContext,
      ...context,
      clientId: context.clientId || existingContext?.clientId || id,
      createdAt: existingContext?.createdAt || new Date(),
      updatedAt: new Date(),
    };

    this.ttlDB.set<ImageOptimizationContext>(
      key,
      updatedContext,
      ttl || this.defaultTTL,
    );
    this.logger.debug(`Stored image optimization context for ID: ${id}`);
  }

  /**
   * Obtiene un contexto de optimización de imágenes
   * @param id Identificador único
   * @returns Contexto de optimización de imágenes o null si no existe
   */
  getImageOptimizationContext(id: string): ImageOptimizationContext | null {
    const key = this.generateKey(ContextType.IMAGE_OPTIMIZATION, id);
    return this.ttlDB.get<ImageOptimizationContext>(key);
  }

  /**
   * Almacena un contexto de usuario
   * @param id Identificador único
   * @param context Datos del contexto
   * @param ttl Tiempo de vida en segundos (opcional)
   */
  setUserContext(
    id: string,
    context: Partial<UserContext>,
    ttl?: number,
  ): void {
    const key = this.generateKey(ContextType.USER, id);
    const existingContext = this.getUserContext(id);

    const updatedContext: UserContext = {
      ...existingContext,
      ...context,
      clientId: context.clientId || existingContext?.clientId || id,
      createdAt: existingContext?.createdAt || new Date(),
      updatedAt: new Date(),
    };

    this.ttlDB.set<UserContext>(key, updatedContext, ttl || this.defaultTTL);
    this.logger.debug(`Stored user context for ID: ${id}`);
  }

  /**
   * Obtiene un contexto de usuario
   * @param id Identificador único
   * @returns Contexto de usuario o null si no existe
   */
  getUserContext(id: string): UserContext | null {
    const key = this.generateKey(ContextType.USER, id);
    return this.ttlDB.get<UserContext>(key);
  }

  /**
   * Almacena un contexto de solicitud
   * @param id Identificador único
   * @param context Datos del contexto
   * @param ttl Tiempo de vida en segundos (opcional)
   */
  setRequestContext(
    id: string,
    context: Partial<RequestContext>,
    ttl?: number,
  ): void {
    const key = this.generateKey(ContextType.REQUEST, id);
    const existingContext = this.getRequestContext(id);

    const updatedContext: RequestContext = {
      ...existingContext,
      ...context,
      clientId: context.clientId || existingContext?.clientId || id,
      createdAt: existingContext?.createdAt || new Date(),
      updatedAt: new Date(),
    };

    this.ttlDB.set<RequestContext>(key, updatedContext, ttl || this.defaultTTL);
    this.logger.debug(`Stored request context for ID: ${id}`);
  }

  /**
   * Obtiene un contexto de solicitud
   * @param id Identificador único
   * @returns Contexto de solicitud o null si no existe
   */
  getRequestContext(id: string): RequestContext | null {
    const key = this.generateKey(ContextType.REQUEST, id);
    return this.ttlDB.get<RequestContext>(key);
  }

  /**
   * Almacena un contexto de parámetros de controlador
   * @param id Identificador único
   * @param context Datos del contexto
   * @param ttl Tiempo de vida en segundos (opcional)
   */
  setControllerParamsContext(
    id: string,
    context: Partial<ControllerParamsContext>,
    ttl?: number,
  ): void {
    const key = this.generateKey(ContextType.CONTROLLER_PARAMS, id);
    const existingContext = this.getControllerParamsContext(id);

    // @ts-expect-error: ERR
    const updatedContext: ControllerParamsContext = {
      ...(existingContext ?? {}),
      ...(context ?? {}),
      clientId: context.clientId || existingContext?.clientId || id,
      createdAt: existingContext?.createdAt || new Date(),
      updatedAt: new Date(),
    };

    this.ttlDB.set<ControllerParamsContext>(
      key,
      updatedContext,
      ttl || this.defaultTTL,
    );
    this.logger.debug(`Stored controller params context for ID: ${id}`);
  }

  /**
   * Obtiene un contexto de parámetros de controlador
   * @param id Identificador único
   * @returns Contexto de parámetros de controlador o null si no existe
   */
  getControllerParamsContext(id: string): ControllerParamsContext | null {
    const key = this.generateKey(ContextType.CONTROLLER_PARAMS, id);
    return this.ttlDB.get<ControllerParamsContext>(key);
  }

  /**
   * Verifica si existe un contexto
   * @param contextType Tipo de contexto
   * @param id Identificador único
   * @returns true si existe, false en caso contrario
   */
  hasContext(contextType: ContextType, id: string): boolean {
    const key = this.generateKey(contextType, id);
    return this.ttlDB.has(key);
  }

  /**
   * Elimina un contexto
   * @param contextType Tipo de contexto
   * @param id Identificador único
   * @returns true si se eliminó, false si no existía
   */
  deleteContext(contextType: ContextType, id: string): boolean {
    const key = this.generateKey(contextType, id);
    return this.ttlDB.delete(key);
  }

  /**
   * Actualiza el tiempo de vida de un contexto
   * @param contextType Tipo de contexto
   * @param id Identificador único
   * @param ttl Nuevo tiempo de vida en segundos
   * @returns true si se actualizó, false si no existía
   */
  updateContextTTL(contextType: ContextType, id: string, ttl: number): boolean {
    const key = this.generateKey(contextType, id);
    return this.ttlDB.updateTTL(key, ttl);
  }

  /**
   * Obtiene todos los IDs de un tipo de contexto específico
   * @param contextType Tipo de contexto
   * @returns Array de IDs
   */
  getContextIds(contextType: ContextType): string[] {
    const prefix = `${contextType}:`;
    return this.ttlDB
      .keys()
      .filter((key) => key.startsWith(prefix))
      .map((key) => key.substring(prefix.length));
  }

  /**
   * Obtiene el número de contextos de un tipo específico
   * @param contextType Tipo de contexto
   * @returns Número de contextos
   */
  getContextCount(contextType: ContextType): number {
    return this.getContextIds(contextType).length;
  }

  /**
   * Limpia todos los contextos de un tipo específico
   * @param contextType Tipo de contexto
   * @returns Número de contextos eliminados
   */
  clearContexts(contextType: ContextType): number {
    const ids = this.getContextIds(contextType);
    let deletedCount = 0;

    for (const id of ids) {
      if (this.deleteContext(contextType, id)) {
        deletedCount++;
      }
    }

    this.logger.log(`Cleared ${deletedCount} ${contextType} contexts`);
    return deletedCount;
  }

  /**
   * Limpia todos los contextos
   */
  clearAllContexts(): void {
    this.ttlDB.clear();
    this.logger.log('Cleared all contexts');
  }
}

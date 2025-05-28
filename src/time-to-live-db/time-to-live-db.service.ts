import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';

interface TTLItem<T> {
  value: T;
  expiresAt: Date;
}

@Injectable()
export class TimeToLiveDBService implements OnModuleInit {
  private readonly logger = new Logger(TimeToLiveDBService.name);
  private storage: Map<string, TTLItem<any>> = new Map();
  private cleanupInterval: NodeJS.Timeout;
  private readonly defaultTTL: number; // en segundos
  private readonly cleanupIntervalTime: number; // en milisegundos

  constructor(
    private readonly configService: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {
    this.defaultTTL = this.configService.get<number>('DEFAULT_TTL', 3600); // 1 hora por defecto
    this.cleanupIntervalTime = this.configService.get<number>(
      'CLEANUP_INTERVAL',
      300000,
    ); // 5 minutos por defecto
  }

  onModuleInit() {
    this.setupCleanupJob();
  }

  /**
   * Configura el trabajo de limpieza periódica
   */
  private setupCleanupJob() {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredItems();
    }, this.cleanupIntervalTime);

    this.schedulerRegistry.addInterval('ttl-db-cleanup', this.cleanupInterval);

    this.logger.log(
      `TTL cleanup job scheduled to run every ${this.cleanupIntervalTime / 1000} seconds`,
    );
  }

  /**
   * Almacena un valor con un tiempo de expiración
   * @param key Clave única para el valor
   * @param value Valor a almacenar
   * @param ttl Tiempo de vida en segundos (opcional, usa el valor por defecto si no se proporciona)
   */
  set<T>(key: string, value: T, ttl?: number): void {
    const expiresAt = new Date(Date.now() + (ttl || this.defaultTTL) * 1000);

    this.storage.set(key, {
      value,
      expiresAt,
    });

    this.logger.debug(
      `Stored key "${key}" with expiration at ${expiresAt.toISOString()}`,
    );
  }

  /**
   * Obtiene un valor almacenado si no ha expirado
   * @param key Clave del valor a obtener
   * @returns El valor almacenado o null si no existe o ha expirado
   */
  get<T>(key: string): T | null {
    const item = this.storage.get(key);

    if (!item) {
      return null;
    }

    // Verificar si el item ha expirado
    if (item.expiresAt < new Date()) {
      this.delete(key);
      return null;
    }

    return item.value as T;
  }

  /**
   * Elimina un valor de la base de datos
   * @param key Clave del valor a eliminar
   * @returns true si se eliminó, false si no existía
   */
  delete(key: string): boolean {
    return this.storage.delete(key);
  }

  /**
   * Verifica si una clave existe y no ha expirado
   * @param key Clave a verificar
   * @returns true si existe y no ha expirado, false en caso contrario
   */
  has(key: string): boolean {
    const item = this.storage.get(key);
    if (!item) return false;

    // Verificar si el item ha expirado
    if (item.expiresAt < new Date()) {
      this.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Actualiza el tiempo de expiración de un valor existente
   * @param key Clave del valor a actualizar
   * @param ttl Nuevo tiempo de vida en segundos
   * @returns true si se actualizó, false si no existía
   */
  updateTTL(key: string, ttl: number): boolean {
    const item = this.storage.get(key);
    if (!item) return false;

    // Verificar si el item ha expirado
    if (item.expiresAt < new Date()) {
      this.delete(key);
      return false;
    }

    // Actualizar tiempo de expiración
    item.expiresAt = new Date(Date.now() + ttl * 1000);
    this.storage.set(key, item);

    return true;
  }

  /**
   * Limpia todos los elementos expirados de la base de datos
   * @returns Número de elementos eliminados
   */
  cleanupExpiredItems(): number {
    const now = new Date();
    let deletedCount = 0;

    for (const [key, item] of this.storage.entries()) {
      if (item.expiresAt < now) {
        this.storage.delete(key);
        deletedCount++;
      }
    }

    if (deletedCount > 0) {
      this.logger.log(`Cleaned up ${deletedCount} expired items`);
    }

    return deletedCount;
  }

  /**
   * Obtiene todas las claves almacenadas que no han expirado
   * @returns Array de claves
   */
  keys(): string[] {
    const now = new Date();
    const validKeys: string[] = [];

    for (const [key, item] of this.storage.entries()) {
      if (item.expiresAt > now) {
        validKeys.push(key);
      }
    }

    return validKeys;
  }

  /**
   * Obtiene el número de elementos almacenados que no han expirado
   * @returns Número de elementos
   */
  size(): number {
    return this.keys().length;
  }

  /**
   * Limpia toda la base de datos
   */
  clear(): void {
    this.storage.clear();
    this.logger.log('TTL database cleared');
  }
}

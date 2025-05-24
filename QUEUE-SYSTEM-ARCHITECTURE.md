# Sistema de Colas para Alto Tráfico - Arquitectura

## Objetivo
Implementar un sistema de colas robusto para manejar alto tráfico de optimización de imágenes con las siguientes características:
- Respuesta inmediata con URL de acceso
- Procesamiento asíncrono en cola
- Time-to-Live (TTL) automático para limpieza
- Almacenamiento en disco (no RAM) para MulterModule

## Componentes del Sistema

### 1. Redis Queue System
- **Bull Queue**: Sistema de colas basado en Redis
- **Job Processing**: Procesamiento asíncrono de imágenes
- **Job Status**: Seguimiento del estado de procesamiento
- **Priority Levels**: Diferentes prioridades para tipos de optimización

### 2. File Storage System
- **Disk Storage**: MulterModule configurado para almacenamiento en disco
- **Structured Directory**: Organización por fecha/hora/ID
- **TTL Cleanup**: Sistema de limpieza automática basado en tiempo

### 3. URL Generation & Access
- **Unique Job IDs**: UUIDs para identificar trabajos únicos
- **Status Endpoints**: APIs para consultar estado del trabajo
- **Download Endpoints**: URLs directas para descargar imágenes optimizadas

### 4. Database (Opcional)
- **Job Metadata**: Información sobre trabajos y archivos
- **TTL Tracking**: Seguimiento de fechas de expiración
- **Statistics**: Métricas de uso y rendimiento

## Flujo de Trabajo

### Proceso de Subida
1. Cliente sube imagen → Endpoint recibe archivo
2. Archivo se guarda temporalmente en disco
3. Job se crea en cola con ID único
4. Se responde inmediatamente con:
   ```json
   {
     "jobId": "uuid-12345",
     "statusUrl": "/api/jobs/uuid-12345/status",
     "downloadUrl": "/api/jobs/uuid-12345/download",
     "estimatedTime": "5-30 seconds"
   }
   ```

### Proceso de Cola
1. Worker toma job de la cola
2. Procesa imagen con Sharp
3. Guarda imagen optimizada en disco
4. Actualiza estado del job
5. Programa TTL para limpieza

### Proceso de Acceso
1. Cliente consulta statusUrl para verificar completado
2. Cliente accede downloadUrl cuando esté listo
3. Sistema sirve archivo desde disco
4. TTL eventualmente limpia archivos

## Estructura de Directorios

```
uploads/
├── temp/           # Archivos temporales de subida
├── processing/     # Archivos en procesamiento
├── completed/      # Archivos completados
│   └── YYYY-MM-DD/ # Organizados por fecha
└── logs/           # Logs del sistema
```

## Dependencias Necesarias

```json
{
  "@nestjs/bull": "^10.0.1",
  "@nestjs/config": "^3.1.1",
  "@nestjs/schedule": "^4.0.0",
  "bull": "^4.12.0",
  "redis": "^4.6.0",
  "uuid": "^9.0.1",
  "cron": "^3.1.6"
}
```

## Configuraciones de Rendimiento

### Redis Configuración
```yaml
redis:
  host: localhost
  port: 6379
  db: 0
  maxRetriesPerRequest: 3
  retryDelayOnFailover: 100
```

### Bull Queue Configuración
```typescript
{
  redis: redisConfig,
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 50,
    attempts: 3,
    backoff: 'exponential'
  }
}
```

### Multer Disk Storage
```typescript
MulterModule.register({
  storage: diskStorage({
    destination: './uploads/temp',
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
  }),
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB
  }
})
```

## Métricas y Monitoreo

### Health Check
- Estado de Redis
- Estado de la cola
- Espacio en disco disponible
- Número de trabajos pendientes

### Logs
- Tiempo de procesamiento por imagen
- Errores y fallos
- Estadísticas de TTL cleanup
- Métricas de rendimiento

## Escalabilidad

### Horizontal Scaling
- Múltiples workers pueden procesar la misma cola
- Redis como punto central de coordinación
- Load balancer para múltiples instancias

### Vertical Scaling
- CPU cores para workers paralelos
- RAM para cache de Redis
- Storage SSD para mejor I/O

## Implementación por Fases

### Fase 1: Configuración Básica
- [ ] Instalar dependencias
- [ ] Configurar Redis
- [ ] Configurar Multer disk storage

### Fase 2: Sistema de Colas
- [ ] Implementar Bull Queue
- [ ] Crear job processor
- [ ] Endpoints de status

### Fase 3: TTL y Limpieza
- [ ] Sistema de TTL automático
- [ ] Cron jobs para limpieza
- [ ] Logging y monitoreo

### Fase 4: Optimización
- [ ] Performance tuning
- [ ] Métricas avanzadas
- [ ] Scaling configuration
# Performance Optimization Guide

## Docker Resource Configuration

Hemos optimizado significativamente los recursos asignados al contenedor para mejorar el rendimiento de optimización de imágenes:

### Recursos Actuales

- **CPU**: 2.0 cores (límite) / 1.0 core (reservado)
- **Memoria**: 4GB (límite) / 2GB (reservado)
- **Mejora**: 4x más CPU y 4x más memoria que la configuración anterior

### Variables de Entorno de Optimización

```bash
# Node.js thread pool optimization
UV_THREADPOOL_SIZE=16          # Más threads para operaciones I/O

# Sharp library optimization
SHARP_CACHE_MEMORY=2048       # 2GB de cache para Sharp
SHARP_CONCURRENCY=4           # Procesamiento concurrente
```

## Mejoras Esperadas

### Antes vs Después

- **Imagen 6MB**: ~40 segundos → **~8-12 segundos** (estimado)
- **CPU disponible**: 0.5 cores → **2.0 cores**
- **Memoria disponible**: 1GB → **4GB**
- **Cache Sharp**: Sin limite → **2GB dedicado**

### Optimizaciones Implementadas

1. **Thread Pool Aumentado**: De 4 a 16 threads para operaciones I/O
2. **Cache Dedicado**: 2GB de memoria cache para Sharp
3. **Procesamiento Concurrente**: 4 hilos simultáneos para Sharp
4. **Recursos 4x Mayores**: CPU y memoria significativamente aumentados

## Comandos de Monitoreo

```bash
# Ver uso de recursos en tiempo real
docker stats image-optimization-service

# Ver logs del contenedor
docker logs -f image-optimization-service

# Reiniciar con nueva configuración
docker-compose down && docker-compose up --build -d
```

## Pruebas de Rendimiento

Para probar el rendimiento mejorado:

```bash
# Subir una imagen de 6MB para pruebas
curl -X POST http://localhost:3000/image-optimization/optimize \
  -F "image=@tu-imagen-6mb.jpg" \
  -F "width=1920" \
  -F "quality=80" \
  -F "format=jpeg"
```

## Configuración por Ambiente

- **Producción**: `docker-compose.yml` - Recursos completos
- **Desarrollo**: `docker-compose.dev.yml` - Recursos completos + hot reload

## Troubleshooting

Si el rendimiento sigue siendo lento:

1. Verificar que Docker Desktop tenga suficientes recursos asignados
2. Comprobar que no hay otros procesos consumiendo recursos
3. Considerar usar SSD para almacenamiento de imágenes
4. Monitorear logs para identificar cuellos de botella

## Variables de Entorno Adicionales

Para optimización adicional, puedes añadir:

```bash
# En docker-compose.yml
- NODE_OPTIONS=--max-old-space-size=3072  # Más memoria para Node.js
- SHARP_IGNORE_GLOBAL_LIBVIPS=1          # Usar libvips local
- MALLOC_ARENA_MAX=2                     # Optimizar malloc
```
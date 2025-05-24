# Docker Deployment Guide

Esta guía explica cómo desplegar la aplicación Image Optimization Service usando Docker y Docker Compose.

## 📋 Prerequisitos

- Docker Engine 20.10+
- Docker Compose 2.0+
- Al menos 2GB de RAM disponible
- Puertos 3000, 80, 443 disponibles

## 🚀 Inicio Rápido

### Desarrollo

```bash
# Clonar el repositorio
git clone <repository-url>
cd image-optimization-service

# Construir y ejecutar en modo desarrollo
docker-compose -f docker-compose.dev.yml up --build

# La aplicación estará disponible en:
# http://localhost:3000 - API
# http://localhost:3000/api - Swagger Documentation
```

### Producción

```bash
# Construir y ejecutar en modo producción
docker-compose up --build -d

# Con proxy nginx (recomendado)
docker-compose --profile production up --build -d

# La aplicación estará disponible en:
# http://localhost:80 - Nginx Proxy
# http://localhost:3000 - API Direct
```

## 🏗️ Arquitectura

### Servicios Principales

1. **image-optimization-api**: Aplicación NestJS principal
2. **nginx**: Proxy reverso y balanceador de carga
3. **redis**: Cache (opcional)
4. **postgres-dev**: Base de datos para desarrollo (opcional)

### Volúmenes

- `./uploads`: Almacenamiento persistente de imágenes
- `./logs`: Logs de la aplicación
- `redis_data`: Datos de Redis
- `postgres_dev_data`: Datos de PostgreSQL (desarrollo)

## 📁 Estructura de Archivos

```
.
├── Dockerfile                 # Imagen principal multi-stage
├── docker-compose.yml         # Configuración de producción
├── docker-compose.dev.yml     # Configuración de desarrollo
├── .dockerignore              # Archivos excluidos del build
├── nginx/
│   └── nginx.conf            # Configuración de Nginx
└── README-Docker.md          # Esta guía
```

## 🔧 Configuración

### Variables de Entorno

Crea un archivo `.env` para personalizar la configuración:

```bash
# .env
NODE_ENV=production
PORT=3000
MAX_FILE_SIZE=50MB
UPLOAD_DIR=/app/uploads

# Opcional: Redis
REDIS_HOST=redis
REDIS_PORT=6379

# Opcional: PostgreSQL
DATABASE_HOST=postgres-dev
DATABASE_PORT=5432
DATABASE_NAME=image_optimization_dev
DATABASE_USER=dev_user
DATABASE_PASSWORD=dev_password
```

### Perfiles de Docker Compose

```bash
# Solo aplicación principal
docker-compose up

# Con Nginx proxy
docker-compose --profile production up

# Con Redis cache
docker-compose --profile cache up

# Con base de datos (desarrollo)
docker-compose -f docker-compose.dev.yml --profile database up

# Combinaciones múltiples
docker-compose --profile production --profile cache up
```

## 🛠️ Comandos Útiles

### Desarrollo

```bash
# Iniciar en modo desarrollo con hot reload
docker-compose -f docker-compose.dev.yml up --build

# Ver logs en tiempo real
docker-compose -f docker-compose.dev.yml logs -f

# Ejecutar comandos dentro del contenedor
docker-compose -f docker-compose.dev.yml exec image-optimization-dev npm run test

# Debugging
docker-compose -f docker-compose.dev.yml up --build
# Después conectar debugger a localhost:9229
```

### Producción

```bash
# Iniciar servicios
docker-compose up -d

# Escalar la aplicación
docker-compose up --scale image-optimization-api=3 -d

# Ver estado de servicios
docker-compose ps

# Ver logs
docker-compose logs image-optimization-api

# Actualizar imagen
docker-compose pull
docker-compose up -d
```

### Mantenimiento

```bash
# Detener todos los servicios
docker-compose down

# Detener y eliminar volúmenes
docker-compose down -v

# Limpiar imágenes no utilizadas
docker system prune -a

# Backup de volúmenes
docker run --rm -v $(pwd)/uploads:/backup ubuntu tar czf /backup/uploads-backup.tar.gz /backup
```

## 🔍 Monitoreo y Debugging

### Health Checks

```bash
# Verificar salud de los contenedores
docker-compose ps

# Verificar health check específico
docker inspect --format='{{json .State.Health}}' image-optimization-service
```

### Logs

```bash
# Ver todos los logs
docker-compose logs

# Seguir logs en tiempo real
docker-compose logs -f image-optimization-api

# Logs de Nginx
docker-compose logs nginx
```

### Métricas

```bash
# Uso de recursos
docker stats

# Información del contenedor
docker inspect image-optimization-service
```

## 🚨 Troubleshooting

### Problemas Comunes

1. **Error de permisos en uploads/**
   ```bash
   sudo chown -R $(id -u):$(id -g) uploads/
   ```

2. **Puerto ya en uso**
   ```bash
   # Cambiar puerto en docker-compose.yml
   ports:
     - "3001:3000"  # Usar puerto 3001 en lugar de 3000
   ```

3. **Memoria insuficiente**
   ```bash
   # Ajustar limits en docker-compose.yml
   deploy:
     resources:
       limits:
         memory: 2G
   ```

4. **Problemas con Sharp en Alpine**
   ```bash
   # Reconstruir imagen
   docker-compose build --no-cache
   ```

### Depuración

```bash
# Acceder al contenedor
docker-compose exec image-optimization-api sh

# Verificar instalación de Sharp
docker-compose exec image-optimization-api npm list sharp

# Probar procesamiento de imagen
docker-compose exec image-optimization-api node -e "console.log(require('sharp'))"
```

## 🔒 Seguridad

### Recomendaciones de Producción

1. **Usar HTTPS**
   - Configurar SSL en Nginx
   - Usar certificados Let's Encrypt

2. **Limitar acceso**
   - Configurar firewall
   - Usar redes Docker privadas

3. **Monitoreo**
   - Implementar logging centralizado
   - Alertas de seguridad

4. **Backups**
   - Backup regular de volúmenes
   - Backup de configuración

---

## 📞 Soporte

Para problemas o preguntas:
1. Verificar logs: `docker-compose logs`
2. Revisar esta documentación
3. Consultar la documentación de NestJS
4. Crear un issue en el repositorio
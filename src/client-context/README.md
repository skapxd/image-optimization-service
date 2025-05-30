# Módulo de Contexto del Cliente (ClientContext)

Este módulo proporciona un wrapper type-safe para `TimeToLiveDBService`, permitiendo almacenar y recuperar datos de contexto del cliente con autocompletado y verificación de tipos.

## Características

- **Type-Safe**: Proporciona interfaces TypeScript para diferentes tipos de contexto
- **Autocompletado**: Facilita el desarrollo con sugerencias de propiedades en el IDE
- **TTL Integrado**: Hereda la funcionalidad de expiración automática de `TimeToLiveDBService`
- **Contexto Global**: Evita el prop drilling al proporcionar un almacén de datos centralizado
- **Múltiples Contextos**: Soporta diferentes tipos de contexto (optimización de imágenes, usuario, solicitud)

## Instalación

El módulo ya está configurado en la aplicación. Se ha añadido al `AppModule` y está disponible globalmente.

## Uso

### Importar el servicio

```typescript
import { ClientContextService } from '../client-context/client-context.service';
import { ContextType } from '../client-context/client-context.types';
```

### Inyectar en el constructor

```typescript
constructor(
  private readonly clientContext: ClientContextService,
) {}
```

### Almacenar datos de contexto

```typescript
// Contexto de optimización de imágenes
this.clientContext.setImageOptimizationContext('job-123', {
  originalFilename: 'example.jpg',
  originalSize: 1024000,
  width: 800,
  height: 600,
  quality: 80,
});

// Contexto de usuario
this.clientContext.setUserContext('user-456', {
  userId: 'user-456',
  username: 'john_doe',
  email: 'john@example.com',
  preferences: { theme: 'dark' },
});

// Contexto de solicitud
this.clientContext.setRequestContext('req-789', {
  ip: '192.168.1.1',
  userAgent: 'Mozilla/5.0...',
  path: '/api/images',
  method: 'POST',
});
```

### Recuperar datos de contexto

```typescript
// Contexto de optimización de imágenes
const imageContext = this.clientContext.getImageOptimizationContext('job-123');
if (imageContext) {
  console.log(`Compression ratio: ${imageContext.compressionRatio}`);
}

// Contexto de usuario
const userContext = this.clientContext.getUserContext('user-456');
if (userContext) {
  console.log(`Username: ${userContext.username}`);
}

// Contexto de solicitud
const requestContext = this.clientContext.getRequestContext('req-789');
if (requestContext) {
  console.log(`Request path: ${requestContext.path}`);
}
```

### Verificar existencia de contexto

```typescript
const exists = this.clientContext.hasContext(ContextType.IMAGE_OPTIMIZATION, 'job-123');
```

### Eliminar contexto

```typescript
this.clientContext.deleteContext(ContextType.USER, 'user-456');
```

### Actualizar TTL

```typescript
// Extender el tiempo de vida a 2 horas (7200 segundos)
this.clientContext.updateContextTTL(ContextType.REQUEST, 'req-789', 7200);
```

### Obtener estadísticas

```typescript
const imageContextCount = this.clientContext.getContextCount(ContextType.IMAGE_OPTIMIZATION);
console.log(`Número de contextos de optimización de imágenes: ${imageContextCount}`);
```

## Extender con nuevos tipos de contexto

Para añadir un nuevo tipo de contexto:

1. Añadir una nueva interfaz en `client-context.types.ts`:

```typescript
export interface NewContextType extends BaseClientContext {
  // Propiedades específicas del nuevo contexto
  property1?: string;
  property2?: number;
}
```

2. Actualizar el tipo unión `ClientContextType`:

```typescript
export type ClientContextType = 
  | ImageOptimizationContext
  | UserContext
  | RequestContext
  | NewContextType; // Añadir el nuevo tipo
```

3. Añadir un nuevo valor al enum `ContextType`:

```typescript
export enum ContextType {
  IMAGE_OPTIMIZATION = 'image-optimization',
  USER = 'user',
  REQUEST = 'request',
  NEW_CONTEXT = 'new-context', // Añadir el nuevo tipo
}
```

4. Implementar los métodos correspondientes en `ClientContextService`:

```typescript
setNewContext(id: string, context: Partial<NewContextType>, ttl?: number): void {
  // Implementación
}

getNewContext(id: string): NewContextType | null {
  // Implementación
}
```

## Ejemplo completo

Ver el archivo `client-context.example.ts` para un ejemplo completo de uso del módulo en un controlador.
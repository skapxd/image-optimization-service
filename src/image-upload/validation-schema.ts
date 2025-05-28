import { z } from 'zod/v4';

export const validationSchema = z.object({
  S3_BUCKET_NAME: z
    .string()
    .min(1, 'El nombre del bucket S3 no puede estar vacío'),
  S3_ACCESS_KEY_ID: z
    .string()
    .min(1, 'El ID de clave de acceso S3 no puede estar vacío'),
  S3_SECRET_ACCESSKEY: z
    .string()
    .min(1, 'La clave secreta de acceso S3 no puede estar vacía'),
  S3_ENDPOINT: z.url('El endpoint de S3 debe ser una URL válida'),
  S3_CUSTOM_DOMAIN: z.url(
    'El dominio personalizado de S3 debe ser una URL válida',
  ),
});

export type ConfigSchema = z.infer<typeof validationSchema>;

// Función de ayuda para validar la configuración
export function validate(config: Record<string, unknown>): ConfigSchema {
  const result = validationSchema.safeParse(config);

  if (!result.success) {
    const formattedErrors = result.error.format();
    console.error('Error de validación de configuración:', formattedErrors);
    throw new Error(
      'La configuración de S3 no es válida. Revise los logs para más detalles.',
    );
  }

  return result.data;
}

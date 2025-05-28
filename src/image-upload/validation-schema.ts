import { z } from 'zod/v4';

export const validationSchema = z.object({
  S3_BUCKET_NAME: z.string(),
  S3_ACCESS_KEY_ID: z.string(),
  S3_SECRET_ACCESSKEY: z.string(),
  S3_ENDPOINT: z.string(),
});

export type ConfigSchema = z.infer<typeof validationSchema>;

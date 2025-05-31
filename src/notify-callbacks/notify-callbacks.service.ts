import { Injectable, Logger } from '@nestjs/common';

export interface OptimizationCallback {
  url: string;
  headers?: Record<string, string>;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH';
}

@Injectable()
export class NotifyCallbackService {
  private readonly logger = new Logger(NotifyCallbackService.name);

  async notify(callbacks: OptimizationCallback[], data: any) {
    try {
      // Procesar cada callback en paralelo
      const callbackPromises = callbacks?.map(async (callback) => {
        try {
          const { url, headers = {}, method = 'POST' } = callback;

          if (!URL.canParse(url)) {
            this.logger.error(`Invalid URL: ${url}`);

            return;
          }

          const response = await fetch(url, {
            method,
            headers: {
              'Content-Type': 'application/json',
              ...headers,
            },
            body: method !== 'GET' ? JSON.stringify(data) : undefined,
          });

          if (!response.ok) {
            console.error(
              `Callback to ${url} failed with status ${response.status}`,
            );
          }
        } catch (error) {
          console.error(`Error notifying callback ${callback.url}:`, error);
        }
      });

      await Promise.allSettled(callbackPromises);
    } catch (error) {
      console.error(
        'Error importing node-fetch or processing callbacks:',
        error,
      );
    }
  }
}

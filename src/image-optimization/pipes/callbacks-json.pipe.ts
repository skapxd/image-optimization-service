import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import { OptimizationCallback } from 'src/notify-callbacks/notify-callbacks.service';

@Injectable()
export class CallbacksJsonPipe
  implements PipeTransform<string, OptimizationCallback[]>
{
  transform(value: string): OptimizationCallback[] {
    if (!value) {
      return [];
    }
    try {
      // Si el valor no empieza con '[' y termina con ']', asumimos que es una concatenación de objetos JSON
      let jsonString = value.trim();

      // If the value is not an array, try to parse it as a single JSON object
      // and wrap it in an array.
      if (!jsonString.startsWith('[') && jsonString.startsWith('{')) {
        jsonString = `[${jsonString}]`;
      } else if (!jsonString.startsWith('[') || !jsonString.endsWith(']')) {
        // If it's not a single object or an array, try to reconstruct from concatenated objects
        const parts = jsonString.split('},{');
        jsonString =
          '[' +
          parts
            .map((part, index) => {
              if (index === 0) {
                return part + '}';
              } else if (index === parts.length - 1) {
                return '{' + part;
              } else {
                return '{' + part + '}';
              }
            })
            .join(',') +
          ']';
      }

      const callbacks = JSON.parse(jsonString) as unknown;
      if (!Array.isArray(callbacks)) {
        throw new Error('Callbacks must be an array.');
      }
      // Aquí puedes añadir validación más detallada para cada objeto dentro del array
      // Por ejemplo, verificar que cada objeto tenga una propiedad 'url'
      for (const callback of callbacks) {
        if (
          typeof callback !== 'object' ||
          callback === null ||
          !('url' in callback)
        ) {
          throw new Error("Each callback object must have a 'url' property.");
        }
      }

      return callbacks as OptimizationCallback[];
    } catch (e) {
      throw new BadRequestException(
        `Invalid callbacks format: ${e.message || 'Must be a JSON string representing an array of OptimizationCallback objects.'}`,
      );
    }
  }
}

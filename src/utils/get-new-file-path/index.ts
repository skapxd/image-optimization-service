import { DateTime } from 'luxon';
import { randomUUID } from 'node:crypto';

export const getNewFilePath = (format: string) => {
  const dateTime = DateTime.now().setZone('local');
  const formattedDate = dateTime.toFormat('yyyy-MM-dd-HH-mm-ss-SSS');
  const offset = dateTime.toFormat('Z').replace(':00', '');

  return `optimized/${formattedDate}_${offset}_${randomUUID()}.${format}`;
};

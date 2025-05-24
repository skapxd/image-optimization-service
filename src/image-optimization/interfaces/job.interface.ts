import { JobStatus } from '../enums/job-status.enum';
import { ImageFormat } from '../image-format.enum';

export interface ImageOptimizationJob {
  id: string;
  fileName: string;
  originalName: string;
  filePath: string;
  options: {
    width?: number;
    height?: number;
    quality?: number;
    format?: ImageFormat;
  };
  status: JobStatus;
  createdAt: Date;
  processedAt?: Date;
  completedAt?: Date;
  resultUrl?: string;
  errorMessage?: string;
  ttl: number; // TTL en horas
  expiresAt: Date;
}

export interface JobResponse {
  jobId: string;
  status: string;
  message: string;
  estimatedTime?: number;
  resultUrl?: string;
}

export interface ProcessingResult {
  jobId: string;
  success: boolean;
  resultPath?: string;
  resultUrl?: string;
  originalSize?: number;
  optimizedSize?: number;
  compressionRatio?: number;
  error?: string;
}
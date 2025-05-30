/**
 * Tipos para el módulo de contexto del cliente
 * Este archivo define los tipos utilizados en el módulo de contexto del cliente
 */

import { OptimizationCallback } from "src/notify-callbacks/notify-callbacks.service";

/**
 * Interfaz base para todos los contextos de cliente
 * Cada contexto específico debe extender esta interfaz
 */
export interface BaseClientContext {
  clientId: string;
  sessionId?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Contexto para datos de optimización de imágenes
 */
export interface ImageOptimizationContext extends BaseClientContext {
  originalFilename?: string;
  originalSize?: number;
  optimizedSize?: number;
  compressionRatio?: number;
  format?: string;
  width?: number;
  height?: number;
  quality?: number;
  processingTime?: number;
}

/**
 * Contexto para datos de usuario
 */
export interface UserContext extends BaseClientContext {
  userId?: string;
  username?: string;
  email?: string;
  preferences?: Record<string, any>;
}

/**
 * Contexto para datos de solicitud
 */
export interface RequestContext extends BaseClientContext {
  ip?: string;
  userAgent?: string;
  referer?: string;
  path?: string;
  method?: string;
  params?: Record<string, any>;
  query?: Record<string, any>;
  body?: Record<string, any>;
}

/**
 * Contexto para parámetros de controladores
 */
export interface ControllerParamsContext extends BaseClientContext {
  // Parámetros comunes de controladores
  file: Express.Multer.File;
  files: Express.Multer.File[];
  callbacks: OptimizationCallback[];
  width: number;
  height: number | null;
  quality: number;
  format: string;
  // Parámetros específicos para optimización de imágenes
  blurRadius: number;
  mobileOptimized: boolean;
  newFilePath: string;
  // Otros parámetros que puedan ser necesarios
  [key: string]: any;
}

/**
 * Unión de todos los tipos de contexto disponibles
 */
export type ClientContextType =
  | ImageOptimizationContext
  | UserContext
  | RequestContext
  | ControllerParamsContext;

/**
 * Tipo para las claves de contexto
 */
export type ContextKey = string;

/**
 * Enum para los tipos de contexto
 */
export enum ContextType {
  IMAGE_OPTIMIZATION = 'image-optimization',
  USER = 'user',
  REQUEST = 'request',
  CONTROLLER_PARAMS = 'controller-params',
}

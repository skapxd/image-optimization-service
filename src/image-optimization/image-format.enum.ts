export enum ImageFormat {
  JPEG = 'jpeg',
  PNG = 'png',
  WEBP = 'webp',
  AVIF = 'avif',
  GIF = 'gif',
  TIFF = 'tiff',
  SVG = 'svg',
  AUTO = 'auto',
}

export const SUPPORTED_IMAGE_FORMATS = Object.values(ImageFormat);

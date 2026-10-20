export interface UploadFileOptions {
  key: string;
  body: string | Uint8Array | Buffer;
  contentType?: string;
  bucket?: string;
}

export interface UploadFileResult {
  key: string;
  bucket: string;
  eTag?: string;
}

export interface PresignedUrlOptions {
  key: string;
  expiresIn?: number; // in seconds (default: 3600)
  bucket?: string;
}

export interface PresignedUploadUrlOptions {
  key: string;
  expiresIn?: number;
  contentType?: string;
  bucket?: string;
}

export interface PresignedUploadUrlResult {
  url: string;
  key: string;
  bucket: string;
  expiresIn: number;
}

export interface StorageConnectionStatus {
  connected: boolean;
  bucket: string;
  latencyMs: number;
  error?: string;
}

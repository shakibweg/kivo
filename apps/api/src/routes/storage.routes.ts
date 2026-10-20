import { Router } from 'express';
import {
  getStorageStatus,
  getPresignedDownloadUrl,
  getPresignedUploadUrl,
  uploadFile,
  deleteFile,
} from '../controllers/storage.controller';

const router = Router();

// Storage Status
router.get('/status', getStorageStatus);

// Presigned URLs
router.post('/presigned-url', getPresignedDownloadUrl);
router.post('/download-url', getPresignedDownloadUrl);
router.post('/upload-url', getPresignedUploadUrl);

// Direct Operations
router.post('/upload', uploadFile);
router.delete('/file', deleteFile);

export default router;

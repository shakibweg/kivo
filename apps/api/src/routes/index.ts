import { Router } from 'express';
import healthRouter from './health.route';
import authRouter from './auth.routes';
import aiRouter from './ai.routes';
import storageRouter from './storage.routes';
import pageRouter from './page.routes';
import imageRouter from './image.routes';
import mediaRouter from './media.routes';
import { ApiResponse } from '../utils/ApiResponse';

const router = Router();

router.get('/', (_req, res) => {
  return res.status(200).json(
    new ApiResponse(
      200,
      {
        name: 'Kivo API',
        version: '1.0.0',
        status: 'online',
        timestamp: new Date().toISOString(),
        endpoints: {
          health: '/api/health',
          pages: '/api/pages',
          documents: '/api/documents',
          aiStatus: '/api/ai/status',
          aiGenerate: '/api/ai/generate',
          aiStream: '/api/ai/stream',
          aiChat: '/api/ai/chat',
          aiInline: '/api/ai/inline',
          storageStatus: '/api/storage/status',
          storagePresignedUrl: '/api/storage/presigned-url',
          imageUploadUrl: '/api/images/upload-url',
          images: '/api/images',
          mediaUnsplash: '/api/media/unsplash',
          mediaGiphy: '/api/media/giphy',
          storageUploadUrl: '/api/storage/upload-url',
          googleLogin: '/api/auth/google',
          authStatus: '/api/auth/status',
          me: '/api/auth/me',
        },
      },
      'Welcome to Kivo API'
    )
  );
});

// Mount modular sub-routes
router.use('/health', healthRouter);
router.use('/pages', pageRouter);
router.use('/documents', pageRouter); // Alias for backward compatibility
router.use('/auth', authRouter);
router.use('/ai', aiRouter);
router.use('/storage', storageRouter);
router.use('/images', imageRouter);
router.use('/media', mediaRouter);

export default router;
export { router };

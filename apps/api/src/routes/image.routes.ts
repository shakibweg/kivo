import { Router } from 'express';
import { imageController } from '../controllers/image.controller';
import { optionalAuth } from '../middlewares/auth.middleware';

const router = Router();

router.post('/upload-url', optionalAuth, imageController.createUploadUrl);
router.post('/', optionalAuth, imageController.confirmUpload);
router.get('/:id/file', imageController.serveImage);
router.get('/:id', imageController.getImage);

export default router;

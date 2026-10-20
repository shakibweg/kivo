import { Router } from 'express';
import { mediaController } from '../controllers/media.controller';

const router = Router();

router.get('/unsplash', mediaController.searchUnsplash);
router.post('/unsplash/track', mediaController.trackUnsplash);
router.get('/giphy', mediaController.searchGiphy);

export default router;

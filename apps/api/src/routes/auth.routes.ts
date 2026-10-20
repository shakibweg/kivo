import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { ensureAuthenticated } from '../middlewares/auth.middleware';

const router = Router();

// 1. Google OAuth & Direct Auth endpoints (Mobile & Web)
router.post('/mobile/google', authController.mobileGoogleLogin);
router.post('/web/google', authController.webGoogleLogin);
router.post('/google', authController.webGoogleLogin);
router.get('/google', authController.googleLogin);
router.get('/google/callback', authController.googleCallback);

// 2. Current User Profile (Protected via JWT / Session)
router.get('/me', ensureAuthenticated, authController.getMe);

// 3. Logout
router.post('/logout', authController.logout);
router.get('/logout', authController.logout);

// 4. Configuration status
router.get('/status', authController.getStatus);

export default router;

import { Router, Request, Response, NextFunction } from 'express';
import { pageController } from '../controllers/page.controller';
import jwt from 'jsonwebtoken';
import { ENV } from '../config/env';
import { users } from '../config/passport';

const router = Router();

function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  if (req.user) return next();

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    if (token) {
      try {
        const decoded = jwt.verify(token, ENV.JWT_SECRET) as { id: string };
        if (decoded?.id) {
          req.user = users.get(decoded.id) || ({ id: decoded.id } as any);
        }
      } catch {
        // Continue even if token is invalid
      }
    }
  }
  next();
}

router.use(optionalAuth);

router.get('/', pageController.getPages);
router.post('/', pageController.createPage);
router.get('/:id', pageController.getPageById);
router.put('/:id', pageController.updatePage);
router.delete('/:id', pageController.deletePage);

export default router;

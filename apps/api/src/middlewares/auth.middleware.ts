import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ENV } from '../config/env';
import { users } from '../config/passport';
import { User } from '../types/user';
import { ApiError } from '../utils/ApiError';

/**
 * Attaches req.user when a valid Bearer token is present, but never rejects.
 */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
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
        // Continue as anonymous when the token is invalid
      }
    }
  }
  next();
}

export function ensureAuthenticated(req: Request, _res: Response, next: NextFunction): void {
  // 1. Check Passport session authentication
  if (req.isAuthenticated && req.isAuthenticated() && req.user) {
    return next();
  }

  // 2. Fallback: Check JWT token in Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    if (token) {
      try {
        const decoded = jwt.verify(token, ENV.JWT_SECRET) as {
          id: string;
          email?: string;
          name?: string;
        };
        const user = users.get(decoded.id);
        if (user) {
          req.user = user;
          return next();
        } else if (decoded.id) {
          const reconstructedUser: User = {
            id: decoded.id,
            googleId: decoded.id,
            email: decoded.email || '',
            name: decoded.name || decoded.email?.split('@')[0] || 'User',
            provider: 'google',
            createdAt: new Date().toISOString(),
            lastLoginAt: new Date().toISOString(),
          };
          users.set(decoded.id, reconstructedUser);
          req.user = reconstructedUser;
          return next();
        }
      } catch {
        return next(new ApiError(401, 'Invalid or expired authentication token'));
      }
    }
  }

  return next(new ApiError(401, 'Authentication required. Please sign in via Google OAuth.'));
}

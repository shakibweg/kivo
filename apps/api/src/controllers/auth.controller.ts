import { Request, Response, NextFunction } from 'express';
import passport from 'passport';
import jwt from 'jsonwebtoken';
import { ENV } from '../config/env';
import { users } from '../config/passport';
import { User } from '../types/user';
import { ApiError } from '../utils/ApiError';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import logger from '../logger/winston.logger';

export const authController = {
  // 1. Mobile Google Auth endpoint
  mobileGoogleLogin: asyncHandler(async (req: Request, res: Response) => {
    const { user, idToken } = req.body;

    const email = user?.email || '';
    const name = user?.name || email.split('@')[0] || 'Mobile User';
    const avatar = user?.photo || user?.avatar || '';
    const id = user?.id || `usr_mob_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    const appUser: User = {
      id,
      googleId: user?.id || '',
      email,
      name,
      firstName: user?.givenName,
      lastName: user?.familyName,
      avatar,
      provider: 'google',
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    };

    users.set(appUser.id, appUser);

    logger.info(
      `[Auth] Mobile Google Sign-In: ${JSON.stringify(
        {
          id: appUser.id,
          email: appUser.email,
          name: appUser.name,
          avatar: appUser.avatar,
          hasIdToken: Boolean(idToken),
          ip: req.ip || req.socket.remoteAddress,
          timestamp: new Date().toISOString(),
        },
        null,
        2
      )}`
    );

    const token = jwt.sign(
      {
        id: appUser.id,
        email: appUser.email,
        name: appUser.name,
      },
      ENV.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          user: appUser,
          token,
        },
        'Mobile Google login logged and authenticated successfully'
      )
    );
  }),

  // 2. Web Google Direct Auth / Sync endpoint
  webGoogleLogin: asyncHandler(async (req: Request, res: Response) => {
    const { user, idToken, credential } = req.body;

    const email = user?.email || '';
    const name = user?.name || email.split('@')[0] || 'Web User';
    const avatar = user?.avatar || user?.picture || user?.photo || '';
    const id = user?.id || `usr_web_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const googleId = user?.googleId || user?.id || '';

    const appUser: User = {
      id,
      googleId,
      email,
      name,
      firstName: user?.given_name || user?.firstName,
      lastName: user?.family_name || user?.lastName,
      avatar,
      provider: 'google',
      createdAt: user?.createdAt || new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    };

    users.set(appUser.id, appUser);

    logger.info(
      `[Auth] Web Google Sign-In: ${JSON.stringify(
        {
          id: appUser.id,
          googleId: appUser.googleId,
          email: appUser.email,
          name: appUser.name,
          avatar: appUser.avatar,
          hasIdToken: Boolean(idToken || credential),
          ip: req.ip || req.socket.remoteAddress,
          userAgent: req.headers['user-agent'],
          timestamp: new Date().toISOString(),
        },
        null,
        2
      )}`
    );

    const token = jwt.sign(
      {
        id: appUser.id,
        email: appUser.email,
        name: appUser.name,
      },
      ENV.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          user: appUser,
          token,
        },
        'Web Google login logged and authenticated successfully'
      )
    );
  }),

  // 3. Initiate Google OAuth (Web/Browser)
  googleLogin: (req: Request, res: Response, next: NextFunction) => {
    if (!ENV.GOOGLE.CLIENT_ID || !ENV.GOOGLE.CLIENT_SECRET) {
      return next(
        new ApiError(500, 'Google OAuth credentials not configured in server environment (.env).')
      );
    }
    const state = typeof req.query.state === 'string' ? req.query.state : undefined;
    passport.authenticate('google', {
      scope: ['profile', 'email'],
      prompt: 'select_account',
      ...(state ? { state } : {}),
    })(req, res, next);
  },

  // 4. Google OAuth Callback (Web/Browser)
  googleCallback: (req: Request, res: Response, next: NextFunction) => {
    passport.authenticate('google', (err: Error | null, user: User | false) => {
      if (err) {
        logger.error(`[Auth] Google OAuth callback error: ${err.message}`);
        return next(err);
      }
      if (!user) {
        logger.warn('[Auth] Google OAuth failed: No user returned');
        return res.redirect(`${ENV.CLIENT_URL}/login?error=auth_failed`);
      }

      req.logIn(user, (loginErr) => {
        if (loginErr) {
          logger.error(`[Auth] Session login error: ${loginErr.message}`);
          return next(loginErr);
        }

        logger.info(
          `[Auth] Web Google OAuth Sign-In: ${JSON.stringify(
            {
              id: user.id,
              googleId: user.googleId,
              email: user.email,
              name: user.name,
              avatar: user.avatar,
              provider: user.provider,
              ip: req.ip || req.socket.remoteAddress,
              userAgent: req.headers['user-agent'],
              timestamp: new Date().toISOString(),
            },
            null,
            2
          )}`
        );

        // Generate JWT token for cross-platform / web clients
        const token = jwt.sign(
          {
            id: user.id,
            email: user.email,
            name: user.name,
          },
          ENV.JWT_SECRET,
          { expiresIn: '7d' }
        );

        // Check if request expects JSON (e.g. mobile app with headers or query param)
        const format =
          req.query.format ||
          (req.headers.accept?.includes('application/json') ? 'json' : 'redirect');

        if (format === 'json') {
          return res.status(200).json(
            new ApiResponse(
              200,
              {
                user,
                token,
              },
              'Successfully authenticated with Google'
            )
          );
        }

        // Redirect to Web/Client app with auth token (redirect to /home for web, /login for desktop source)
        const state = typeof req.query.state === 'string' ? req.query.state : '';
        const redirectUrl = new URL(ENV.CLIENT_URL);
        redirectUrl.pathname = state === 'desktop' ? '/login' : '/home';
        redirectUrl.searchParams.set('token', token);
        redirectUrl.searchParams.set('userId', user.id);
        redirectUrl.searchParams.set('auth', 'success');
        if (state === 'desktop') {
          redirectUrl.searchParams.set('source', 'desktop');
        }
        return res.redirect(redirectUrl.toString());
      });
    })(req, res, next);
  },

  // 5. Get Current User Profile
  getMe: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw new ApiError(401, 'Unauthorized: No active session');
    }

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          authenticated: true,
          user: req.user,
        },
        'Current user retrieved successfully'
      )
    );
  }),

  // 6. Logout User
  logout: (req: Request, res: Response, next: NextFunction) => {
    const userIdentifier =
      req.user || req.body?.user || req.body?.email || req.body?.userId || 'Web/Mobile Client';

    logger.info(
      `[Auth] Account Logged Out: ${JSON.stringify(
        {
          user: userIdentifier,
          ip: req.ip || req.socket.remoteAddress,
          userAgent: req.headers['user-agent'],
          timestamp: new Date().toISOString(),
        },
        null,
        2
      )}`
    );

    req.logout((err) => {
      if (err) {
        return next(err);
      }
      req.session?.destroy((sessionErr) => {
        if (sessionErr) {
          return next(sessionErr);
        }
        res.clearCookie('connect.sid');
        return res.status(200).json(new ApiResponse(200, null, 'Successfully logged out'));
      });
    });
  },

  // 7. Auth Service Status
  getStatus: asyncHandler(async (_req: Request, res: Response) => {
    return res.status(200).json(
      new ApiResponse(
        200,
        {
          provider: 'google',
          configured: Boolean(ENV.GOOGLE.CLIENT_ID && ENV.GOOGLE.CLIENT_SECRET),
          callbackUrl: ENV.GOOGLE.CALLBACK_URL,
          clientUrl: ENV.CLIENT_URL,
          status: 'ready',
        },
        'Auth service status retrieved'
      )
    );
  }),
};

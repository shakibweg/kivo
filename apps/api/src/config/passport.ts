import passport from 'passport';
import { Strategy as GoogleStrategy, Profile, VerifyCallback } from 'passport-google-oauth20';
import { ENV } from './env';
import { User } from '../types/user';

// In-memory user store (ready to connect with database e.g., Prisma, Drizzle, MongoDB)
const users = new Map<string, User>();

export function configurePassport(): void {
  // Serialize user ID into session
  passport.serializeUser((user: Express.User, done) => {
    done(null, (user as User).id);
  });

  // Deserialize user from session
  passport.deserializeUser((id: string, done) => {
    const user = users.get(id);
    if (user) {
      done(null, user);
    } else {
      done(null, null);
    }
  });

  // Only register GoogleStrategy if client ID and secret are configured
  if (ENV.GOOGLE.CLIENT_ID && ENV.GOOGLE.CLIENT_SECRET) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: ENV.GOOGLE.CLIENT_ID,
          clientSecret: ENV.GOOGLE.CLIENT_SECRET,
          callbackURL: ENV.GOOGLE.CALLBACK_URL,
          scope: ['profile', 'email'],
        },
        async (
          accessToken: string,
          refreshToken: string,
          profile: Profile,
          done: VerifyCallback
        ) => {
          try {
            const email = profile.emails?.[0]?.value || '';
            const avatar = profile.photos?.[0]?.value || '';
            const googleId = profile.id;

            // Check if user exists by googleId or email
            let user = Array.from(users.values()).find(
              (u) => u.googleId === googleId || (email && u.email === email)
            );

            const now = new Date().toISOString();

            if (user) {
              // Update existing user
              user.lastLoginAt = now;
              user.name = profile.displayName || user.name;
              user.avatar = avatar || user.avatar;
              users.set(user.id, user);
            } else {
              // Create new user
              user = {
                id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
                googleId,
                email,
                name: profile.displayName || email.split('@')[0] || 'User',
                firstName: profile.name?.givenName,
                lastName: profile.name?.familyName,
                avatar,
                provider: 'google',
                createdAt: now,
                lastLoginAt: now,
              };
              users.set(user.id, user);
            }

            return done(null, user);
          } catch (error) {
            return done(error as Error, undefined);
          }
        }
      )
    );
    console.log('✅ Google OAuth Strategy registered successfully.');
  } else {
    console.warn(
      '⚠️ Google OAuth credentials missing in .env (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET). Google login will require setting these variables.'
    );
  }
}

export { users };

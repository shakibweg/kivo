export interface AppUser {
  id: string;
  googleId?: string;
  email: string;
  name: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
  provider: 'google';
  createdAt: string;
  lastLoginAt: string;
}

export type User = AppUser;

declare global {
  namespace Express {
    // eslint-disable-next-line @typescript-eslint/no-empty-interface
    interface User extends AppUser {}
  }
}

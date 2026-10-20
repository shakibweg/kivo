import dotenv from 'dotenv';
import path from 'path';

// Load .env from workspace root or current directory
dotenv.config();

export const ENV = {
  PORT: parseInt(process.env.PORT || '5000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:3000',
  SESSION_SECRET: process.env.SESSION_SECRET || 'kivo-dev-session-secret-change-in-production',
  JWT_SECRET: process.env.JWT_SECRET || 'kivo-dev-jwt-secret-change-in-production',
  GOOGLE: {
    CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
    CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || '',
    CALLBACK_URL:
      process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/api/auth/google/callback',
  },
  DATABASE: {
    URL: process.env.DATABASE_URL || '',
  },
  GEMINI: {
    API_KEY: process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY || '',
  },
  STORAGE: {
    ENDPOINT: process.env.AWS_ENDPOINT_URL_S3 || process.env.S3_ENDPOINT || '',
    ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID || '',
    SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY || '',
    REGION: process.env.AWS_REGION || 'ap-southeast-1',
    BUCKET: process.env.AWS_BUCKET_NAME || process.env.S3_BUCKET || 'kivo',
  },
  MEDIA: {
    UNSPLASH_ACCESS_KEY: process.env.UNSPLASH_ACCESS_KEY || '',
    GIPHY_API_KEY: process.env.GIPHY_API_KEY || '',
  },
};

export const {
  PORT,
  NODE_ENV,
  CLIENT_URL,
  SESSION_SECRET,
  JWT_SECRET,
  GOOGLE,
  DATABASE,
  GEMINI,
  STORAGE,
} = ENV;

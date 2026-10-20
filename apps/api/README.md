# Kivo API Service 🚀

The modular, high-performance backend API service powering the **Kivo** ecosystem. Built with Express 5, TypeScript, PostgreSQL connection pooling (`pg`), Google Gemini Generative AI (`@google/genai`), and S3-compatible Object Storage (Neon Storage).

---

## 🛠️ Tech Stack

- **Framework**: Express 5
- **Language**: TypeScript 7.x
- **Database**: PostgreSQL with connection pooling (`pg` node-postgres)
- **AI Engine**: Google GenAI SDK (`@google/genai`) with Gemini models (`gemini-3.8-flash`, `gemini-3.8-flash-lite`)
- **Object Storage**: AWS S3 SDK (`@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`)
- **Authentication**: Passport.js Google OAuth 2.0 & JWT Sessions
- **Logging**: Winston & Morgan

---

## 📡 API Endpoints

### 🩺 Health & Status

- `GET /api/health` - Comprehensive service, PostgreSQL database, and S3 storage connectivity check.

### 🤖 Gemini AI

- `GET /api/ai/status` - Returns AI model configurations and availability status.
- `POST /api/ai/generate` (or `/api/ai/text`) - Generates text response using Gemini models.
- `POST /api/ai/stream` - Streams real-time response chunks via Server-Sent Events (SSE).

### 📦 S3 Object Storage

- `GET /api/storage/status` - Returns storage bucket status and latency.
- `POST /api/storage/presigned-url` - Generates a signed view/download URL.
- `POST /api/storage/upload-url` - Generates a signed direct upload (PUT) URL.
- `POST /api/storage/upload` - Direct server-side file upload.
- `DELETE /api/storage/file` - Deletes an object from the storage bucket.

### 🔐 Authentication

- `GET /api/auth/google` - Initiate Google OAuth 2.0 login.
- `GET /api/auth/google/callback` - Google OAuth 2.0 callback URL.
- `GET /api/auth/status` - Check current session/authentication status.
- `GET /api/auth/me` - Get current authenticated user profile.
- `POST /api/auth/logout` - Logout and terminate session.

---

## ⚙️ Environment Variables

Create a `.env` file in `apps/api/`:

```env
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:3000

# Session & JWT
SESSION_SECRET=your-session-secret
JWT_SECRET=your-jwt-secret

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback

# Database (Neon PostgreSQL)
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require

# Google Gemini AI
GEMINI_API_KEY=your-gemini-api-key

# S3-Compatible Object Storage
AWS_ENDPOINT_URL_S3=https://your-storage-endpoint.storage.neon.tech
AWS_ACCESS_KEY_ID=your-access-key-id
AWS_SECRET_ACCESS_KEY=your-secret-access-key
AWS_REGION=ap-southeast-1
AWS_BUCKET_NAME=kivo
```

---

## 💻 Development

```bash
# Start development server with live reload
pnpm --filter api dev

# Build production bundle
pnpm --filter api build

# Typecheck
pnpm --filter api check-types
```

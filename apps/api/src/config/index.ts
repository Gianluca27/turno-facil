import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const config = {
  // Application
  app: {
    name: 'TurnoFácil API',
    env: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3000', 10),
    apiVersion: 'v1',
    apiPrefix: '/api/v1',
    corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
  },

  // Database
  database: {
    mongodb: {
      uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/turnofacil',
      options: {
        maxPoolSize: 10,
        minPoolSize: 5,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      },
    },
    redis: {
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0', 10),
    },
  },

  // JWT
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'your-super-secret-access-key',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'your-super-secret-refresh-key',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
    issuer: 'turnofacil',
    audience: 'turnofacil-app',
  },

  // Security
  security: {
    bcryptRounds: 12,
    rateLimitWindowMs: 15 * 60 * 1000, // 15 minutes
    rateLimitMaxRequests: 100,
    authRateLimitMaxRequests: 5,
  },

  // External Services - Firebase
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  },

  // External Services - Twilio
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    verifyServiceSid: process.env.TWILIO_VERIFY_SERVICE_SID,
    fromNumber: process.env.TWILIO_FROM_NUMBER,
  },

  // External Services - SendGrid
  sendgrid: {
    apiKey: process.env.SENDGRID_API_KEY,
    fromEmail: process.env.SENDGRID_FROM_EMAIL || 'noreply@turnofacil.com',
    fromName: process.env.SENDGRID_FROM_NAME || 'TurnoFácil',
    templates: {
      welcome: process.env.SENDGRID_TEMPLATE_WELCOME,
      bookingConfirmed: process.env.SENDGRID_TEMPLATE_BOOKING_CONFIRMED,
      bookingCancelled: process.env.SENDGRID_TEMPLATE_BOOKING_CANCELLED,
      reminder: process.env.SENDGRID_TEMPLATE_REMINDER,
      passwordReset: process.env.SENDGRID_TEMPLATE_PASSWORD_RESET,
      reviewRequest: process.env.SENDGRID_TEMPLATE_REVIEW_REQUEST,
    },
  },

  // External Services - Mercado Pago
  mercadoPago: {
    accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN,
    publicKey: process.env.MERCADOPAGO_PUBLIC_KEY,
    webhookSecret: process.env.MERCADOPAGO_WEBHOOK_SECRET,
    notificationUrl: process.env.MERCADOPAGO_NOTIFICATION_URL,
  },

  // External Services - AWS S3
  aws: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION || 'us-east-1',
    s3: {
      bucketAvatars: process.env.AWS_S3_BUCKET_AVATARS || 'turnofacil-avatars',
      bucketBusinessMedia: process.env.AWS_S3_BUCKET_BUSINESS_MEDIA || 'turnofacil-business-media',
      bucketReviews: process.env.AWS_S3_BUCKET_REVIEWS || 'turnofacil-reviews',
      bucketReceipts: process.env.AWS_S3_BUCKET_RECEIPTS || 'turnofacil-receipts',
    },
    cloudfront: {
      domain: process.env.AWS_CLOUDFRONT_DOMAIN,
    },
  },

  // External Services - Google
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    mapsApiKey: process.env.GOOGLE_MAPS_API_KEY,
  },

  // External Services - Facebook
  facebook: {
    appId: process.env.FACEBOOK_APP_ID,
    appSecret: process.env.FACEBOOK_APP_SECRET,
  },

  // External Services - Apple
  apple: {
    clientId: process.env.APPLE_CLIENT_ID,
    teamId: process.env.APPLE_TEAM_ID,
    keyId: process.env.APPLE_KEY_ID,
    privateKey: process.env.APPLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },

  // Queues
  queues: {
    notifications: 'notifications',
    emails: 'emails',
    sms: 'sms',
    analytics: 'analytics',
    webhooks: 'webhooks',
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'json',
  },

  // Pagination
  pagination: {
    defaultLimit: 20,
    maxLimit: 100,
  },

  // Upload limits
  upload: {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedImageTypes: ['image/jpeg', 'image/png', 'image/webp'],
    avatarMaxSize: 5 * 1024 * 1024, // 5MB
    galleryMaxSize: 10 * 1024 * 1024, // 10MB
  },
} as const;

// Validate required configuration in production
if (config.app.env === 'production') {
  const requiredEnvVars = [
    'JWT_ACCESS_SECRET',
    'JWT_REFRESH_SECRET',
    'MONGODB_URI',
    'REDIS_URL',
  ];

  const missingVars = requiredEnvVars.filter((varName) => !process.env[varName]);

  if (missingVars.length > 0) {
    throw new Error(
      `Missing required environment variables in production: ${missingVars.join(', ')}`
    );
  }
}

export default config;
export type Config = typeof config;

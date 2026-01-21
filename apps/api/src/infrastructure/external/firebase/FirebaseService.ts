import * as admin from 'firebase-admin';
import config from '../../../config/index.js';
import { logger } from '../../../utils/logger.js';

export interface PushNotificationParams {
  token: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
  badge?: number;
}

export interface MulticastParams {
  tokens: string[];
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
}

export interface TopicNotificationParams {
  topic: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
}

export interface PushResult {
  success: boolean;
  messageId?: string;
  error?: string;
  failedTokens?: string[];
}

class FirebaseService {
  private initialized: boolean = false;
  private app: admin.app.App | null = null;

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    const { projectId, privateKey, clientEmail } = config.firebase;

    if (projectId && privateKey && clientEmail) {
      try {
        if (admin.apps.length === 0) {
          this.app = admin.initializeApp({
            credential: admin.credential.cert({
              projectId,
              privateKey,
              clientEmail,
            }),
          });
        } else {
          this.app = admin.apps[0]!;
        }
        this.initialized = true;
        logger.info('Firebase service initialized successfully');
      } catch (error) {
        logger.error('Failed to initialize Firebase', { error });
      }
    } else {
      logger.warn('Firebase credentials not configured. Push notifications will be unavailable.');
    }
  }

  isConfigured(): boolean {
    return this.initialized && this.app !== null;
  }

  async sendPushNotification(params: PushNotificationParams): Promise<PushResult> {
    if (!this.isConfigured()) {
      logger.warn('Firebase not configured. Push notification not sent.');
      return { success: false, error: 'Push notification service not configured' };
    }

    try {
      const message: admin.messaging.Message = {
        token: params.token,
        notification: {
          title: params.title,
          body: params.body,
          imageUrl: params.imageUrl,
        },
        data: params.data,
        android: {
          priority: 'high',
          notification: {
            channelId: 'turnofacil_default',
            sound: 'default',
            priority: 'high',
            defaultVibrateTimings: true,
            clickAction: 'FLUTTER_NOTIFICATION_CLICK',
          },
        },
        apns: {
          headers: {
            'apns-priority': '10',
            'apns-push-type': 'alert',
          },
          payload: {
            aps: {
              sound: 'default',
              badge: params.badge || 1,
              contentAvailable: true,
            },
          },
        },
      };

      const messageId = await admin.messaging().send(message);

      logger.info('Push notification sent successfully', {
        messageId,
        token: params.token.substring(0, 20) + '...',
      });

      return { success: true, messageId };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorCode = (error as { code?: string })?.code;

      logger.error('Failed to send push notification', {
        error: errorMessage,
        code: errorCode,
      });

      if (errorCode === 'messaging/invalid-registration-token' ||
          errorCode === 'messaging/registration-token-not-registered') {
        return { success: false, error: 'Invalid or expired token', failedTokens: [params.token] };
      }

      return { success: false, error: errorMessage };
    }
  }

  async sendMulticast(params: MulticastParams): Promise<PushResult> {
    if (!this.isConfigured()) {
      logger.warn('Firebase not configured. Multicast notification not sent.');
      return { success: false, error: 'Push notification service not configured' };
    }

    if (params.tokens.length === 0) {
      return { success: true, messageId: 'no-tokens' };
    }

    if (params.tokens.length > 500) {
      const results = await this.sendMulticastBatched(params);
      return results;
    }

    try {
      const message: admin.messaging.MulticastMessage = {
        tokens: params.tokens,
        notification: {
          title: params.title,
          body: params.body,
          imageUrl: params.imageUrl,
        },
        data: params.data,
        android: {
          priority: 'high',
          notification: {
            channelId: 'turnofacil_default',
            sound: 'default',
            priority: 'high',
          },
        },
        apns: {
          headers: {
            'apns-priority': '10',
          },
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
            },
          },
        },
      };

      const response = await admin.messaging().sendEachForMulticast(message);

      const failedTokens: string[] = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          failedTokens.push(params.tokens[idx]);
          logger.warn('Failed to send to token', {
            token: params.tokens[idx].substring(0, 20) + '...',
            error: resp.error?.message,
          });
        }
      });

      logger.info('Multicast notification completed', {
        successCount: response.successCount,
        failureCount: response.failureCount,
        totalTokens: params.tokens.length,
      });

      return {
        success: response.successCount > 0,
        messageId: `multicast-${response.successCount}/${params.tokens.length}`,
        failedTokens: failedTokens.length > 0 ? failedTokens : undefined,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to send multicast notification', { error: errorMessage });
      return { success: false, error: errorMessage };
    }
  }

  private async sendMulticastBatched(params: MulticastParams): Promise<PushResult> {
    const batchSize = 500;
    const batches: string[][] = [];

    for (let i = 0; i < params.tokens.length; i += batchSize) {
      batches.push(params.tokens.slice(i, i + batchSize));
    }

    const results = await Promise.all(
      batches.map(tokens =>
        this.sendMulticast({ ...params, tokens })
      )
    );

    const failedTokens: string[] = [];
    let successCount = 0;

    results.forEach(result => {
      if (result.success) successCount++;
      if (result.failedTokens) {
        failedTokens.push(...result.failedTokens);
      }
    });

    return {
      success: successCount > 0,
      messageId: `batched-${successCount}/${batches.length}`,
      failedTokens: failedTokens.length > 0 ? failedTokens : undefined,
    };
  }

  async sendToTopic(params: TopicNotificationParams): Promise<PushResult> {
    if (!this.isConfigured()) {
      return { success: false, error: 'Push notification service not configured' };
    }

    try {
      const message: admin.messaging.Message = {
        topic: params.topic,
        notification: {
          title: params.title,
          body: params.body,
          imageUrl: params.imageUrl,
        },
        data: params.data,
        android: {
          priority: 'high',
          notification: {
            channelId: 'turnofacil_default',
            sound: 'default',
          },
        },
        apns: {
          headers: {
            'apns-priority': '10',
          },
          payload: {
            aps: {
              sound: 'default',
            },
          },
        },
      };

      const messageId = await admin.messaging().send(message);

      logger.info('Topic notification sent', { topic: params.topic, messageId });

      return { success: true, messageId };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to send topic notification', { error: errorMessage, topic: params.topic });
      return { success: false, error: errorMessage };
    }
  }

  async subscribeToTopic(tokens: string[], topic: string): Promise<PushResult> {
    if (!this.isConfigured()) {
      return { success: false, error: 'Push notification service not configured' };
    }

    try {
      const response = await admin.messaging().subscribeToTopic(tokens, topic);

      logger.info('Subscribed to topic', {
        topic,
        successCount: response.successCount,
        failureCount: response.failureCount,
      });

      const failedTokens: string[] = [];
      response.errors.forEach(error => {
        failedTokens.push(tokens[error.index]);
      });

      return {
        success: response.successCount > 0,
        failedTokens: failedTokens.length > 0 ? failedTokens : undefined,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to subscribe to topic', { error: errorMessage, topic });
      return { success: false, error: errorMessage };
    }
  }

  async unsubscribeFromTopic(tokens: string[], topic: string): Promise<PushResult> {
    if (!this.isConfigured()) {
      return { success: false, error: 'Push notification service not configured' };
    }

    try {
      const response = await admin.messaging().unsubscribeFromTopic(tokens, topic);

      logger.info('Unsubscribed from topic', {
        topic,
        successCount: response.successCount,
        failureCount: response.failureCount,
      });

      return { success: response.successCount > 0 };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to unsubscribe from topic', { error: errorMessage, topic });
      return { success: false, error: errorMessage };
    }
  }

  async verifyGoogleToken(idToken: string): Promise<admin.auth.DecodedIdToken | null> {
    if (!this.isConfigured()) {
      logger.warn('Firebase not configured. Token verification unavailable.');
      return null;
    }

    try {
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      return decodedToken;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to verify Google token', { error: errorMessage });
      return null;
    }
  }
}

export const firebaseService = new FirebaseService();

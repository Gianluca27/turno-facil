import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import config from '../../config/index.js';
import { logger } from '../../utils/logger.js';

let io: Server;

// Socket with user data
interface AuthenticatedSocket extends Socket {
  userId?: string;
  userType?: 'user' | 'business_user';
  businessIds?: string[];
}

export const setupWebSocket = (httpServer: HttpServer): Server => {
  io = new Server(httpServer, {
    cors: {
      origin: config.app.corsOrigins,
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // Authentication middleware
  io.use((socket: AuthenticatedSocket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];

    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const payload = jwt.verify(token, config.jwt.accessSecret) as {
        sub: string;
        type: 'user' | 'business_user';
      };

      socket.userId = payload.sub;
      socket.userType = payload.type;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  // Client namespace (app cliente)
  const clientNamespace = io.of('/client');

  clientNamespace.on('connection', (socket: AuthenticatedSocket) => {
    logger.info('Client connected', { userId: socket.userId });

    // Join user's personal room
    socket.join(`user:${socket.userId}`);

    socket.on('disconnect', () => {
      logger.info('Client disconnected', { userId: socket.userId });
    });
  });

  // Business namespace (app negocio)
  const businessNamespace = io.of('/business');

  businessNamespace.on('connection', async (socket: AuthenticatedSocket) => {
    logger.info('Business user connected', { userId: socket.userId });

    // Join user's personal room
    socket.join(`business_user:${socket.userId}`);

    // Join business rooms
    socket.on('subscribe:business', (businessId: string) => {
      socket.join(`business:${businessId}`);
      logger.debug('Subscribed to business', { userId: socket.userId, businessId });
    });

    socket.on('unsubscribe:business', (businessId: string) => {
      socket.leave(`business:${businessId}`);
      logger.debug('Unsubscribed from business', { userId: socket.userId, businessId });
    });

    socket.on('disconnect', () => {
      logger.info('Business user disconnected', { userId: socket.userId });
    });
  });

  logger.info('WebSocket server initialized');

  return io;
};

export const getIO = (): Server => {
  if (!io) {
    throw new Error('Socket.io not initialized');
  }
  return io;
};

// Emit events to specific targets
export const emitToUser = (userId: string, event: string, data: any): void => {
  io?.of('/client').to(`user:${userId}`).emit(event, data);
};

export const emitToBusinessUser = (userId: string, event: string, data: any): void => {
  io?.of('/business').to(`business_user:${userId}`).emit(event, data);
};

export const emitToBusiness = (businessId: string, event: string, data: any): void => {
  io?.of('/business').to(`business:${businessId}`).emit(event, data);
};

// Event types
export const WS_EVENTS = {
  // Client app events
  APPOINTMENT_CONFIRMED: 'appointment:confirmed',
  APPOINTMENT_CANCELLED: 'appointment:cancelled',
  APPOINTMENT_RESCHEDULED: 'appointment:rescheduled',
  APPOINTMENT_REMINDER: 'appointment:reminder',
  WAITLIST_AVAILABLE: 'waitlist:available',
  NOTIFICATION_NEW: 'notification:new',

  // Business app events
  APPOINTMENT_NEW: 'appointment:new',
  APPOINTMENT_CANCELLED_BY_CLIENT: 'appointment:cancelled_by_client',
  APPOINTMENT_UPDATED: 'appointment:updated',
  CLIENT_CHECKIN: 'client:checkin',
  CALENDAR_REFRESH: 'calendar:refresh',
  NEW_REVIEW: 'review:new',
} as const;

// Helper functions for common events
export const notifyAppointmentConfirmed = (userId: string, appointment: any): void => {
  emitToUser(userId, WS_EVENTS.APPOINTMENT_CONFIRMED, appointment);
};

export const notifyNewAppointment = (businessId: string, appointment: any): void => {
  emitToBusiness(businessId, WS_EVENTS.APPOINTMENT_NEW, appointment);
};

export const notifyAppointmentCancelledByClient = (businessId: string, appointment: any): void => {
  emitToBusiness(businessId, WS_EVENTS.APPOINTMENT_CANCELLED_BY_CLIENT, appointment);
};

export const notifyCalendarRefresh = (businessId: string): void => {
  emitToBusiness(businessId, WS_EVENTS.CALENDAR_REFRESH, { timestamp: new Date() });
};

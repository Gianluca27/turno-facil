import { io, Socket } from 'socket.io-client';
import { authStorage as storage } from '../shared/utils/storage';

// Configuration
// Use your local IP for development (run ipconfig to find it)
const DEV_API_HOST = '192.168.100.2';
const WS_URL = __DEV__ ? `http://${DEV_API_HOST}:3000/business` : 'https://api.turnofacil.com/business';

// Socket instance
let socket: Socket | null = null;

// Event handlers registry
const eventHandlers: Map<string, Set<(data: any) => void>> = new Map();

export const initializeServices = () => {
  console.log('Initializing services...');
};

// WebSocket connection
export const connectWebSocket = (): Socket | null => {
  const tokensStr = storage.getString('tokens');
  if (!tokensStr) {
    console.log('No tokens available, skipping WebSocket connection');
    return null;
  }

  const tokens = JSON.parse(tokensStr);

  if (socket?.connected) {
    return socket;
  }

  socket = io(WS_URL, {
    transports: ['websocket'],
    auth: {
      token: tokens.accessToken,
    },
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  socket.on('connect', () => {
    console.log('WebSocket connected');

    // Subscribe to current business
    const currentBusinessStr = storage.getString('currentBusiness');
    if (currentBusinessStr) {
      const currentBusiness = JSON.parse(currentBusinessStr);
      socket?.emit('subscribe:business', currentBusiness.businessId);
    }
  });

  socket.on('disconnect', (reason) => {
    console.log('WebSocket disconnected:', reason);
  });

  socket.on('connect_error', (error) => {
    console.error('WebSocket connection error:', error);
  });

  // Forward events to registered handlers
  const events = [
    'appointment:new',
    'appointment:cancelled_by_client',
    'appointment:updated',
    'client:checkin',
    'calendar:refresh',
    'review:new',
    'notification:new',
  ];

  events.forEach((event) => {
    socket?.on(event, (data) => {
      const handlers = eventHandlers.get(event);
      handlers?.forEach((handler) => handler(data));
    });
  });

  return socket;
};

export const disconnectWebSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export const getSocket = (): Socket | null => socket;

// Subscribe to WebSocket events
export const subscribeToEvent = (event: string, handler: (data: any) => void) => {
  if (!eventHandlers.has(event)) {
    eventHandlers.set(event, new Set());
  }
  eventHandlers.get(event)?.add(handler);

  // Return unsubscribe function
  return () => {
    eventHandlers.get(event)?.delete(handler);
  };
};

// Subscribe to business updates
export const subscribeToBusiness = (businessId: string) => {
  socket?.emit('subscribe:business', businessId);
};

export const unsubscribeFromBusiness = (businessId: string) => {
  socket?.emit('unsubscribe:business', businessId);
};

// Notifications
export const initializePushNotifications = async () => {
  // TODO: Initialize Firebase Cloud Messaging
  // This would typically involve:
  // 1. Requesting permissions
  // 2. Getting the FCM token
  // 3. Registering the token with the backend
  // 4. Setting up notification handlers
  console.log('Push notifications initialization placeholder');
};

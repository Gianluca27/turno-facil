// MongoDB initialization script
// This runs when the container is first created

db = db.getSiblingDB('turnofacil');

// Create collections with validation schemas
db.createCollection('users', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['email', 'status', 'createdAt'],
      properties: {
        email: {
          bsonType: 'string',
          description: 'User email address',
        },
        status: {
          enum: ['active', 'suspended', 'deleted'],
          description: 'User account status',
        },
      },
    },
  },
});

db.createCollection('business_users', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['email', 'status', 'createdAt'],
      properties: {
        email: {
          bsonType: 'string',
        },
        status: {
          enum: ['active', 'suspended', 'deleted'],
        },
      },
    },
  },
});

db.createCollection('businesses', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['name', 'slug', 'status', 'ownerId', 'createdAt'],
      properties: {
        name: {
          bsonType: 'string',
        },
        slug: {
          bsonType: 'string',
        },
        status: {
          enum: ['pending', 'active', 'suspended', 'deleted'],
        },
      },
    },
  },
});

db.createCollection('staff');
db.createCollection('services');
db.createCollection('appointments');
db.createCollection('reviews');
db.createCollection('transactions');
db.createCollection('notifications');
db.createCollection('waitlist');
db.createCollection('promotions');
db.createCollection('campaigns');
db.createCollection('client_business_relations');

// Create indexes
// Users indexes
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ phone: 1 }, { unique: true, sparse: true });
db.users.createIndex(
  { 'authProviders.provider': 1, 'authProviders.providerId': 1 },
  { sparse: true }
);
db.users.createIndex({ status: 1 });
db.users.createIndex({ createdAt: -1 });

// Business users indexes
db.business_users.createIndex({ email: 1 }, { unique: true });
db.business_users.createIndex({ 'businesses.businessId': 1 });
db.business_users.createIndex({ status: 1 });

// Businesses indexes
db.businesses.createIndex({ slug: 1 }, { unique: true });
db.businesses.createIndex({ 'location.coordinates': '2dsphere' });
db.businesses.createIndex({ type: 1, status: 1 });
db.businesses.createIndex({ ownerId: 1 });
db.businesses.createIndex({ 'stats.averageRating': -1 });
db.businesses.createIndex({ status: 1, 'subscription.status': 1 });

// Staff indexes
db.staff.createIndex({ businessId: 1, status: 1 });
db.staff.createIndex({ businessId: 1, services: 1 });
db.staff.createIndex({ userId: 1 }, { sparse: true });

// Services indexes
db.services.createIndex({ businessId: 1, status: 1 });
db.services.createIndex({ businessId: 1, categoryId: 1 });
db.services.createIndex({ 'discount.isActive': 1 });

// Appointments indexes
db.appointments.createIndex({ businessId: 1, date: 1, status: 1 });
db.appointments.createIndex({ businessId: 1, staffId: 1, date: 1 });
db.appointments.createIndex({ clientId: 1, status: 1 });
db.appointments.createIndex({ startDateTime: 1 });
db.appointments.createIndex({ businessId: 1, startDateTime: 1, endDateTime: 1 });
db.appointments.createIndex({ status: 1, date: 1 });
db.appointments.createIndex({ 'recurrence.parentId': 1 }, { sparse: true });

// Reviews indexes
db.reviews.createIndex({ businessId: 1, status: 1, createdAt: -1 });
db.reviews.createIndex({ businessId: 1, staffId: 1 });
db.reviews.createIndex({ clientId: 1 });
db.reviews.createIndex({ appointmentId: 1 }, { unique: true, sparse: true });
db.reviews.createIndex({ 'ratings.overall': -1 });

// Transactions indexes
db.transactions.createIndex({ businessId: 1, createdAt: -1 });
db.transactions.createIndex({ businessId: 1, type: 1, createdAt: -1 });
db.transactions.createIndex({ businessId: 1, staffId: 1, createdAt: -1 });
db.transactions.createIndex({ appointmentId: 1 }, { sparse: true });
db.transactions.createIndex({ 'externalPayment.transactionId': 1 }, { sparse: true });

// Notifications indexes
db.notifications.createIndex({ recipientType: 1, recipientId: 1, read: 1, createdAt: -1 });
db.notifications.createIndex({ scheduledFor: 1, 'channels.push.sent': 1 });
db.notifications.createIndex({ businessId: 1, type: 1 });
db.notifications.createIndex({ createdAt: 1 }, { expireAfterSeconds: 7776000 }); // 90 days TTL

// Waitlist indexes
db.waitlist.createIndex({ businessId: 1, status: 1, priority: -1, createdAt: 1 });
db.waitlist.createIndex({ clientId: 1, status: 1 });
db.waitlist.createIndex({ expiresAt: 1 });

// Promotions indexes
db.promotions.createIndex({ businessId: 1, status: 1 });
db.promotions.createIndex({ code: 1, businessId: 1 }, { unique: true, sparse: true });
db.promotions.createIndex({ validFrom: 1, validUntil: 1 });

// Campaigns indexes
db.campaigns.createIndex({ businessId: 1, status: 1 });
db.campaigns.createIndex({ 'schedule.sendAt': 1, status: 1 });

// Client business relations indexes
db.client_business_relations.createIndex({ clientId: 1, businessId: 1 }, { unique: true });
db.client_business_relations.createIndex({ businessId: 1, 'stats.lastVisit': -1 });
db.client_business_relations.createIndex({ businessId: 1, 'loyalty.tier': 1 });
db.client_business_relations.createIndex({ businessId: 1, isBlocked: 1 });

print('TurnoFácil database initialized successfully!');

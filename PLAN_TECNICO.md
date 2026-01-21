# TurnoFácil - Plan Técnico de Desarrollo

## Índice
1. [Arquitectura del Sistema](#1-arquitectura-del-sistema)
2. [Estructura de Proyectos](#2-estructura-de-proyectos)
3. [Base de Datos - Esquemas MongoDB](#3-base-de-datos---esquemas-mongodb)
4. [API REST - Endpoints](#4-api-rest---endpoints)
5. [Autenticación y Seguridad](#5-autenticación-y-seguridad)
6. [Sistema de Notificaciones](#6-sistema-de-notificaciones)
7. [Integraciones Externas](#7-integraciones-externas)
8. [WebSockets - Tiempo Real](#8-websockets---tiempo-real)
9. [Testing](#9-testing)
10. [DevOps y Deployment](#10-devops-y-deployment)
11. [Plan de Desarrollo por Fases](#11-plan-de-desarrollo-por-fases)

---

## 1. Arquitectura del Sistema

### 1.1 Visión General

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENTES                                        │
├──────────────────────────────┬──────────────────────────────────────────────┤
│     App Negocio (React Native)│     App Cliente (React Native)              │
│     - iOS                     │     - iOS                                    │
│     - Android                 │     - Android                                │
└──────────────┬───────────────┴─────────────────────┬────────────────────────┘
               │                                      │
               │              HTTPS/WSS              │
               ▼                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           API GATEWAY / LOAD BALANCER                        │
│                              (Nginx / AWS ALB)                               │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           BACKEND (Node.js + Express)                        │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   Auth      │  │  Business   │  │  Booking    │  │  Payment    │        │
│  │   Service   │  │  Service    │  │  Service    │  │  Service    │        │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   User      │  │  Staff      │  │  Analytics  │  │  Notification│       │
│  │   Service   │  │  Service    │  │  Service    │  │  Service    │        │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘        │
└────────┬────────────────┬────────────────┬────────────────┬─────────────────┘
         │                │                │                │
         ▼                ▼                ▼                ▼
┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐
│  MongoDB    │  │   Redis     │  │ Bull Queue  │  │   Servicios Externos    │
│  (Primary)  │  │   (Cache)   │  │  (Jobs)     │  │  - Firebase (FCM)       │
│             │  │             │  │             │  │  - Mercado Pago         │
│  MongoDB    │  │             │  │             │  │  - Twilio (SMS)         │
│  (Replica)  │  │             │  │             │  │  - SendGrid (Email)     │
└─────────────┘  └─────────────┘  └─────────────┘  │  - AWS S3 (Storage)     │
                                                    │  - Google Maps API      │
                                                    └─────────────────────────┘
```

### 1.2 Stack Tecnológico Detallado

#### Frontend (React Native)
```
- React Native 0.73+
- TypeScript 5.x
- Estado Global: Zustand + React Query (TanStack Query)
- Navegación: React Navigation 6.x
- UI Components: React Native Paper + componentes custom
- Formularios: React Hook Form + Zod (validación)
- Mapas: react-native-maps
- Calendario: react-native-calendars
- Notificaciones: @react-native-firebase/messaging
- Storage local: MMKV (más rápido que AsyncStorage)
- Networking: Axios + React Query
- WebSocket: Socket.io-client
- Animaciones: React Native Reanimated 3
- Gestos: React Native Gesture Handler
```

#### Backend (Node.js)
```
- Node.js 20 LTS
- Express.js 4.x
- TypeScript 5.x
- MongoDB Driver: Mongoose 8.x
- Autenticación: Passport.js + JWT
- Validación: Zod
- WebSockets: Socket.io
- Cola de trabajos: BullMQ + Redis
- Caché: Redis (ioredis)
- Rate Limiting: express-rate-limit + redis-store
- Logging: Winston + Morgan
- Documentación API: Swagger/OpenAPI
- Testing: Jest + Supertest
- ORM/ODM: Mongoose con TypeScript
```

#### Infraestructura
```
- Cloud: AWS / DigitalOcean
- Contenedores: Docker + Docker Compose
- Orquestación (producción): Kubernetes o AWS ECS
- CI/CD: GitHub Actions
- Base de datos: MongoDB Atlas (replica set)
- Caché: Redis Cloud o ElastiCache
- Storage: AWS S3 + CloudFront CDN
- Monitoreo: Datadog o New Relic
- Logs: CloudWatch o Papertrail
- APM: Sentry para error tracking
```

### 1.3 Patrones de Arquitectura

#### Backend - Clean Architecture
```
src/
├── domain/           # Entidades y reglas de negocio puras
│   ├── entities/
│   ├── repositories/ # Interfaces
│   └── services/     # Lógica de negocio
├── application/      # Casos de uso
│   └── use-cases/
├── infrastructure/   # Implementaciones concretas
│   ├── database/
│   ├── external/     # APIs externas
│   └── repositories/ # Implementación de repos
└── presentation/     # Controllers, routes, middleware
    ├── controllers/
    ├── routes/
    └── middleware/
```

---

## 2. Estructura de Proyectos

### 2.1 Monorepo Structure

```
turnofacil/
├── apps/
│   ├── mobile-business/          # App React Native para negocios
│   │   ├── src/
│   │   │   ├── app/              # Navegación y setup
│   │   │   ├── features/         # Módulos por feature
│   │   │   │   ├── auth/
│   │   │   │   ├── dashboard/
│   │   │   │   ├── calendar/
│   │   │   │   ├── clients/
│   │   │   │   ├── services/
│   │   │   │   ├── staff/
│   │   │   │   ├── finances/
│   │   │   │   ├── marketing/
│   │   │   │   ├── analytics/
│   │   │   │   ├── settings/
│   │   │   │   ├── waitlist/
│   │   │   │   └── pos/          # Point of Sale
│   │   │   ├── shared/
│   │   │   │   ├── components/
│   │   │   │   ├── hooks/
│   │   │   │   ├── utils/
│   │   │   │   └── theme/
│   │   │   └── services/         # API, storage, etc.
│   │   ├── android/
│   │   ├── ios/
│   │   └── package.json
│   │
│   ├── mobile-client/            # App React Native para clientes
│   │   ├── src/
│   │   │   ├── app/
│   │   │   ├── features/
│   │   │   │   ├── auth/
│   │   │   │   ├── explore/
│   │   │   │   ├── business-profile/
│   │   │   │   ├── booking/
│   │   │   │   ├── appointments/
│   │   │   │   ├── favorites/
│   │   │   │   ├── profile/
│   │   │   │   ├── reviews/
│   │   │   │   ├── promotions/
│   │   │   │   ├── payments/
│   │   │   │   └── support/
│   │   │   ├── shared/
│   │   │   └── services/
│   │   ├── android/
│   │   ├── ios/
│   │   └── package.json
│   │
│   └── api/                      # Backend Node.js
│       ├── src/
│       │   ├── domain/
│       │   │   ├── entities/
│       │   │   ├── repositories/
│       │   │   └── services/
│       │   ├── application/
│       │   │   └── use-cases/
│       │   ├── infrastructure/
│       │   │   ├── database/
│       │   │   │   ├── mongodb/
│       │   │   │   │   ├── models/
│       │   │   │   │   └── repositories/
│       │   │   │   └── redis/
│       │   │   ├── external/
│       │   │   │   ├── firebase/
│       │   │   │   ├── mercadopago/
│       │   │   │   ├── twilio/
│       │   │   │   ├── sendgrid/
│       │   │   │   └── s3/
│       │   │   └── jobs/
│       │   ├── presentation/
│       │   │   ├── controllers/
│       │   │   ├── routes/
│       │   │   ├── middleware/
│       │   │   └── websocket/
│       │   ├── config/
│       │   └── utils/
│       ├── tests/
│       └── package.json
│
├── packages/                     # Código compartido
│   ├── shared-types/             # TypeScript types compartidos
│   ├── shared-utils/             # Utilidades comunes
│   └── shared-validators/        # Esquemas de validación Zod
│
├── docker/
│   ├── api.Dockerfile
│   └── docker-compose.yml
│
├── .github/
│   └── workflows/
│       ├── api-ci.yml
│       ├── mobile-business-ci.yml
│       └── mobile-client-ci.yml
│
├── package.json                  # Workspaces root
├── turbo.json                    # Turborepo config
└── README.md
```

---

## 3. Base de Datos - Esquemas MongoDB

### 3.1 Colección: Users (usuarios de app cliente)

```typescript
// users
{
  _id: ObjectId,
  email: string,                    // único, indexado
  phone: string,                    // único, indexado, formato E.164
  phoneVerified: boolean,
  password: string,                 // hash bcrypt

  profile: {
    firstName: string,
    lastName: string,
    avatar: string,                 // URL S3
    birthDate: Date,
    gender: 'male' | 'female' | 'other' | 'prefer_not_say'
  },

  authProviders: [{
    provider: 'google' | 'facebook' | 'apple',
    providerId: string,
    email: string
  }],

  preferences: {
    language: string,               // default: 'es'
    timezone: string,               // default: 'America/Argentina/Buenos_Aires'
    theme: 'light' | 'dark' | 'system',
    notifications: {
      push: boolean,
      email: boolean,
      sms: boolean,
      marketing: boolean
    }
  },

  paymentMethods: [{
    _id: ObjectId,
    type: 'card' | 'mercadopago',
    last4: string,
    brand: string,
    externalId: string,             // ID en Mercado Pago
    isDefault: boolean
  }],

  favorites: {
    businesses: [ObjectId],         // ref: businesses
    professionals: [ObjectId]       // ref: staff
  },

  stats: {
    totalAppointments: number,
    totalSpent: number,
    cancelledAppointments: number,
    noShows: number
  },

  status: 'active' | 'suspended' | 'deleted',

  refreshTokens: [{
    token: string,
    device: string,
    createdAt: Date,
    expiresAt: Date
  }],

  createdAt: Date,
  updatedAt: Date,
  lastLoginAt: Date
}

// Índices
- { email: 1 } unique
- { phone: 1 } unique sparse
- { 'authProviders.provider': 1, 'authProviders.providerId': 1 }
- { status: 1 }
- { createdAt: -1 }
```

### 3.2 Colección: Businesses (negocios)

```typescript
// businesses
{
  _id: ObjectId,

  // Información básica
  name: string,
  slug: string,                     // URL-friendly, único
  type: string,                     // 'barberia', 'peluqueria', 'spa', etc.
  description: string,

  // Contacto
  contact: {
    email: string,
    phone: string,
    whatsapp: string,
    website: string,
    socialMedia: {
      instagram: string,
      facebook: string,
      tiktok: string
    }
  },

  // Ubicación
  location: {
    address: string,
    city: string,
    state: string,
    country: string,
    postalCode: string,
    coordinates: {
      type: 'Point',
      coordinates: [number, number]  // [lng, lat]
    },
    placeId: string                  // Google Place ID
  },

  // Media
  media: {
    logo: string,                    // URL S3
    cover: string,                   // URL S3
    gallery: [{
      _id: ObjectId,
      url: string,
      thumbnail: string,
      caption: string,
      order: number
    }]
  },

  // Horarios de operación
  schedule: {
    timezone: string,
    regular: [{
      dayOfWeek: 0-6,               // 0=domingo
      isOpen: boolean,
      slots: [{
        open: string,               // "09:00"
        close: string               // "18:00"
      }]
    }],
    exceptions: [{                  // Feriados, días especiales
      date: Date,
      isOpen: boolean,
      slots: [{
        open: string,
        close: string
      }],
      reason: string
    }]
  },

  // Configuración de reservas
  bookingConfig: {
    slotDuration: number,           // minutos, default 30
    bufferTime: number,             // minutos entre turnos
    maxSimultaneous: number,        // turnos simultáneos
    minAdvance: number,             // horas mínimas anticipación
    maxAdvance: number,             // días máximos anticipación
    allowInstantBooking: boolean,
    requireConfirmation: boolean,
    cancellationPolicy: {
      allowCancellation: boolean,
      hoursBeforeAppointment: number,
      penaltyType: 'none' | 'percentage' | 'fixed',
      penaltyAmount: number
    },
    requireDeposit: boolean,
    depositAmount: number,
    depositType: 'percentage' | 'fixed',
    maxBookingsPerClient: number,   // por día
    allowWaitlist: boolean
  },

  // Métodos de pago
  paymentConfig: {
    acceptedMethods: ['cash', 'card', 'mercadopago', 'transfer'],
    mercadoPagoAccountId: string,
    requirePaymentOnBooking: boolean
  },

  // Categorías de servicios
  serviceCategories: [{
    _id: ObjectId,
    name: string,
    description: string,
    order: number,
    isActive: boolean
  }],

  // Estadísticas (denormalizadas para performance)
  stats: {
    totalAppointments: number,
    completedAppointments: number,
    cancelledAppointments: number,
    noShows: number,
    totalRevenue: number,
    averageRating: number,
    totalReviews: number,
    totalClients: number
  },

  // Rating y reviews config
  reviewConfig: {
    allowReviews: boolean,
    requireVerifiedVisit: boolean,
    autoRequestAfterHours: number
  },

  // Suscripción
  subscription: {
    plan: 'free' | 'basic' | 'professional' | 'enterprise',
    status: 'active' | 'trial' | 'past_due' | 'cancelled',
    currentPeriodStart: Date,
    currentPeriodEnd: Date,
    mercadoPagoSubscriptionId: string
  },

  // Owner
  ownerId: ObjectId,                // ref: business_users

  status: 'pending' | 'active' | 'suspended' | 'deleted',

  createdAt: Date,
  updatedAt: Date
}

// Índices
- { slug: 1 } unique
- { 'location.coordinates': '2dsphere' }
- { type: 1, status: 1 }
- { ownerId: 1 }
- { 'stats.averageRating': -1 }
- { status: 1, 'subscription.status': 1 }
```

### 3.3 Colección: BusinessUsers (usuarios de app negocio)

```typescript
// business_users
{
  _id: ObjectId,
  email: string,
  phone: string,
  password: string,

  profile: {
    firstName: string,
    lastName: string,
    avatar: string
  },

  // Negocios asociados y roles
  businesses: [{
    businessId: ObjectId,           // ref: businesses
    role: 'owner' | 'admin' | 'manager' | 'employee' | 'reception',
    permissions: [string],          // permisos específicos
    joinedAt: Date
  }],

  preferences: {
    language: string,
    timezone: string,
    theme: 'light' | 'dark' | 'system',
    notifications: {
      push: boolean,
      email: boolean,
      sms: boolean,
      newBooking: boolean,
      cancellation: boolean,
      reminder: boolean
    }
  },

  refreshTokens: [{
    token: string,
    device: string,
    createdAt: Date,
    expiresAt: Date
  }],

  status: 'active' | 'suspended' | 'deleted',

  createdAt: Date,
  updatedAt: Date,
  lastLoginAt: Date
}

// Índices
- { email: 1 } unique
- { 'businesses.businessId': 1 }
- { status: 1 }
```

### 3.4 Colección: Staff (profesionales)

```typescript
// staff
{
  _id: ObjectId,
  businessId: ObjectId,             // ref: businesses
  userId: ObjectId,                 // ref: business_users (opcional)

  profile: {
    firstName: string,
    lastName: string,
    displayName: string,
    avatar: string,
    bio: string,
    specialties: [string]
  },

  contact: {
    email: string,
    phone: string
  },

  // Servicios que ofrece
  services: [ObjectId],             // ref: services

  // Horario individual
  schedule: {
    useBusinessSchedule: boolean,
    custom: [{
      dayOfWeek: 0-6,
      isAvailable: boolean,
      slots: [{
        start: string,
        end: string
      }]
    }]
  },

  // Excepciones (vacaciones, días libres)
  exceptions: [{
    _id: ObjectId,
    startDate: Date,
    endDate: Date,
    type: 'vacation' | 'sick' | 'personal' | 'other',
    reason: string,
    isRecurring: boolean,
    recurringPattern: {
      frequency: 'weekly' | 'monthly',
      daysOfWeek: [number]
    }
  }],

  // Configuración específica
  config: {
    bufferTime: number,             // override del negocio
    maxDailyAppointments: number,
    acceptsNewClients: boolean
  },

  // Stats
  stats: {
    totalAppointments: number,
    completedAppointments: number,
    cancelledAppointments: number,
    totalRevenue: number,
    averageRating: number,
    totalReviews: number
  },

  order: number,                    // para ordenar en la lista
  status: 'active' | 'inactive' | 'vacation' | 'deleted',

  createdAt: Date,
  updatedAt: Date
}

// Índices
- { businessId: 1, status: 1 }
- { businessId: 1, services: 1 }
- { userId: 1 }
```

### 3.5 Colección: Services (servicios)

```typescript
// services
{
  _id: ObjectId,
  businessId: ObjectId,             // ref: businesses
  categoryId: ObjectId,             // ref: embedded en business

  name: string,
  description: string,

  // Duración y precio
  duration: number,                 // minutos
  price: number,
  currency: string,                 // default: 'ARS'

  // Configuración
  config: {
    bufferAfter: number,            // minutos de buffer después
    maxPerDay: number,              // límite por día
    requiresDeposit: boolean,
    depositAmount: number,
    allowOnlineBooking: boolean
  },

  // Disponibilidad específica
  availability: {
    allDays: boolean,
    specificDays: [0-6],            // días disponible
    specificHours: [{
      start: string,
      end: string
    }]
  },

  // Media
  image: string,
  gallery: [string],

  // Para combos/paquetes
  isPackage: boolean,
  packageServices: [{
    serviceId: ObjectId,
    quantity: number
  }],

  // Descuentos
  discount: {
    isActive: boolean,
    type: 'percentage' | 'fixed',
    amount: number,
    validFrom: Date,
    validUntil: Date
  },

  // Stats
  stats: {
    totalBookings: number,
    totalRevenue: number
  },

  order: number,
  status: 'active' | 'inactive' | 'deleted',

  createdAt: Date,
  updatedAt: Date
}

// Índices
- { businessId: 1, status: 1 }
- { businessId: 1, categoryId: 1 }
- { 'discount.isActive': 1 }
```

### 3.6 Colección: Appointments (turnos)

```typescript
// appointments
{
  _id: ObjectId,
  businessId: ObjectId,             // ref: businesses

  // Cliente
  clientId: ObjectId,               // ref: users
  clientInfo: {                     // snapshot para historial
    name: string,
    phone: string,
    email: string
  },

  // Staff
  staffId: ObjectId,                // ref: staff
  staffInfo: {
    name: string
  },

  // Servicios
  services: [{
    serviceId: ObjectId,
    name: string,
    duration: number,
    price: number,
    discount: number
  }],

  // Fecha y hora
  date: Date,                       // solo fecha, sin hora
  startTime: string,                // "14:30"
  endTime: string,                  // "15:30"
  startDateTime: Date,              // fecha completa para queries
  endDateTime: Date,

  // Duración total
  totalDuration: number,            // minutos

  // Precio
  pricing: {
    subtotal: number,
    discount: number,
    discountCode: string,
    deposit: number,
    depositPaid: boolean,
    total: number,
    tip: number,
    finalTotal: number
  },

  // Estado
  status: 'pending' | 'confirmed' | 'checked_in' | 'in_progress' | 'completed' | 'cancelled' | 'no_show',

  // Historial de estados
  statusHistory: [{
    status: string,
    changedAt: Date,
    changedBy: ObjectId,
    reason: string
  }],

  // Cancelación
  cancellation: {
    cancelledAt: Date,
    cancelledBy: 'client' | 'business',
    reason: string,
    refunded: boolean,
    refundAmount: number
  },

  // Pago
  payment: {
    status: 'pending' | 'partial' | 'paid' | 'refunded',
    method: 'cash' | 'card' | 'mercadopago' | 'transfer',
    transactionId: string,
    paidAt: Date,
    paidAmount: number
  },

  // Notas
  notes: {
    client: string,                 // nota del cliente al reservar
    business: string,               // nota interna del negocio
    staff: string                   // nota del profesional
  },

  // Recordatorios enviados
  reminders: [{
    type: 'confirmation' | '24h' | '2h' | 'custom',
    channel: 'push' | 'sms' | 'email' | 'whatsapp',
    sentAt: Date,
    status: 'sent' | 'delivered' | 'failed'
  }],

  // Review
  review: {
    submitted: boolean,
    requestedAt: Date
  },

  // Source
  source: 'app_client' | 'app_business' | 'manual' | 'api',

  // Recurrencia (para turnos recurrentes)
  recurrence: {
    isRecurring: boolean,
    parentId: ObjectId,             // turno original
    pattern: 'weekly' | 'biweekly' | 'monthly',
    endsAt: Date
  },

  createdAt: Date,
  updatedAt: Date,
  createdBy: ObjectId
}

// Índices
- { businessId: 1, date: 1, status: 1 }
- { businessId: 1, staffId: 1, date: 1 }
- { clientId: 1, status: 1 }
- { startDateTime: 1 }
- { businessId: 1, startDateTime: 1, endDateTime: 1 }
- { status: 1, date: 1 }
- { 'recurrence.parentId': 1 }
```

### 3.7 Colección: Reviews (reseñas)

```typescript
// reviews
{
  _id: ObjectId,
  businessId: ObjectId,
  appointmentId: ObjectId,
  clientId: ObjectId,
  staffId: ObjectId,

  // Ratings
  ratings: {
    overall: number,                // 1-5
    service: number,
    staff: number,
    cleanliness: number,
    value: number
  },

  // Contenido
  content: {
    text: string,
    photos: [string],               // URLs
    services: [string]              // servicios que recibió
  },

  // Respuesta del negocio
  response: {
    text: string,
    respondedAt: Date,
    respondedBy: ObjectId
  },

  // Verificación
  isVerified: boolean,              // visita verificada

  // Moderación
  moderation: {
    status: 'pending' | 'approved' | 'rejected' | 'flagged',
    reviewedAt: Date,
    reviewedBy: ObjectId,
    reason: string
  },

  // Votos útiles
  helpfulVotes: number,
  reportCount: number,

  status: 'active' | 'hidden' | 'deleted',

  createdAt: Date,
  updatedAt: Date
}

// Índices
- { businessId: 1, status: 1, createdAt: -1 }
- { businessId: 1, staffId: 1 }
- { clientId: 1 }
- { appointmentId: 1 } unique
- { 'ratings.overall': -1 }
```

### 3.8 Colección: Transactions (transacciones financieras)

```typescript
// transactions
{
  _id: ObjectId,
  businessId: ObjectId,

  // Referencias
  appointmentId: ObjectId,
  clientId: ObjectId,
  staffId: ObjectId,

  // Tipo
  type: 'payment' | 'refund' | 'deposit' | 'tip' | 'expense',

  // Monto
  amount: number,
  currency: string,

  // Método de pago
  paymentMethod: 'cash' | 'card' | 'mercadopago' | 'transfer' | 'other',

  // Detalles del pago externo
  externalPayment: {
    provider: 'mercadopago' | 'stripe',
    transactionId: string,
    status: string,
    rawResponse: object
  },

  // Desglose
  breakdown: {
    services: [{
      serviceId: ObjectId,
      name: string,
      amount: number
    }],
    discount: number,
    discountCode: string,
    tip: number,
    tax: number
  },

  // Para gastos del negocio
  expense: {
    category: string,
    description: string,
    receipt: string                 // URL
  },

  status: 'pending' | 'completed' | 'failed' | 'cancelled' | 'refunded',

  notes: string,

  processedAt: Date,
  processedBy: ObjectId,

  createdAt: Date,
  updatedAt: Date
}

// Índices
- { businessId: 1, createdAt: -1 }
- { businessId: 1, type: 1, createdAt: -1 }
- { businessId: 1, staffId: 1, createdAt: -1 }
- { appointmentId: 1 }
- { 'externalPayment.transactionId': 1 }
```

### 3.9 Colección: Notifications (notificaciones)

```typescript
// notifications
{
  _id: ObjectId,

  // Destinatario
  recipientType: 'user' | 'business_user',
  recipientId: ObjectId,

  // Contenido
  type: 'booking_confirmed' | 'booking_cancelled' | 'reminder_24h' |
        'reminder_2h' | 'review_request' | 'promotion' | 'message' |
        'payment_received' | 'waitlist_available' | 'birthday',

  title: string,
  body: string,
  data: object,                     // datos adicionales para la app

  // Referencias
  businessId: ObjectId,
  appointmentId: ObjectId,

  // Canales
  channels: {
    push: {
      sent: boolean,
      sentAt: Date,
      fcmMessageId: string,
      status: 'sent' | 'delivered' | 'failed'
    },
    email: {
      sent: boolean,
      sentAt: Date,
      messageId: string,
      status: string
    },
    sms: {
      sent: boolean,
      sentAt: Date,
      sid: string,
      status: string
    }
  },

  // Estado
  read: boolean,
  readAt: Date,

  // Programación
  scheduledFor: Date,               // null = inmediato

  createdAt: Date
}

// Índices
- { recipientType: 1, recipientId: 1, read: 1, createdAt: -1 }
- { scheduledFor: 1, 'channels.push.sent': 1 }
- { businessId: 1, type: 1 }
// TTL index para limpiar notificaciones viejas
- { createdAt: 1 }, expireAfterSeconds: 7776000 // 90 días
```

### 3.10 Colección: Waitlist (lista de espera)

```typescript
// waitlist
{
  _id: ObjectId,
  businessId: ObjectId,
  clientId: ObjectId,

  // Preferencias
  preferences: {
    services: [ObjectId],
    staffId: ObjectId,              // null = sin preferencia
    dateRange: {
      from: Date,
      to: Date
    },
    timeRange: {
      from: string,
      to: string
    },
    daysOfWeek: [0-6]
  },

  // Prioridad
  priority: 'normal' | 'vip',
  position: number,

  // Notificaciones enviadas
  notifications: [{
    appointmentId: ObjectId,        // turno que se liberó
    sentAt: Date,
    expiresAt: Date,
    status: 'sent' | 'accepted' | 'expired' | 'declined'
  }],

  status: 'active' | 'fulfilled' | 'cancelled' | 'expired',

  createdAt: Date,
  expiresAt: Date
}

// Índices
- { businessId: 1, status: 1, priority: -1, createdAt: 1 }
- { clientId: 1, status: 1 }
- { expiresAt: 1 }
```

### 3.11 Colección: Promotions (promociones y descuentos)

```typescript
// promotions
{
  _id: ObjectId,
  businessId: ObjectId,

  name: string,
  description: string,

  // Tipo
  type: 'percentage' | 'fixed' | 'first_visit' | 'loyalty' | 'package',

  // Código
  code: string,                     // null si es automático

  // Descuento
  discount: {
    type: 'percentage' | 'fixed',
    amount: number,
    maxDiscount: number             // tope para porcentaje
  },

  // Condiciones
  conditions: {
    minPurchase: number,
    services: [ObjectId],           // aplica solo a estos servicios
    staff: [ObjectId],              // aplica solo con estos profesionales
    daysOfWeek: [0-6],
    timeRange: {
      from: string,
      to: string
    },
    firstVisitOnly: boolean,
    minVisits: number,              // para loyalty
    clientSegment: 'all' | 'new' | 'returning' | 'vip' | 'inactive'
  },

  // Límites
  limits: {
    totalUses: number,              // null = ilimitado
    usesPerClient: number,
    currentUses: number
  },

  // Vigencia
  validFrom: Date,
  validUntil: Date,

  status: 'draft' | 'active' | 'paused' | 'expired' | 'deleted',

  createdAt: Date,
  updatedAt: Date
}

// Índices
- { businessId: 1, status: 1 }
- { code: 1, businessId: 1 } unique sparse
- { validFrom: 1, validUntil: 1 }
```

### 3.12 Colección: Campaigns (campañas de marketing)

```typescript
// campaigns
{
  _id: ObjectId,
  businessId: ObjectId,

  name: string,

  // Tipo
  type: 'push' | 'email' | 'sms' | 'whatsapp',

  // Contenido
  content: {
    title: string,
    body: string,
    image: string,
    actionUrl: string,
    // Para email
    htmlTemplate: string,
    // Para WhatsApp
    templateId: string
  },

  // Segmentación
  audience: {
    type: 'all' | 'segment' | 'custom',
    segment: 'new' | 'returning' | 'vip' | 'inactive' | 'birthday',
    customFilters: {
      lastVisitDaysAgo: { min: number, max: number },
      totalVisits: { min: number, max: number },
      totalSpent: { min: number, max: number },
      services: [ObjectId],
      staff: [ObjectId]
    },
    clientIds: [ObjectId]           // para custom
  },

  // Programación
  schedule: {
    type: 'immediate' | 'scheduled' | 'recurring',
    sendAt: Date,
    recurring: {
      frequency: 'daily' | 'weekly' | 'monthly',
      daysOfWeek: [0-6],
      time: string
    }
  },

  // Stats
  stats: {
    totalRecipients: number,
    sent: number,
    delivered: number,
    opened: number,
    clicked: number,
    failed: number
  },

  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'cancelled',

  createdAt: Date,
  updatedAt: Date,
  sentAt: Date
}

// Índices
- { businessId: 1, status: 1 }
- { 'schedule.sendAt': 1, status: 1 }
```

### 3.13 Colección: ClientBusinessRelation (relación cliente-negocio)

```typescript
// client_business_relations
{
  _id: ObjectId,
  clientId: ObjectId,               // ref: users
  businessId: ObjectId,             // ref: businesses

  // Info del cliente específica para este negocio
  clientInfo: {
    customName: string,             // si el negocio le puso otro nombre
    tags: [string],                 // VIP, Frecuente, etc.
    notes: string,                  // notas privadas del negocio
    allergies: [string],
    preferences: string
  },

  // Stats con este negocio
  stats: {
    totalVisits: number,
    totalSpent: number,
    totalCancellations: number,
    totalNoShows: number,
    lastVisit: Date,
    averageSpent: number,
    favoriteServices: [{
      serviceId: ObjectId,
      count: number
    }],
    favoriteStaff: ObjectId
  },

  // Loyalty
  loyalty: {
    points: number,
    tier: 'bronze' | 'silver' | 'gold' | 'platinum',
    tierUpdatedAt: Date
  },

  // Estado
  isBlocked: boolean,
  blockedAt: Date,
  blockedReason: string,

  // Comunicación
  communicationPreferences: {
    allowMarketing: boolean,
    allowReminders: boolean,
    preferredChannel: 'push' | 'sms' | 'email' | 'whatsapp'
  },

  createdAt: Date,
  updatedAt: Date
}

// Índices
- { clientId: 1, businessId: 1 } unique
- { businessId: 1, 'stats.lastVisit': -1 }
- { businessId: 1, 'loyalty.tier': 1 }
- { businessId: 1, isBlocked: 1 }
```

---

## 4. API REST - Endpoints

### 4.1 Autenticación

```
POST   /api/v1/auth/register              # Registro usuario cliente
POST   /api/v1/auth/login                 # Login email/password
POST   /api/v1/auth/login/phone           # Login con teléfono (OTP)
POST   /api/v1/auth/verify-otp            # Verificar código OTP
POST   /api/v1/auth/social                # Login social (Google/Facebook/Apple)
POST   /api/v1/auth/refresh               # Refresh token
POST   /api/v1/auth/logout                # Logout (invalidar token)
POST   /api/v1/auth/forgot-password       # Solicitar reset password
POST   /api/v1/auth/reset-password        # Reset password con token
POST   /api/v1/auth/change-password       # Cambiar password (autenticado)

# Business Auth (separado)
POST   /api/v1/business-auth/register     # Registro negocio
POST   /api/v1/business-auth/login        # Login negocio
POST   /api/v1/business-auth/refresh      # Refresh token negocio
```

### 4.2 Usuarios (App Cliente)

```
GET    /api/v1/users/me                   # Perfil del usuario actual
PUT    /api/v1/users/me                   # Actualizar perfil
DELETE /api/v1/users/me                   # Eliminar cuenta
PUT    /api/v1/users/me/avatar            # Subir/actualizar avatar
GET    /api/v1/users/me/appointments      # Mis turnos
GET    /api/v1/users/me/favorites         # Mis favoritos
PUT    /api/v1/users/me/preferences       # Actualizar preferencias
GET    /api/v1/users/me/notifications     # Mis notificaciones
PUT    /api/v1/users/me/notifications/:id/read  # Marcar notificación leída
GET    /api/v1/users/me/payment-methods   # Métodos de pago
POST   /api/v1/users/me/payment-methods   # Agregar método de pago
DELETE /api/v1/users/me/payment-methods/:id    # Eliminar método de pago
GET    /api/v1/users/me/reviews           # Mis reviews
GET    /api/v1/users/me/transactions      # Historial de pagos
```

### 4.3 Exploración (App Cliente)

```
GET    /api/v1/explore/businesses         # Buscar negocios
       ?lat=&lng=                         # Por ubicación
       ?q=                                # Búsqueda texto
       ?type=                             # Tipo de negocio
       ?rating=                           # Rating mínimo
       ?distance=                         # Distancia máxima (km)
       ?priceRange=                       # Rango de precio
       ?hasAvailability=                  # Con disponibilidad hoy
       ?page=&limit=

GET    /api/v1/explore/businesses/featured    # Destacados
GET    /api/v1/explore/businesses/nearby      # Cercanos
GET    /api/v1/explore/businesses/recommended # Recomendados para el usuario
GET    /api/v1/explore/categories             # Categorías de negocios
```

### 4.4 Negocio Público (App Cliente)

```
GET    /api/v1/businesses/:slug               # Perfil público del negocio
GET    /api/v1/businesses/:id/services        # Servicios del negocio
GET    /api/v1/businesses/:id/staff           # Staff del negocio
GET    /api/v1/businesses/:id/reviews         # Reviews del negocio
GET    /api/v1/businesses/:id/availability    # Disponibilidad
       ?date=&serviceIds=&staffId=
GET    /api/v1/businesses/:id/promotions      # Promociones activas
POST   /api/v1/businesses/:id/favorite        # Agregar a favoritos
DELETE /api/v1/businesses/:id/favorite        # Quitar de favoritos
```

### 4.5 Reservas (App Cliente)

```
POST   /api/v1/bookings                       # Crear reserva
GET    /api/v1/bookings/:id                   # Detalle de reserva
PUT    /api/v1/bookings/:id                   # Modificar reserva
POST   /api/v1/bookings/:id/cancel            # Cancelar reserva
POST   /api/v1/bookings/:id/reschedule        # Reprogramar reserva
POST   /api/v1/bookings/check-availability    # Verificar disponibilidad
POST   /api/v1/bookings/calculate-price       # Calcular precio
GET    /api/v1/bookings/:id/payment           # Info de pago
POST   /api/v1/bookings/:id/payment           # Procesar pago
```

### 4.6 Lista de Espera (App Cliente)

```
POST   /api/v1/waitlist                       # Anotarse en lista de espera
GET    /api/v1/waitlist/me                    # Mis entradas en lista de espera
DELETE /api/v1/waitlist/:id                   # Cancelar entrada
POST   /api/v1/waitlist/:notificationId/accept    # Aceptar turno liberado
POST   /api/v1/waitlist/:notificationId/decline   # Rechazar turno liberado
```

### 4.7 Reviews (App Cliente)

```
POST   /api/v1/reviews                        # Crear review
PUT    /api/v1/reviews/:id                    # Editar review
DELETE /api/v1/reviews/:id                    # Eliminar review
POST   /api/v1/reviews/:id/helpful            # Marcar como útil
POST   /api/v1/reviews/:id/report             # Reportar review
```

### 4.8 Promociones (App Cliente)

```
GET    /api/v1/promotions                     # Promociones disponibles
POST   /api/v1/promotions/validate            # Validar código
       { code, businessId, serviceIds }
```

---

### 4.9 Gestión de Negocio (App Negocio)

```
# Negocio
GET    /api/v1/manage/business                # Mi negocio
PUT    /api/v1/manage/business                # Actualizar negocio
PUT    /api/v1/manage/business/logo           # Actualizar logo
PUT    /api/v1/manage/business/cover          # Actualizar cover
POST   /api/v1/manage/business/gallery        # Agregar foto a galería
DELETE /api/v1/manage/business/gallery/:id    # Eliminar foto
PUT    /api/v1/manage/business/schedule       # Actualizar horarios
PUT    /api/v1/manage/business/booking-config # Config de reservas
PUT    /api/v1/manage/business/payment-config # Config de pagos

# Dashboard
GET    /api/v1/manage/dashboard               # Resumen general
GET    /api/v1/manage/dashboard/today         # Resumen del día
GET    /api/v1/manage/dashboard/stats         # Estadísticas
       ?period=day|week|month|year
       ?from=&to=
```

### 4.10 Staff (App Negocio)

```
GET    /api/v1/manage/staff                   # Lista de staff
POST   /api/v1/manage/staff                   # Crear staff
GET    /api/v1/manage/staff/:id               # Detalle de staff
PUT    /api/v1/manage/staff/:id               # Actualizar staff
DELETE /api/v1/manage/staff/:id               # Eliminar staff
PUT    /api/v1/manage/staff/:id/schedule      # Actualizar horario
POST   /api/v1/manage/staff/:id/exception     # Agregar excepción (vacaciones)
DELETE /api/v1/manage/staff/:id/exception/:exId   # Eliminar excepción
GET    /api/v1/manage/staff/:id/stats         # Estadísticas del staff
PUT    /api/v1/manage/staff/:id/services      # Asignar servicios
```

### 4.11 Servicios (App Negocio)

```
GET    /api/v1/manage/services                # Lista de servicios
POST   /api/v1/manage/services                # Crear servicio
GET    /api/v1/manage/services/:id            # Detalle
PUT    /api/v1/manage/services/:id            # Actualizar
DELETE /api/v1/manage/services/:id            # Eliminar
PUT    /api/v1/manage/services/:id/status     # Activar/desactivar
POST   /api/v1/manage/services/:id/duplicate  # Duplicar servicio

# Categorías
GET    /api/v1/manage/service-categories      # Lista categorías
POST   /api/v1/manage/service-categories      # Crear categoría
PUT    /api/v1/manage/service-categories/:id  # Actualizar
DELETE /api/v1/manage/service-categories/:id  # Eliminar
PUT    /api/v1/manage/service-categories/reorder  # Reordenar
```

### 4.12 Calendario/Turnos (App Negocio)

```
GET    /api/v1/manage/appointments            # Lista de turnos
       ?date=&from=&to=
       ?staffId=
       ?status=
       ?view=day|week|month

POST   /api/v1/manage/appointments            # Crear turno manual
GET    /api/v1/manage/appointments/:id        # Detalle
PUT    /api/v1/manage/appointments/:id        # Modificar
DELETE /api/v1/manage/appointments/:id        # Eliminar

# Acciones sobre turnos
POST   /api/v1/manage/appointments/:id/confirm        # Confirmar
POST   /api/v1/manage/appointments/:id/check-in       # Check-in
POST   /api/v1/manage/appointments/:id/start          # Iniciar servicio
POST   /api/v1/manage/appointments/:id/complete       # Completar
POST   /api/v1/manage/appointments/:id/cancel         # Cancelar
POST   /api/v1/manage/appointments/:id/no-show        # Marcar no-show
POST   /api/v1/manage/appointments/:id/reschedule     # Reprogramar
POST   /api/v1/manage/appointments/:id/reminder       # Enviar recordatorio

# Disponibilidad
GET    /api/v1/manage/availability            # Ver disponibilidad
POST   /api/v1/manage/availability/block      # Bloquear horario
DELETE /api/v1/manage/availability/block/:id  # Desbloquear
```

### 4.13 Clientes (App Negocio)

```
GET    /api/v1/manage/clients                 # Lista de clientes
       ?q=                                    # Búsqueda
       ?segment=new|returning|vip|inactive|blocked
       ?page=&limit=

POST   /api/v1/manage/clients                 # Crear cliente manual
GET    /api/v1/manage/clients/:id             # Detalle del cliente
PUT    /api/v1/manage/clients/:id             # Actualizar info
GET    /api/v1/manage/clients/:id/appointments    # Historial de turnos
GET    /api/v1/manage/clients/:id/stats       # Estadísticas
POST   /api/v1/manage/clients/:id/block       # Bloquear cliente
POST   /api/v1/manage/clients/:id/unblock     # Desbloquear
POST   /api/v1/manage/clients/:id/vip         # Marcar como VIP
POST   /api/v1/manage/clients/:id/message     # Enviar mensaje
POST   /api/v1/manage/clients/:id/note        # Agregar nota
```

### 4.14 Finanzas (App Negocio)

```
GET    /api/v1/manage/finances/summary        # Resumen financiero
       ?period=day|week|month|year
       ?from=&to=

GET    /api/v1/manage/finances/transactions   # Transacciones
       ?type=payment|refund|expense
       ?from=&to=
       ?staffId=
       ?method=

POST   /api/v1/manage/finances/transactions   # Registrar transacción manual
GET    /api/v1/manage/finances/transactions/:id   # Detalle

# Reportes
GET    /api/v1/manage/finances/reports/daily-close    # Cierre de caja
GET    /api/v1/manage/finances/reports/by-service     # Por servicio
GET    /api/v1/manage/finances/reports/by-staff       # Por empleado
GET    /api/v1/manage/finances/reports/by-method      # Por método de pago
POST   /api/v1/manage/finances/reports/export         # Exportar reporte

# Gastos
GET    /api/v1/manage/expenses                # Lista de gastos
POST   /api/v1/manage/expenses                # Registrar gasto
PUT    /api/v1/manage/expenses/:id            # Actualizar
DELETE /api/v1/manage/expenses/:id            # Eliminar
```

### 4.15 Marketing (App Negocio)

```
# Promociones
GET    /api/v1/manage/promotions              # Lista de promociones
POST   /api/v1/manage/promotions              # Crear promoción
GET    /api/v1/manage/promotions/:id          # Detalle
PUT    /api/v1/manage/promotions/:id          # Actualizar
DELETE /api/v1/manage/promotions/:id          # Eliminar
PUT    /api/v1/manage/promotions/:id/status   # Activar/pausar

# Campañas
GET    /api/v1/manage/campaigns               # Lista de campañas
POST   /api/v1/manage/campaigns               # Crear campaña
GET    /api/v1/manage/campaigns/:id           # Detalle
PUT    /api/v1/manage/campaigns/:id           # Actualizar
DELETE /api/v1/manage/campaigns/:id           # Eliminar
POST   /api/v1/manage/campaigns/:id/send      # Enviar campaña
POST   /api/v1/manage/campaigns/:id/cancel    # Cancelar envío
GET    /api/v1/manage/campaigns/:id/stats     # Estadísticas

# Configuración de notificaciones automáticas
GET    /api/v1/manage/auto-notifications      # Config actual
PUT    /api/v1/manage/auto-notifications      # Actualizar config
```

### 4.16 Estadísticas (App Negocio)

```
GET    /api/v1/manage/analytics/overview      # Overview general
GET    /api/v1/manage/analytics/occupancy     # Ocupación
       ?period=&staffId=
GET    /api/v1/manage/analytics/clients       # Métricas de clientes
GET    /api/v1/manage/analytics/services      # Métricas de servicios
GET    /api/v1/manage/analytics/staff         # Métricas de staff
GET    /api/v1/manage/analytics/revenue       # Métricas de ingresos
GET    /api/v1/manage/analytics/trends        # Tendencias
GET    /api/v1/manage/analytics/predictions   # Predicciones
```

### 4.17 Lista de Espera (App Negocio)

```
GET    /api/v1/manage/waitlist                # Lista de espera
POST   /api/v1/manage/waitlist                # Agregar manualmente
PUT    /api/v1/manage/waitlist/:id            # Actualizar
DELETE /api/v1/manage/waitlist/:id            # Eliminar
POST   /api/v1/manage/waitlist/:id/notify     # Notificar disponibilidad
```

### 4.18 Reviews (App Negocio)

```
GET    /api/v1/manage/reviews                 # Lista de reviews
GET    /api/v1/manage/reviews/:id             # Detalle
POST   /api/v1/manage/reviews/:id/respond     # Responder review
PUT    /api/v1/manage/reviews/:id/respond     # Editar respuesta
POST   /api/v1/manage/reviews/:id/report      # Reportar review
```

### 4.19 Configuración (App Negocio)

```
GET    /api/v1/manage/settings                # Todas las configuraciones
PUT    /api/v1/manage/settings/general        # Config general
PUT    /api/v1/manage/settings/booking        # Config de reservas
PUT    /api/v1/manage/settings/notifications  # Config de notificaciones
PUT    /api/v1/manage/settings/payments       # Config de pagos

# Integraciones
GET    /api/v1/manage/integrations            # Lista integraciones
POST   /api/v1/manage/integrations/google-calendar    # Conectar Google
DELETE /api/v1/manage/integrations/google-calendar    # Desconectar
POST   /api/v1/manage/integrations/mercadopago        # Conectar MP
DELETE /api/v1/manage/integrations/mercadopago        # Desconectar

# Suscripción
GET    /api/v1/manage/subscription            # Plan actual
POST   /api/v1/manage/subscription/upgrade    # Cambiar plan
GET    /api/v1/manage/subscription/invoices   # Facturas

# Equipo
GET    /api/v1/manage/team                    # Usuarios del equipo
POST   /api/v1/manage/team/invite             # Invitar usuario
PUT    /api/v1/manage/team/:id/role           # Cambiar rol
DELETE /api/v1/manage/team/:id                # Eliminar del equipo
```

### 4.20 Punto de Venta (App Negocio)

```
POST   /api/v1/manage/pos/checkout            # Procesar venta
       { appointmentId, services, discounts, tip, paymentMethod }
GET    /api/v1/manage/pos/pending             # Turnos pendientes de cobro
POST   /api/v1/manage/pos/quick-sale          # Venta rápida (sin turno)
GET    /api/v1/manage/pos/receipt/:transactionId  # Obtener recibo
POST   /api/v1/manage/pos/receipt/:transactionId/send  # Enviar recibo
```

---

## 5. Autenticación y Seguridad

### 5.1 Estrategia de Autenticación

```typescript
// JWT Structure
{
  // Access Token (15 min)
  accessToken: {
    header: { alg: 'RS256', typ: 'JWT' },
    payload: {
      sub: 'userId',
      type: 'user' | 'business_user',
      iat: timestamp,
      exp: timestamp,
      jti: 'uniqueTokenId'
    }
  },

  // Refresh Token (30 días)
  refreshToken: {
    header: { alg: 'RS256', typ: 'JWT' },
    payload: {
      sub: 'userId',
      type: 'refresh',
      family: 'tokenFamilyId',  // para detectar reuse
      iat: timestamp,
      exp: timestamp,
      jti: 'uniqueTokenId'
    }
  }
}
```

### 5.2 Flujos de Autenticación

```
1. Email/Password:
   - Registro → verificación email → login → tokens
   - Login → validar credenciales → tokens

2. Teléfono (OTP):
   - Ingresar teléfono → enviar OTP (Twilio) → verificar → tokens
   - Rate limit: 3 intentos/hora por número

3. Social (Google/Facebook/Apple):
   - OAuth flow → verificar token con provider → crear/vincular usuario → tokens

4. Refresh:
   - Enviar refresh token → validar → rotar tokens (nuevo access + nuevo refresh)
   - Refresh token rotation con detección de reuso
```

### 5.3 Seguridad

```typescript
// Middleware de seguridad
{
  // Rate Limiting
  rateLimiter: {
    general: '100 requests/minute',
    auth: '5 requests/minute',
    sensitive: '3 requests/minute'
  },

  // Headers de seguridad
  helmet: {
    contentSecurityPolicy: true,
    crossOriginEmbedderPolicy: true,
    crossOriginOpenerPolicy: true,
    crossOriginResourcePolicy: true,
    dnsPrefetchControl: true,
    frameguard: true,
    hidePoweredBy: true,
    hsts: true,
    ieNoOpen: true,
    noSniff: true,
    originAgentCluster: true,
    permittedCrossDomainPolicies: true,
    referrerPolicy: true,
    xssFilter: true
  },

  // CORS
  cors: {
    origin: ['app://turnofacil.business', 'app://turnofacil.client'],
    credentials: true
  },

  // Validación de input
  validation: 'Zod schemas en cada endpoint',

  // Sanitización
  sanitization: 'mongo-sanitize + xss-clean',

  // Encriptación
  passwords: 'bcrypt (cost 12)',
  tokens: 'RS256 (asymmetric)',
  sensitiveData: 'AES-256-GCM'
}
```

### 5.4 Sistema de Permisos

```typescript
// Roles y permisos para app de negocio
const roles = {
  owner: {
    permissions: ['*'],  // Todo
    canTransferOwnership: true
  },

  admin: {
    permissions: [
      'business:read', 'business:update',
      'staff:*',
      'services:*',
      'appointments:*',
      'clients:*',
      'finances:read', 'finances:transactions',
      'marketing:*',
      'analytics:*',
      'settings:read', 'settings:update',
      'team:read', 'team:invite'
    ]
  },

  manager: {
    permissions: [
      'business:read',
      'staff:read', 'staff:schedule',
      'services:read',
      'appointments:*',
      'clients:read', 'clients:update',
      'finances:read',
      'marketing:read',
      'analytics:read'
    ]
  },

  employee: {
    permissions: [
      'appointments:read:own', 'appointments:update:own',
      'clients:read',
      'analytics:read:own'
    ]
  },

  reception: {
    permissions: [
      'appointments:*',
      'clients:read', 'clients:create',
      'services:read',
      'staff:read'
    ]
  }
};
```

---

## 6. Sistema de Notificaciones

### 6.1 Arquitectura de Notificaciones

```
┌─────────────────────────────────────────────────────────────────┐
│                    NOTIFICATION SERVICE                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │   Trigger    │───▶│  Processor   │───▶│   Delivery   │      │
│  │   Events     │    │   (BullMQ)   │    │   Channels   │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
│        │                    │                    │               │
│        ▼                    ▼                    ▼               │
│  - Booking created    - Template           - FCM (Push)         │
│  - Booking cancelled    rendering          - Twilio (SMS)       │
│  - Reminder due       - User prefs         - SendGrid (Email)   │
│  - Review request       check              - WhatsApp API       │
│  - Promotion          - Rate limiting                           │
│  - Campaign           - Retry logic                             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 Tipos de Notificaciones

```typescript
const notificationTypes = {
  // Transaccionales (automáticas)
  transactional: {
    BOOKING_CONFIRMED: {
      channels: ['push', 'email'],
      template: 'booking_confirmed',
      priority: 'high'
    },
    BOOKING_CANCELLED: {
      channels: ['push', 'email'],
      template: 'booking_cancelled',
      priority: 'high'
    },
    BOOKING_RESCHEDULED: {
      channels: ['push', 'email'],
      template: 'booking_rescheduled',
      priority: 'high'
    },
    REMINDER_24H: {
      channels: ['push'],
      template: 'reminder_24h',
      scheduledOffset: -24 * 60 * 60 * 1000  // 24h antes
    },
    REMINDER_2H: {
      channels: ['push', 'sms'],
      template: 'reminder_2h',
      scheduledOffset: -2 * 60 * 60 * 1000   // 2h antes
    },
    REVIEW_REQUEST: {
      channels: ['push'],
      template: 'review_request',
      scheduledOffset: 2 * 60 * 60 * 1000    // 2h después
    },
    PAYMENT_RECEIVED: {
      channels: ['push', 'email'],
      template: 'payment_received',
      priority: 'high'
    },
    WAITLIST_AVAILABLE: {
      channels: ['push', 'sms'],
      template: 'waitlist_available',
      priority: 'high',
      expiresIn: 30 * 60 * 1000              // 30 min para responder
    }
  },

  // Para negocio
  business: {
    NEW_BOOKING: {
      channels: ['push'],
      template: 'new_booking_business'
    },
    BOOKING_CANCELLED_BY_CLIENT: {
      channels: ['push'],
      template: 'cancelled_by_client'
    },
    NEW_REVIEW: {
      channels: ['push'],
      template: 'new_review'
    },
    DAILY_SUMMARY: {
      channels: ['push', 'email'],
      template: 'daily_summary',
      scheduled: '07:00'                      // Cada día a las 7am
    }
  },

  // Marketing
  marketing: {
    PROMOTION: {
      channels: ['push'],
      requiresOptIn: true
    },
    CAMPAIGN: {
      channels: ['push', 'email', 'sms', 'whatsapp'],
      requiresOptIn: true
    },
    BIRTHDAY: {
      channels: ['push', 'email'],
      requiresOptIn: true
    },
    INACTIVE_CLIENT: {
      channels: ['push', 'email'],
      requiresOptIn: true
    }
  }
};
```

### 6.3 Templates

```typescript
// Ejemplo de templates (en español)
const templates = {
  booking_confirmed: {
    push: {
      title: '¡Turno confirmado!',
      body: 'Tu turno en {{businessName}} para el {{date}} a las {{time}} está confirmado.'
    },
    email: {
      subject: 'Confirmación de turno - {{businessName}}',
      template: 'booking-confirmed.html'
    }
  },

  reminder_24h: {
    push: {
      title: 'Recordatorio de turno',
      body: 'Mañana tenés turno en {{businessName}} a las {{time}}. ¡Te esperamos!'
    }
  },

  reminder_2h: {
    push: {
      title: '¡Tu turno es pronto!',
      body: 'En 2 horas tenés turno en {{businessName}}. Dirección: {{address}}'
    },
    sms: '{{businessName}}: Tu turno es hoy a las {{time}}. Te esperamos en {{address}}'
  }
};
```

---

## 7. Integraciones Externas

### 7.1 Mercado Pago

```typescript
// Funcionalidades a implementar
const mercadoPagoIntegration = {
  // Pagos
  payments: {
    createPayment: 'Procesar pago único',
    createPreference: 'Checkout Pro para depósitos',
    getPayment: 'Consultar estado de pago',
    refund: 'Devoluciones parciales/totales'
  },

  // Suscripciones (para planes del negocio)
  subscriptions: {
    createPlan: 'Crear plan de suscripción',
    createSubscription: 'Suscribir negocio',
    updateSubscription: 'Cambiar plan',
    cancelSubscription: 'Cancelar suscripción'
  },

  // Webhooks
  webhooks: {
    'payment.created': 'Pago creado',
    'payment.updated': 'Pago actualizado',
    'subscription.authorized': 'Suscripción autorizada',
    'subscription.cancelled': 'Suscripción cancelada'
  },

  // Split payments (si el modelo es comisión)
  marketplace: {
    createSeller: 'Registrar negocio como vendedor',
    splitPayment: 'Dividir pago (comisión plataforma)'
  }
};
```

### 7.2 Firebase Cloud Messaging (FCM)

```typescript
const fcmIntegration = {
  // Registro de dispositivos
  registerDevice: {
    saveToken: 'Guardar FCM token por usuario/dispositivo',
    updateToken: 'Actualizar token cuando cambia',
    removeToken: 'Eliminar token en logout'
  },

  // Envío
  send: {
    toDevice: 'Enviar a dispositivo específico',
    toUser: 'Enviar a todos los dispositivos del usuario',
    toTopic: 'Enviar a topic (ej: negocio específico)',
    batch: 'Envío masivo (hasta 500 por batch)'
  },

  // Configuración
  config: {
    android: {
      priority: 'high',
      notification: {
        channelId: 'turnofacil_default',
        sound: 'default',
        clickAction: 'FLUTTER_NOTIFICATION_CLICK'
      }
    },
    apns: {
      headers: {
        'apns-priority': '10'
      },
      payload: {
        aps: {
          sound: 'default',
          badge: 1
        }
      }
    }
  }
};
```

### 7.3 Twilio (SMS)

```typescript
const twilioIntegration = {
  // SMS
  sms: {
    send: 'Enviar SMS',
    verify: 'Verificación de teléfono (OTP)'
  },

  // Verify API (para OTP)
  verify: {
    startVerification: 'Enviar código OTP',
    checkVerification: 'Verificar código',
    // Rate limits automáticos
  },

  // Configuración
  config: {
    fromNumber: '+1234567890',
    messagingServiceSid: 'MGxxxx',
    // Templates aprobados para Argentina
  }
};
```

### 7.4 SendGrid (Email)

```typescript
const sendGridIntegration = {
  // Transactional
  transactional: {
    send: 'Enviar email con template',
    sendRaw: 'Enviar email sin template'
  },

  // Templates
  templates: {
    bookingConfirmed: 'd-xxxxx',
    bookingCancelled: 'd-xxxxx',
    reminder: 'd-xxxxx',
    reviewRequest: 'd-xxxxx',
    passwordReset: 'd-xxxxx',
    welcome: 'd-xxxxx'
  },

  // Marketing
  marketing: {
    createCampaign: 'Crear campaña',
    sendCampaign: 'Enviar campaña',
    getStats: 'Obtener estadísticas'
  }
};
```

### 7.5 AWS S3 (Storage)

```typescript
const s3Integration = {
  // Buckets
  buckets: {
    avatars: 'turnofacil-avatars',
    businessMedia: 'turnofacil-business-media',
    reviews: 'turnofacil-reviews',
    receipts: 'turnofacil-receipts'
  },

  // Operaciones
  operations: {
    getSignedUrl: 'URL pre-firmada para upload directo',
    upload: 'Upload desde backend',
    delete: 'Eliminar archivo',
    copy: 'Copiar archivo'
  },

  // Procesamiento de imágenes
  imageProcessing: {
    // Usar Sharp o Lambda para:
    resize: 'Redimensionar a múltiples tamaños',
    compress: 'Comprimir para web',
    generateThumbnail: 'Generar thumbnails'
  },

  // CDN
  cloudfront: {
    distribution: 'dxxxxx.cloudfront.net',
    // Cacheo automático
  }
};
```

### 7.6 Google APIs

```typescript
const googleIntegration = {
  // Maps
  maps: {
    geocoding: 'Convertir dirección a coordenadas',
    reverseGeocoding: 'Coordenadas a dirección',
    places: 'Autocompletado de direcciones',
    distanceMatrix: 'Calcular distancias'
  },

  // Calendar
  calendar: {
    oauth: 'Conectar cuenta de Google',
    createEvent: 'Crear evento en calendario',
    updateEvent: 'Actualizar evento',
    deleteEvent: 'Eliminar evento',
    sync: 'Sincronización bidireccional'
  },

  // Auth
  auth: {
    verifyIdToken: 'Verificar token de Google Sign-In'
  }
};
```

---

## 8. WebSockets - Tiempo Real

### 8.1 Arquitectura

```typescript
// Socket.io con Redis Adapter para escalar
const socketConfig = {
  adapter: '@socket.io/redis-adapter',

  // Namespaces
  namespaces: {
    '/client': 'App cliente',
    '/business': 'App negocio'
  },

  // Rooms
  rooms: {
    user: 'user:{userId}',           // Notificaciones personales
    business: 'business:{businessId}', // Updates del negocio
    appointment: 'appointment:{appointmentId}'  // Updates de turno específico
  }
};
```

### 8.2 Eventos

```typescript
// Eventos del servidor → cliente
const serverEvents = {
  // Para app cliente
  client: {
    'appointment:confirmed': 'Turno confirmado',
    'appointment:cancelled': 'Turno cancelado',
    'appointment:rescheduled': 'Turno reprogramado',
    'appointment:reminder': 'Recordatorio',
    'waitlist:available': 'Turno disponible en lista de espera',
    'notification:new': 'Nueva notificación'
  },

  // Para app negocio
  business: {
    'appointment:new': 'Nuevo turno',
    'appointment:cancelled': 'Turno cancelado por cliente',
    'appointment:updated': 'Turno modificado',
    'client:checkin': 'Cliente llegó',
    'calendar:refresh': 'Refrescar calendario',
    'notification:new': 'Nueva notificación'
  }
};

// Eventos del cliente → servidor
const clientEvents = {
  'subscribe:business': 'Suscribirse a updates del negocio',
  'unsubscribe:business': 'Desuscribirse',
  'typing:start': 'Empezó a escribir (chat)',
  'typing:stop': 'Dejó de escribir'
};
```

---

## 9. Testing

### 9.1 Estrategia de Testing

```
                    ┌─────────────────┐
                    │    E2E Tests    │  ← 10%
                    │   (Detox/Maestro)│
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │ Integration     │  ← 30%
                    │ Tests (API)     │
                    └────────┬────────┘
                             │
           ┌─────────────────┼─────────────────┐
           │                 │                 │
    ┌──────▼──────┐   ┌──────▼──────┐   ┌──────▼──────┐
    │ Unit Tests  │   │ Unit Tests  │   │ Unit Tests  │  ← 60%
    │  (Backend)  │   │ (Frontend)  │   │  (Shared)   │
    └─────────────┘   └─────────────┘   └─────────────┘
```

### 9.2 Backend Testing

```typescript
// Jest + Supertest
const backendTests = {
  unit: {
    services: 'Lógica de negocio',
    validators: 'Validación de schemas',
    utils: 'Funciones utilitarias'
  },

  integration: {
    api: 'Endpoints completos',
    database: 'Operaciones de BD',
    external: 'Integraciones (mocked)'
  },

  // Cobertura mínima
  coverage: {
    statements: 80,
    branches: 75,
    functions: 80,
    lines: 80
  }
};

// Ejemplo de test
describe('BookingService', () => {
  describe('createBooking', () => {
    it('should create a booking with valid data', async () => {});
    it('should throw when slot is not available', async () => {});
    it('should throw when business is closed', async () => {});
    it('should apply discount code correctly', async () => {});
    it('should send confirmation notification', async () => {});
  });
});
```

### 9.3 Frontend Testing

```typescript
// React Native Testing Library + Jest
const frontendTests = {
  unit: {
    hooks: 'Custom hooks',
    utils: 'Funciones utilitarias',
    stores: 'Estado global (Zustand)'
  },

  component: {
    rendering: 'Renderizado correcto',
    interactions: 'Eventos de usuario',
    states: 'Estados del componente'
  },

  integration: {
    screens: 'Flujos de pantalla',
    navigation: 'Navegación'
  }
};
```

### 9.4 E2E Testing

```typescript
// Detox para React Native
const e2eTests = {
  flows: {
    auth: ['login', 'register', 'logout', 'password-reset'],
    booking: ['search', 'select-service', 'select-time', 'confirm', 'cancel'],
    profile: ['view', 'edit', 'payment-methods'],
    business: ['dashboard', 'calendar', 'create-appointment', 'checkout']
  }
};
```

---

## 10. DevOps y Deployment

### 10.1 Environments

```
┌─────────────────────────────────────────────────────────────┐
│                      ENVIRONMENTS                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Development    →    Staging    →    Production             │
│  (local)             (testing)       (live)                 │
│                                                              │
│  - Docker local     - AWS/DO        - AWS/DO                │
│  - MongoDB local    - Replica       - Replica Set           │
│  - Redis local      - Redis         - Redis Cluster         │
│                     - Sandbox APIs   - Production APIs      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 10.2 CI/CD Pipeline

```yaml
# GitHub Actions
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  # Backend
  api-test:
    runs-on: ubuntu-latest
    steps:
      - Checkout
      - Setup Node.js
      - Install dependencies
      - Run linter
      - Run tests
      - Upload coverage

  api-build:
    needs: api-test
    steps:
      - Build Docker image
      - Push to registry

  api-deploy:
    needs: api-build
    if: github.ref == 'refs/heads/main'
    steps:
      - Deploy to production
      - Run migrations
      - Health check

  # Mobile
  mobile-test:
    runs-on: macos-latest
    steps:
      - Checkout
      - Setup Node.js
      - Install dependencies
      - Run linter
      - Run tests

  mobile-build-android:
    needs: mobile-test
    steps:
      - Setup Java
      - Build APK/AAB
      - Upload to Play Store (internal track)

  mobile-build-ios:
    needs: mobile-test
    steps:
      - Setup Xcode
      - Build IPA
      - Upload to TestFlight
```

### 10.3 Infrastructure as Code

```yaml
# Docker Compose (desarrollo)
version: '3.8'
services:
  api:
    build: ./apps/api
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
      - MONGODB_URI=mongodb://mongo:27017/turnofacil
      - REDIS_URL=redis://redis:6379
    depends_on:
      - mongo
      - redis

  mongo:
    image: mongo:7
    volumes:
      - mongo_data:/data/db
    ports:
      - "27017:27017"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  worker:
    build: ./apps/api
    command: npm run worker
    environment:
      - NODE_ENV=development
    depends_on:
      - mongo
      - redis

volumes:
  mongo_data:
```

### 10.4 Monitoreo

```typescript
const monitoring = {
  // APM
  apm: {
    tool: 'Datadog / New Relic / Sentry',
    metrics: [
      'Response time',
      'Error rate',
      'Throughput',
      'Database performance'
    ]
  },

  // Logging
  logging: {
    tool: 'Winston + CloudWatch / Papertrail',
    levels: ['error', 'warn', 'info', 'debug'],
    format: 'JSON structured logging'
  },

  // Alertas
  alerts: {
    errorRateHigh: '> 1% en 5 min',
    responseTimeSlow: '> 2s p95',
    serverDown: 'Health check failed',
    diskUsageHigh: '> 80%',
    memoryUsageHigh: '> 85%'
  },

  // Uptime
  uptime: {
    tool: 'UptimeRobot / Pingdom',
    endpoints: ['/health', '/api/v1/status'],
    interval: '1 min'
  }
};
```

---

## 11. Plan de Desarrollo por Fases

### Fase 1: Fundamentos (Semanas 1-3)

```
Backend:
├── Setup del proyecto (monorepo, TypeScript, ESLint, Prettier)
├── Configuración de Docker y docker-compose
├── Conexión a MongoDB y Redis
├── Sistema de autenticación completo
│   ├── Registro/Login email
│   ├── Login con teléfono (OTP)
│   ├── Social login (Google, Facebook, Apple)
│   ├── JWT con refresh tokens
│   └── Middleware de autenticación
├── Modelos base (Users, BusinessUsers, Businesses)
├── Sistema de permisos y roles
└── Estructura de API base

Mobile (ambas apps):
├── Setup React Native con TypeScript
├── Configuración de navegación
├── Setup de estado global (Zustand)
├── Configuración de React Query
├── Tema y componentes UI base
├── Pantallas de autenticación
│   ├── Login
│   ├── Registro
│   ├── Verificación OTP
│   └── Social login
└── Setup de notificaciones push (FCM)
```

### Fase 2: Core del Negocio (Semanas 4-7)

```
Backend:
├── Modelos completos (Staff, Services, Appointments)
├── CRUD de negocios
├── CRUD de servicios y categorías
├── CRUD de staff
├── Sistema de horarios y disponibilidad
├── Motor de reservas
│   ├── Verificación de disponibilidad
│   ├── Creación de turnos
│   ├── Gestión de conflictos
│   └── Cancelaciones y reprogramaciones
├── Sistema de notificaciones base
│   ├── Confirmación de turno
│   ├── Recordatorios
│   └── Cancelaciones
└── WebSockets para tiempo real

Mobile Business:
├── Onboarding del negocio
├── Dashboard principal
├── Calendario/Agenda
│   ├── Vista día/semana/mes
│   ├── Drag & drop
│   └── Filtros
├── Gestión de servicios
├── Gestión de staff
└── Gestión de turnos
    ├── Crear/editar/cancelar
    ├── Estados del turno
    └── Notas

Mobile Cliente:
├── Home/Exploración
│   ├── Búsqueda de negocios
│   ├── Filtros
│   └── Mapa
├── Perfil del negocio
├── Flujo de reserva completo
├── Mis turnos
│   ├── Próximos
│   ├── Pasados
│   └── Cancelados
└── Favoritos
```

### Fase 3: Clientes y Relaciones (Semanas 8-9)

```
Backend:
├── Sistema de clientes por negocio
├── Historial y estadísticas de clientes
├── Segmentación de clientes
├── Notas y preferencias
├── Sistema de bloqueo
└── Lista VIP

Mobile Business:
├── Lista de clientes
├── Perfil de cliente detallado
├── Historial de turnos por cliente
├── Segmentación y filtros
├── Notas y preferencias
└── Acciones (bloquear, VIP, mensaje)

Mobile Cliente:
├── Perfil de usuario completo
├── Preferencias
└── Historial personal
```

### Fase 4: Pagos y Finanzas (Semanas 10-12)

```
Backend:
├── Integración Mercado Pago
│   ├── Pagos únicos
│   ├── Depósitos/señas
│   └── Reembolsos
├── Sistema de transacciones
├── Reportes financieros
├── Cierre de caja
├── Gastos del negocio
└── Webhooks de pago

Mobile Business:
├── Dashboard financiero
├── Lista de transacciones
├── Reportes
│   ├── Diario
│   ├── Semanal
│   ├── Mensual
│   └── Por servicio/staff
├── Registro de gastos
├── Punto de venta
│   ├── Checkout
│   ├── Descuentos
│   ├── Propinas
│   └── Recibos
└── Exportación de datos

Mobile Cliente:
├── Métodos de pago
├── Historial de pagos
└── Recibos digitales
```

### Fase 5: Reviews y Marketing (Semanas 13-15)

```
Backend:
├── Sistema de reviews
│   ├── Creación con verificación
│   ├── Respuestas del negocio
│   ├── Moderación
│   └── Estadísticas
├── Promociones y descuentos
├── Sistema de campañas
├── Notificaciones automáticas avanzadas
│   ├── Cliente inactivo
│   ├── Cumpleaños
│   └── Personalizadas
└── Lista de espera

Mobile Business:
├── Gestión de reviews
├── Crear promociones
├── Crear campañas
├── Configuración de notificaciones
└── Lista de espera

Mobile Cliente:
├── Ver y escribir reviews
├── Mis promociones
├── Notificaciones de ofertas
└── Anotarse en lista de espera
```

### Fase 6: Analytics y Optimización (Semanas 16-17)

```
Backend:
├── Métricas de ocupación
├── Métricas de clientes
├── Métricas de servicios
├── Métricas de staff
├── Tendencias y proyecciones
└── Análisis predictivo básico

Mobile Business:
├── Dashboard de analytics
├── Gráficos interactivos
├── Reportes detallados
├── Comparativas
└── Recomendaciones
```

### Fase 7: Integraciones y Pulido (Semanas 18-20)

```
Backend:
├── Google Calendar sync
├── WhatsApp Business API
├── Optimización de queries
├── Caché avanzado
└── Rate limiting refinado

Mobile (ambas):
├── Modo offline
├── Deep linking
├── Optimización de performance
├── Accesibilidad
├── Animaciones y pulido UI
└── Manejo de errores mejorado

General:
├── Testing E2E completo
├── Documentación API
├── Documentación de usuario
└── Preparación para producción
```

### Fase 8: Launch (Semanas 21-22)

```
├── Beta testing cerrado
├── Corrección de bugs
├── Optimización final
├── Setup de producción completo
├── Monitoreo y alertas
├── Publicación en stores
│   ├── Google Play
│   └── App Store
└── Documentación de soporte
```

---

## Notas Finales

### Principios de Desarrollo
1. **Mobile-first**: Diseñar primero para móvil
2. **Offline-first**: La app debe funcionar sin conexión
3. **Security-first**: Seguridad desde el diseño
4. **Performance**: Optimizar para dispositivos de gama media
5. **Escalabilidad**: Arquitectura preparada para crecer

### Métricas de Calidad
- Tiempo de carga inicial: < 3 segundos
- Time to interactive: < 5 segundos
- Crash rate: < 0.1%
- API response time p95: < 500ms
- Test coverage: > 80%

### Consideraciones de UX
- Flujos de máximo 3-4 pasos
- Feedback visual inmediato
- Mensajes de error claros y accionables
- Estados de carga siempre visibles
- Acciones críticas con confirmación

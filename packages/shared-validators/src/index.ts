/**
 * TurnoFácil Shared Validators
 *
 * This package contains all shared Zod validation schemas used across
 * the TurnoFácil platform (API, mobile-business, mobile-client).
 *
 * All validators include Spanish error messages for better UX.
 */

// Re-export zod for convenience
export { z } from 'zod';

// Auth validators
export * from './auth';

// User validators
export * from './user';

// Business validators
export * from './business';

// Service validators
export * from './service';

// Staff validators
export * from './staff';

// Appointment validators
export * from './appointment';

// Review validators
export * from './review';

// Waitlist validators
export * from './waitlist';

// Promotion validators
export * from './promotion';

// Transaction validators
export * from './transaction';

// Client validators
export * from './client';

// Campaign validators
export * from './campaign';

/**
 * Review Types - Shared types for reviews
 */

export type ModerationStatus = 'pending' | 'approved' | 'rejected' | 'flagged';
export type ReviewStatus = 'active' | 'hidden' | 'deleted';

export interface ReviewRatings {
  overall: number; // 1-5
  service?: number;
  staff?: number;
  cleanliness?: number;
  value?: number;
}

export interface ReviewContent {
  text: string;
  photos?: string[];
  services?: string[];
}

export interface ReviewResponse {
  text: string;
  respondedAt: string;
  respondedBy: string;
}

export interface ReviewModeration {
  status: ModerationStatus;
  reviewedAt?: string;
  reviewedBy?: string;
  reason?: string;
}

export interface Review {
  _id: string;
  businessId: string;
  appointmentId: string;
  clientId: string;
  staffId?: string;
  ratings: ReviewRatings;
  content: ReviewContent;
  response?: ReviewResponse;
  isVerified: boolean;
  moderation: ReviewModeration;
  helpfulVotes: number;
  reportCount: number;
  status: ReviewStatus;
  createdAt: string;
  updatedAt: string;
  // Populated fields
  client?: {
    _id: string;
    profile: {
      firstName: string;
      lastName: string;
      avatar?: string;
    };
  };
  staff?: {
    _id: string;
    profile: {
      firstName: string;
      lastName: string;
    };
  };
  business?: {
    _id: string;
    name: string;
    slug: string;
  };
}

// API Request Types
export interface CreateReviewRequest {
  appointmentId: string;
  ratings: ReviewRatings;
  content: {
    text: string;
    photos?: string[];
  };
}

export interface UpdateReviewRequest {
  ratings?: Partial<ReviewRatings>;
  content?: {
    text?: string;
    photos?: string[];
  };
}

export interface RespondToReviewRequest {
  text: string;
}

export interface ReportReviewRequest {
  reason: string;
}

// Business-side types
export interface ReviewWithDetails extends Review {
  appointment?: {
    _id: string;
    date: string;
    services: Array<{ name: string }>;
  };
}

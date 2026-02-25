import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IRatings {
  overall: number;
  service: number;
  staff: number;
  cleanliness: number;
  value: number;
}

export interface IReviewContent {
  text?: string;
  photos: string[];
  services: string[];
}

export interface IReviewResponse {
  text: string;
  respondedAt: Date;
  respondedBy: mongoose.Types.ObjectId;
}

export interface IReviewModeration {
  status: 'pending' | 'approved' | 'rejected' | 'flagged';
  reviewedAt?: Date;
  reviewedBy?: mongoose.Types.ObjectId;
  reason?: string;
}

export interface IReview extends Document {
  _id: mongoose.Types.ObjectId;
  businessId: mongoose.Types.ObjectId;
  appointmentId: mongoose.Types.ObjectId;
  clientId: mongoose.Types.ObjectId;
  staffId?: mongoose.Types.ObjectId;
  ratings: IRatings;
  content: IReviewContent;
  response?: IReviewResponse;
  isVerified: boolean;
  moderation: IReviewModeration;
  helpfulVotes: number;
  reportCount: number;
  status: 'active' | 'hidden' | 'deleted';
  createdAt: Date;
  updatedAt: Date;
}

export interface IReviewModel extends Model<IReview> {
  findByBusiness(businessId: string, limit?: number): Promise<IReview[]>;
  getAverageRating(businessId: string): Promise<number>;
}

const reviewSchema = new Schema<IReview, IReviewModel>(
  {
    businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    appointmentId: { type: Schema.Types.ObjectId, ref: 'Appointment', required: true, unique: true },
    clientId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    staffId: { type: Schema.Types.ObjectId, ref: 'Staff', index: true },
    ratings: {
      overall: { type: Number, required: true, min: 1, max: 5 },
      service: { type: Number, min: 1, max: 5 },
      staff: { type: Number, min: 1, max: 5 },
      cleanliness: { type: Number, min: 1, max: 5 },
      value: { type: Number, min: 1, max: 5 },
    },
    content: {
      text: { type: String, maxlength: 1000 },
      photos: { type: [String], default: [] },
      services: { type: [String], default: [] },
    },
    response: {
      text: String,
      respondedAt: Date,
      respondedBy: { type: Schema.Types.ObjectId, ref: 'BusinessUser' },
    },
    isVerified: { type: Boolean, default: true },
    moderation: {
      status: { type: String, enum: ['pending', 'approved', 'rejected', 'flagged'], default: 'approved' },
      reviewedAt: Date,
      reviewedBy: Schema.Types.ObjectId,
      reason: String,
    },
    helpfulVotes: { type: Number, default: 0 },
    reportCount: { type: Number, default: 0 },
    status: { type: String, enum: ['active', 'hidden', 'deleted'], default: 'active', index: true },
  },
  { timestamps: true }
);

reviewSchema.index({ businessId: 1, status: 1, createdAt: -1 });
reviewSchema.index({ businessId: 1, staffId: 1 });
reviewSchema.index({ 'ratings.overall': -1 });

reviewSchema.statics.findByBusiness = function (businessId: string, limit = 20): Promise<IReview[]> {
  return this.find({ businessId, status: 'active', 'moderation.status': 'approved' })
    .populate('clientId', 'profile.firstName profile.avatar')
    .sort({ createdAt: -1 })
    .limit(limit);
};

reviewSchema.statics.getAverageRating = async function (businessId: string): Promise<number> {
  const result = await this.aggregate([
    { $match: { businessId: new mongoose.Types.ObjectId(businessId), status: 'active' } },
    { $group: { _id: null, avgRating: { $avg: '$ratings.overall' } } },
  ]);
  return result[0]?.avgRating || 0;
};

export const Review = (mongoose.models.Review as IReviewModel) || mongoose.model<IReview, IReviewModel>('Review', reviewSchema);

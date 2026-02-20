import mongoose from 'mongoose';
import { User } from '../../../infrastructure/database/mongodb/models/User.js';
import { Business } from '../../../infrastructure/database/mongodb/models/Business.js';
import { NotFoundError, BadRequestError } from '../../../presentation/middleware/errorHandler.js';
import { logger } from '../../../utils/logger.js';

export interface RemoveTeamMemberInput {
  businessId: string;
  memberId: string;
  requestUserId: string;
  requestUserRole: string;
}

export async function removeTeamMember(input: RemoveTeamMemberInput): Promise<void> {
  const { businessId, memberId, requestUserId, requestUserRole } = input;

  const business = await Business.findById(businessId);
  if (!business) {
    throw new NotFoundError('Business not found');
  }

  // Check if trying to remove owner
  if (business.ownerId.toString() === memberId) {
    throw new BadRequestError('Cannot remove owner from team');
  }

  // Check if trying to remove self
  if (requestUserId === memberId && requestUserRole !== 'owner') {
    throw new BadRequestError('Cannot remove yourself from team');
  }

  // Remove member
  business.team = business.team?.filter(
    (m: { userId: mongoose.Types.ObjectId }) => m.userId.toString() !== memberId
  );
  await business.save();

  // Remove business from user's businesses array
  await User.findByIdAndUpdate(memberId, {
    $pull: { businesses: { businessId: new mongoose.Types.ObjectId(businessId) } },
  });

  logger.info('Team member removed', {
    businessId,
    memberId,
    removedBy: requestUserId,
  });
}
